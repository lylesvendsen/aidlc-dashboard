"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import type { StreamEvent, LogLevel } from "@/types"
import { LogLine } from "@/components/LogLine"
import { LogFilterBar } from "@/components/LogFilterBar"
import {
  levelFromStreamEvent,
  entryVisible,
  normalizeLogFilters,
  DEFAULT_LOG_FILTERS,
  type LogFilterState,
} from "@/lib/logDisplay"
import CostTracker, { type SubPromptResult as CostSp } from "@/components/CostTracker"

type SpStatus = "pending" | "running" | "passed" | "failed"

type TerminalEntry = {
  id: string
  timestamp: string
  message: string
  level: LogLevel
}

export default function RunPage() {
  const { appId, projId } = useParams<{ appId: string; projId: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const specFile     = searchParams.get("specFile") ?? ""
  const fromSpId     = searchParams.get("fromSpId") ?? undefined

  const [entries,     setEntries]     = useState<TerminalEntry[]>([])
  const [filters,     setFilters]     = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [initialFilters, setInitialFilters] = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [spStatus,    setSpStatus]    = useState<Record<string, SpStatus>>({})
  const [spTokens,    setSpTokens]    = useState<Record<string, { input: number; output: number }>>({})
  const [startedAt,   setStartedAt]   = useState<string>(new Date().toISOString())
  const [done,        setDone]        = useState(false)
  const [running,     setRunning]     = useState(false)
  const [validated,   setValidated]   = useState<"pending" | "validating" | "passed" | "failed">("pending")
  const [validError,  setValidError]  = useState("")
  const logRef        = useRef<HTMLDivElement>(null)
  const autoStarted   = useRef(false)

  const specName = decodeURIComponent(specFile).split("/").pop() ?? ""

  useEffect(() => {
    fetch("/api/log-config")
      .then((r) => r.json() as Promise<Partial<LogFilterState>>)
      .then((data) => {
        const n = normalizeLogFilters(data)
        setInitialFilters(n)
        setFilters(n)
      })
      .catch(() => {
        /* keep defaults */
      })
  }, [])

  /** Always append — filters only affect `visibleEntries`, never this list. */
  const pushEntry = (message: string, level: LogLevel) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false })
    const id = crypto.randomUUID()
    setEntries((prev) => [...prev, { id, timestamp, message, level }])
  }

  useEffect(() => {
    if (fromSpId) {
      setValidated("passed")
      return
    }
    runValidation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fromSpId && !autoStarted.current) {
      autoStarted.current = true
      start(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runValidation = () => {
    setValidated("validating")
    setValidError("")

    const url =
      "/api/stream?projectId=" +
      projId +
      "&specFile=" +
      encodeURIComponent(specFile) +
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
    setEntries([])
    setSpStatus({})
    setDone(false)
    setRunning(true)
    setStartedAt(new Date().toISOString())

    const url =
      "/api/stream?projectId=" +
      projId +
      "&specFile=" +
      encodeURIComponent(specFile) +
      (fromSpId ? "&fromSpId=" + fromSpId : "") +
      (dry ? "&dryRun=true" : "")

    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      pushEntry(event.message, levelFromStreamEvent(event))

      if (event.type === "sp_start" && event.spId) setSpStatus((s) => ({ ...s, [event.spId!]: "running" }))
      if (event.type === "sp_pass" && event.spId) {
        setSpStatus((s) => ({ ...s, [event.spId!]: "passed" }))
        setSpTokens((s) => ({ ...s, [event.spId!]: { input: event.inputTokens ?? 0, output: event.outputTokens ?? 0 } }))
      }
      if (event.type === "sp_fail" && event.spId) setSpStatus((s) => ({ ...s, [event.spId!]: "failed" }))
      if (event.type === "done" || event.type === "error") {
        setDone(true)
        setRunning(false)
        es.close()
      }
    }
    es.onerror = () => {
      setRunning(false)
      es.close()
    }
  }

  const retry = (fromSp: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false })
    setEntries((prev) => {
      const next = [...prev]
      for (const msg of ["---", "--- Retrying from " + fromSp + " ---", "---"]) {
        next.push({ id: crypto.randomUUID(), timestamp: ts, message: msg, level: "info" })
      }
      return next
    })
    setDone(false)
    router.push(
      "/projects/" +
        projId +
        "/run" +
        "?specFile=" +
        encodeURIComponent(specFile) +
        "&fromSpId=" +
        fromSp
    )
  }

  /** UI only — `entries` holds the full stream; log file on disk has all levels regardless. */
  const visibleEntries = useMemo(
    () => entries.filter((e) => entryVisible(e.level, filters)),
    [entries, filters],
  )

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleEntries, running])

  const statusIcon = (s: SpStatus) =>
    s === "running" ? "..." : s === "passed" ? "✓" : s === "failed" ? "✗" : "—"
  const statusColor = (s: SpStatus) =>
    s === "running"
      ? "text-blue-500"
      : s === "passed"
        ? "text-green-600"
        : s === "failed"
          ? "text-red-500"
          : "text-gray-400"

  const failedSpId  = Object.entries(spStatus).find(([, s]) => s === "failed")?.[0] ?? null
  const overallPass = done && !Object.values(spStatus).some((s) => s === "failed")
  const overallFail = done && Object.values(spStatus).some((s) => s === "failed")
  const canRun      = validated === "passed" && !running

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1 truncate">{specName}</p>
          {fromSpId && (
            <p className="text-xs text-amber-600 mt-0.5">Resuming from {fromSpId}</p>
          )}
        </div>
        <a href={`/v2/applications/${appId}/projects/${projId}`} className="btn-ghost text-sm shrink-0">
          Back
        </a>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => start(false)}
              disabled={!canRun}
              className={
                "btn-primary whitespace-nowrap " + (!canRun ? "opacity-40 cursor-not-allowed" : "")
              }
            >
              {running ? "Running..." : "Run Spec"}
            </button>

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
              <span className="text-xs text-amber-600">
                Resuming from {fromSpId} — validation skipped
              </span>
            )}
          </div>

          {validated === "failed" && (
            <button
              onClick={runValidation}
              className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0"
            >
              Re-validate
            </button>
          )}
        </div>

        {done && (
          <div
            className={
              "rounded-lg px-3 py-2 text-sm font-medium border " +
              (overallPass
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200")
            }
          >
            {overallPass && "✓ Execution complete"}
            {overallFail && "✗ Execution failed — see log below"}
          </div>
        )}
      </div>

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

      <div>
        <CostTracker
            subPrompts={Object.entries(spStatus).map(([spId, status]) => ({
              spId,
              inputTokens:  spTokens[spId]?.input  ?? 0,
              outputTokens: spTokens[spId]?.output ?? 0,
              status: status as CostSp["status"],
            }))}
            model={searchParams.get("model") ?? "claude-sonnet-4-6"}
            isRunning={running}
            startedAt={startedAt}
          />
          <LogFilterBar initialFilters={initialFilters} value={filters} onChange={setFilters} />
        <div
          ref={logRef}
          className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm space-y-0.5 border border-gray-800"
        >
          {visibleEntries.length === 0 && !running && (
            <p className="text-gray-500">
              {validated === "passed"
                ? 'Click "Run Spec" to begin execution.'
                : validated === "validating"
                  ? "Validating spec..."
                  : validated === "failed"
                    ? "Spec validation failed. Fix the spec and re-validate."
                    : ""}
            </p>
          )}
          {visibleEntries.map((row) => (
            <LogLine key={row.id} timestamp={row.timestamp} message={row.message} level={row.level} />
          ))}
          {running && <p className="log-info animate-pulse">Running...</p>}
        </div>
      </div>
    </div>
  )
}
