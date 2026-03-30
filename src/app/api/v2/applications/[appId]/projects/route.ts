import { NextRequest, NextResponse } from "next/server"
import { listProjects, saveProject, getApplication } from "@/lib/v2"
import type { ProjectConfig } from "@/lib/v2/types"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  return NextResponse.json(listProjects(appId))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getApplication(appId)
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  const id  = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36)
  const now = new Date().toISOString()
  const proj: ProjectConfig = {
    id, applicationId: appId,
    name: body.name.trim(),
    description: body.description?.trim() || undefined,
    specDirFilter: body.specDirFilter || undefined,
    model: body.model || undefined,
    projectContext: body.projectContext || undefined,
    constraints: Array.isArray(body.constraints) ? body.constraints : [],
    validation: body.validation,
    git: body.git,
    createdAt: now, updatedAt: now,
  }
  saveProject(proj)
  return NextResponse.json(proj)
}
