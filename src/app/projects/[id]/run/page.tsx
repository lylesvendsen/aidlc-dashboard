"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import type { StreamEvent } from "@/types"

type SpStatus = "pending" | "running" | "passed" | "failed"

export default function RunPage() {
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const specFile     = searchParams.get("specFile") ?? ""
  const fromSpId     = searchParams.get("fromSpId") ?? undefined

  const [lines,        setLines]        = useState<string[]>([])
  const [spStatus,     setSpStatus]     = useState<Record<string, SpStatus>>({})
  const [done,         setDone]         = useState(false)
  const [running,      setRunning]      = useState(false)
  const [dryRun,       setDryRun]       = useState(true)
  const [dryRunPassed, setDryRunPassed] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  // If resuming from a specific SP, dry run already implicitly validated
  const dryRunRequired = !fromSpId

  const specName = decodeURIComponent(specFile).split("/").pop() ?? ""

  const start = (dry: boolean) => {
    setLines([])
    setSpStatus({})
    setDone(false)
    setRunning(true)
    if (!dry) setDryRun(false)

    const url = "/api/stream?projectId=" + id +
      "&specFile=" + encodeURIComponent(specFile) +
      (fromSpId ? "&fromSpId=" + fromSpId : "") +
      (dry ? "&dryRun=true" : "")

    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false })
      setLines(l => [...l, "[" + timestamp + "] " + event.message])
      if (event.type === "sp_start" && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "running" }))
      if (event.type === "sp_pass"  && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "passed" }))
      if (event.type === "sp_fail"  && event.spId) setSpStatus(s => ({ ...s, [event.spId!]: "failed" }))
      if (event.type === "done") {
        setDone(true)
        setRunning(false)
        es.close()
        if (dry) setDryRunPassed(true)
      }
      if (event.type === "error") {
        setDone(true)
        setRunning(false)
        es.close()
        if (dry) setDryRunPassed(false)
      }
    }
    es.onerror = () => { setRunning(false); es.close() }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  const statusIcon  = (s: SpStatus) =>
    s === "running" ? "..." : s === "passed" ? "✓" : s === "failed" ? "✗" : "—"
  const statusColor = (s: SpStatus) =>
    s === "running" ? "text-blue-500" : s === "passed" ? "text-green-600" :
    s === "failed"  ? "text-red-500"  : "text-gray-400"

  const overallPassed = done && !Object.values(spStatus).some(s => s === "failed")
  const overallFailed = done &&  Object.values(spStatus).some(s => s === "failed")
  const canRunLive    = !dryRunRequired || dryRunPassed

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1 truncate">{specName}</p>
          {fromSpId && (
            <p className="text-xs text-amber-600 mt-0.5">
              Resuming from {fromSpId} — dry run not required
            </p>
          )}
        </div>
        <button onClick={() => router.back()} className="btn-ghost text-sm shrink-0">Back</button>
      </div>

      {/* Controls */}
      <div className="card space-y-4">

        {/* Step 1 — Dry run */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={
              "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 " +
              (dryRunPassed ? "bg-green-500 text-white" :
               !dryRunRequired ? "bg-gray-200 text-gray-400" :
               "bg-brand-500 text-white")
            }>
              {dryRunPassed ? "✓" : "1"}
            </span>
            <p className="text-sm font-medium text-gray-700">
              {dryRunPassed ? "Dry run passed" : "Run dry run first"}
            </p>
          </div>
          <p className="text-xs text-gray-400 ml-7">
            {dryRunRequired
              ? "Validates spec parsing — no files written, no API calls. Required before going live."
              : "Skipped — resuming from a specific sub-prompt."}
          </p>
          {!dryRunPassed && dryRunRequired && !running && (
            <div className="ml-7">
              <button
                onClick={() => start(true)}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                Run Dry Run
              </button>
            </div>
          )}
          {dryRunPassed && !running && (
            <div className="ml-7">
              <button
                onClick={() => { setDryRunPassed(false); start(true) }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Re-run dry run
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100" />

        {/* Step 2 — Run live */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={
              "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 " +
              (canRunLive ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-400")
            }>
              2
            </span>
            <p className={"text-sm font-medium " + (canRunLive ? "text-gray-700" : "text-gray-400")}>
              Run live
            </p>
          </div>
          <p className="text-xs text-gray-400 ml-7">
            Calls Claude API, writes files to disk, and runs validation after each sub-prompt.
          </p>
          <div className="ml-7 flex items-center gap-3">
            <button
              onClick={() => start(false)}
              disabled={!canRunLive || running}
              className={"btn-primary text-sm whitespace-nowrap " +
                (!canRunLive ? "opacity-40 cursor-not-allowed" : "")}
            >
              {running && !dryRun ? "Running..." : "Run Live"}
            </button>
            {!canRunLive && (
              <p className="text-xs text-gray-400">Complete dry run first to unlock</p>
            )}
          </div>
        </div>

        {/* Status bar */}
        {done && (
          <div className={
            "rounded-lg px-3 py-2 text-sm font-medium border " +
            (overallPassed
              ? (dryRun
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-green-50 text-green-700 border-green-200")
              : "bg-red-50 text-red-700 border-red-200")
          }>
            {overallPassed && dryRun  && "✓ Dry run complete — ready to run live"}
            {overallPassed && !dryRun && "✓ Execution complete"}
            {overallFailed            && "✗ Execution failed — see log below"}
          </div>
        )}
      </div>

      {/* Sub-prompt status */}
      {Object.keys(spStatus).length > 0 && (
        <div className="card space-y-1.5">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Sub-prompts {dryRun && running ? "(dry run)" : ""}
          </p>
          {Object.entries(spStatus).map(([spId, status]) => (
            <div key={spId} className={"flex items-center gap-2 text-sm " + statusColor(status)}>
              <span className="w-4 text-center font-mono">{statusIcon(status)}</span>
              <span className="font-mono">{spId}</span>
              {dryRun && status === "passed" && (
                <span className="text-xs text-gray-400">(not executed)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log stream */}
      <div
        ref={logRef}
        className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-0.5"
      >
        {lines.length === 0 && !running && (
          <p className="text-gray-500">
            {canRunLive
              ? "Dry run passed — click \"Run Live\" to execute."
              : "Click \"Run Dry Run\" above to validate the spec before executing."}
          </p>
        )}
        {lines.map((line, i) => (
          <p key={i} className={
            line.includes("failed") || line.includes("✗") ? "text-red-400" :
            line.includes("passed") || line.includes("✓") || line.includes("complete") ? "text-green-300" :
            line.includes("Running") || line.includes("Starting") ? "text-blue-300" :
            "text-green-300"
          }>{line}</p>
        ))}
        {running && (
          <p className="text-blue-400 animate-pulse">
            {dryRun ? "Running dry run..." : "Running live..."}
          </p>
        )}
      </div>
    </div>
  )
}
