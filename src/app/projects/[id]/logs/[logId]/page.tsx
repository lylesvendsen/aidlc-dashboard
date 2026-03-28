"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { ExecutionLog } from "@/types"

export default function LogDetailPage() {
  const { id, logId } = useParams<{ id: string; logId: string }>()
  const router        = useRouter()
  const [log,        setLog]        = useState<ExecutionLog | null>(null)
  const [undoing,    setUndoing]    = useState(false)
  const [undone,     setUndone]     = useState(false)
  const [expanded,   setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/logs/" + logId + "?projectId=" + id).then(r => r.json()).then(setLog)
  }, [id, logId])

  const undo = async () => {
    if (!confirm("Revert app directory to git state before this run?")) return
    setUndoing(true)
    const res  = await fetch("/api/undo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id, logId }),
    })
    const data = await res.json()
    setUndoing(false)
    if (data.ok) setUndone(true)
    else alert("Undo failed: " + data.error)
  }

  if (!log) return <p className="text-gray-400">Loading...</p>

  const totalTokens = log.subPrompts.reduce((s, sp) => s + sp.tokens.input + sp.tokens.output, 0)
  const estCost     = ((totalTokens / 1_000_000) * 3).toFixed(4)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{log.unitId} — {log.unitTitle}</h1>
          <p className="text-gray-500 text-sm">{new Date(log.timestamp).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          {log.gitStateBeforeRun && !undone && (
            <button onClick={undo} disabled={undoing} className="btn-danger text-sm">
              {undoing ? "Reverting..." : "Undo Run"}
            </button>
          )}
          {undone && <span className="badge-pass text-sm px-3 py-1">Reverted</span>}
          <Link href={"/projects/" + id + "/run?specFile=" + encodeURIComponent(log.specFile)} className="btn-primary text-sm">
            Re-run
          </Link>
          <button onClick={() => router.back()} className="btn-ghost text-sm">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Status</p>
          <span className={log.status === "passed" ? "badge-pass" : "badge-fail"}>{log.status}</span>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Duration</p>
          <p className="font-semibold">{Math.round(log.durationMs / 1000)}s</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Tokens</p>
          <p className="font-semibold">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Est. cost</p>
          <p className="font-semibold">${estCost}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Sub-prompts</h2>
        {log.subPrompts.map(sp => (
          <div key={sp.id} className="card space-y-2">
            <div className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpanded(expanded === sp.id ? null : sp.id)}>
              <div className="flex items-center gap-3">
                <span className={sp.status === "passed" ? "badge-pass" : sp.status === "failed" ? "badge-fail" : "badge-none"}>
                  {sp.status}
                </span>
                <span className="font-mono text-sm font-semibold">{sp.id}</span>
                <span className="text-sm">{sp.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>{(sp.tokens.input + sp.tokens.output).toLocaleString()} tokens</span>
                <span>{Math.round(sp.durationMs / 1000)}s</span>
                <span>{expanded === sp.id ? "▲" : "▼"}</span>
              </div>
            </div>
            {expanded === sp.id && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                {sp.filesWritten.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Files written</p>
                    {sp.filesWritten.map(f => (
                      <p key={f} className="text-xs font-mono text-gray-600">{f}</p>
                    ))}
                  </div>
                )}
                {sp.validation.map(v => (
                  <div key={v.command}>
                    <p className={"text-xs font-mono font-medium " + (v.passed ? "text-green-600" : "text-red-500")}>
                      {v.passed ? "✓" : "✗"} {v.command}
                    </p>
                    {!v.passed && v.output && (
                      <pre className="text-xs text-red-600 bg-red-50 rounded p-2 mt-1 overflow-x-auto">
                        {v.output.slice(0, 500)}
                      </pre>
                    )}
                  </div>
                ))}
                {sp.error && (
                  <pre className="text-xs text-red-600 bg-red-50 rounded p-2 overflow-x-auto">{sp.error}</pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {log.git && (
        <div className="card">
          <p className="text-sm font-medium text-gray-700 mb-2">Git</p>
          <p className="text-xs font-mono text-gray-600">{log.git.commit} — {log.git.message}</p>
          <p className="text-xs font-mono text-gray-400">{log.git.tag}</p>
        </div>
      )}
    </div>
  )
}
