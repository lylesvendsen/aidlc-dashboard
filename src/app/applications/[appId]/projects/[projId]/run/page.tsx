"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import type { StreamEvent, LogLevel, Project } from "@/types"
import { LogLine } from "@/components/LogLine"
import { LogFilterBar } from "@/components/LogFilterBar"
import {
  levelFromStreamEvent, entryVisible, normalizeLogFilters,
  DEFAULT_LOG_FILTERS, type LogFilterState,
} from "@/lib/logDisplay"
import CostTracker, { type SubPromptResult as CostSp } from "@/components/run/CostTracker"
import { FilesList } from "@/components/run/FilesList"
import { ValidationResults } from "@/components/run/ValidationResults"
import { ManualFixButton } from "@/components/run/ManualFixButton"
import ConstraintToggles, { type ActiveConstraints } from "@/components/run/ConstraintToggles"
import { AttemptHistory } from "@/components/run/AttemptHistory"
import AttemptNotes from "@/components/run/AttemptNotes"
import AttemptComparison from "@/components/run/AttemptComparison"
import { RegenerateFileButton } from "@/components/run/RegenerateFileButton"
import FileApprovalModal from "@/components/run/FileApprovalModal"
import { FileContentViewer } from "@/components/run/FileContentViewer"
import type { SpAttempt } from "@/lib/attempts"

type SpStatus = "pending" | "running" | "passed" | "failed"
type VR = { command: string; status: string; output: string; errorCount?: number; passed?: boolean }
type SpData = {
  status: SpStatus; filesWritten: string[]; validation: VR[]
  durationMs: number | null
  inputTokens: number; outputTokens: number; name?: string; attempts: SpAttempt[]
}
type TerminalEntry = { id: string; timestamp: string; message: string; level: LogLevel }

