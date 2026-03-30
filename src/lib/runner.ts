import * as fs   from "fs"
import * as path from "path"
import * as cp   from "child_process"
import Anthropic from "@anthropic-ai/sdk"
import type {
  Project, SpecFile, SubPromptDef, SubPromptResult,
  ExecutionLog, StreamEvent, LogLevel,
} from "@/types"
import { saveLog } from "./logs"
import { resolvePath } from "./projects"

const DEFAULT_MAX_TOKENS = 8192

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Append to saved execution log — never filtered; mirrors every streamed event. */
function persistLine(log: ExecutionLog, ev: StreamEvent): void {
  if (!log.logLines) log.logLines = []
  const level: LogLevel =
    ev.type === "log"
      ? (ev.level ?? "info")
      : ev.type === "error" || ev.type === "sp_fail"
        ? "error"
        : ev.type === "done" || ev.type === "sp_pass"
          ? "success"
          : "info"
  log.logLines.push({
    timestamp: new Date().toISOString(),
    message: ev.message,
    level,
  })
}

function* emit(log: ExecutionLog, ev: StreamEvent): Generator<StreamEvent> {
  persistLine(log, ev)
  yield ev
}

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
    logLines:        [],
  }

  const startTime = Date.now()

  // --- Spec loading (system) ---
  yield* emit(log, {
    type: "log",
    level: "system",
    message: "Spec loading: parsing " + spec.filePath,
  })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Spec loading: id=${spec.id} title="${spec.title}" version=${spec.version || "(none)"}`,
  })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Spec loading: ${spec.subPrompts.length} sub-prompt(s) — ${spec.subPrompts.map((s) => s.id).join(", ") || "(none)"}`,
  })
  const order = spec.subPrompts.map((s) => s.id)
  yield* emit(log, {
    type: "log",
    level: "system",
    message:
      "Spec loading: dependency graph — sequential order " +
      (order.length ? order.join(" → ") : "(empty)") +
      " (intra-SP deps not inferred from spec text)",
  })

  yield* emit(log, { type: "log", level: "info", message: "Starting " + spec.id + " - " + spec.title })
  yield* emit(log, { type: "log", level: "info", message: "App dir: " + appDir })
  yield* emit(log, { type: "log", level: "info", message: "Model: " + model })
  if (project.git?.autoCommit) {
    yield* emit(log, {
      type: "log",
      level: "system",
      message:
        "Git: auto-commit enabled in project settings — commit/tag steps are not run by this runner (undo still uses captured HEAD)",
    })
  }

  let toRun = spec.subPrompts
  if (onlySpId) toRun = spec.subPrompts.filter((sp) => sp.id === onlySpId)
  if (fromSpId) {
    const idx = spec.subPrompts.findIndex((sp) => sp.id === fromSpId)
    if (idx >= 0) toRun = spec.subPrompts.slice(idx)
  }

  for (const sp of toRun) {
    yield* emit(log, { type: "sp_start", message: "Running " + sp.id + ": " + sp.name, spId: sp.id, spName: sp.name })

    const iter = executeSubPrompt(spec, sp, project, appDir, model, log, dryRun)
    let spResult: SubPromptResult
    while (true) {
      const n = await iter.next()
      if (n.done) {
        spResult = n.value as SubPromptResult
        break
      }
      yield n.value as StreamEvent
    }

    log.subPrompts.push(spResult)

    if (spResult.status === "failed") {
      yield* emit(log, {
        type:              "sp_fail",
        message:           sp.id + " failed: " + (spResult.error ?? ""),
        spId:              sp.id,
        filesWritten:      spResult.filesWritten,
        validationResults: spResult.validation,
      })
      log.status     = "failed"
      log.durationMs = Date.now() - startTime
      log.error      = "Failed at " + sp.id + ": " + spResult.error
      if (!dryRun) saveLog(logsDir, log)
      yield* emit(log, { type: "error", message: "Execution failed at " + sp.id })
      return
    }

    yield* emit(log, {
      type:              "sp_pass",
      message:           sp.id + " passed (" + Math.round(spResult.durationMs / 1000) + "s)",
      spId:              sp.id,
      spName:            spResult.name,
      inputTokens:       spResult.tokens.input,
      outputTokens:      spResult.tokens.output,
      durationMs:        spResult.durationMs,
      filesWritten:      spResult.filesWritten,
      validationResults: spResult.validation,
    })
  }

  log.status     = "passed"
  log.durationMs = Date.now() - startTime
  if (!dryRun) saveLog(logsDir, log)
  yield* emit(log, { type: "done", message: spec.id + " complete in " + Math.round(log.durationMs / 1000) + "s", logId: log.id })
}

