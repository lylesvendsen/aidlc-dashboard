import Link from "next/link"
import { getApplication, listProjects, listSpecConfigs } from "@/lib/v2"
import { notFound } from "next/navigation"

export default async function ApplicationDetailPage(
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params
  const app = getApplication(appId)
  if (!app) return notFound()
  const projects = listProjects(appId)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/v2/applications" className="hover:text-gray-900">Applications</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{app.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{app.name}</h1>
          {app.description && <p className="text-sm text-gray-500 mt-1">{app.description}</p>}
        </div>
        <Link href={`/applications/${appId}/edit`} className="btn-secondary text-sm">Edit</Link>
      </div>

      {/* Config summary */}
      <div className="card grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">App directory</p>
          <p className="font-mono text-gray-700 truncate text-xs">{app.appDir}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Spec directory</p>
          <p className="font-mono text-gray-700 truncate text-xs">{app.specDir}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Model</p>
          <p className="font-mono text-gray-700 text-xs">{app.defaultModel ?? "claude-sonnet-4-6"}</p>
        </div>
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-gray-900">Projects <span className="text-gray-400">({projects.length})</span></h2>
          <Link href={`/applications/${appId}/projects/new`} className="btn-primary text-sm">+ New Project</Link>
        </div>
        <div className="space-y-2">
          {projects.map(proj => {
            const specs = listSpecConfigs(appId, proj.id)
            return (
              <Link key={proj.id} href={`/applications/${appId}/projects/${proj.id}`}
                className="card hover:shadow-md transition-shadow flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{proj.name}</p>
                  {proj.description && <p className="text-sm text-gray-500">{proj.description}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{specs.length} specs</span>
                  <span className="text-gray-400">→</span>
                </div>
              </Link>
            )
          })}
          {projects.length === 0 && (
            <div className="card text-center py-8 text-gray-500 text-sm">
              No projects yet. <Link href={`/applications/${appId}/projects/new`} className="text-blue-600 hover:underline">Create one</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
