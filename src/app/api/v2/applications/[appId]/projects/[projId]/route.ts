import { NextRequest, NextResponse } from "next/server"
import { getProject, saveProject } from "@/lib/v2"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appId: string; projId: string }> }) {
  const { appId, projId } = await params
  const proj = getProject(appId, projId)
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(proj)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ appId: string; projId: string }> }) {
  const { appId, projId } = await params
  const proj = getProject(appId, projId)
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = await req.json()
  const updated = { ...proj, ...body, id: proj.id, applicationId: appId, updatedAt: new Date().toISOString() }
  saveProject(updated)
  return NextResponse.json(updated)
}
