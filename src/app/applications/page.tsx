import Link from "next/link"
import { listApplications, listProjects, listSpecConfigs } from "@/lib/v2"

export default function ApplicationsPage() {
  const applications = listApplications()

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your AI-driven development lifecycle applications</p>
        </div>
        <Link href="/applications/new" className="btn-primary text-sm">
          + New Application
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No applications yet.</p>
          <Link href="/applications/new" className="btn-primary text-sm mt-4 inline-block">
            Create your first application
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {applications.map(app => {
            const projects = listProjects(app.id)
            const specCount = projects.reduce((sum, proj) => {
              return sum + listSpecConfigs(app.id, proj.id).length
            }, 0)
            return (
              <Link
                key={app.id}
                href={`/applications/${app.id}`}
                className="card hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start justify-between">
                  <h2 className="font-medium text-gray-900">{app.name}</h2>
                  <span className="text-gray-400 text-lg">→</span>
                </div>
                {app.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{app.description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  <span>{projects.length} project{projects.length !== 1 ? "s" : ""}</span>
                  <span>{specCount} spec{specCount !== 1 ? "s" : ""}</span>
                  {(app.globalConstraints?.length ?? 0) > 0 && (
                    <span className="text-amber-600">{app.globalConstraints!.length} constraints</span>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-mono text-gray-400">{app.defaultModel ?? "claude-sonnet-4-6"}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
