"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import type { SpecFile } from "@/types"

export default function SpecEditorPage() {
  const { id, specId } = useParams<{ id: string; specId: string }>()
  const router         = useRouter()
  const [spec,    setSpec]    = useState<SpecFile | null>(null)
  const [content, setContent] = useState("")
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [tab,     setTab]     = useState<"edit" | "preview">("edit")

  // Generate prompt state
  const [genSpId,   setGenSpId]   = useState("")
  const [genDesc,   setGenDesc]   = useState("")
  const [genResult, setGenResult] = useState("")
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch("/api/specs/" + specId + "?projectId=" + id)
      .then(r => r.json())
      .then(s => { setSpec(s); setContent(s.rawContent) })
  }, [id, specId])

  const save = async () => {
    setSaving(true)
    await fetch("/api/specs/" + specId + "?projectId=" + id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
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
        projectId:   id,
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
          <Link href={"/projects/" + id + "/run?specFile=" + encodeURIComponent(spec.filePath)} className="btn-primary">
            Run Spec
          </Link>
          <button onClick={save} disabled={saving} className="btn-secondary">
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
          <button onClick={() => router.back()} className="btn-ghost">Back</button>
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
