import * as fs   from "fs"
import * as path from "path"
import * as cp   from "child_process"
import Anthropic from "@anthropic-ai/sdk"
import type {
  Project, SpecFile, SubPromptDef, SubPromptResult,
  ExecutionLog, StreamEvent,
} from "@/types"
import { saveLog } from "./logs"
import { resolvePath } from "./projects"

const DEFAULT_MAX_TOKENS = 8192

export async function* runSpec(
  project:   Project,
  spec:      SpecFile,
  fromSpId?: string,
  onlySpId?: string,
  dryRun = false,
): AsyncGenerator<StreamEvent> {
  const appDir  = resolvePath(project.appDir)
  const logsDir = resolvePath(project.logsDir)
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
    const spResult = await executeSubPrompt(spec, sp, project, appDir, model, dryRun)
    log.subPrompts.push(spResult)

    if (spResult.status === "failed") {
      yield { type: "sp_fail", message: sp.id + " failed: " + (spResult.error ?? ""), spId: sp.id }
      log.status     = "failed"
      log.durationMs = Date.now() - startTime
      log.error      = "Failed at " + sp.id + ": " + spResult.error
      if (!dryRun) saveLog(logsDir, log)
      yield { type: "error", message: "Execution failed at " + sp.id }
      return
    }

    yield { type: "sp_pass", message: sp.id + " passed (" + Math.round(spResult.durationMs / 1000) + "s)", spId: sp.id }
  }

  log.status     = "passed"
  log.durationMs = Date.now() - startTime
  if (!dryRun) saveLog(logsDir, log)
  yield { type: "done", message: spec.id + " complete in " + Math.round(log.durationMs / 1000) + "s" }
}

async function executeSubPrompt(
  spec:    SpecFile,
  sp:      SubPromptDef,
  project: Project,
  appDir:  string,
  model:   string,
  dryRun = false,
): Promise<SubPromptResult> {
  const start  = Date.now()
  const result: SubPromptResult = {
    id: sp.id, name: sp.name, status: "pending", durationMs: 0,
    tokens: { input: 0, output: 0 }, filesWritten: [], commandsRun: [], validation: [],
  }

  try {
    if (dryRun) {
      result.status     = "passed"
      result.durationMs = Date.now() - start
      return result
    }

    const filesToWrite = extractFilePaths(sp.body)

    if (filesToWrite.length === 0) {
      const { filesWritten, tokens } = await singleCallApproach(spec, sp, project, appDir, model)
      result.filesWritten = filesWritten
      result.tokens       = tokens
    } else {
      let totalInput = 0, totalOutput = 0
      for (const filePath of filesToWrite) {
        const { content, tokens, truncated } = await writeOneFile(spec, sp, project, appDir, model, filePath)
        totalInput  += tokens.input
        totalOutput += tokens.output
        if (truncated) throw new Error(
          "Response truncated writing " + filePath + ". Hit max_tokens (" + getMaxTokens(project) + "). Split this SP into smaller pieces."
        )
        if (!content.trim()) throw new Error("Claude returned empty content for " + filePath)
        const fullPath = path.resolve(appDir, filePath)
        fs.mkdirSync(path.dirname(fullPath), { recursive: true })
        fs.writeFileSync(fullPath, content, "utf-8")
        result.filesWritten.push(filePath)
      }
      result.tokens = { input: totalInput, output: totalOutput }
    }

    const VALIDATION_CMDS = ["npm run typecheck", "npm run lint", "npm run test", "npm run build"]
    for (const cmd of extractSetupCommands(sp.body)) {
      if (VALIDATION_CMDS.some(v => cmd.trim().startsWith(v.trim()))) continue
      const res = runCommand(cmd, appDir)
      result.commandsRun.push(cmd)
      if (!res.success) {
        if (cmd.includes("npm install")) {
          const fb = runCommand(cmd + " --legacy-peer-deps", appDir)
          if (!fb.success) throw new Error("Command failed: " + cmd + "\n" + res.output)
        } else throw new Error("Command failed: " + cmd + "\n" + res.output)
      }
    }

    const validationCmds = project.validation?.afterEachSubPrompt ?? []
    if (validationCmds.length > 0) {
      const validations = validationCmds.map((cmd: string) => {
        const res = runCommand(cmd, appDir)
        return { command: cmd, passed: res.success, status: res.success ? "passed" as const : "failed" as const, output: res.output }
      })
      result.validation = validations
      const failed = validations.filter((v: { passed: boolean }) => !v.passed)
      if (failed.length > 0) throw new Error(
        "Validation failed:\n" + failed.map((v: { command: string; output: string }) => v.command + ":\n" + v.output.slice(0, 500)).join("\n\n")
      )
    }

    result.status     = "passed"
    result.durationMs = Date.now() - start
  } catch (err: unknown) {
    result.status     = "failed"
    result.durationMs = Date.now() - start
    result.error      = err instanceof Error ? err.message : String(err)
  }
  return result
}

