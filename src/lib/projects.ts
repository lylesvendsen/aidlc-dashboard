import fs   from "fs"
import path from "path"
import type { Project } from "@/types"

const DATA_DIR = path.resolve(process.cwd(), process.env.AIDLC_DATA_DIR ?? "./data", "projects")


// Resolves a path that may be relative (./repo-name or repo-name)
// Relative paths are resolved from the dashboard parent directory
// so sibling repos can be referenced without absolute paths.
// Absolute paths pass through unchanged (back-compatible).
const DASHBOARD_DIR = process.cwd()
const PARENT_DIR    = path.resolve(DASHBOARD_DIR, "..")

export function resolvePath(p: string): string {
  if (!p) return p
  if (path.isAbsolute(p)) return p
  const clean = p.startsWith("./") ? p.slice(2) : p
  const base  = process.env.AIDLC_BASE_DIR
    ? path.resolve(process.env.AIDLC_BASE_DIR)
    : path.resolve(process.cwd(), "..")
  return path.resolve(base, clean)
}
export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function listProjects(): Project[] {
  ensureDataDir()
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")) as Project)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getProject(id: string): Project | null {
  const p = path.join(DATA_DIR, id + ".json")
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Project
}

export function saveProject(project: Project): void {
  ensureDataDir()
  fs.writeFileSync(path.join(DATA_DIR, project.id + ".json"), JSON.stringify(project, null, 2))
}

export function deleteProject(id: string): void {
  const p = path.join(DATA_DIR, id + ".json")
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
