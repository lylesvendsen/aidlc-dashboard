import * as fs   from "fs"
import * as path from "path"
import type { ApplicationConfig, ProjectConfig, SpecConfig } from "./types"

const V2_DIR = path.join(process.cwd(), "data", "v2", "applications")

function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch { return null }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
}

// ── Applications ─────────────────────────────────────────────────────────────

export function listApplications(): ApplicationConfig[] {
  if (!fs.existsSync(V2_DIR)) return []
  return fs.readdirSync(V2_DIR)
    .filter(id => fs.statSync(path.join(V2_DIR, id)).isDirectory())
    .map(id => readJson<ApplicationConfig>(path.join(V2_DIR, id, "application.config.json")))
    .filter(Boolean) as ApplicationConfig[]
}

export function getApplication(appId: string): ApplicationConfig | null {
  return readJson<ApplicationConfig>(path.join(V2_DIR, appId, "application.config.json"))
}

export function saveApplication(app: ApplicationConfig): void {
  writeJson(path.join(V2_DIR, app.id, "application.config.json"), app)
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function listProjects(appId: string): ProjectConfig[] {
  const projDir = path.join(V2_DIR, appId, "projects")
  if (!fs.existsSync(projDir)) return []
  return fs.readdirSync(projDir)
    .filter(id => fs.statSync(path.join(projDir, id)).isDirectory())
    .map(id => readJson<ProjectConfig>(path.join(projDir, id, "project.config.json")))
    .filter(Boolean) as ProjectConfig[]
}

export function getProject(appId: string, projId: string): ProjectConfig | null {
  return readJson<ProjectConfig>(
    path.join(V2_DIR, appId, "projects", projId, "project.config.json")
  )
}

export function saveProject(proj: ProjectConfig): void {
  writeJson(
    path.join(V2_DIR, proj.applicationId, "projects", proj.id, "project.config.json"),
    proj
  )
}

// ── Specs ─────────────────────────────────────────────────────────────────────

export function listSpecConfigs(appId: string, projId: string): SpecConfig[] {
  const specsDir = path.join(V2_DIR, appId, "projects", projId, "specs")
  if (!fs.existsSync(specsDir)) return []
  return fs.readdirSync(specsDir)
    .filter(id => fs.statSync(path.join(specsDir, id)).isDirectory())
    .map(id => readJson<SpecConfig>(
      path.join(specsDir, id, "spec.config.json")
    ))
    .filter(Boolean) as SpecConfig[]
}

export function getSpecConfig(appId: string, projId: string, specId: string): SpecConfig | null {
  return readJson<SpecConfig>(
    path.join(V2_DIR, appId, "projects", projId, "specs", specId, "spec.config.json")
  )
}

export function saveSpecConfig(config: SpecConfig): void {
  writeJson(
    path.join(V2_DIR, config.applicationId, "projects", config.projectId, "specs", config.id, "spec.config.json"),
    config
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find a project by ID across all applications */
export function findProject(projId: string): { app: ApplicationConfig; proj: ProjectConfig } | null {
  for (const app of listApplications()) {
    const proj = getProject(app.id, projId)
    if (proj) return { app, proj }
  }
  return null
}

/** Get specDir for a project — applies specDirFilter if set */
export function getSpecDir(app: ApplicationConfig, proj: ProjectConfig): string {
  const base = app.specDir
  if (!proj.specDirFilter) return base
  return path.join(base, proj.specDirFilter)
}