async function writeOneFile(
  spec: SpecFile, sp: SubPromptDef, project: Project,
  appDir: string, model: string, filePath: string,
): Promise<{ content: string; tokens: { input: number; output: number }; truncated: boolean }> {
  const maxTokens     = getMaxTokens(project)
  const existingFiles = getExistingFileContents(sp.body, appDir)
  const constraints   = project.constraints.map((c: string) => "- " + c).join("\n")
  const fullPath      = path.resolve(appDir, filePath)
  const isModify      = fs.existsSync(fullPath)
  const currentContent = isModify ? fs.readFileSync(fullPath, "utf-8") : null

  const prompt = [
    "You are implementing one specific file in a spec-driven AI-DLC project.",
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
    "YOUR TASK: Write the complete content for this single file: " + filePath,
    isModify
      ? "This file EXISTS. Preserve all existing logic. Only add/change what the SP requires."
      : "This is a NEW file. Write the complete implementation.",
    "",
    isModify && currentContent ? "CURRENT FILE CONTENT:\n--- " + filePath + " ---\n" + currentContent + "\n--- end ---\n" : "",
    existingFiles.filter(f => f.path !== filePath).length > 0
      ? "OTHER RELEVANT FILES:\n" + existingFiles.filter(f => f.path !== filePath).map(f => "--- " + f.path + " ---\n" + f.content + "\n--- end ---").join("\n\n")
      : "",
    "CODEBASE STRUCTURE:",
    getFiletree(appDir),
    "",
    "CONSTRAINTS:",
    constraints,
    "",
    "OUTPUT: Raw file content only. No JSON. No markdown fences. No explanation.",
    "Write the COMPLETE file. Never import unused variables. Strict TypeScript.",
  ].filter(Boolean).join("\n")

  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  const content = message.content.find(b => b.type === "text")?.text ?? ""
  return { content, tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens }, truncated: message.usage.output_tokens >= maxTokens }
}

async function singleCallApproach(
  spec: SpecFile, sp: SubPromptDef, project: Project, appDir: string, model: string,
): Promise<{ filesWritten: string[]; tokens: { input: number; output: number } }> {
  const maxTokens     = getMaxTokens(project)
  const existingFiles = getExistingFileContents(sp.body, appDir)
  const constraints   = project.constraints.map((c: string) => "- " + c).join("\n")

  const prompt = [
    "You are implementing a unit of work in a spec-driven AI-DLC project.",
    "PROJECT CONTEXT:", project.projectContext, "",
    "FULL SPEC:", spec.rawContent, "",
    "CURRENT SUB-PROMPT: " + sp.id + ": " + sp.name, sp.body, "",
    existingFiles.length > 0 ? "EXISTING FILES:\n" + existingFiles.map(f => "--- " + f.path + " ---\n" + f.content + "\n--- end ---").join("\n\n") : "",
    "CODEBASE:", getFiletree(appDir), "",
    "CONSTRAINTS:", constraints, "",
    'OUTPUT: Valid JSON only. No markdown. { "files": [{ "path": "...", "content": "..." }], "commands": [], "notes": "" }',
    "CRITICAL: Complete file content. No unused imports. Strict TypeScript.",
  ].filter(Boolean).join("\n")

  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await client.messages.create({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  const text    = message.content.find(b => b.type === "text")?.text ?? ""

  if (message.usage.output_tokens >= maxTokens) throw new Error(
    "Response truncated in single-call fallback. Add explicit file paths to SP body so one-file-per-call is used."
  )

  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
  let parsed: { files?: { path: string; content: string }[] } = { files: [] }
  try { parsed = JSON.parse(cleaned) } catch { /* empty */ }

  const filesWritten: string[] = []
  for (const file of parsed.files ?? []) {
    const fullPath = path.resolve(appDir, file.path)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, file.content, "utf-8")
    filesWritten.push(file.path)
  }
  return { filesWritten, tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens } }
}