export default function RunPage() {
  const { appId, projId } = useParams<{ appId: string; projId: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const specFile     = searchParams.get("specFile") ?? ""
  const fromSpId     = searchParams.get("fromSpId") ?? undefined
  const branchParam  = searchParams.get("branch") ?? undefined
  const specName     = decodeURIComponent(specFile).split("/").pop() ?? ""

  const [project,        setProject]        = useState<Project | null>(null)
  const [entries,        setEntries]        = useState<TerminalEntry[]>([])
  const [filters,        setFilters]        = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [initialFilters, setInitialFilters] = useState<LogFilterState>(DEFAULT_LOG_FILTERS)
  const [spData,         setSpData]         = useState<Record<string, SpData>>({})
  const [startedAt,      setStartedAt]      = useState(new Date().toISOString())
  const [logId,          setLogId]          = useState<string | null>(null)
  const [comparingSp,    setComparingSp]    = useState<string | null>(null)
  const [viewingFile,    setViewingFile]    = useState<string | null>(null)
  const [reviewMode,     setReviewMode]     = useState(false)
  const [pendingFiles,   setPendingFiles]   = useState<{ path: string; newContent: string; existingContent: string; spId: string }[]>([])
  const [done,           setDone]           = useState(false)
  const [running,        setRunning]        = useState(false)
  const [validated,      setValidated]      = useState<"pending"|"validating"|"passed"|"failed">("pending")
  const [validError,     setValidError]     = useState("")
  const [expandedSps,    setExpandedSps]    = useState<Set<string>>(new Set())
  const [activeConstraints, setActiveConstraints] = useState<ActiveConstraints | null>(null)
  const [detectedBranch, setDetectedBranch] = useState<string | null>(branchParam ?? null)
  const logRef      = useRef<HTMLDivElement>(null)
  const autoStarted = useRef(false)

  useEffect(() => {
    fetch("/api/projects/" + projId)
      .then(r => r.json()).then((p: Project) => setProject(p)).catch(() => {})
    fetch("/api/log-config")
      .then(r => r.json() as Promise<Partial<LogFilterState>>)
      .then(d => { const n = normalizeLogFilters(d); setInitialFilters(n); setFilters(n) })
      .catch(() => {})
  }, [projId])

  const pushEntry = (message: string, level: LogLevel) => {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false })
    setEntries(prev => [...prev, { id: crypto.randomUUID(), timestamp, message, level }])
  }

  useEffect(() => {
    if (fromSpId) { setValidated("passed"); return }
    runValidation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (fromSpId && !autoStarted.current) { autoStarted.current = true; start(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runValidation = () => {
    setValidated("validating"); setValidError("")
    const url = "/api/stream?projectId=" + projId + "&specFile=" + encodeURIComponent(specFile) + "&dryRun=true"
    const es = new EventSource(url)
    es.onmessage = (e) => {
      const ev: StreamEvent = JSON.parse(e.data)
      if (ev.type === "done")  { setValidated("passed"); es.close() }
      if (ev.type === "error") { setValidated("failed"); setValidError(ev.message); es.close() }
    }
    es.onerror = () => { setValidated("failed"); setValidError("Could not connect"); es.close() }
  }

  const start = (dry: boolean) => {
    setEntries([]); setSpData({}); setDone(false); setRunning(true); setLogId(null)
    setStartedAt(new Date().toISOString())
    setDetectedBranch(branchParam ?? null)
    const url = "/api/stream?projectId=" + projId +
      "&specFile=" + encodeURIComponent(specFile) +
      (fromSpId ? "&fromSpId=" + fromSpId : "") +
      (dry ? "&dryRun=true" : "") + (reviewMode ? "&reviewMode=true" : "")
    const es = new EventSource(url)
    es.onmessage = (e) => {
      const ev: StreamEvent = JSON.parse(e.data)
      const level = levelFromStreamEvent(ev)
      pushEntry(ev.message, level)

      if (ev.type === "log" && level === "system" && ev.message) {
        const branchMatch =
          ev.message.match(/^Branch: switched to (.+)$/) ??
          ev.message.match(/^Branch: created and switched to (.+)$/) ??
          ev.message.match(/^Branch: switching to (.+)$/)
        if (branchMatch && branchMatch[1]) {
          setDetectedBranch(branchMatch[1].trim())
        }
      }

      if (ev.type === "sp_start" && ev.spId)
        setSpData(s => ({ ...s, [ev.spId!]: { status: "running", filesWritten: [], validation: [], inputTokens: 0, outputTokens: 0, durationMs: null, name: ev.spName, attempts: [] }}))
      if (ev.type === "sp_pass" && ev.spId)
        setSpData(s => ({ ...s, [ev.spId!]: { ...s[ev.spId!], status: "passed",
          filesWritten: ev.filesWritten ?? [], validation: (ev.validationResults ?? []) as VR[],
          inputTokens: ev.inputTokens ?? 0, outputTokens: ev.outputTokens ?? 0, durationMs: ev.durationMs ?? null, name: ev.spName }}))
      if (ev.type === "sp_fail" && ev.spId)
        setSpData(s => ({ ...s, [ev.spId!]: { ...s[ev.spId!], status: "failed",
          filesWritten: ev.filesWritten ?? [], validation: (ev.validationResults ?? []) as VR[] }}))
      if (ev.type === "sp_files_pending" && ev.spId && ev.pendingFiles) {
        setPendingFiles(ev.pendingFiles.map(f => ({ ...f, spId: ev.spId! })))
      }
      if (ev.type === "done" || ev.type === "error") { setDone(true); setRunning(false); if (ev.logId) setLogId(ev.logId); es.close() }
    }
    es.onerror = () => { setRunning(false); es.close() }
  }

  const retry = (fromSp: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false })
    setEntries(prev => { const n = [...prev]; for (const m of ["---","--- Retrying from "+fromSp+" ---","---"]) n.push({id:crypto.randomUUID(),timestamp:ts,message:m,level:"info"}); return n })
    setDone(false)
    router.push(`/applications/${appId}/projects/${projId}/run?specFile=${encodeURIComponent(specFile)}&fromSpId=${fromSp}`)
  }

  const toggleExpand = (spId: string) => setExpandedSps(prev => { const n = new Set(prev); n.has(spId) ? n.delete(spId) : n.add(spId); return n })

  useEffect(() => {
    const failed = Object.entries(spData).filter(([,s]) => s.status === "failed").map(([id]) => id)
    if (failed.length) setExpandedSps(prev => { const n = new Set(prev); failed.forEach(id => n.add(id)); return n })
  }, [spData])

  const visibleEntries = useMemo(() => entries.filter(e => entryVisible(e.level, filters)), [entries, filters])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [visibleEntries, running])

  const statusIcon  = (s: SpStatus) => s==="running"?"...":s==="passed"?"✓":s==="failed"?"✗":"—"
  const statusColor = (s: SpStatus) => s==="running"?"text-blue-500":s==="passed"?"text-green-600":s==="failed"?"text-red-500":"text-gray-400"
  const failedSpId  = Object.entries(spData).find(([,s]) => s.status==="failed")?.[0] ?? null
  const overallPass = done && !Object.values(spData).some(s => s.status==="failed")
  const overallFail = done && Object.values(spData).some(s => s.status==="failed")
  const canRun      = validated==="passed" && !running

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Run Spec</h1>
          <p className="text-gray-500 text-sm font-mono mt-1 truncate">{specName}</p>
          {detectedBranch && (
            <p className="text-xs text-gray-400 mt-0.5">
              ⎇ <span className="font-mono">{detectedBranch}</span>
            </p>
          )}
          {fromSpId && <p className="text-xs text-amber-600 mt-0.5">Resuming from {fromSpId}</p>}
        </div>
        <a href={`/applications/${appId}/projects/${projId}`} className="btn-ghost text-sm shrink-0">Back</a>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => start(false)} disabled={!canRun}
              className={"btn-primary whitespace-nowrap " + (!canRun ? "opacity-40 cursor-not-allowed" : "")}>
              {running ? "Running..." : "Run Spec"}
            </button>
            <button
              onClick={() => setReviewMode(v => !v)}
              disabled={running}
              className={"text-xs px-3 py-1.5 rounded border transition-colors " + (reviewMode ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}>
              {reviewMode ? "⏸ Review mode" : "▶ Auto-write"}
            </button>
            {validated==="validating" && <span className="text-xs text-gray-400 animate-pulse">Validating spec...</span>}
            {validated==="passed" && !fromSpId && <span className="text-xs text-green-600">✓ Spec parsed and validated</span>}
            {validated==="failed" && <span className="text-xs text-red-500">✗ {validError}</span>}
            {fromSpId && <span className="text-xs text-amber-600">Resuming from {fromSpId} — validation skipped</span>}
          </div>
          {validated==="failed" && <button onClick={runValidation} className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0">Re-validate</button>}
        </div>
        {done && (
          <div className={"rounded-lg px-3 py-2 text-sm font-medium border " + (overallPass ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200")}>
            {overallPass && "✓ Execution complete"}{overallFail && "✗ Execution failed — see log below"}
          </div>
        )}
        {project && (project.constraints?.length > 0 || project.validation?.afterEachSubPrompt?.length > 0) && (
          <ConstraintToggles
            constraints={project.constraints ?? []}
            validationCmds={project.validation?.afterEachSubPrompt ?? []}
            onChange={setActiveConstraints}
            runStarted={running}
          />
        )}
      </div>

      {Object.keys(spData).length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Sub-prompts</p>
          {Object.entries(spData).map(([spId, sp]) => (
            <div key={spId} className="border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => toggleExpand(spId)}
                className={"w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors " + statusColor(sp.status)}>
                <span className="w-4 text-center font-mono flex-shrink-0">{statusIcon(sp.status)}</span>
                <span className="font-mono flex-shrink-0">{spId}</span>
                {sp.name && <span className="text-gray-500 text-xs truncate">{sp.name}</span>}
                <span className="ml-auto flex items-center gap-3 flex-shrink-0 text-gray-400 text-xs">
                  {sp.filesWritten.length > 0 && <span>{sp.filesWritten.length} file{sp.filesWritten.length!==1?"s":""}</span>}
                  {sp.durationMs != null && <span>{Math.round(sp.durationMs/1000)}s</span>}
                  {sp.inputTokens > 0 && <span className="font-mono">{(sp.inputTokens+sp.outputTokens).toLocaleString()} tok</span>}
                  <span>{expandedSps.has(spId) ? "▲" : "▼"}</span>
                </span>
              </button>
              {expandedSps.has(spId) && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-3">
                  {sp.filesWritten.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Files Written ({sp.filesWritten.length})</p>
                      <div className="border border-gray-200 rounded overflow-hidden">
                        {sp.filesWritten.map((filePath, fileIdx) => {
                          const segs = filePath.replace(/\\/g, "/").split("/")
                          const fileName = segs[segs.length - 1] ?? filePath
                          const dirPath = segs.slice(0, -1).join("/")
                          return (
                            <div key={filePath} className={"flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-gray-50 " + (fileIdx < sp.filesWritten.length - 1 ? "border-b border-gray-100" : "")}>
                              <button type="button" onClick={() => setViewingFile(filePath)}
                                className="flex items-center gap-2 min-w-0 text-left flex-1 hover:opacity-70 transition-opacity">
                                <span className="text-blue-500 shrink-0">ð</span>
                                <span className="min-w-0">
                                  <span className="text-gray-800 font-mono text-xs block truncate">{fileName}</span>
                                  {dirPath && <span className="text-gray-400 font-mono text-xs block truncate">{dirPath}</span>}
                                </span>
                              </button>
                              <RegenerateFileButton projectId={projId} specFile={specFile} spId={spId} filePath={filePath} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {sp.validation.length > 0 && <ValidationResults validation={sp.validation as Parameters<typeof ValidationResults>[0]["validation"]} />}
                  {sp.attempts.length > 0 && (
                    <div className="space-y-2">
                      <AttemptHistory attempts={sp.attempts} spId={spId} isRunning={sp.status==="running"} />
                      {logId && sp.attempts.map((a, idx) => (
                        <AttemptNotes key={idx} logId={logId} spId={spId} attemptIndex={a.index} />
                      ))}
                      {sp.attempts.length >= 2 && (
                        <button onClick={() => setComparingSp(comparingSp === spId ? null : spId)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline">
                          {comparingSp === spId ? "Hide comparison" : "Compare attempts"}
                        </button>
                      )}
                      {comparingSp === spId && (
                        <AttemptComparison
                          spId={spId}
                          attempts={sp.attempts.map(a => ({
                            attemptIndex: a.index,
                            status: a.status,
                            error: a.error ?? undefined,
                            duration: a.durationMs ?? undefined,
                          }))}
                          onClose={() => setComparingSp(null)}
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {done && sp.status==="failed" && spId===failedSpId && (
                      <button onClick={() => retry(spId)} className="text-xs px-2 py-1 rounded border border-amber-400 text-amber-600 hover:bg-amber-50 transition-colors">
                        Retry from here
                      </button>
                    )}
                    {done && sp.status==="failed" && (
                      <ManualFixButton projectId={projId} spId={spId}
                        onValidationComplete={(results, newStatus) =>
                          setSpData(s => ({ ...s, [spId]: { ...s[spId], status: newStatus as SpStatus, validation: results as VR[] }}))
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <CostTracker
          subPrompts={Object.entries(spData).map(([spId, sp]) => ({ spId, inputTokens: sp.inputTokens, outputTokens: sp.outputTokens, status: sp.status as CostSp["status"], name: sp.name }))}
          model={project?.model ?? "claude-sonnet-4-6"}
          isRunning={running}
          startedAt={startedAt}
        />
        <LogFilterBar initialFilters={initialFilters} value={filters} onChange={setFilters} />
        <div ref={logRef} className="bg-gray-900 rounded-xl p-4 h-96 overflow-y-auto font-mono text-sm space-y-0.5 border border-gray-800">
          {visibleEntries.length===0 && !running && (
            <p className="text-gray-500">
              {validated==="passed" ? 'Click "Run Spec" to begin execution.'
               : validated==="validating" ? "Validating spec..."
               : validated==="failed" ? "Spec validation failed." : ""}
            </p>
          )}
          {visibleEntries.map(row => <LogLine key={row.id} timestamp={row.timestamp} message={row.message} level={row.level} />)}
          {running && <p className="log-info animate-pulse">Running...</p>}
        </div>
      </div>
      {pendingFiles.length > 0 && (
        <FileApprovalModal
          executionId={logId ?? "pending"}
          spId={pendingFiles[0]?.spId ?? ""}
          files={pendingFiles}
          onApply={async (approved) => {
            const spId = pendingFiles[0]?.spId ?? ""
            setPendingFiles([])
            const res = await fetch("/api/projects/" + projId + "/write-files", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ spId, files: approved.map(f => ({ path: f.path, content: f.newContent })) }),
            })
            const data = await res.json() as { written: string[]; validation: Parameters<typeof ValidationResults>[0]["validation"]; status: string }
            setSpData(s => ({ ...s, [spId]: {
              ...s[spId],
              status: data.status as SpStatus,
              filesWritten: data.written,
              validation: data.validation as VR[],
            }}))
            if (data.status === "passed") {
              pushEntry(spId + " approved and passed", "success")
            } else {
              pushEntry(spId + " approved but validation failed", "error")
            }
          }}
          onCancel={() => {
            const spId = pendingFiles[0]?.spId ?? ""
            setPendingFiles([])
            setSpData(s => ({ ...s, [spId]: { ...s[spId], status: "failed" }}))
            pushEntry(spId + " — files rejected by user", "error")
            setDone(true)
            setRunning(false)
          }}
        />
      )}
      {viewingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setViewingFile(null)}>
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-mono text-sm text-gray-800 truncate">{viewingFile}</span>
              <button onClick={() => setViewingFile(null)} className="text-gray-400 hover:text-gray-600 ml-4">✕</button>
            </div>
            <FileContentViewer projectId={projId} filePath={viewingFile} />
          </div>
        </div>
      )}
    </div>
  )
}