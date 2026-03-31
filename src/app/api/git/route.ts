import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import { getProject } from "@/lib/projects"

const execAsync = promisify(exec)

async function git(cmd: string, cwd: string) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 10_000 })
    return { out: stdout.trim(), err: stderr.trim(), ok: true }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return { out: "", err: err.stderr ?? err.message ?? "", ok: false }
  }
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId")
  const action    = req.nextUrl.searchParams.get("action") ?? "status"
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const dir = project.appDir

  if (action === "status") {
    const [branch, dirty, log] = await Promise.all([
      git("git branch --show-current", dir),
      git("git status --porcelain", dir),
      git("git log -1 --format=%h|||%s|||%cr", dir),
    ])
    const [sha, msg, ago] = (log.out || "").split("|||")
    return NextResponse.json({
      branch: branch.out || "HEAD",
      dirty:  (dirty.out || "").length > 0,
      dirtyCount: (dirty.out || "").split("\n").filter(Boolean).length,
      lastCommit: log.ok ? { sha, message: msg, ago } : null,
    })
  }

  if (action === "branches") {
    const r = await git("git branch -a --format=%(refname:short)|||%(upstream:short)|||%(HEAD)", dir)
    const local: string[] = []
    const remote: string[] = []
    for (const line of r.out.split("\n").filter(Boolean)) {
      const [ref, , head] = line.split("|||")
      if (!ref) continue
      if (ref.startsWith("origin/")) {
        const name = ref.replace("origin/", "")
        if (name !== "HEAD") remote.push(name)
      } else {
        local.push(ref + (head === "*" ? "|current" : ""))
      }
    }
    return NextResponse.json({ local, remote })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const { projectId, action, branch, baseBranch } = await req.json() as {
    projectId: string; action: string; branch?: string; baseBranch?: string
  }
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const dir = project.appDir

  if (action === "switch" && branch) {
    const r = await git("git checkout " + branch, dir)
    if (!r.ok) return NextResponse.json({ error: r.err }, { status: 400 })
    return NextResponse.json({ ok: true, branch })
  }

  if (action === "create" && branch) {
    const base = baseBranch ? " " + baseBranch : ""
    const r = await git("git checkout -b " + branch + base, dir)
    if (!r.ok) return NextResponse.json({ error: r.err }, { status: 400 })
    return NextResponse.json({ ok: true, branch })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
