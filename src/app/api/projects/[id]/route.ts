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
