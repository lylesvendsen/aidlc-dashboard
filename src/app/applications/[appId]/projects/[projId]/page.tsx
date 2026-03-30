import { SpecActions } from "@/components/v2/SpecActions"
import Link from "next/link"
import * as fs from "fs"
import * as path from "path"
import { getApplication, getProject, listSpecConfigs, getSpecDir } from "@/lib/v2"
import { notFound } from "next/navigation"

const STATUS_COLORS: Record<string, string> = {
  "draft":            "bg-gray-100 text-gray-600",
  "spec-review":      "bg-yellow-50 text-yellow-700 border border-yellow-200",
  "ready":            "bg-green-50 text-green-700 border border-green-200",
  "executed":         "bg-blue-50 text-blue-700 border border-blue-200",
  "execution-review": "bg-purple-50 text-purple-700 border border-purple-200",
  "accepted":         "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "rejected":         "bg-red-50 text-red-700 border border-red-200",
}

export default async function ProjectDetailPage(
  { params }: { params: Promise<{ appId: string; projId: string }> }
) {
  const { appId, projId } = await params
  const app  = getApplication(appId)
  const proj = getProject(appId, projId)
  if (!app || !proj) return notFound()

  const specDir     = getSpecDir(app, proj)
  const specExists  = fs.existsSync(specDir)
  const specConfigs = listSpecConfigs(appId, projId)
  const configById  = Object.fromEntries(specConfigs.map(s => [s.id, s]))
  const mdFiles     = specExists
    ? fs.readdirSync(specDir).filter((f: string) => f.endsWith(".md")).sort()
    : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/v2/applications" className="hover:text-gray-900">Applications</Link>
        <span className="mx-2">/</span>
        <Link href={`/applications/${appId}`} className="hover:text-gray-900">{app.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{proj.name}</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{proj.name}</h1>
          {proj.description && <p className="text-sm text-gray-500 mt-1">{proj.description}</p>}
        </div>
        <Link href={`/applications/${appId}/projects/${projId}/edit`} className="btn-secondary text-sm">Edit</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          ["APP DIRECTORY",  app.appDir],
          ["SPEC DIRECTORY", specDir],
          ["LOGS DIRECTORY", app.logsDir],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="font-mono text-xs text-gray-700 truncate" title={value}>{value}</p>
          </div>
        ))}
      </div>

      {!specExists && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          ⚠ Spec directory not found: <span className="font-mono">{specDir}</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-gray-900">Specs <span className="text-gray-400">({mdFiles.length})</span></h2>
          <div className="flex gap-2">
            <Link href={`/applications/${appId}/projects/${projId}/spec-assistant`} className="btn-ghost text-sm">Spec Assistant</Link>
            <Link href={`/applications/${appId}/projects/${projId}/specs/new`} className="btn-secondary text-sm">New Spec</Link>
          </div>
        </div>
        <div className="space-y-2">
          {mdFiles.map((filename: string) => {
            const specId   = filename.replace(/\.md$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
            const config   = configById[specId]
            const status   = config?.status ?? "draft"
            const specFile = path.join(specDir, filename)
            return (
              <div key={filename} className="card flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium text-blue-600">{filename.replace(/\.md$/, "")}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>{status}</span>
                    {config?.jiraTicketId && (
                      <a href={config.jiraUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 hover:bg-blue-100">
                        {config.jiraTicketId}
                      </a>
                    )}
                  </div>
                </div>
                <SpecActions appId={appId} projId={projId} specId={specId} specFile={specFile} />
              </div>
            )
          })}
          {mdFiles.length === 0 && specExists && (
            <div className="card text-center py-8 text-gray-500 text-sm">
              No spec files found in <span className="font-mono">{specDir}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
