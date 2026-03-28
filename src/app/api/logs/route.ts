import { NextResponse } from "next/server"
import { listLogs } from "@/lib/logs"
import { getProject } from "@/lib/projects"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json(listLogs(project.logsDir, projectId))
}
