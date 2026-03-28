import { NextResponse } from "next/server"
import { listSpecs, getSpec, saveSpec } from "@/lib/specs"
import { getProject } from "@/lib/projects"
import path from "path"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json(listSpecs(project.specDir))
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const body = await req.json()
  const filePath = path.join(project.specDir, body.filename)
  saveSpec(filePath, body.content)
  const spec = getSpec(project.specDir, body.filename)
  return NextResponse.json(spec, { status: 201 })
}
