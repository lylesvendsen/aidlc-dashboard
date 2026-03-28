import { NextResponse } from "next/server"
import { getSpec, saveSpec } from "@/lib/specs"
import { getProject } from "@/lib/projects"
import fs   from "fs"
import path from "path"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const spec = getSpec(project.specDir, decodeURIComponent(filename))
  if (!spec) return NextResponse.json({ error: "Spec not found" }, { status: 404 })
  return NextResponse.json(spec)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const body     = await req.json()
  const filePath = path.join(project.specDir, decodeURIComponent(filename))
  saveSpec(filePath, body.content)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  const filePath = path.join(project.specDir, decodeURIComponent(filename))
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Spec file not found" }, { status: 404 })
  }
  fs.unlinkSync(filePath)
  return NextResponse.json({ ok: true })
}
