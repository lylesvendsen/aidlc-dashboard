import { NextRequest, NextResponse } from "next/server"
import { getProject } from "@/lib/projects"
import { promises as fs } from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface WriteFilesBody {
  spId:  string
  files: { path: string; content: string }[]
}

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const { spId, files } = await req.json() as WriteFilesBody
  if (!files?.length) return NextResponse.json({ error: "No files provided" }, { status: 400 })

  const written: string[] = []
  const errors:  string[] = []

  for (const file of files) {
    try {
      const abs = path.isAbsolute(file.path)
        ? file.path
        : path.resolve(project.appDir, file.path)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      await fs.writeFile(abs, file.content, "utf-8")
      written.push(file.path)
    } catch (e) {
      errors.push(file.path + ": " + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Run afterEachSubPrompt validation
  const validation: { command: string; status: string; output: string; errorCount: number }[] = []
  const cmds = project.validation?.afterEachSubPrompt ?? []
  let priorFailed = false

  for (const cmd of cmds) {
    if (priorFailed) {
      validation.push({ command: cmd, status: "skipped", output: "", errorCount: 0 })
      continue
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: project.appDir, timeout: 120_000 })
      validation.push({ command: cmd, status: "passed", output: [stdout, stderr].filter(Boolean).join("\n"), errorCount: 0 })
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string }
      const output = [err.stdout ?? "", err.stderr ?? ""].filter(Boolean).join("\n")
      const errorCount = (output.match(/(\d+)\s+error/i)?.[1] ?? "0") as unknown as number
      validation.push({ command: cmd, status: "failed", output, errorCount: Number(errorCount) })
      priorFailed = true
    }
  }

  const overallStatus = validation.some(v => v.status === "failed") ? "failed" : "passed"

  return NextResponse.json({ spId, written, errors, validation, status: overallStatus })
}
