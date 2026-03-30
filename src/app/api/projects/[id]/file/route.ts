import { NextRequest, NextResponse } from "next/server"
import { getProject } from "@/lib/projects"
import { promises as fs } from "fs"
import path from "path"

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const filePath = req.nextUrl.searchParams.get("path")
  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 })
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(project.appDir, filePath)
  try {
    const content = await fs.readFile(abs, "utf-8")
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ content: "" })
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { path: filePath, content } = await req.json() as { path: string; content: string }
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(project.appDir, filePath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, "utf-8")
  return NextResponse.json({ ok: true })
}
