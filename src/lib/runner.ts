import * as fs   from "fs"
import * as path from "path"
import * as cp   from "child_process"
import Anthropic from "@anthropic-ai/sdk"
import type {
  Project, SpecFile, SubPromptDef, SubPromptResult,
  ExecutionLog, StreamEvent,
} from "@/types"
import { saveLog } from "./logs"

export async function* runSpec(
  project:   Project,
  spec:      SpecFile,
  fromSpId?: string,
  onlySpId?: string,
): AsyncGenerator<StreamEvent> {
  const appDir  = path.resolve(project.appDir)
  const logsDir = path.resolve(project.logsDir)
  const model   = process.env.AIDLC_MODEL ?? project.model

  const log: ExecutionLog = {
    id:              spec.id + "-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
    projectId:       project.id,
    unitId:          spec.id,
    unitTitle:       spec.title,
    specFile:        spec.filePath,
    specVersion:     spec.version,
    timestamp:       new Date().toISOString(),
    status:          "in_progress",
    durationMs:      0,
    subPrompts:      [],
    finalValidation: [],
    gitStateBeforeRun: captureGitState(appDir),
  }

  const startTime = Date.now()
  yield { type: "log", message: "Starting " + spec.id + " - " + spec.title }
  yield { type: "log", message: "App dir: " + appDir }
  yield { type: "log", message: "Model: " + model }

  let toRun = spec.subPrompts
  if (onlySpId) toRun = spec.subPrompts.filter(sp => sp.id === onlySpId)
  if (fromSpId) {
    const idx = spec.subPrompts.findIndex(sp => sp.id === fromSpId)
    if (idx >= 0) toRun = spec.subPrompts.slice(idx)
  }

  for (const sp of toRun) {
    yield { type: "sp_start", message: "Running " + sp.id + ": " + sp.name, spId: sp.id, spName: sp.name }

    const spResult = await executeSubPrompt(spec, sp, project, appDir, model)
    log.subPrompts.push(spResult)

    if (spResult.status === "failed") {
      yield { type: "sp_fail", message: sp.id + " failed: " + (spResult.error ?? ""), spId: sp.id }
      log.status    = "failed"
      log.durationMs = Date.now() - startTime
      log.error     = "Failed at " + sp.id + ": " + spResult.error
      saveLog(logsDir, log)
      yield { type: "error", message: "Execution failed at " + sp.id }
      return
    }

    yield { type: "sp_pass", message: sp.id + " passed (" + Math.round(spResult.durationMs / 1000) + "s)", spId: sp.id }
  }

  log.status    = "passed"
  log.durationMs = Date.now() - startTime
  saveLog(logsDir, log)
  yield { type: "done", message: spec.id + " complete in " + Math.round(log.durationMs / 1000) + "s" }
}

async function executeSubPrompt(
  spec:    SpecFile,
  sp:      SubPromptDef,
  project: Project,
  appDir:  string,
  model:   string,
): Promise<SubPromptResult> {
  const start  = Date.now()
  const result: SubPromptResult = {
    id: sp.id, name: sp.name, status: "pending", durationMs: 0,
    tokens: { input: 0, output: 0 }, filesWritten: [], commandsRun: [], validation: [],
  }

  try {
    // Step 1: Build prompt and call Claude
    const prompt = buildPrompt(spec, sp, project, appDir)
    const { response, tokens } = await callClaude(prompt, model)
    result.tokens = tokens

    // Step 2: Write all files first
    const parsed = parseClaudeResponse(response)
    for (const file of parsed.files) {
      const fullPath = path.resolve(appDir, file.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, file.content, "utf-8")
      result.filesWritten.push(file.path)
    }

    // Step 3: Run commands AFTER files are written
    // Filter out validation commands — those run separately below
    const VALIDATION_CMDS = ["npm run typecheck", "npm run lint", "npm run test", "npm run build"]
    const setupCommands = parsed.commands.filter(cmd =>
      !VALIDATION_CMDS.some(v => cmd.trim().startsWith(v.trim()))
    )

    for (const cmd of setupCommands) {
      const res = runCommand(cmd, appDir)
      result.commandsRun.push(cmd)
      if (!res.success) {
        // For npm install failures, include output but don't fail immediately
        // if files were written — it may be a workspace issue
        if (cmd.includes("npm install") && result.filesWritten.length > 0) {
          // Try npm install with legacy peer deps as fallback
          const fallback = runCommand(cmd + " --legacy-peer-deps", appDir)
          if (!fallback.success) {
            throw new Error("Command failed: " + cmd + "\n" + res.output + "\n" + fallback.output)
          }
        } else {
          throw new Error("Command failed: " + cmd + "\n" + res.output)
        }
      }
    }

    // Step 4: Run validation commands from project config
    // Only run if there are validation commands configured
    const validationCmds = project.validation?.afterEachSubPrompt ?? []
    if (validationCmds.length > 0) {
      const validations = validationCmds.map(cmd => {
        const res = runCommand(cmd, appDir)
        return { command: cmd, passed: res.success, output: res.output }
      })
      result.validation = validations

      const failed = validations.filter(v => !v.passed)
      if (failed.length > 0) {
        throw new Error(
          "Validation failed:\n" +
          failed.map(v => v.command + ":\n" + v.output.slice(0, 500)).join("\n\n")
        )
      }
    }

    result.status    = "passed"
    result.durationMs = Date.now() - start

  } catch (err: unknown) {
    result.status    = "failed"
    result.durationMs = Date.now() - start
    result.error     = err instanceof Error ? err.message : String(err)
  }

  return result
}

