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
import CostTracker, { type SubPromptResult as CostSp } from "@/components/run/CostTracker"
import { FilesList } from "@/components/run/FilesList"
import { ValidationResults } from "@/components/run/ValidationResults"
import { ManualFixButton } from "@/components/run/ManualFixButton"

type SpStatus = "pending" | "running" | "passed" | "failed"

type ValidationResult = {
  command: string
  status: string
  output: string
  errorCount?: number
}

type SpData = {
  status: SpStatus
  filesWritten: string[]
  validation: ValidationResult[]
  inputTokens: number
  outputTokens: number
  name?: string
}

type TerminalEntry = {
  id: string
  timestamp: string
  message: string
  level: LogLevel
}

export default function RunPage() {
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const specFile     = searchParams.get("specFile") ?? ""
  const fromSpId     = searchParams.get("fromSpId") ?? undefined

  const [entries,        setEntries]        = useState<TerminalEntry[]>([])
  const [filters,        setFilters]        = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [initialFilters, setInitialFilters] = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [spData,         setSpData]         = useState<Record<string, SpData>>({})
  const [startedAt,      setStartedAt]      = useState<string>(new Date().toISOString())
  const [done,           setDone]           = useState(false)
  const [running,        setRunning]        = useState(false)
  const [validated,      setValidated]      = useState<"pending" | "validating" | "passed" | "failed">("pending")
  const [validError,     setValidError]     = useState("")
  const [expandedSps,    setExpandedSps]    = useState<Set<string>>(new Set())
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
      .catch(() => { /* keep defaults */ })
  }, [])

  const pushEntry = (message: string, level: LogLevel) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false })
    const id = crypto.randomUUID()
    setEntries((prev) => [...prev, { id, timestamp, message, level }])
  }

  useEffect(() => {
    if (fromSpId) { setValidated("passed"); return }
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
    const url = "/api/stream?projectId=" + id + "&specFile=" + encodeURIComponent(specFile) + "&dryRun=true"
    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      if (event.type === "done") { setValidated("passed"); es.close() }
      if (event.type === "error") { setValidated("failed"); setValidError(event.message); es.close() }
    }
    es.onerror = () => { setValidated("failed"); setValidError("Could not connect"); es.close() }
  }

  const start = (dry: boolean) => {
    setEntries([])
    setSpData({})
    setDone(false)
    setRunning(true)
    setStartedAt(new Date().toISOString())

    const url = "/api/stream?projectId=" + id +
      "&specFile=" + encodeURIComponent(specFile) +
      (fromSpId ? "&fromSpId=" + fromSpId : "") +
      (dry ? "&dryRun=true" : "")

    const es = new EventSource(url)
    es.onmessage = (e) => {
      const event: StreamEvent = JSON.parse(e.data)
      pushEntry(event.message, levelFromStreamEvent(event))

      if (event.type === "sp_start" && event.spId) {
        setSpData((s) => ({ ...s, [event.spId!]: {
          status: "running", filesWritten: [], validation: [], inputTokens: 0, outputTokens: 0, name: event.spName
        }}))
      }
      if (event.type === "sp_pass" && event.spId) {
        setSpData((s) => ({ ...s, [event.spId!]: {
          ...s[event.spId!],
          status:      "passed",
          filesWritten:  event.filesWritten ?? [],
          validation:    (event.validationResults ?? []) as ValidationResult[],
          inputTokens:   event.inputTokens ?? 0,
          outputTokens:  event.outputTokens ?? 0,
          name:          event.spName,
        }}))
      }
      if (event.type === "sp_fail" && event.spId) {
        setSpData((s) => ({ ...s, [event.spId!]: {
          ...s[event.spId!],
          status:      "failed",
          filesWritten:  event.filesWritten ?? [],
          validation:    (event.validationResults ?? []) as ValidationResult[],
        }}))
      }
      if (event.type === "done" || event.type === "error") {
        setDone(true)
        setRunning(false)
        es.close()
      }
    }
    es.onerror = () => { setRunning(false); es.close() }
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
    router.push("/projects/" + id + "/run?specFile=" + encodeURIComponent(specFile) + "&fromSpId=" + fromSp)
  }

  const toggleExpand = (spId: string) => {
    setExpandedSps((prev) => {
      const next = new Set(prev)
      if (next.has(spId)) next.delete(spId)
      else next.add(spId)
      return next
    })
  }

  const visibleEntries = useMemo(
    () => entries.filter((e) => entryVisible(e.level, filters)),
    [entries, filters],
  )

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [visibleEntries, running])

  const statusIcon  = (s: SpStatus) => s === "running" ? "..." : s === "passed" ? "✓" : s === "failed" ? "✗" : "—"
  const statusColor = (s: SpStatus) => s === "running" ? "text-blue-500" : s === "passed" ? "text-green-600" : s === "failed" ? "text-red-500" : "text-gray-400"

  const failedSpId  = Object.entries(spData).find(([, s]) => s.status === "failed")?.[0] ?? null
  const overallPass = done && !Object.values(spData).some((s) => s.status === "failed")
  const overallFail = done && Object.values(spData).some((s) => s.status === "failed")
  const canRun      = validated === "passed" && !running

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1 truncate">{specName}</p>
          {fromSpId && <p className="text-xs text-amber-600 mt-0.5">Resuming from {fromSpId}</p>}
        </div>
        <a href={"/projects/" + id} className="btn-ghost text-sm shrink-0">Back</a>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => start(false)} disabled={!canRun}
              className={"btn-primary whitespace-nowrap " + (!canRun ? "opacity-40 cursor-not-allowed" : "")}>
              {running ? "Running..." : "Run Spec"}
            </button>
            {validated === "validating" && <span className="text-xs text-gray-400 animate-pulse">Validating spec...</span>}
            {validated === "passed" && !fromSpId && <span className="text-xs text-green-600">✓ Spec parsed and validated</span>}
            {validated === "failed" && <span className="text-xs text-red-500">✗ {validError}</span>}
            {fromSpId && <span className="text-xs text-amber-600">Resuming from {fromSpId} — validation skipped</span>}
          </div>
          {validated === "failed" && (
            <button onClick={runValidation} className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0">Re-validate</button>
          )}
        </div>
        {done && (
          <div className={"rounded-lg px-3 py-2 text-sm font-medium border " + (overallPass ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
            {overallPass && "✓ Execution complete"}
            {overallFail && "✗ Execution failed — see log below"}
          </div>
        )}
      </div>

      {/* Sub-prompts panel */}
      {Object.keys(spData).length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Sub-prompts</p>
          {Object.entries(spData).map(([spId, sp]) => (
            <div key={spId} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* SP header row */}
              <button
                onClick={() => toggleExpand(spId)}
                className={"w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors " + statusColor(sp.status)}
              >
                <span className="w-4 text-center font-mono flex-shrink-0">{statusIcon(sp.status)}</span>
                <span className="font-mono flex-shrink-0">{spId}</span>
                {sp.name && <span className="text-gray-500 text-xs truncate">{sp.name}</span>}
                <span className="ml-auto flex items-center gap-3 flex-shrink-0">
                  {sp.filesWritten.length > 0 && (
                    <span className="text-xs text-gray-400">{sp.filesWritten.length} file{sp.filesWritten.length !== 1 ? "s" : ""}</span>
                  )}
                  {sp.inputTokens > 0 && (
                    <span className="text-xs text-gray-400 font-mono">{(sp.inputTokens + sp.outputTokens).toLocaleString()} tok</span>
                  )}
                  <span className="text-gray-400 text-xs">{expandedSps.has(spId) ? "▲" : "▼"}</span>
                </span>
              </button>

              {/* SP detail panel */}
              {expandedSps.has(spId) && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-3">
                  {sp.filesWritten.length > 0 && (
                    <FilesList files={sp.filesWritten} projectId={id} />
                  )}
                  {sp.validation.length > 0 && (
                    <ValidationResults validation={sp.validation as Parameters<typeof ValidationResults>[0]["validation"]} />
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {done && sp.status === "failed" && spId === failedSpId && (
                      <button onClick={() => retry(spId)}
                        className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors">
                        Retry from here
                      </button>
                    )}
                    {done && sp.status === "failed" && (
                      <ManualFixButton
                        projectId={id}
                        spId={spId}
                        onValidationComplete={(results, newStatus) => {
                          setSpData((s) => ({ ...s, [spId]: {
                            ...s[spId],
                            status: newStatus as SpStatus,
                            validation: results as ValidationResult[],
                          }}))
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cost tracker + terminal */}
      <div className="space-y-2">
        <CostTracker
          subPrompts={Object.entries(spData).map(([spId, sp]) => ({
            spId,
            inputTokens:  sp.inputTokens,
            outputTokens: sp.outputTokens,
            status: sp.status as CostSp["status"],
            name: sp.name,
          }))}
          model={searchParams.get("model") ?? "claude-sonnet-4-6"}
          isRunning={running}
          startedAt={startedAt}
        />
        <LogFilterBar initialFilters={initialFilters} value={filters} onChange={setFilters} />
        <div ref={logRef}
          className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm space-y-0.5 border border-gray-800">
          {visibleEntries.length === 0 && !running && (
            <p className="text-gray-500">
              {validated === "passed" ? 'Click "Run Spec" to begin execution.' :
               validated === "validating" ? "Validating spec..." :
               validated === "failed" ? "Spec validation failed." : ""}
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
