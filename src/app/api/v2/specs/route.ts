import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { getApplication, getProject, getSpecDir, listSpecConfigs, saveSpecConfig } from "@/lib/v2"
import type { SpecConfig } from "@/lib/v2/types"

export async function GET(req: NextRequest) {
  const appId  = req.nextUrl.searchParams.get("appId")
  const projId = req.nextUrl.searchParams.get("projId")
  if (!appId || !projId) return NextResponse.json({ error: "appId and projId required" }, { status: 400 })
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const specDir = getSpecDir(app, proj)
  if (!fs.existsSync(specDir)) return NextResponse.json([])
  const configs = listSpecConfigs(appId, projId)
  const configById = Object.fromEntries(configs.map(c => [c.id, c]))
  const files = fs.readdirSync(specDir).filter(f => f.endsWith(".md")).sort()
  const specs = files.map(filename => {
    const specId = filename.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const config = configById[specId]
    const content = fs.readFileSync(path.join(specDir, filename), "utf-8")
    return { id: specId, filename, filePath: path.join(specDir, filename), rawContent: content, status: config?.status ?? "draft", jiraUrl: config?.jiraUrl, jiraTicketId: config?.jiraTicketId }
  })
  return NextResponse.json(specs)
}

export async function POST(req: NextRequest) {
  const appId  = req.nextUrl.searchParams.get("appId")
  const projId = req.nextUrl.searchParams.get("projId")
  if (!appId || !projId) return NextResponse.json({ error: "appId and projId required" }, { status: 400 })
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { filename, content } = await req.json()
  if (!filename || !content) return NextResponse.json({ error: "filename and content required" }, { status: 400 })
  const specDir = getSpecDir(app, proj)
  fs.mkdirSync(specDir, { recursive: true })
  const filePath = path.join(specDir, filename)
  if (fs.existsSync(filePath)) return NextResponse.json({ error: "File already exists" }, { status: 409 })
  fs.writeFileSync(filePath, content, "utf-8")
  // Create spec.config.json
  const specId = filename.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const jiraMatch = content.match(/# Jira:\s*(https?:\/\/\S+)/)
  const jiraUrl   = jiraMatch ? jiraMatch[1] : undefined
  const jiraTid   = jiraUrl ? (jiraUrl.match(/browse\/([A-Z]+-\d+)/)?.[1]) : undefined
  const now = new Date().toISOString()
  const config: SpecConfig = { id: specId, applicationId: appId, projectId: projId, filePath, status: "draft", jiraUrl, jiraTicketId: jiraTid, model: undefined, validation: undefined, git: undefined, maxTokens: undefined, reviewNotes: undefined, createdAt: now, updatedAt: now }
  saveSpecConfig(config)
  return NextResponse.json({ filename, filePath })
}
