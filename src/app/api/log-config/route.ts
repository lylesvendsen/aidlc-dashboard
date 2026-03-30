import { NextResponse } from "next/server"

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultValue
  const v = raw.trim().toLowerCase()
  if (v === "true" || v === "1" || v === "yes") return true
  if (v === "false" || v === "0" || v === "no") return false
  return defaultValue
}

/**
 * Default display filter toggles for the run terminal (see .env.local.example).
 * GET returns which levels are shown initially in the UI only — does not affect persisted logs.
 */
export async function GET() {
  return NextResponse.json({
    errors: parseBool(process.env.AIDLC_LOG_DISPLAY_ERRORS, true),
    success: parseBool(process.env.AIDLC_LOG_DISPLAY_SUCCESS, true),
    info: parseBool(process.env.AIDLC_LOG_DISPLAY_INFO, true),
    system: parseBool(process.env.AIDLC_LOG_DISPLAY_SYSTEM, false),
  })
}
