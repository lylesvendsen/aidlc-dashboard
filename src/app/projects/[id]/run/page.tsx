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

  const [lines,       setLines]       = useState<string[]>([])
  const [spStatus,    setSpStatus]    = useState<Record<string, SpStatus>>({})
  const [done,        setDone]        = useState(false)
  const [running,     setRunning]     = useState(false)
  const [validated,   setValidated]   = useState<"pending" | "validating" | "passed" | "failed">("pending")
  const [validError,  setValidError]  = useState("")
  const logRef      = useRef<HTMLDivElement>(null)
  const autoStarted = useRef(false)

  const specName = decodeURIComponent(specFile).split("/").pop() ?? ""

  // Auto-validate on page load (unless resuming from a specific SP)
  useEffect(() => {
    if (fromSpId) {
      setValidated("passed")
      return
    }
    runValidation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start when resuming from a specific SP
  useEffect(() => {
    if (fromSpId && !autoStarted.current) {
      autoStarted.current = true
      start(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runValidation = () => {
    setValidated("validating")
    setValidError("")

    const url = "/api/stream?projectId=" + id +
      "&specFile=" + encodeURIComponent(specFile) +
      "&dryRun=true"

    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      if (event.type === "done") {
        setValidated("passed")
        es.close()
      }
      if (event.type === "error") {
        setValidated("failed")
        setValidError(event.message)
        es.close()
      }
    }
    es.onerror = () => {
      setValidated("failed")
      setValidError("Could not connect to validation stream")
      es.close()
    }
  }

  const start = (dry: boolean) => {
    setLines([])
    setSpStatus({})
    setDone(false)
    setRunning(true)

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
      if (event.type === "done" || event.type === "error") {
        setDone(true)
        setRunning(false)
        es.close()
      }
    }
    es.onerror = () => { setRunning(false); es.close() }
  }

  const retry = (fromSp: string) => {
    setLines(l => [...l, "---", "--- Retrying from " + fromSp + " ---", "---"])
    setDone(false)
    router.push(
      "/projects/" + id + "/run" +
      "?specFile=" + encodeURIComponent(specFile) +
      "&fromSpId=" + fromSp
    )
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [lines])

  const statusIcon  = (s: SpStatus) =>
    s === "running" ? "..." : s === "passed" ? "✓" : s === "failed" ? "✗" : "—"
  const statusColor = (s: SpStatus) =>
    s === "running" ? "text-blue-500" : s === "passed" ? "text-green-600" :
    s === "failed"  ? "text-red-500"  : "text-gray-400"

  const failedSpId  = Object.entries(spStatus).find(([, s]) => s === "failed")?.[0] ?? null
  const overallPass = done && !Object.values(spStatus).some(s => s === "failed")
  const overallFail = done &&  Object.values(spStatus).some(s => s === "failed")
  const canRun      = validated === "passed" && !running

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1 truncate">{specName}</p>
          {fromSpId && (
            <p className="text-xs text-amber-600 mt-0.5">Resuming from {fromSpId}</p>
          )}
        </div>
        <a href={"/projects/" + id} className="btn-ghost text-sm shrink-0">Back</a>
      </div>

      {/* Run controls */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">

          {/* Run Spec button + validation status */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => start(false)}
              disabled={!canRun}
              className={"btn-primary whitespace-nowrap " + (!canRun ? "opacity-40 cursor-not-allowed" : "")}
            >
              {running ? "Running..." : "Run Spec"}
            </button>

            {/* Inline validation status */}
            {validated === "validating" && (
              <span className="text-xs text-gray-400 animate-pulse">Validating spec...</span>
            )}
            {validated === "passed" && !fromSpId && (
              <span className="text-xs text-green-600">✓ Spec parsed and validated</span>
            )}
            {validated === "failed" && (
              <span className="text-xs text-red-500">✗ Spec validation failed — {validError}</span>
            )}
            {fromSpId && (
              <span className="text-xs text-amber-600">Resuming from {fromSpId} — validation skipped</span>
            )}
          </div>

          {/* Re-validate link (subtle) */}
          {validated === "failed" && (
            <button
              onClick={runValidation}
              className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0"
            >
              Re-validate
            </button>
          )}
        </div>

        {/* Overall status bar */}
        {done && (
          <div className={
            "rounded-lg px-3 py-2 text-sm font-medium border " +
            (overallPass
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200")
          }>
            {overallPass && "✓ Execution complete"}
            {overallFail && "✗ Execution failed — see log below"}
          </div>
        )}
      </div>

      {/* Sub-prompt status */}
      {Object.keys(spStatus).length > 0 && (
        <div className="card space-y-1.5">
          <p className="text-sm font-medium text-gray-700 mb-2">Sub-prompts</p>
          {Object.entries(spStatus).map(([spId, status]) => (
            <div key={spId} className={"flex items-center gap-2 text-sm " + statusColor(status)}>
              <span className="w-4 text-center font-mono">{statusIcon(status)}</span>
              <span className="font-mono">{spId}</span>
              {done && status === "failed" && spId === failedSpId && (
                <button
                  onClick={() => retry(spId)}
                  className="text-xs px-2 py-0.5 rounded border border-amber-400 text-amber-600 hover:bg-amber-50 whitespace-nowrap ml-1 transition-colors"
                >
                  Retry from here
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Log stream */}
      <div
        ref={logRef}
        className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm space-y-0.5"
      >
        {lines.length === 0 && !running && (
          <p className="text-gray-500">
            {validated === "passed"
              ? "Click \"Run Spec\" to begin execution."
              : validated === "validating"
              ? "Validating spec..."
              : validated === "failed"
              ? "Spec validation failed. Fix the spec and re-validate."
              : ""}
          </p>
        )}
        {lines.map((line, i) => (
          <p key={i} className={
            line.includes("failed") || line.includes("✗") ? "text-red-400" :
            line.includes("passed") || line.includes("✓") || line.includes("complete") ? "text-green-300" :
            line.includes("Running") || line.includes("Starting") || line.includes("Retrying") ? "text-blue-300" :
            "text-green-300"
          }>{line}</p>
        ))}
        {running && <p className="text-blue-400 animate-pulse">Running...</p>}
      </div>
    </div>
  )
}
