"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

type DirCheckResult = {
  exists:       boolean
  hasStructure: boolean
  hasSpecDir:   boolean
  hasLogsDir:   boolean
  specDir:      string | null
  logsDir:      string | null
  specCount:    number
  resolvedDir:  string
  message?:     string
}

type Mode = "idle" | "checking" | "has-structure" | "no-structure" | "manual" | "not-found"

const DEFAULT_CONSTRAINTS = [
  "TypeScript strict mode throughout",
  "Never hardcode credentials or secrets",
  "Write ALL failing tests before any implementation code",
  "Run npm run typecheck and npm run lint before marking done",
].join("\n")

export default function NewProjectPage() {
  const router    = useRouter()
  const [saving,   setSaving]   = useState(false)
  const [checking, setChecking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mode,     setMode]     = useState<Mode>("idle")
  const [dirResult, setDirResult] = useState<DirCheckResult | null>(null)

  const [form, setForm] = useState({
    name:           "",
    description:    "",
    appDir:         "",
    specDir:        "",
    logsDir:        "",
    model:          "claude-sonnet-4-6",
    projectContext: "",
    constraints:    DEFAULT_CONSTRAINTS,
  })

  const checkDir = async () => {
    if (!form.appDir.trim()) return
    setChecking(true)
    setMode("checking")
    setDirResult(null)
    const res  = await fetch("/api/check-dir", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ appDir: form.appDir }),
    })
    const data: DirCheckResult = await res.json()
    setDirResult(data)
    setChecking(false)
    if (!data.exists) {
      setMode("not-found")
    } else if (data.hasStructure) {
      setForm(f => ({ ...f, specDir: data.specDir ?? "", logsDir: data.logsDir ?? "" }))
      setMode("has-structure")
    } else {
      setMode("no-structure")
    }
  }

  const createStructure = async () => {
    setCreating(true)
    const res  = await fetch("/api/create-structure", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ appDir: form.appDir }),
    })
    const data = await res.json()
    setCreating(false)
    if (data.ok) {
      setForm(f => ({ ...f, specDir: data.specDir, logsDir: data.logsDir }))
      setMode("has-structure")
      setDirResult(d => d ? { ...d, hasStructure: true, specDir: data.specDir, logsDir: data.logsDir } : d)
    }
  }

  const save = async () => {
    setSaving(true)
    const body = {
      ...form,
      constraints: form.constraints.split("\n").map((s: string) => s.trim()).filter(Boolean),
    }
    const res  = await fetch("/api/projects", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
    const proj = await res.json()
    router.push("/projects/" + proj.id)
  }

  const resetDir = () => {
    setForm(f => ({ ...f, specDir: "", logsDir: "" }))
    setMode("idle")
    setDirResult(null)
  }

  const canSave = form.name && form.appDir && form.specDir && form.logsDir

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Project</h1>

      {/* Basic info */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Project info</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Project name</label>
          <input className="input-field" placeholder="OverBoardom"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <input className="input-field" placeholder="Brief description of your project"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Claude model</label>
          <select className="input-field" value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
            <option value="claude-sonnet-4-6">claude-sonnet-4-6 (recommended)</option>
            <option value="claude-opus-4-6">claude-opus-4-6 (most capable)</option>
          </select>
        </div>
      </div>

      {/* Directory setup */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Directory setup</h2>
        <p className="text-sm text-gray-500">
          Enter the absolute path to your app directory. The dashboard will check
          for the standard AIDLC structure inside it
          {" "}(<code className="text-xs bg-gray-100 px-1 rounded">docs/aidlc/specs</code> and{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">docs/aidlc/logs</code>).
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">App directory</label>
          <div className="flex gap-2">
            <input
              className="input-field flex-1 font-mono text-sm"
              placeholder="/Users/you/code/my-app"
              value={form.appDir}
              onChange={e => {
                setForm(f => ({ ...f, appDir: e.target.value, specDir: "", logsDir: "" }))
                setMode("idle")
                setDirResult(null)
              }}
            />
            <button
              onClick={checkDir}
              disabled={!form.appDir.trim() || checking}
              className="btn-secondary whitespace-nowrap"
            >
              {checking ? "Checking..." : "Check Directory"}
            </button>
          </div>
        </div>

        {mode === "not-found" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
            <p className="text-sm font-medium text-red-700">Directory not found</p>
            <p className="text-xs text-red-600 font-mono">{dirResult?.message}</p>
            <p className="text-xs text-red-500">Check the path and try again, or enter paths manually.</p>
            <button onClick={() => setMode("manual")} className="text-xs text-red-600 underline hover:no-underline">
              Enter paths manually instead
            </button>
          </div>
        )}

        {mode === "has-structure" && dirResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
            <p className="text-sm font-medium text-green-700">
              ✓ Standard AIDLC structure found
            </p>
            <div className="space-y-1 text-xs font-mono text-green-800 bg-green-100 rounded p-2">
              <p>specs → {form.specDir}</p>
              <p>logs  → {form.logsDir}</p>
            </div>
            {dirResult.specCount > 0 && (
              <p className="text-xs text-green-600">
                {dirResult.specCount} spec{dirResult.specCount !== 1 ? "s" : ""} found
              </p>
            )}
            <button onClick={() => setMode("manual")} className="text-xs text-green-700 underline hover:no-underline">
              Override with manual paths
            </button>
          </div>
        )}

        {mode === "no-structure" && dirResult && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-700">No AIDLC structure found</p>
            <p className="text-xs text-amber-600">
              Directory exists but is missing the standard folders. Creating them will add:
            </p>
            <div className="text-xs font-mono text-amber-800 bg-amber-100 rounded p-2 space-y-0.5">
              <p>{dirResult.resolvedDir}/docs/aidlc/specs/</p>
              <p>{dirResult.resolvedDir}/docs/aidlc/logs/</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createStructure}
                disabled={creating}
                className="btn-primary text-sm"
              >
                {creating ? "Creating..." : "Create Standard Structure"}
              </button>
              <button onClick={() => setMode("manual")} className="btn-secondary text-sm">
                Enter Paths Manually
              </button>
            </div>
          </div>
        )}

        {mode === "manual" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Manual path entry</p>
              <button onClick={resetDir} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Spec directory (absolute path)</label>
              <input className="input-field text-sm font-mono"
                placeholder="/absolute/path/to/specs"
                value={form.specDir}
                onChange={e => setForm(f => ({ ...f, specDir: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Logs directory (absolute path)</label>
              <input className="input-field text-sm font-mono"
                placeholder="/absolute/path/to/logs"
                value={form.logsDir}
                onChange={e => setForm(f => ({ ...f, logsDir: e.target.value }))} />
            </div>
          </div>
        )}
      </div>

      {/* Prompt context */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Prompt context</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Project context</label>
          <p className="text-xs text-gray-400">Injected into every Claude prompt.</p>
          <textarea rows={4} className="input-field font-mono text-xs"
            placeholder="My project is a... Stack: Next.js, TypeScript..."
            value={form.projectContext}
            onChange={e => setForm(f => ({ ...f, projectContext: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Constraints (one per line)</label>
          <p className="text-xs text-gray-400">Rules Claude must always follow.</p>
          <textarea rows={5} className="input-field font-mono text-xs"
            value={form.constraints}
            onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))} />
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <button onClick={save} disabled={saving || !canSave} className="btn-primary">
          {saving ? "Creating..." : "Create Project"}
        </button>
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
        {!canSave && form.appDir && !form.specDir && mode !== "manual" && (
          <p className="text-xs text-gray-400">
            Click "Check Directory" to set up spec and logs paths.
          </p>
        )}
      </div>
    </div>
  )
}
