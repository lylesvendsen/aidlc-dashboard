"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type { Project } from "@/types"

export default function ConfigPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const [form, setForm] = useState({
    name:               "",
    description:        "",
    appDir:             "",
    specDir:            "",
    logsDir:            "",
    model:              "claude-sonnet-4-6",
    projectContext:     "",
    constraints:        "",
    afterEachSubPrompt: "",
    afterUnit:          "",
    autoCommit:         true,
    autoTag:            true,
    commitMessage:      "",
    tagTemplate:        "",
  })

  useEffect(() => {
    fetch("/api/projects/" + id)
      .then(r => r.json())
      .then((p: Project) => {
        setProject(p)
        setForm({
          name:               p.name,
          description:        p.description,
          appDir:             p.appDir,
          specDir:            p.specDir,
          logsDir:            p.logsDir,
          model:              p.model,
          projectContext:     p.projectContext,
          constraints:        p.constraints.join("\n"),
          afterEachSubPrompt: p.validation.afterEachSubPrompt.join("\n"),
          afterUnit:          p.validation.afterUnit.join("\n"),
          autoCommit:         p.git.autoCommit,
          autoTag:            p.git.autoTag,
          commitMessage:      p.git.commitMessage,
          tagTemplate:        p.git.tagTemplate,
        })
      })
  }, [id])

  const save = async () => {
    setSaving(true)
    // Build the correct nested structure — no top-level leakage
    const body = {
      name:           form.name,
      description:    form.description,
      appDir:         form.appDir,
      specDir:        form.specDir,
      logsDir:        form.logsDir,
      model:          form.model,
      projectContext: form.projectContext,
      constraints:    form.constraints.split("\n").map((s: string) => s.trim()).filter(Boolean),
      validation: {
        afterEachSubPrompt: form.afterEachSubPrompt.split("\n").map((s: string) => s.trim()).filter(Boolean),
        afterUnit:          form.afterUnit.split("\n").map((s: string) => s.trim()).filter(Boolean),
      },
      git: {
        autoCommit:    form.autoCommit,
        autoTag:       form.autoTag,
        commitMessage: form.commitMessage,
        tagTemplate:   form.tagTemplate,
      },
    }
    await fetch("/api/projects/" + id, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!project) return <p className="text-gray-400">Loading...</p>

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder = "",
    textarea = false,
    rows = 3,
  ) => (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {textarea ? (
        <textarea
          rows={rows}
          className="input-field font-mono text-xs"
          placeholder={placeholder}
          value={String(form[key])}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        />
      ) : (
        <input
          className="input-field"
          placeholder={placeholder}
          value={String(form[key])}
          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        />
      )}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Config — {project.name}</h1>
        <button onClick={() => router.back()} className="btn-ghost">Back</button>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Project</h2>
        {field("Name", "name")}
        {field("Description", "description")}
        {field("App directory (absolute path)", "appDir", "/absolute/path/to/app")}
        {field("Spec directory (absolute path)", "specDir", "/absolute/path/to/specs")}
        {field("Logs directory (absolute path)", "logsDir", "/absolute/path/to/logs")}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Model</label>
          <select
            className="input-field"
            value={form.model}
            onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
          >
            <option value="claude-sonnet-4-6">claude-sonnet-4-6 (recommended)</option>
            <option value="claude-opus-4-6">claude-opus-4-6 (most capable)</option>
          </select>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Prompt context</h2>
        {field("Project context", "projectContext", "Describe your stack and architecture...", true, 6)}
        {field("Constraints (one per line)", "constraints", "", true, 5)}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Validation commands</h2>
        {field("After each sub-prompt (one per line)", "afterEachSubPrompt", "", true, 3)}
        {field("After full unit (one per line)", "afterUnit", "", true, 4)}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Git</h2>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoCommit}
              onChange={e => setForm(p => ({ ...p, autoCommit: e.target.checked }))}
            />
            Auto-commit on success
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoTag}
              onChange={e => setForm(p => ({ ...p, autoTag: e.target.checked }))}
            />
            Auto-tag on success
          </label>
        </div>
        {field("Commit message template", "commitMessage", "{unitId} complete: {unitTitle}")}
        {field("Tag template", "tagTemplate", "{unitId}-{timestamp}")}
      </div>

      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving..." : saved ? "Saved!" : "Save Config"}
        </button>
        <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}