function buildPrompt(spec: SpecFile, sp: SubPromptDef, project: Project, appDir: string): string {
  const filetree    = getFiletree(appDir)
  const constraints = project.constraints.map(c => "- " + c).join("\n")

  return [
    "You are implementing a unit of work in a spec-driven AI-DLC project.",
    "",
    "PROJECT CONTEXT:",
    project.projectContext,
    "",
    "FULL SPEC:",
    spec.rawContent,
    "",
    "CURRENT SUB-PROMPT: " + sp.id + ": " + sp.name,
    sp.body,
    "",
    "ACCEPTANCE CRITERIA FOR THIS SUB-PROMPT:",
    sp.criteria.join("\n"),
    "",
    "CURRENT CODEBASE STATE (files already in app directory):",
    filetree,
    "",
    "CONSTRAINTS (never violate):",
    constraints,
    "",
    "OUTPUT FORMAT:",
    "Respond with a valid JSON object only. No markdown fences. No explanation outside the JSON.",
    '{',
    '  "files": [',
    '    { "path": "relative/path/from/appDir/file.ts", "content": "complete file content here" }',
    '  ],',
    '  "commands": ["npm install"],',
    '  "notes": "Brief implementation notes"',
    '}',
    "",
    "IMPORTANT:",
    "- All file paths are relative to the application directory root",
    "- Include COMPLETE file content for every file — no truncation, no ellipsis",
    "- Only include setup commands (npm install, etc.) — NOT validation commands like npm run test",
    "- Write ALL files before any npm install commands are needed",
    "- If running npm install, it will run AFTER all files are written",
  ].join("\n")
}

async function callClaude(prompt: string, model: string) {
  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  })
  const text = message.content.find(b => b.type === "text")?.text ?? ""
  return {
    response: text,
    tokens: {
      input:  message.usage.input_tokens,
      output: message.usage.output_tokens,
    },
  }
}

function parseClaudeResponse(response: string): { files: {path:string;content:string}[]; commands: string[]; notes: string } {
  const cleaned = response
    .replace(/^```json\n?/, "")
    .replace(/\n?```$/, "")
    .trim()
  try {
    const p = JSON.parse(cleaned)
    return {
      files:    Array.isArray(p.files)    ? p.files    : [],
      commands: Array.isArray(p.commands) ? p.commands : [],
      notes:    typeof p.notes === "string" ? p.notes  : "",
    }
  } catch {
    console.error("Failed to parse Claude response as JSON:", cleaned.slice(0, 200))
    return { files: [], commands: [], notes: "parse-error" }
  }
}

function runCommand(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = cp.execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout:  180_000,  // 3 min for npm install
      stdio:    "pipe",
      env:      { ...process.env, NODE_ENV: "development" },
    })
    return { success: true, output: output ?? "" }
  } catch (err: unknown) {
    if (err && typeof err === "object" && ("stdout" in err || "stderr" in err)) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n")
      return { success: false, output }
    }
    return { success: false, output: String(err) }
  }
}

function getFiletree(dir: string, depth = 3, prefix = ""): string {
  if (!fs.existsSync(dir)) return "(app directory does not exist yet)"
  const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage"])
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !SKIP.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  return entries.map((entry, i) => {
    const last    = i === entries.length - 1
    const pointer = last ? "L-- " : "|-- "
    const line    = prefix + pointer + entry.name
    if (entry.isDirectory() && depth > 0) {
      const next = prefix + (last ? "    " : "|   ")
      return line + "\n" + getFiletree(path.join(dir, entry.name), depth - 1, next)
    }
    return line
  }).join("\n")
}

function captureGitState(appDir: string): string | undefined {
  try {
    return cp.execSync("git rev-parse HEAD", {
      cwd:      appDir,
      encoding: "utf-8",
      stdio:    "pipe",
    }).trim()
  } catch {
    return undefined
  }
}
