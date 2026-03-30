'use client'
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

type Exists = true | false | null
interface DS { exists: Exists; checking: boolean; resolved: string }
const EMPTY: DS = { exists: null, checking: false, resolved: "" }

// DirRow is defined OUTSIDE the parent component so it never remounts on re-render
function DirRow({ label, value, ds, onChange, onCheck, onCreate, showCheck = true }: {
  label: string; value: string; ds: DS
  onChange: (v: string) => void
  onCheck: () => void
  onCreate: () => void
  showCheck?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label} *</label>
      <div className="flex gap-2 items-center">
        <input className="input-field flex-1" value={value} required
          onChange={e => onChange(e.target.value)} />
        {showCheck && (
          <button type="button" onClick={onCheck}
            disabled={!value.trim() || ds.checking}
            className="btn-secondary text-xs whitespace-nowrap px-3">
            {ds.checking ? "..." : "Check"}
          </button>
        )}
        {!ds.checking && ds.exists === true && (
          <span className="text-xs text-green-600 whitespace-nowrap">✓ exists</span>
        )}
        {!ds.checking && ds.exists === false && (
          <button type="button" onClick={onCreate}
            className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-600 hover:bg-amber-50 whitespace-nowrap">
            Create
          </button>
        )}
      </div>
      {ds.resolved && ds.resolved !== value && (
        <p className="text-xs text-gray-400 font-mono">→ {ds.resolved}</p>
      )}
    </div>
  )
}

export default function NewApplicationPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")
  const [name,              setName]             = useState("")
  const [description,       setDescription]      = useState("")
  const [appDir,            setAppDir]           = useState("")
  const [specDir,           setSpecDir]          = useState("")
  const [logsDir,           setLogsDir]          = useState("")
  const [defaultModel,      setDefaultModel]     = useState("claude-sonnet-4-6")
  const [projectContext,    setProjectContext]   = useState("")
  const [globalConstraints, setGlobalConstraints]= useState("")
  const [appDS,  setAppDS]  = useState<DS>(EMPTY)
  const [specDS, setSpecDS] = useState<DS>(EMPTY)
  const [logsDS, setLogsDS] = useState<DS>(EMPTY)

  async function checkPath(p: string): Promise<DS> {
    if (!p.trim()) return EMPTY
    const res  = await fetch(`/api/v2/check-dir?path=${encodeURIComponent(p)}`)
    const data = await res.json()
    return { exists: data.exists, checking: false, resolved: data.path ?? p }
  }

  async function handleCheckApp() {
    if (!appDir.trim()) return
    const sd = specDir || appDir.replace(/\/+$/, "") + "/docs/aidlc/specs"
    const ld = logsDir || appDir.replace(/\/+$/, "") + "/docs/aidlc/logs"
    if (!specDir) setSpecDir(sd)
    if (!logsDir) setLogsDir(ld)
    setAppDS(s => ({ ...s, checking: true }))
    setSpecDS(s => ({ ...s, checking: true }))
    setLogsDS(s => ({ ...s, checking: true }))
    const [a, s, l] = await Promise.all([checkPath(appDir), checkPath(sd), checkPath(ld)])
    setAppDS(a); setSpecDS(s); setLogsDS(l)
  }

  async function handleCheckSpec() {
    setSpecDS(s => ({ ...s, checking: true }))
    setSpecDS(await checkPath(specDir))
  }

  async function handleCheckLogs() {
    setLogsDS(s => ({ ...s, checking: true }))
    setLogsDS(await checkPath(logsDir))
  }

  async function createPath(p: string, setDS: (d: DS) => void) {
    setDS({ exists: null, checking: true, resolved: "" })
    const res  = await fetch("/api/v2/check-dir", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p }),
    })
    const data = await res.json()
    setDS({ exists: res.ok, checking: false, resolved: data.path ?? p })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("")
    try {
      const res = await fetch("/api/v2/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, appDir, specDir, logsDir, defaultModel, projectContext,
          globalConstraints: globalConstraints.split("\n").map(s => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      router.push(`/v2/applications/${(await res.json()).id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error"); setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/v2/applications" className="hover:text-gray-900">Applications</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">New Application</span>
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">New Application</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Name *</label>
          <input className="input-field" value={name} required
            placeholder="My Application" onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <input className="input-field" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <DirRow label="App directory"  value={appDir}  ds={appDS}
          onChange={v => { setAppDir(v);  setAppDS(EMPTY)  }}
          onCheck={handleCheckApp}
          onCreate={() => createPath(appDir, setAppDS)} />
        <DirRow label="Spec directory" value={specDir} ds={specDS}
          onChange={v => { setSpecDir(v); setSpecDS(EMPTY) }}
          onCheck={handleCheckSpec}
          onCreate={() => createPath(specDir, setSpecDS)}
          showCheck={false} />
        <DirRow label="Logs directory" value={logsDir} ds={logsDS}
          onChange={v => { setLogsDir(v); setLogsDS(EMPTY) }}
          onCheck={handleCheckLogs}
          onCreate={() => createPath(logsDir, setLogsDS)}
          showCheck={false} />
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Default model</label>
          <input className="input-field font-mono" value={defaultModel}
            placeholder="claude-sonnet-4-6" onChange={e => setDefaultModel(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Project context</label>
          <textarea className="input-field min-h-[80px]" value={projectContext}
            placeholder="Describe this application..." onChange={e => setProjectContext(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Global constraints
            <span className="text-xs text-gray-400 font-normal ml-2">(inherited by all projects, cannot be removed)</span>
          </label>
          <textarea className="input-field min-h-[80px] font-mono text-xs" value={globalConstraints}
            placeholder="TypeScript strict mode throughout
Never import unused variables"
            onChange={e => setGlobalConstraints(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Creating..." : "Create Application"}
          </button>
          <Link href="/v2/applications" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
