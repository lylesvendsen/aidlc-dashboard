"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import type { ExecutionLog } from "@/types"

export default function LogsPage() {
  const { id } = useParams<{ id: string }>()
  const [logs, setLogs] = useState<ExecutionLog[]>([])

  useEffect(() => {
    fetch("/api/logs?projectId=" + id).then(r => r.json()).then(d => Array.isArray(d) ? setLogs(d) : null)
  }, [id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Execution History</h1>
        <Link href={"/projects/" + id} className="btn-ghost">Back</Link>
      </div>
      {logs.length === 0 && <p className="text-gray-400">No runs yet.</p>}
      <div className="space-y-3">
        {logs.map(log => (
          <Link key={log.id} href={"/projects/" + id + "/logs/" + log.id}
            className="card flex items-center justify-between hover:border-brand-300 transition-colors block">
            <div className="flex items-center gap-3">
              <span className={log.status === "passed" ? "badge-pass" : log.status === "failed" ? "badge-fail" : "badge-run"}>
                {log.status}
              </span>
              <span className="font-mono text-sm font-semibold">{log.unitId}</span>
              <span className="text-sm">{log.unitTitle}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>{Math.round(log.durationMs / 1000)}s</span>
              <span>{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
