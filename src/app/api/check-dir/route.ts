import { NextResponse } from "next/server"
import fs   from "fs"
import path from "path"

const STANDARD_SPEC_DIR = "docs/aidlc/specs"
const STANDARD_LOGS_DIR = "docs/aidlc/logs"
const STANDARD_CONFIG   = "docs/aidlc/aidlc.config.ts"

export async function POST(req: Request) {
  const { appDir } = await req.json()

  if (!appDir || !appDir.trim()) {
    return NextResponse.json({ error: "appDir is required" }, { status: 400 })
  }

  const resolvedDir = path.resolve(appDir.trim())

  if (!fs.existsSync(resolvedDir)) {
    return NextResponse.json({
      exists:       false,
      hasStructure: false,
      specDir:      null,
      logsDir:      null,
      message:      "Directory does not exist: " + resolvedDir,
    })
  }

  const specPath = path.join(resolvedDir, STANDARD_SPEC_DIR)
  const logsPath = path.join(resolvedDir, STANDARD_LOGS_DIR)
  const configPath = path.join(resolvedDir, STANDARD_CONFIG)

  const hasSpecDir   = fs.existsSync(specPath)
  const hasLogsDir   = fs.existsSync(logsPath)
  const hasConfig    = fs.existsSync(configPath)
  const hasStructure = hasSpecDir && hasLogsDir

  let specCount = 0
  if (hasSpecDir) {
    specCount = fs.readdirSync(specPath).filter(f => f.endsWith(".md")).length
  }

  return NextResponse.json({
    exists:          true,
    hasStructure,
    hasSpecDir,
    hasLogsDir,
    hasConfig,
    specDir:         hasSpecDir ? specPath : path.join(resolvedDir, STANDARD_SPEC_DIR),
    logsDir:         hasLogsDir ? logsPath : path.join(resolvedDir, STANDARD_LOGS_DIR),
    specCount,
    standardSpecDir: STANDARD_SPEC_DIR,
    standardLogsDir: STANDARD_LOGS_DIR,
    resolvedDir,
  })
}