async function* executeSubPrompt(
  spec:    SpecFile,
  sp:      SubPromptDef,
  project: Project,
  appDir:  string,
  model:   string,
  log:     ExecutionLog,
  dryRun = false,
): AsyncGenerator<StreamEvent, SubPromptResult> {
  const start  = Date.now()
  const result: SubPromptResult = {
    id: sp.id,
    name: sp.name,
    status: "pending",
    durationMs: 0,
    tokens: { input: 0, output: 0 },
    filesWritten: [],
    commandsRun: [],
    validation: [],
  }

  try {
    if (dryRun) {
      yield* emit(log, {
        type: "log",
        level: "system",
        message: "Dry run: skipping execution for " + sp.id,
      })
      result.status     = "passed"
      result.durationMs = Date.now() - start
      return result
    }

    const filesToWrite = extractFilePaths(sp.body)

    if (filesToWrite.length === 0) {
      const iter = singleCallApproach(spec, sp, project, appDir, model, log)
      while (true) {
        const n = await iter.next()
        if (n.done) {
          const { filesWritten, tokens } = n.value as { filesWritten: string[]; tokens: { input: number; output: number } }
          result.filesWritten = filesWritten
          result.tokens       = tokens
          break
        }
        yield n.value as StreamEvent
      }
    } else {
      let totalInput = 0
      let totalOutput = 0
      for (const filePath of filesToWrite) {
        const iter = writeOneFile(spec, sp, project, appDir, model, filePath, log)
        while (true) {
          const n = await iter.next()
          if (n.done) {
            const { content, tokens, truncated } = n.value as {
              content: string
              tokens: { input: number; output: number }
              truncated: boolean
            }
            if (truncated) {
              throw new Error(
                "Response truncated writing " +
                  filePath +
                  ". Hit max_tokens (" +
                  getMaxTokens(project) +
                  "). Split this SP into smaller pieces.",
              )
            }
            if (!content.trim()) throw new Error("Claude returned empty content for " + filePath)
            const fullPath = path.resolve(appDir, filePath)
            fs.mkdirSync(path.dirname(fullPath), { recursive: true })
            fs.writeFileSync(fullPath, content, "utf-8")
            const bytes = Buffer.byteLength(content, "utf-8")
            yield* emit(log, {
              type: "log",
              level: "system",
              message: `File write: ${filePath} (${bytes} bytes)`,
            })
            result.filesWritten.push(filePath)
            totalInput  += tokens.input
            totalOutput += tokens.output
            break
          }
          yield n.value as StreamEvent
        }
      }
      result.tokens = { input: totalInput, output: totalOutput }
    }

    const VALIDATION_CMDS = ["npm run typecheck", "npm run lint", "npm run test", "npm run build"]
    for (const cmd of extractSetupCommands(sp.body)) {
      if (VALIDATION_CMDS.some((v) => cmd.trim().startsWith(v.trim()))) continue
      yield* emit(log, {
        type: "log",
        level: "system",
        message: "Setup command: " + cmd,
      })
      const res = runCommand(cmd, appDir)
      result.commandsRun.push(cmd)
      if (!res.success) {
        if (cmd.includes("npm install")) {
          const fb = runCommand(cmd + " --legacy-peer-deps", appDir)
          if (!fb.success) {
            yield* emit(log, {
              type: "log",
              level: "error",
              message: "Command failed: " + cmd + "\n" + res.output.slice(0, 800),
            })
            throw new Error("Command failed: " + cmd + "\n" + res.output)
          }
          yield* emit(log, {
            type: "log",
            level: "success",
            message: "Setup command succeeded (legacy peer deps): " + cmd,
          })
        } else {
          yield* emit(log, {
            type: "log",
            level: "error",
            message: "Command failed: " + cmd + "\n" + res.output.slice(0, 800),
          })
          throw new Error("Command failed: " + cmd + "\n" + res.output)
        }
      } else {
        yield* emit(log, {
          type: "log",
          level: "success",
          message: "Setup command passed: " + cmd,
        })
      }
    }

    const validationCmds = project.validation?.afterEachSubPrompt ?? []
    if (validationCmds.length > 0) {
      yield* emit(log, {
        type: "log",
        level: "system",
        message: `Validation: running ${validationCmds.length} command(s) after ${sp.id}`,
      })
      const validations: {
        command: string
        passed: boolean
        status: "passed" | "failed"
        output: string
      }[] = []
      for (const cmd of validationCmds) {
        yield* emit(log, {
          type: "log",
          level: "system",
          message: "Validation: executing — " + cmd,
        })
        const res = runCommand(cmd, appDir)
        const passed = res.success
        const preview = res.output.slice(0, 400).replace(/\s+/g, " ").trim()
        yield* emit(log, {
          type: "log",
          level: passed ? "success" : "error",
          message:
            (passed ? "Validation: PASS — " : "Validation: FAIL — ") +
            cmd +
            (preview ? ` — preview: ${preview}` : ""),
        })
        validations.push({
          command: cmd,
          passed,
          status: passed ? "passed" : "failed",
          output: res.output,
        })
      }
      result.validation = validations
      const failed = validations.filter((v: { passed: boolean }) => !v.passed)
      if (failed.length > 0) {
        yield* emit(log, {
          type: "log",
          level: "error",
          message:
            "Validation failed:\n" +
            failed.map((v: { command: string; output: string }) => v.command + ":\n" + v.output.slice(0, 500)).join("\n\n"),
        })
        throw new Error(
          "Validation failed:\n" +
            failed.map((v: { command: string; output: string }) => v.command + ":\n" + v.output.slice(0, 500)).join("\n\n"),
        )
      }
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

async function* writeOneFile(
  spec: SpecFile,
  sp: SubPromptDef,
  project: Project,
  appDir: string,
  model: string,
  filePath: string,
  log: ExecutionLog,
): AsyncGenerator<
  StreamEvent,
  { content: string; tokens: { input: number; output: number }; truncated: boolean }
> {
  const maxTokens = getMaxTokens(project)

  yield* emit(log, {
    type: "log",
    level: "system",
    message: "Context: collecting files for injection (SP " + sp.id + ", target " + filePath + ")",
  })

  const ctx = gatherContextFiles(sp.body, appDir)
  yield* emit(log, {
    type: "log",
    level: "system",
    message:
      `Context: ${ctx.paths.length} path(s) referenced for injection: ${ctx.paths.join(", ") || "(none)"}`,
  })
  for (const row of ctx.selectedLog) {
    yield* emit(log, {
      type: "log",
      level: "system",
      message: `Context: selected ${row.path} (${row.sizeBytes} bytes${row.lineTruncated ? ", line-truncated" : ""})`,
    })
  }
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Context: ${ctx.files.length} file(s) in prompt, ~${estimateTokens(ctx.files.map((f) => f.content).join("\n"))} tokens from file contents (${ctx.totalChars} chars)`,
  })
  for (const ex of ctx.excluded) {
    yield* emit(log, {
      type: "log",
      level: "system",
      message: `Context: excluded ${ex.path} — ${ex.reason}`,
    })
  }

  const existingFiles = ctx.files

  const constraints = project.constraints.map((c: string) => "- " + c).join("\n")
  const fullPath    = path.resolve(appDir, filePath)
  const isModify    = fs.existsSync(fullPath)
  const currentContent = isModify ? fs.readFileSync(fullPath, "utf-8") : null
  const sysPromptParts = [
    "You are implementing one specific file in a spec-driven AI-DLC project.",
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
    existingFiles.filter((f) => f.path !== filePath).length > 0
      ? "OTHER RELEVANT FILES:\n" +
        existingFiles
          .filter((f) => f.path !== filePath)
          .map((f) => "--- " + f.path + " ---\n" + f.content + "\n--- end ---")
          .join("\n\n")
      : "",
    "CODEBASE STRUCTURE:",
    getFiletree(appDir),
    "",
    "CONSTRAINTS:",
    constraints,
    "",
    "OUTPUT: Raw file content only. No JSON. No markdown fences. No explanation.",
    "Write the COMPLETE file. Never import unused variables. Strict TypeScript.",
  ].filter(Boolean) as string[]

  const prompt = sysPromptParts.join("\n")
  const systemPortion =
    "You are implementing one specific file in a spec-driven AI-DLC project.\nPROJECT CONTEXT:\n" + project.projectContext

  yield* emit(log, {
    type: "log",
    level: "system",
    message:
      `Prompt assembly: model=${model} max_tokens=${maxTokens} | constraints=${project.constraints.length} — ` +
      project.constraints.slice(0, 3).join("; ").slice(0, 200) +
      (project.constraints.length > 3 ? "…" : ""),
  })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Prompt assembly: project context ~${estimateTokens(project.projectContext)} tok, system block ~${estimateTokens(systemPortion)} tok, full prompt ~${estimateTokens(prompt)} tok`,
  })

  yield* emit(log, {
    type: "log",
    level: "system",
    message: "API: sending request to Claude — model=" + model + " at " + new Date().toISOString(),
  })

  const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: "API: streaming response started",
  })
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  })
  const content = message.content.find((b) => b.type === "text")?.text ?? ""
  const truncated = message.usage.output_tokens >= maxTokens
  yield* emit(log, {
    type: "log",
    level: truncated ? "error" : "system",
    message: `API: response complete — input_tokens=${message.usage.input_tokens} output_tokens=${message.usage.output_tokens} truncated=${truncated}`,
  })

  return { content, tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens }, truncated }
}

