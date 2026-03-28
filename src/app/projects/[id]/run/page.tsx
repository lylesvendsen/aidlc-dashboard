"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import type { StreamEvent } from "@/types"

type SpStatus = "pending" | "running" | "passed" | "failed"

export default function RunPage() {
  const { id }        = useParams<{ id: string }>()
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const specFile      = searchParams.get("specFile") ?? ""
  const fromSpId      = searchParams.get("fromSpId") ?? undefined

  const [lines, setLines]       = useState<string[]>([])
  const [spStatus, setSpStatus] = useState<Record<string, SpStatus>>({})
  const [done, setDone]         = useState(false)
  const [running, setRunning]   = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const start = () => {
    setLines([])
    setSpStatus({})
    setDone(false)
    setRunning(true)

    const url = "/api/stream?projectId=" + id +
      "&specFile=" + encodeURIComponent(specFile) +
      (fromSpId ? "&fromSpId=" + fromSpId : "")

    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      setLines(l => [...l, event.message])
      if (event.type === "sp_start" && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "running" }))
      if (event.type === "sp_pass"  && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "passed" }))
      if (event.type === "sp_fail"  && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "failed" }))
      if (event.type === "done" || event.type === "error") { setDone(true); setRunning(false); es.close() }
    }
    es.onerror = () => { setRunning(false); es.close() }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  const statusIcon = (s: SpStatus) =>
    s === "running" ? "⏳" : s === "passed" ? "✓" : s === "failed" ? "✗" : "—"

  const statusColor = (s: SpStatus) =>
    s === "running" ? "text-blue-500" : s === "passed" ? "text-green-600" : s === "failed" ? "text-red-500" : "text-gray-400"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1">{decodeURIComponent(specFile).split("/").pop()}</p>
        </div>
        <div className="flex gap-2">
          {!running && !done && (
            <button onClick={start} className="btn-primary">Start Execution</button>
          )}
          {done && (
            <button onClick={start} className="btn-secondary">Run Again</button>
          )}
          <button onClick={() => router.back()} className="btn-ghost">Back</button>
        </div>
      </div>

      {Object.keys(spStatus).length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-3">Sub-prompts</p>
          {Object.entries(spStatus).map(([spId, status]) => (
            <div key={spId} className={"flex items-center gap-2 text-sm " + statusColor(status)}>
              <span>{statusIcon(status)}</span>
              <span className="font-mono">{spId}</span>
            </div>
          ))}
        </div>
      )}

      <div
        ref={logRef}
        className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs text-green-300 space-y-0.5"
      >
        {lines.length === 0 && !running && (
          <p className="text-gray-500">Click "Start Execution" to begin...</p>
        )}
        {lines.map((line, i) => <p key={i}>{line}</p>)}
        {running && <p className="text-blue-400 animate-pulse">Running...</p>}
      </div>
    </div>
  )
}
