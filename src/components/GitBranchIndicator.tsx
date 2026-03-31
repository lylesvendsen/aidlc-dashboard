'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

interface GitStatus {
  branch: string
  dirty: boolean
  dirtyCount: number
  lastCommit: { sha: string; message: string; ago: string } | null
}

interface Branches {
  local: string[]
  remote: string[]
}

interface GitBranchIndicatorProps {
  projectId: string
  className?: string
}

export function GitBranchIndicator({ projectId, className = "" }: GitBranchIndicatorProps) {
  const [status,   setStatus]   = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<Branches | null>(null)
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [newBranch, setNewBranch] = useState("")
  const [creating,  setCreating]  = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [tab,      setTab]      = useState<"local"|"remote">("local")
  const ref = useRef<HTMLDivElement>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/git?projectId=" + projectId + "&action=status")
      if (r.ok) setStatus(await r.json() as GitStatus)
    } catch {}
  }, [projectId])

  const fetchBranches = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/git?projectId=" + projectId + "&action=branches")
      if (r.ok) setBranches(await r.json() as Branches)
    } catch {}
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (open && !branches) fetchBranches()
  }, [open, branches, fetchBranches])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function switchBranch(branch: string, fromRemote = false) {
    setSwitching(branch)
    setError(null)
    const r = await fetch("/api/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action: "switch", branch }),
    })
    const d = await r.json() as { ok?: boolean; error?: string }
    if (d.ok) {
      await fetchStatus()
      await fetchBranches()
    } else {
      setError(d.error ?? "Failed to switch branch")
    }
    setSwitching(null)
  }

  async function createBranch() {
    if (!newBranch.trim()) return
    setCreating(true)
    setError(null)
    const r = await fetch("/api/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, action: "create", branch: newBranch.trim() }),
    })
    const d = await r.json() as { ok?: boolean; error?: string }
    if (d.ok) {
      setNewBranch("")
      await fetchStatus()
      await fetchBranches()
    } else {
      setError(d.error ?? "Failed to create branch")
    }
    setCreating(false)
  }

  if (!status) return null

  const currentBranch = status.branch
  const localBranches = (branches?.local ?? []).map(b => b.replace("|current", ""))
  const remoteBranches = branches?.remote ?? []

  return (
    <div ref={ref} className={"relative " + className}>
      <button
        onClick={() => setOpen(v => !v)}
        className={"flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors " +
          (open ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")}
      >
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="font-mono">{currentBranch}</span>
        {status.dirty && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title={status.dirtyCount + " uncommitted changes"} />
        )}
        <svg className={"w-3 h-3 text-gray-400 transition-transform " + (open ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">Current branch</span>
              <span className="font-mono text-xs text-blue-600 font-semibold">{currentBranch}</span>
              {status.dirty && (
                <span className="ml-auto text-xs text-amber-600">{status.dirtyCount} change{status.dirtyCount !== 1 ? "s" : ""}</span>
              )}
            </div>
            {status.lastCommit && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {status.lastCommit.sha} · {status.lastCommit.message} · {status.lastCommit.ago}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(["local", "remote"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={"flex-1 py-1.5 text-xs font-medium transition-colors " +
                  (tab === t ? "text-blue-600 border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-700")}>
                {t === "local" ? "Local" : "Remote"}
                {t === "local" && localBranches.length > 0 && <span className="ml-1 text-gray-400">({localBranches.length})</span>}
                {t === "remote" && remoteBranches.length > 0 && <span className="ml-1 text-gray-400">({remoteBranches.length})</span>}
              </button>
            ))}
          </div>

          {/* Branch list */}
          <div className="max-h-48 overflow-y-auto">
            {loading && <p className="text-xs text-gray-400 text-center py-4">Loading...</p>}
            {!loading && tab === "local" && localBranches.map(b => (
              <button key={b} onClick={() => b !== currentBranch && switchBranch(b)}
                disabled={switching === b || b === currentBranch}
                className={"w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors " +
                  (b === currentBranch ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700")}>
                {switching === b
                  ? <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  : <span className={"w-2 h-2 rounded-full shrink-0 " + (b === currentBranch ? "bg-blue-500" : "bg-gray-300")} />
                }
                <span className="font-mono truncate">{b}</span>
                {b === currentBranch && <span className="ml-auto text-xs text-blue-500">current</span>}
              </button>
            ))}
            {!loading && tab === "remote" && remoteBranches.map(b => (
              <button key={b} onClick={() => switchBranch(b, true)}
                disabled={switching === b}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 text-gray-700 transition-colors">
                {switching === b
                  ? <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  : <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                }
                <span className="font-mono truncate">{b}</span>
                <span className="ml-auto text-xs text-gray-400">remote</span>
              </button>
            ))}
            {!loading && tab === "local" && localBranches.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No local branches</p>
            )}
            {!loading && tab === "remote" && remoteBranches.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No remote branches</p>
            )}
          </div>

          {/* Create branch */}
          <div className="border-t border-gray-100 p-2">
            <div className="flex gap-1.5">
              <input
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createBranch()}
                placeholder="New branch name..."
                className="flex-1 text-xs px-2 py-1.5 border border-gray-200 rounded font-mono focus:outline-none focus:border-blue-400"
              />
              <button onClick={createBranch} disabled={creating || !newBranch.trim()}
                className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap">
                {creating ? "..." : "Create"}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