function getMaxTokens(project: Project): number {
  if (project.maxTokens && project.maxTokens > 0) return project.maxTokens
  const envVal = parseInt(process.env.AIDLC_MAX_TOKENS ?? "")
  if (!isNaN(envVal) && envVal > 0) return envVal
  return DEFAULT_MAX_TOKENS
}

function extractFilePaths(spBody: string): string[] {
  const paths = new Set<string>()
  // Match file paths that have at least one directory component
  // e.g. src/lib/foo.ts YES, page.tsx NO
  const lines = spBody.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    // Look for lines that are purely a file path (indented path lines in specs)
    // Must start with a known directory prefix
    const pathMatch = trimmed.match(/^(src|apps|packages|functions|docs|tests?|components?)[\/][a-zA-Z0-9_.\[\]/-]+\.[a-zA-Z]{1,5}$/)
    if (pathMatch) {
      paths.add(trimmed)
    }
  }
  return Array.from(paths)
}

function extractSetupCommands(spBody: string): string[] {
  return spBody.split("\n").map(l => l.trim()).filter(l => l.startsWith("npm install") || l.startsWith("npx "))
}

function getExistingFileContents(spBody: string, appDir: string, maxLines = 200): { path: string; content: string; truncated: boolean }[] {
  const results: { path: string; content: string; truncated: boolean }[] = []
  for (const relPath of extractFilePaths(spBody)) {
    const fullPath = path.resolve(appDir, relPath)
    if (!fs.existsSync(fullPath)) continue
    const stat = fs.statSync(fullPath)
    if (!stat.isFile() || stat.size > 100_000) continue
    try {
      const raw   = fs.readFileSync(fullPath, "utf-8")
      const lines = raw.split("\n")
      const truncated = lines.length > maxLines
      results.push({ path: relPath, content: truncated ? lines.slice(0, maxLines).join("\n") + "\n... (truncated)" : raw, truncated })
    } catch { /* skip */ }
  }
  return results
}

function getFiletree(dir: string, depth = 3, prefix = ""): string {
  if (!fs.existsSync(dir)) return "(directory does not exist)"
  const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage"])
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !SKIP.has(e.name)).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries.map((entry, i) => {
    const last = i === entries.length - 1
    const line = prefix + (last ? "L-- " : "|-- ") + entry.name
    if (entry.isDirectory() && depth > 0) return line + "\n" + getFiletree(path.join(dir, entry.name), depth - 1, prefix + (last ? "    " : "|   "))
    return line
  }).join("\n")
}

function runCommand(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = cp.execSync(cmd, { cwd, encoding: "utf-8", timeout: 180_000, stdio: "pipe", env: { ...process.env, NODE_ENV: "development" } })
    return { success: true, output: output ?? "" }
  } catch (err: unknown) {
    if (err && typeof err === "object" && ("stdout" in err || "stderr" in err)) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      return { success: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join("\n") }
    }
    return { success: false, output: String(err) }
  }
}

function captureGitState(appDir: string): string | undefined {
  try { return cp.execSync("git rev-parse HEAD", { cwd: appDir, encoding: "utf-8", stdio: "pipe" }).trim() }
  catch { return undefined }
}
