import { NextResponse } from "next/server"
import { getProject } from "@/lib/projects"
import { getLog } from "@/lib/logs"
import cp from "child_process"
import path from "path"

export async function POST(req: Request) {
  const { projectId, logId } = await req.json()
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const log = getLog(project.logsDir, logId)
  if (!log) return NextResponse.json({ error: "Log not found" }, { status: 404 })
  if (!log.gitStateBeforeRun) return NextResponse.json({ error: "No git state captured for this run" }, { status: 400 })

  const appDir = path.resolve(project.appDir)
  try {
    cp.execSync("git reset --hard " + log.gitStateBeforeRun, { cwd: appDir, stdio: "pipe" })
    return NextResponse.json({ ok: true, restoredTo: log.gitStateBeforeRun })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Git reset failed: " + msg }, { status: 500 })
  }
}
