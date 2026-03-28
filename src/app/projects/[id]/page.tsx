"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { Project, SpecFile, ExecutionLog } from "@/types"

export default function ProjectPage() {
  const { id }  = useParams<{ id: string }>()
  const [project, setProject]     = useState<Project | null>(null)
  const [specs,   setSpecs]       = useState<SpecFile[]>([])
  const [logs,    setLogs]        = useState<ExecutionLog[]>([])
  const [deleteTarget, setDeleteTarget] = useState<SpecFile | null>(null)
  const [deleteInput,  setDeleteInput]  = useState("")
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState("")

  const loadSpecs = () =>
    fetch("/api/specs?projectId=" + id)
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setSpecs(d) : null)

  useEffect(() => {
    fetch("/api/projects/" + id).then(r => r.json()).then(setProject)
    loadSpecs()
    fetch("/api/logs?projectId=" + id)
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setLogs(d) : null)
  }, [id])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteInput !== deleteTarget.filename) {
      setDeleteError("Filename doesn't match — please type it exactly")
      return
    }
    setDeleting(true)
    setDeleteError("")
    const res = await fetch(
      "/api/specs/" + encodeURIComponent(deleteTarget.filename) + "?projectId=" + id,
      { method: "DELETE" }
    )
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json()
      setDeleteError(data.error ?? "Delete failed")
      return
    }
    setDeleteTarget(null)
    setDeleteInput("")
    loadSpecs()
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
    setDeleteInput("")
    setDeleteError("")
  }

  if (!project) return <p className="text-gray-400">Loading...</p>

  const recentLogs = logs.slice(0, 5)

  return (
    <div className="space-y-8">

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card max-w-md w-full mx-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-red-600">Delete spec?</h2>
              <p className="text-sm text-gray-600 mt-1">
                This will permanently delete the spec file from disk.
                This cannot be undone.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-sm text-gray-700">
              {deleteTarget.filename}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Type the filename to confirm:
              </label>
              <input
                className="input-field font-mono"
                placeholder={deleteTarget.filename}
                value={deleteInput}
                onChange={e => { setDeleteInput(e.target.value); setDeleteError("") }}
                autoFocus
              />
              {deleteError && (
                <p className="text-xs text-red-500">{deleteError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                disabled={deleting || deleteInput !== deleteTarget.filename}
                className="btn-danger"
              >
                {deleting ? "Deleting..." : "Delete Spec"}
              </button>
              <button onClick={cancelDelete} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 mt-1">{project.description}</p>
          )}
        </div>
        <Link href={"/projects/" + id + "/config"} className="btn-secondary">
          Edit Config
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="card">
          <p className="text-gray-400 text-xs mb-1">App directory</p>
          <p className="font-mono text-xs truncate">{project.appDir || "not set"}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-xs mb-1">Spec directory</p>
          <p className="font-mono text-xs truncate">{project.specDir || "not set"}</p>
        </div>
        <div className="card">
          <p className="text-gray-400 text-xs mb-1">Model</p>
          <p className="font-mono text-xs">{project.model}</p>
        </div>
      </div>

      {/* Specs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Specs</h2>
          <Link href={"/projects/" + id + "/specs/new"} className="btn-secondary text-sm">
            New Spec
          </Link>
        </div>

        {specs.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No specs found in {project.specDir}
          </p>
        ) : (
          specs.map(spec => {
            const lastLog = logs.find(l => l.unitId === spec.id)
            return (
              <div key={spec.id} className="card flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-brand-600">
                      {spec.id}
                    </span>
                    <span className="font-medium">{spec.title}</span>
                    {lastLog && (
                      <span className={lastLog.status === "passed" ? "badge-pass" : "badge-fail"}>
                        {lastLog.status}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">
                    {spec.summary.slice(0, 80)}
                  </p>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <Link
                    href={"/projects/" + id + "/specs/" + encodeURIComponent(spec.filename)}
                    className="btn-ghost text-sm"
                  >
                    Edit
                  </Link>
                  <Link
                    href={"/projects/" + id + "/run?specFile=" + encodeURIComponent(spec.filePath)}
                    className="btn-primary text-sm"
                  >
                    Run
                  </Link>
                  <button
                    onClick={() => { setDeleteTarget(spec); setDeleteInput("") }}
                    className="btn-danger text-sm"
                    title="Delete spec"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Recent runs */}
      {recentLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent runs</h2>
            <Link
              href={"/projects/" + id + "/logs"}
              className="text-sm text-brand-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {recentLogs.map(log => (
            <Link
              key={log.id}
              href={"/projects/" + id + "/logs/" + log.id}
              className="card flex items-center justify-between hover:border-brand-300 transition-colors block"
            >
              <div className="flex items-center gap-3">
                <span className={
                  log.status === "passed"  ? "badge-pass" :
                  log.status === "failed"  ? "badge-fail" : "badge-run"
                }>
                  {log.status}
                </span>
                <span className="font-mono text-sm font-semibold">{log.unitId}</span>
                <span className="text-sm text-gray-600">{log.unitTitle}</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
