import fs   from "fs"
import path from "path"
import type { ExecutionLog } from "@/types"

export function listLogs(logsDir: string, projectId: string): ExecutionLog[] {
  if (!fs.existsSync(logsDir)) return []
  return fs.readdirSync(logsDir)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(logsDir, f), "utf-8")) as ExecutionLog)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function getLog(logsDir: string, logId: string): ExecutionLog | null {
  const p = path.join(logsDir, logId + ".json")
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, "utf-8")) as ExecutionLog
}

export function saveLog(logsDir: string, log: ExecutionLog): void {
  fs.mkdirSync(logsDir, { recursive: true })
  fs.writeFileSync(path.join(logsDir, log.id + ".json"), JSON.stringify(log, null, 2))
}

export function getLastLog(logsDir: string, unitId: string): ExecutionLog | null {
  if (!fs.existsSync(logsDir)) return null
  const files = fs.readdirSync(logsDir)
    .filter(f => f.startsWith(unitId + "-") && f.endsWith(".json"))
    .sort().reverse()
  if (!files.length) return null
  return JSON.parse(fs.readFileSync(path.join(logsDir, files[0]), "utf-8")) as ExecutionLog
}
