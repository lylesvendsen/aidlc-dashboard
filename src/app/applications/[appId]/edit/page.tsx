'use client'
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import type { ApplicationConfig } from "@/lib/v2/types"

export default function EditApplicationPage() {
  const { appId } = useParams<{ appId: string }>()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")
  const [form, setForm] = useState<Partial<ApplicationConfig> & { constraintsText: string }>({
    name: "", description: "", appDir: "", specDir: "", logsDir: "",
    defaultModel: "claude-sonnet-4-6", projectContext: "", constraintsText: "",
  })

  useEffect(() => {
    fetch(`/api/applications/${appId}`).
      then(r => r.json()).then(data => {
        setForm({
          ...data,
          constraintsText: (data.globalConstraints ?? []).join("\n"),
        })
      })
  }, [appId])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("")
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          globalConstraints: (form.constraintsText ?? "").split("\n").map(s => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      router.push(`/applications/${appId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error"); setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/v2/applications" className="hover:text-gray-900">Applications</Link>
        <span className="mx-2">/</span>
        <Link href={`/applications/${appId}`} className="hover:text-gray-900">{form.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Edit</span>
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">Edit Application</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        {[
          ["Name", "name", true],
          ["Description", "description", false],
          ["App directory", "appDir", true],
          ["Spec directory", "specDir", true],
          ["Logs directory", "logsDir", true],
          ["Default model", "defaultModel", false],
        ].map(([label, key, required]) => (
          <div key={key as string} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{label as string}{required ? " *" : ""}</label>
            <input className="input-field" value={(form as unknown as Record<string, string>)[key as string] ?? ""}
              required={required as boolean} onChange={e => set(key as string, e.target.value)} />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Project context</label>
          <textarea className="input-field min-h-[80px]" value={form.projectContext ?? ""}
            onChange={e => set("projectContext", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Global constraints <span className="text-xs text-gray-400 font-normal ml-2">(inherited by all projects, cannot be removed)</span>
          </label>
          <textarea className="input-field min-h-[80px] font-mono text-xs" value={form.constraintsText ?? ""}
            onChange={e => set("constraintsText", e.target.value)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Changes"}</button>
          <Link href={`/applications/${appId}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