async function* singleCallApproach(
  spec: SpecFile,
  sp: SubPromptDef,
  project: Project,
  appDir: string,
  model: string,
  log: ExecutionLog,
): AsyncGenerator<StreamEvent, { filesWritten: string[]; tokens: { input: number; output: number } }> {
  const maxTokens = getMaxTokens(project)

  yield* emit(log, {
    type: "log",
    level: "system",
    message: "Context: single-call mode — scanning SP body for path references",
  })
  const ctx = gatherContextFiles(sp.body, appDir)
  yield* emit(log, {
    type: "log",
    level: "system",
    message:
      `Context: ${ctx.paths.length} path(s) referenced for injection: ${ctx.paths.join(", ") || "(none)"}`,
  })
  for (const row of ctx.selectedLog) {
    yield* emit(log, {
      type: "log",
      level: "system",
      message: `Context: selected ${row.path} (${row.sizeBytes} bytes${row.lineTruncated ? ", line-truncated" : ""})`,
    })
  }
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Context: ${ctx.files.length} file(s) for injection, ~${estimateTokens(ctx.files.map((f) => f.content).join("\n"))} tokens (${ctx.totalChars} chars)`,
  })
  for (const ex of ctx.excluded) {
    yield* emit(log, {
      type: "log",
      level: "system",
      message: `Context: excluded ${ex.path} — ${ex.reason}`,
    })
  }

  const existingFiles = ctx.files

  const constraints = project.constraints.map((c: string) => "- " + c).join("\n")

  const prompt = [
    "You are implementing a unit of work in a spec-driven AI-DLC project.",
    "PROJECT CONTEXT:",
    project.projectContext,
    "",
    "FULL SPEC:",
    spec.rawContent,
    "",
    "CURRENT SUB-PROMPT: " + sp.id + ": " + sp.name,
    sp.body,
    "",
    existingFiles.length > 0
      ? "EXISTING FILES:\n" +
        existingFiles.map((f) => "--- " + f.path + " ---\n" + f.content + "\n--- end ---").join("\n\n")
      : "",
    "CODEBASE:",
    getFiletree(appDir),
    "",
    "CONSTRAINTS:",
    constraints,
    "",
    'OUTPUT: Valid JSON only. No markdown. { "files": [{ "path": "...", "content": "..." }], "commands": [], "notes": "" }',
    "CRITICAL: Complete file content. No unused imports. Strict TypeScript.",
  ]
    .filter(Boolean)
    .join("\n")

  const systemPortion =
    "You are implementing a unit of work in a spec-driven AI-DLC project.\nPROJECT CONTEXT:\n" + project.projectContext

  yield* emit(log, {
    type: "log",
    level: "system",
    message:
      `Prompt assembly: model=${model} max_tokens=${maxTokens} | constraints=${project.constraints.length}`,
  })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: `Prompt assembly: project context ~${estimateTokens(project.projectContext)} tok, system ~${estimateTokens(systemPortion)} tok, full prompt ~${estimateTokens(prompt)} tok`,
  })

  yield* emit(log, {
    type: "log",
    level: "system",
    message: "API: sending request to Claude — model=" + model + " at " + new Date().toISOString(),
  })
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  yield* emit(log, {
    type: "log",
    level: "system",
    message: "API: streaming response started",
  })
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  })
  const text = message.content.find((b) => b.type === "text")?.text ?? ""
  const truncated = message.usage.output_tokens >= maxTokens
  yield* emit(log, {
    type: "log",
    level: truncated ? "error" : "system",
    message: `API: response complete — input_tokens=${message.usage.input_tokens} output_tokens=${message.usage.output_tokens} truncated=${truncated}`,
  })

  if (truncated) {
    throw new Error(
      "Response truncated in single-call fallback. Add explicit file paths to SP body so one-file-per-call is used.",
    )
  }

  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
  let parsed: { files?: { path: string; content: string }[] } = { files: [] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    /* empty */
  }

  const filesWritten: string[] = []
  for (const file of parsed.files ?? []) {
    const fullPath = path.resolve(appDir, file.path)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, file.content, "utf-8")
    const bytes = Buffer.byteLength(file.content, "utf-8")
    yield* emit(log, {
      type: "log",
      level: "system",
      message: `File write: ${file.path} (${bytes} bytes)`,
    })
    filesWritten.push(file.path)
  }
  return { filesWritten, tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens } }
}

function gatherContextFiles(spBody: string, appDir: string): {
  paths: string[]
  files: { path: string; content: string; truncated: boolean }[]
  excluded: { path: string; reason: string }[]
  totalChars: number
  selectedLog: { path: string; sizeBytes: number; lineTruncated: boolean }[]
} {
  const excluded: { path: string; reason: string }[] = []
  const results: { path: string; content: string; truncated: boolean }[] = []
  const selectedLog: { path: string; sizeBytes: number; lineTruncated: boolean }[] = []
  const paths     = extractFilePaths(spBody)
  const maxLines  = 200

  for (const relPath of paths) {
    const fullPath = path.resolve(appDir, relPath)
    if (!fs.existsSync(fullPath)) {
      excluded.push({ path: relPath, reason: "file does not exist" })
      continue
    }
    const stat = fs.statSync(fullPath)
    if (!stat.isFile()) {
      excluded.push({ path: relPath, reason: "not a regular file" })
      continue
    }
    if (stat.size > 100_000) {
      excluded.push({ path: relPath, reason: `too large (${stat.size} bytes > 100000)` })
      continue
    }
    try {
      const buf = fs.readFileSync(fullPath)
      if (buf.includes(0)) {
        excluded.push({ path: relPath, reason: "binary content" })
        continue
      }
      const raw         = buf.toString("utf-8")
      const lines       = raw.split("\n")
      const lineTruncated = lines.length > maxLines
      results.push({
        path: relPath,
        content: lineTruncated ? lines.slice(0, maxLines).join("\n") + "\n... (truncated)" : raw,
        truncated: lineTruncated,
      })
      selectedLog.push({
        path: relPath,
        sizeBytes: stat.size,
        lineTruncated,
      })
    } catch {
      excluded.push({ path: relPath, reason: "read error" })
    }
  }

  const totalChars = results.reduce((a, f) => a + f.content.length, 0)
  return { paths, files: results, excluded, totalChars, selectedLog }
}

function getMaxTokens(project: Project): number {
  if (project.maxTokens && project.maxTokens > 0) return project.maxTokens
  const envVal = parseInt(process.env.AIDLC_MAX_TOKENS ?? "")
  if (!isNaN(envVal) && envVal > 0) return envVal
  return DEFAULT_MAX_TOKENS
}

function extractFilePaths(spBody: string): string[] {
  const paths = new Set<string>()
  const lines = spBody.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const pathMatch = trimmed.match(
      /^(src|apps|packages|functions|docs|tests?|components?)[\/][a-zA-Z0-9_.\[\]/-]+\.[a-zA-Z]{1,5}$/,
    )
    if (pathMatch) {
      paths.add(trimmed)
    }
  }
  return Array.from(paths)
}

function extractSetupCommands(spBody: string): string[] {
  return spBody.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("npm install") || l.startsWith("npx "))
}

function getExistingFileContents(
  spBody: string,
  appDir: string,
  maxLines = 200,
): { path: string; content: string; truncated: boolean }[] {
  const { files } = gatherContextFilesSync(spBody, appDir, maxLines)
  return files
}

function gatherContextFilesSync(
  spBody: string,
  appDir: string,
  maxLines: number,
): { files: { path: string; content: string; truncated: boolean }[] } {
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
      results.push({
        path: relPath,
        content: truncated ? lines.slice(0, maxLines).join("\n") + "\n... (truncated)" : raw,
        truncated,
      })
    } catch {
      /* skip */
    }
  }
  return { files: results }
}

function getFiletree(dir: string, depth = 3, prefix = ""): string {
  if (!fs.existsSync(dir)) return "(directory does not exist)"
  const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage"])
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !SKIP.has(e.name)).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
    .map((entry, i) => {
      const last = i === entries.length - 1
      const line = prefix + (last ? "L-- " : "|-- ") + entry.name
      if (entry.isDirectory() && depth > 0)
        return line + "\n" + getFiletree(path.join(dir, entry.name), depth - 1, prefix + (last ? "    " : "|   "))
      return line
    })
    .join("\n")
}

function runCommand(cmd: string, cwd: string): { success: boolean; output: string } {
  try {
    const output = cp.execSync(cmd, {
      cwd,
      encoding: "utf-8",
      timeout: 180_000,
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "development" },
    })
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
  try {
    return cp.execSync("git rev-parse HEAD", { cwd: appDir, encoding: "utf-8", stdio: "pipe" }).trim()
  } catch {
    return undefined
  }
}
