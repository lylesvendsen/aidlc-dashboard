"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { SpecFile } from "@/types"

function renderBranchTemplate(
  template: string,
  vars: { specId: string; projectId: string; jiraId?: string }
): string {
  if (!template.trim()) return ""
  let result = template
    .replace(/\{specId\}/g, vars.specId)
    .replace(/\{projectId\}/g, vars.projectId)
    .replace(/\{jiraId\}/g, vars.jiraId ?? "")
  result = result.toLowerCase().replace(/[^a-z0-9/]+/g, "-").replace(/^-+|-+$/g, "")
  return result
}

export default function SpecEditorPage() {
  const { appId, projId, specId } = useParams<{ appId: string; projId: string; specId: string }>()
  const router         = useRouter()
  const [spec,    setSpec]    = useState<SpecFile | null>(null)
  const [content, setContent] = useState("")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [tab,     setTab]     = useState<"edit" | "preview">("edit")

  // Branch override state
  const [branchOverride, setBranchOverride] = useState("")
  const [projectBranchTemplate, setProjectBranchTemplate] = useState("")

  // Generate prompt state
  const [genSpId,   setGenSpId]   = useState("")
  const [genDesc,   setGenDesc]   = useState("")
  const [genResult, setGenResult] = useState("")
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch("/api/app-specs/" + specId + "?appId=" + appId + "&projId=" + projId)
      .then(r => r.json())
      .then(s => {
        setSpec(s)
        setContent(s.rawContent)
        setBranchOverride(s.config?.branch ?? "")
      })
  }, [appId, projId, specId])

  useEffect(() => {
    fetch(`/api/applications/${appId}/projects/${projId}`)
      .then(r => r.json())
      .then(d => {
        setProjectBranchTemplate(d.branchTemplate ?? "")
      })
      .catch(() => {})
  }, [appId, projId])

  const resolvedBranch = (() => {
    const effectiveTemplate = branchOverride.trim() || projectBranchTemplate.trim()
    if (!effectiveTemplate) return ""
    return renderBranchTemplate(effectiveTemplate, {
      specId: spec?.id ?? specId,
      projectId: projId,
      jiraId: spec?.jiraTicketId ?? undefined,
    })
  })()

  const save = async () => {
    setSaving(true)
    await fetch("/api/app-specs/" + specId + "?appId=" + appId + "&projId=" + projId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, branch: branchOverride.trim() || null }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const generatePrompt = async () => {
    setGenerating(true)
    const res = await fetch("/api/generate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId:   projId,
        description: genDesc,
        spId:        genSpId,
        specContext: spec?.rawContent.slice(0, 2000),
      }),
    })
    const data = await res.json()
    setGenResult(data.content)
    setGenerating(false)
  }

  if (!spec) return <p className="text-gray-400">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{spec.title}</h1>
          <p className="text-gray-500 text-sm font-mono">{spec.filename}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/applications/${appId}/projects/${projId}/run?specFile=` + encodeURIComponent(spec.filePath)} className="btn-primary">
            Run Spec
          </Link>
          <button onClick={save} disabled={saving} className="btn-secondary">
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
          <button onClick={() => router.push(`/applications/${appId}/projects/${projId}`)} className="btn-ghost">Back</button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("edit")} className={tab === "edit" ? "btn-primary" : "btn-ghost"}>Edit</button>
        <button onClick={() => setTab("preview")} className={tab === "preview" ? "btn-primary" : "btn-ghost"}>Preview</button>
      </div>

      {tab === "edit" && (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full h-[600px] input-field font-mono text-xs leading-relaxed resize-none"
          spellCheck={false}
        />
      )}

      {tab === "preview" && (
        <div className="card prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-xs font-mono">{content}</pre>
        </div>
      )}

      {/* Branch Override */}
      <div className="card space-y-3">
        <h2 className="font-semibold">Branch</h2>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Branch override</label>
          <input
            className="input-field font-mono text-sm"
            placeholder="Leave empty to use project template"
            value={branchOverride}
            onChange={e => setBranchOverride(e.target.value)}
          />
          {projectBranchTemplate && !branchOverride.trim() && (
            <p className="text-xs text-gray-400">
              Project template: <span className="font-mono">{projectBranchTemplate}</span>
            </p>
          )}
          {resolvedBranch ? (
            <p className="text-xs text-gray-500">
              Resolved branch:{" "}
              <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                ⎇ {resolvedBranch}
              </span>
            </p>
          ) : (
            <p className="text-xs text-gray-400">No branch configured — will run on current branch.</p>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">AI Prompt Generator</h2>
        <p className="text-sm text-gray-500">Describe what a sub-prompt should do and Claude will write it for you.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Sub-prompt ID</label>
            <input className="input-field" placeholder="SP-03" value={genSpId} onChange={e => setGenSpId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input className="input-field" placeholder="Set up Firebase client and admin SDKs..." value={genDesc} onChange={e => setGenDesc(e.target.value)} />
          </div>
        </div>
        <button onClick={generatePrompt} disabled={generating || !genDesc} className="btn-primary">
          {generating ? "Generating..." : "Generate Sub-prompt"}
        </button>
        {genResult && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Generated content (copy into your spec):</p>
            <textarea
              readOnly
              value={genResult}
              className="w-full h-48 input-field font-mono text-xs resize-none bg-gray-50"
            />
            <button
              onClick={() => setContent(c => c + "\n\n" + genResult)}
              className="btn-secondary text-sm"
            >
              Append to spec
            </button>
          </div>
        )}
      </div>
    </div>
  )
}