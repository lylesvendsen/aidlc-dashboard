import { NextRequest, NextResponse } from "next/server"
import { listApplications, saveApplication } from "@/lib/v2"
import type { ApplicationConfig } from "@/lib/v2/types"

export function GET() {
  return NextResponse.json(listApplications())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })
  if (!body.appDir?.trim()) return NextResponse.json({ error: "App directory required" }, { status: 400 })
  if (!body.specDir?.trim()) return NextResponse.json({ error: "Spec directory required" }, { status: 400 })
  if (!body.logsDir?.trim()) return NextResponse.json({ error: "Logs directory required" }, { status: 400 })
  const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36)
  const now = new Date().toISOString()
  const app: ApplicationConfig = {
    id, name: body.name.trim(), description: body.description?.trim() || undefined,
    appDir: body.appDir.trim(), specDir: body.specDir.trim(), logsDir: body.logsDir.trim(),
    rootDir: body.rootDir?.trim() || require("path").dirname(body.appDir.trim()),
    defaultModel: body.defaultModel?.trim() || "claude-sonnet-4-6",
    globalConstraints: Array.isArray(body.globalConstraints) ? body.globalConstraints : [],
    projectContext: body.projectContext?.trim() || undefined,
    createdAt: now, updatedAt: now,
  }
  saveApplication(app)
  return NextResponse.json(app)
}
