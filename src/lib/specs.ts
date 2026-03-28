import fs   from "fs"
import path from "path"
import type { SpecFile, SubPromptDef } from "@/types"

export function listSpecs(specDir: string): SpecFile[] {
  if (!fs.existsSync(specDir)) return []
  return fs.readdirSync(specDir)
    .filter(f => f.endsWith(".md"))
    .map(f => parseSpec(path.join(specDir, f)))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function getSpec(specDir: string, filename: string): SpecFile | null {
  const p = path.join(specDir, filename)
  if (!fs.existsSync(p)) return null
  return parseSpec(p)
}

export function saveSpec(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf-8")
}

export function parseSpec(filePath: string): SpecFile {
  const raw   = fs.readFileSync(filePath, "utf-8")
  const lines = raw.split("\n")

  const titleLine  = lines.find(l => l.startsWith("# ")) ?? "# UNKNOWN - Unknown"
  const titleMatch = titleLine.match(/^#\s+(\S+)\s+-\s+(.+)/)
  const id    = titleMatch?.[1] ?? "UNKNOWN"
  const title = titleMatch?.[2]?.trim() ?? "Unknown"

  const versionLine = lines.find(l => l.match(/^#\s*Version:/))
  const version     = versionLine?.match(/Version:\s*(.+)/)?.[1]?.trim() ?? "1.0"

  const jiraLine = lines.find(l => l.match(/^#\s*Jira:\s*\S+/))
  let jiraUrl: string | undefined = undefined
  let jiraTicketId: string | undefined = undefined
  if (jiraLine) {
    const jiraMatch = jiraLine.match(/^#\s*Jira:\s*(\S+)/)
    if (jiraMatch?.[1]) {
      jiraUrl = jiraMatch[1]
      const ticketMatch = jiraUrl.match(/browse\/([A-Z]+-\d+)/)
      if (ticketMatch?.[1]) {
        jiraTicketId = ticketMatch[1]
      }
    }
  }

  const deliversIdx = lines.findIndex(l => l.includes("What this unit delivers"))
  let summary = ""
  if (deliversIdx >= 0) {
    for (let i = deliversIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith("#")) { summary = line; break }
    }
  }

  const subPrompts: SubPromptDef[] = []
  const spRegex = /^###\s+(SP-\d+):\s+(.+)$/
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(spRegex)
    if (!match) continue
    const bodyLines: string[] = []
    const criteria:  string[] = []
    let inCriteria = false
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]
      if (line.match(spRegex) || line.match(/^##\s/)) break
      if (line.trim().startsWith("Acceptance:")) { inCriteria = true; continue }
      if (inCriteria) { if (line.trim()) criteria.push(line.trim()) }
      else bodyLines.push(line)
    }
    subPrompts.push({ id: match[1], name: match[2], body: bodyLines.join("\n").trim(), criteria })
  }

  return {
    id, title, summary, version,
    filename:   path.basename(filePath),
    filePath,
    rawContent: raw,
    subPrompts,
    jiraUrl,
    jiraTicketId,
  }
}