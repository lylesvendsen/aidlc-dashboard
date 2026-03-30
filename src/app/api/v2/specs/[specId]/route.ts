import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { getApplication, getProject, getSpecDir, getSpecConfig, saveSpecConfig } from "@/lib/v2"

export async function GET(req: NextRequest, { params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params
  const appId  = req.nextUrl.searchParams.get("appId")
  const projId = req.nextUrl.searchParams.get("projId")
  if (!appId || !projId) return NextResponse.json({ error: "appId and projId required" }, { status: 400 })
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const specDir  = getSpecDir(app, proj)
  const config   = getSpecConfig(appId, projId, specId)
  const filePath = config?.filePath ?? path.join(specDir, specId + ".md")
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: "Spec file not found" }, { status: 404 })
  const rawContent = fs.readFileSync(filePath, "utf-8")
  const title = rawContent.match(/^#\s+(.+)/m)?.[1] ?? specId
  return NextResponse.json({ id: specId, filename: path.basename(filePath), filePath, rawContent, title, status: config?.status ?? "draft" })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params
  const appId  = req.nextUrl.searchParams.get("appId")
  const projId = req.nextUrl.searchParams.get("projId")
  if (!appId || !projId) return NextResponse.json({ error: "appId and projId required" }, { status: 400 })
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { content } = await req.json()
  const config   = getSpecConfig(appId, projId, specId)
  const specDir  = getSpecDir(app, proj)
  const filePath = config?.filePath ?? path.join(specDir, specId + ".md")
  fs.writeFileSync(filePath, content, "utf-8")
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ specId: string }> }) {
  const { specId } = await params
  const appId  = req.nextUrl.searchParams.get("appId")
  const projId = req.nextUrl.searchParams.get("projId")
  if (!appId || !projId) return NextResponse.json({ error: "appId and projId required" }, { status: 400 })
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const config   = getSpecConfig(appId, projId, specId)
  const specDir  = getSpecDir(app, proj)
  const filePath = config?.filePath ?? path.join(specDir, specId + ".md")
  // Delete .md file
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  // Delete spec.config.json
  const configPath = path.join(process.cwd(), "data", "v2", "applications", appId, "projects", projId, "specs", specId, "spec.config.json")
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath)
    const specDir2 = path.dirname(configPath)
    if (fs.existsSync(specDir2) && fs.readdirSync(specDir2).length === 0) fs.rmdirSync(specDir2)
  }
  return NextResponse.json({ ok: true })
}
