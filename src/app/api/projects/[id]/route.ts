import { NextResponse } from "next/server"
import { getProject, saveProject, deleteProject } from "@/lib/projects"

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = getProject(id)
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(p)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const p = getProject(id)
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body    = await req.json()
  const updated = { ...p, ...body, id: p.id, updatedAt: new Date().toISOString() }
  saveProject(updated)
  return NextResponse.json(updated)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  deleteProject(id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { path: filePath, content } = await req.json() as { path: string; content: string }
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const fs = await import("fs/promises")
  const pathMod = await import("path")
  const abs = pathMod.default.isAbsolute(filePath) ? filePath : pathMod.default.resolve(project.appDir, filePath)
  await fs.writeFile(abs, content, "utf-8")
  return NextResponse.json({ ok: true })
}
