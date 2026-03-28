import { NextResponse } from "next/server"
import fs   from "fs"
import path from "path"

export async function POST(req: Request) {
  const { appDir } = await req.json()
  if (!appDir) return NextResponse.json({ error: "appDir required" }, { status: 400 })

  const resolvedDir = path.resolve(appDir.trim())
  if (!fs.existsSync(resolvedDir)) {
    return NextResponse.json({ error: "App directory does not exist: " + resolvedDir }, { status: 400 })
  }

  const specDir = path.join(resolvedDir, "docs/aidlc/specs")
  const logsDir = path.join(resolvedDir, "docs/aidlc/logs")

  let createdSpec = false
  let createdLogs = false

  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true })
    createdSpec = true
  }
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
    createdLogs = true
  }

  // Add .gitkeep so empty dirs are tracked in git
  const specKeep = path.join(specDir, ".gitkeep")
  const logsKeep = path.join(logsDir, ".gitkeep")
  if (!fs.existsSync(specKeep)) fs.writeFileSync(specKeep, "")
  if (!fs.existsSync(logsKeep)) fs.writeFileSync(logsKeep, "")

  return NextResponse.json({
    ok:          true,
    specDir,
    logsDir,
    createdSpec,
    createdLogs,
    message: createdSpec || createdLogs
      ? "Structure created successfully"
      : "Structure already exists — nothing overwritten",
  })
}
