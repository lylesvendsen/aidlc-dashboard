"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Project, SpecFile } from "@/types"

const SPEC_TEMPLATE = `# {ID} - {Title}
# Version: 1.0
# Part of: {Project} AIDLC
# Updated: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
# Jira: https://jira.tools.bestbuy.com/browse/{TICKET-ID}    (optional — delete if not applicable)

## What this unit delivers
[One clear paragraph. What exists after this unit that did not exist before.]

## Context
[Prerequisites. Which prior units must be complete.]

## Architecture principles
[Locked-in decisions this unit must respect.]

## Sub-prompts (execute in order, validate each before next)

### SP-01: {Name}
[What to build. List exact file paths to create or modify.]

Acceptance:
  SP01-01  [Testable criterion]
  SP01-02  [Testable criterion]

### SP-02: {Name}
[Description...]

Acceptance:
  SP02-01  [Criterion]

## Done when
[Final gate. Should map to a runnable command.]

## Files produced by this unit
  path/to/file.ts

## Next unit
[{Next ID} - {Title}]`

// Derive a filename from the first heading line of the spec
// "# B0 - Run Page v2" -> "B0-run-page-v2.md"
function deriveFilename(content: string): string {
  const firstLine = content.split("\n").find(l => l.startsWith("# ")) ?? ""
  const match = firstLine.match(/^#\s+(\S+)\s+-\s+(.+)/)
  if (!match) return ""
  const id    = match[1].trim()
  const title = match[2].trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
  return id + "-" + title + ".md"
}

export default function NewSpecPage() {
  const { appId, projId } = useParams<{ appId: string; projId: string }>()
  const router    = useRouter()
  const [project,    setProject]    = useState<Project | null>(null)
  const [existingSpecs, setExistingSpecs] = useState<SpecFile[]>([])
  const [content,    setContent]    = useState(SPEC_TEMPLATE)
  const [filename,   setFilename]   = useState("")
  const [autoName,   setAutoName]   = useState("")
  const [manualName, setManualName] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState("")

  // AI generator state
  const [genSpId,    setGenSpId]    = useState("")
  const [genDesc,    setGenDesc]    = useState("")
  const [genResult,  setGenResult]  = useState("")
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch("/api/v2/applications/" + appId).then(r => r.json()).then(setProject)
    fetch("/api/v2/specs?appId=" + appId + "&projId=" + projId)
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setExistingSpecs(d) : null)
  }, [appId, projId])

  // Auto-derive filename whenever content changes (unless user manually set it)
  useEffect(() => {
    const derived = deriveFilename(content)
    setAutoName(derived)
    if (!manualName) {
      setFilename(derived)
      setError("")
    }
  }, [content, manualName])

  const existingFilenames = existingSpecs.map(s => s.filename)

  const validate = useCallback((name: string): string => {
    if (!name) return "Filename is required"
    if (!name.endsWith(".md")) return "Filename must end in .md"
    if (!/^[A-Za-z0-9_-]+\.md$/.test(name)) return "Use only letters, numbers, hyphens, underscores"
    if (existingFilenames.includes(name)) return `"${name}" already exists — choose a different name`
    return ""
  }, [existingFilenames])

  const handleFilenameChange = (val: string) => {
    setManualName(true)
    setFilename(val)
    setError(validate(val))
  }

  const resetToAuto = () => {
    setManualName(false)
    setFilename(autoName)
    setError(validate(autoName))
  }

  const save = async () => {
    const err = validate(filename)
    if (err) { setError(err); return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/v2/specs?appId=" + appId + "&projId=" + projId, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filename, content }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? "Failed to save spec")
      setSaving(false)
      return
    }
    router.push(`/v2/applications/${appId}/projects/${projId}`)
  }

  const generatePrompt = async () => {
    if (!genDesc) return
    setGenerating(true)
    const res = await fetch("/api/generate-prompt", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        projectId:   projId,
        description: genDesc,
        spId:        genSpId,
        specContext: content.slice(0, 2000),
      }),
    })
    const data = await res.json()
    setGenResult(data.content ?? "")
    setGenerating(false)
  }

  const appendToSpec = () => {
    if (!genResult) return
    const spHeader = genSpId ? `### ${genSpId}: Generated\n` : ""
    setContent(c => c + "\n\n" + spHeader + genResult)
    setGenResult("")
    setGenSpId("")
    setGenDesc("")
  }

  if (!project) return <p className="text-gray-400 p-8">Loading...</p>

  const isDuplicate = existingFilenames.includes(filename)
  const canSave     = filename && !validate(filename)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">New Spec</h1>
          <p className="text-sm text-gray-500 mt-1 truncate">
            Saving to:{" "}
            <span className="font-mono text-xs">{(project as { specDir?: string }).specDir ?? ""}/</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <button onClick={save} disabled={saving || !canSave} className="btn-primary">
            {saving ? "Saving..." : "Save Spec"}
          </button>
          <button onClick={() => router.push(`/v2/applications/${appId}/projects/${projId}`)} className="btn-ghost">Cancel</button>
        </div>
      </div>

      {/* Filename */}
      <div className="card space-y-2">
        <div className="flex items-start justify-between gap-4">
          <label className="text-sm font-medium text-gray-700">Filename</label>
          {manualName && autoName && (
            <button
              onClick={resetToAuto}
              className="text-xs text-brand-600 hover:underline"
            >
              Reset to auto-generated ({autoName})
            </button>
          )}
        </div>

        <input
          className={`input-field font-mono ${isDuplicate || error ? "border-red-400 focus:ring-red-400" : ""}`}
          placeholder="auto-generated from spec heading..."
          value={filename}
          onChange={e => handleFilenameChange(e.target.value)}
        />

        {/* Status messages */}
        {isDuplicate && (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <span>✗</span>
            <span>
              <strong>{filename}</strong> already exists in your spec directory.
              Choose a different name or edit the existing spec instead.
            </span>
          </div>
        )}
        {error && !isDuplicate && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        {!error && filename && !isDuplicate && (
          <p className="text-xs text-green-600">
            ✓ Will save as <span className="font-mono">{filename}</span>
          </p>
        )}

        <p className="text-xs text-gray-400">
          Auto-generated from the first heading line of your spec.
          Edit the heading (e.g. <span className="font-mono"># B0 - Run Page v2</span>) to update it,
          or type a custom filename above.
        </p>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <label className="text-sm font-medium text-gray-700">Spec content</label>
          <p className="text-xs text-gray-400">
            Replace all {"{placeholder}"} values with your content
          </p>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full h-[500px] input-field font-mono text-xs leading-relaxed resize-none"
          spellCheck={false}
        />
      </div>

      {/* AI Prompt Generator */}
      <div className="card space-y-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">AI Sub-prompt Generator</h2>
          <p className="text-sm text-gray-500 mt-1 truncate">
            Describe what a specific sub-prompt should build and Claude will write
            the implementation instructions. Generated content is appended to your spec above.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Sub-prompt ID</label>
            <input
              className="input-field"
              placeholder="SP-02"
              value={genSpId}
              onChange={e => setGenSpId(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-medium text-gray-600">What should it build?</label>
            <input
              className="input-field"
              placeholder="Set up Firebase client and admin SDKs with emulator support"
              value={genDesc}
              onChange={e => setGenDesc(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={generatePrompt}
          disabled={generating || !genDesc}
          className="btn-primary"
        >
          {generating ? "Generating..." : "Generate Sub-prompt"}
        </button>
        {genResult && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-gray-700">Generated content</p>
              <button onClick={appendToSpec} className="btn-secondary text-sm">
                Append to spec above
              </button>
            </div>
            <textarea
              readOnly
              value={genResult}
              className="w-full h-48 input-field font-mono text-xs resize-none bg-gray-50"
            />
          </div>
        )}
      </div>
    </div>
  )
}
