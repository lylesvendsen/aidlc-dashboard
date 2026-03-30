import { NextRequest, NextResponse } from "next/server"
import { getApplication, saveApplication } from "@/lib/v2"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getApplication(appId)
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(app)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params
  const app = getApplication(appId)
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const body = await req.json()
  const updated = { ...app, ...body, id: app.id, updatedAt: new Date().toISOString() }
  saveApplication(updated)
  return NextResponse.json(updated)
}
