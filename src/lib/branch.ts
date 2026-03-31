import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

async function git(cmd: string, cwd: string): Promise<{ out: string; ok: boolean; err: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout: 15_000 })
    return { out: stdout.trim(), err: stderr.trim(), ok: true }
  } catch (e) {
    const err = e as { stderr?: string; message?: string }
    return { out: "", err: err.stderr ?? err.message ?? "", ok: false }
  }
}

export function renderBranchTemplate(
  template: string,
  vars: { specId: string; projectId: string; jiraId?: string }
): string | null {
  if (!template.trim()) return null
  let result = template
    .replace(/\{specId\}/g,    vars.specId    ?? "")
    .replace(/\{projectId\}/g, vars.projectId ?? "")
    .replace(/\{jiraId\}/g,    vars.jiraId    ?? "")
  result = result.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return result || null
}

export function resolveBranch(
  specId:   string,
  projectId: string,
  jiraId?:  string,
  specBranchOverride?: string,
  projectBranchTemplate?: string,
): string | null {
  if (specBranchOverride?.trim()) return specBranchOverride.trim()
  if (projectBranchTemplate?.trim()) {
    return renderBranchTemplate(projectBranchTemplate, { specId, projectId, jiraId })
  }
  return null
}

export async function ensureBranch(
  appDir: string,
  branch: string,
): Promise<{ created: boolean; switched: boolean; error?: string }> {
  // Check for uncommitted changes
  const status = await git("git status --porcelain", appDir)
  if (!status.ok) return { created: false, switched: false, error: status.err }

  // Check if branch exists locally
  const exists = await git("git branch --list " + branch, appDir)
  const branchExists = exists.out.trim().length > 0

  if (branchExists) {
    const sw = await git("git checkout " + branch, appDir)
    if (!sw.ok) return { created: false, switched: false, error: sw.err }
    return { created: false, switched: true }
  } else {
    const create = await git("git checkout -b " + branch, appDir)
    if (!create.ok) return { created: false, switched: false, error: create.err }
    return { created: true, switched: true }
  }
}
