import { NextRequest, NextResponse } from "next/server"
import * as fs   from "fs"
import * as path from "path"

const BASE_DIR = path.resolve(process.cwd(), "..")

function resolvePath(p: string): string {
  if (!p) return p
  if (path.isAbsolute(p)) return p
  return path.resolve(BASE_DIR, p.startsWith("./") ? p.slice(2) : p)
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path")
  if (!p) return NextResponse.json({ error: "path required" }, { status: 400 })
  const resolved = resolvePath(p)
  return NextResponse.json({ exists: fs.existsSync(resolved), path: resolved })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const p = body.path
  if (!p) return NextResponse.json({ error: "path required" }, { status: 400 })
  const resolved = resolvePath(p)
  try {
    fs.mkdirSync(resolved, { recursive: true })
    return NextResponse.json({ created: true, path: resolved })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 })
  }
}
