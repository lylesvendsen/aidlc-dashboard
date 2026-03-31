'use client'
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

interface Props { isNew?: boolean }

function renderTemplate(template: string, vars: { specId: string; projectId: string; jiraId?: string }): string {
  if (!template.trim()) return ""
  let result = template
    .replace(/\{specId\}/g, vars.specId)
    .replace(/\{projectId\}/g, vars.projectId)
    .replace(/\{jiraId\}/g, vars.jiraId ?? "")
  result = result.toLowerCase().replace(/[^a-z0-9/]+/g, "-").replace(/^-+|-+$/g, "")
  return result
}

function ProjectForm({ isNew = false }: Props) {
  const { appId, projId } = useParams<{ appId: string; projId?: string }>()
  const router  = useRouter()
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState("")
  const [appName, setAppName] = useState("")
  const [name,              setName]             = useState("")
  const [description,       setDescription]      = useState("")
  const [specDirFilter,     setSpecDirFilter]    = useState("")
  const [model,             setModel]            = useState("")
  const [projectContext,    setProjectContext]   = useState("")
  const [constraintsText,   setConstraintsText] = useState("")
  const [afterEachSP,       setAfterEachSP]     = useState("")
  const [afterUnit,         setAfterUnit]       = useState("")
  const [autoCommit,        setAutoCommit]      = useState(false)
  const [autoTag,           setAutoTag]         = useState(false)
  const [commitMessage,     setCommitMessage]   = useState("")
  const [branch,            setBranch]          = useState("")
  const [branchTemplate,    setBranchTemplate]  = useState("")
  const [firstSpecId,       setFirstSpecId]     = useState("")

  useEffect(() => {
    fetch(`/api/applications/${appId}`).then(r => r.json()).then(d => setAppName(d.name ?? ""))
    if (!isNew && projId) {
      fetch(`/api/applications/${appId}/projects/${projId}`).then(r => r.json()).then(d => {
        setName(d.name ?? "")
        setDescription(d.description ?? "")
        setSpecDirFilter(d.specDirFilter ?? "")
        setModel(d.model ?? "")
        setProjectContext(d.projectContext ?? "")
        setConstraintsText((d.constraints ?? []).join("\n"))
        setAfterEachSP((d.validation?.afterEachSubPrompt ?? []).join("\n"))
        setAfterUnit((d.validation?.afterUnit ?? []).join("\n"))
        setAutoCommit(d.git?.autoCommit ?? false)
        setAutoTag(d.git?.autoTag ?? false)
        setCommitMessage(d.git?.commitMessage ?? "")
        setBranch(d.git?.branch ?? "")
        setBranchTemplate(d.branchTemplate ?? "")
      })
      fetch(`/api/applications/${appId}/projects/${projId}/specs`).then(r => r.json()).then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setFirstSpecId(d[0].id ?? d[0].specId ?? "")
        }
      }).catch(() => {})
    }
  }, [appId, projId, isNew])

  const branchPreview = branchTemplate.trim()
    ? renderTemplate(branchTemplate, {
        specId: firstSpecId || "b1",
        projectId: projId || "proj",
        jiraId: "PROJ-42",
      })
    : ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("")
    const payload = {
      name, description,
      specDirFilter: specDirFilter.trim() || null,
      model: model.trim() || null,
      projectContext: projectContext.trim() || null,
      constraints: constraintsText.split("\n").map(s => s.trim()).filter(Boolean),
      validation: {
        afterEachSubPrompt: afterEachSP.split("\n").map(s => s.trim()).filter(Boolean),
        afterUnit: afterUnit.split("\n").map(s => s.trim()).filter(Boolean),
      },
      git: {
        autoCommit, autoTag,
        commitMessage: commitMessage.trim() || null,
        branch: branch.trim() || null,
      },
      branchTemplate: branchTemplate.trim() || null,
    }
    try {
      let res: Response
      if (isNew) {
        res = await fetch(`/api/applications/${appId}/projects`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/applications/${appId}/projects/${projId}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const data = await res.json()
      router.push(`/applications/${appId}/projects/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error"); setSaving(false)
    }
  }

  const title = isNew ? "New Project" : "Edit Project"

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <nav className="text-sm text-gray-500">
        <Link href="/v2/applications" className="hover:text-gray-900">Applications</Link>
        <span className="mx-2">/</span>
        <Link href={`/applications/${appId}`} className="hover:text-gray-900">{appName}</Link>
        <span className="mx-2">/</span>
        {!isNew && projId && <><Link href={`/applications/${appId}/projects/${projId}`} className="hover:text-gray-900">{name}</Link><span className="mx-2">/</span></>}
        <span className="text-gray-900">{title}</span>
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Basic */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Basic</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Name *</label>
            <input className="input-field" value={name} required onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <input className="input-field" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Spec directory filter <span className="text-gray-400 font-normal text-xs">(optional subfolder within app spec dir)</span></label>
            <input className="input-field font-mono text-sm" value={specDirFilter}
              placeholder="A-series" onChange={e => setSpecDirFilter(e.target.value)} />
          </div>
        </div>

        {/* Overrides */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Overrides <span className="text-xs text-gray-400 font-normal">(leave blank to inherit from application)</span></h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Model</label>
            <input className="input-field font-mono text-sm" value={model}
              placeholder="claude-sonnet-4-6" onChange={e => setModel(e.target.value)} />
          </div>
        </div>

        {/* Context & Constraints */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Context & Constraints <span className="text-xs text-gray-400 font-normal">(additive — combined with application level)</span></h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Project context</label>
            <textarea className="input-field min-h-[80px]" value={projectContext}
              placeholder="Additional context for this project..."
              onChange={e => setProjectContext(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Additional constraints <span className="text-gray-400 font-normal text-xs">(one per line)</span></label>
            <textarea className="input-field min-h-[80px] font-mono text-xs" value={constraintsText}
              onChange={e => setConstraintsText(e.target.value)} />
          </div>
        </div>

        {/* Validation */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Validation <span className="text-xs text-gray-400 font-normal">(overrides application defaults)</span></h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">After each sub-prompt <span className="text-gray-400 font-normal text-xs">(one command per line)</span></label>
            <textarea className="input-field font-mono text-xs min-h-[60px]" value={afterEachSP}
              placeholder="npm run typecheck" onChange={e => setAfterEachSP(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">After full unit <span className="text-gray-400 font-normal text-xs">(one command per line)</span></label>
            <textarea className="input-field font-mono text-xs min-h-[60px]" value={afterUnit}
              placeholder="npm run test" onChange={e => setAfterUnit(e.target.value)} />
          </div>
        </div>

        {/* Git */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Git <span className="text-xs text-gray-400 font-normal">(overrides application defaults)</span></h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Branch <span className="text-gray-400 font-normal text-xs">(leave blank to use current)</span></label>
            <input className="input-field font-mono text-sm" value={branch}
              placeholder="main" onChange={e => setBranch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Commit message template</label>
            <input className="input-field font-mono text-sm" value={commitMessage}
              placeholder="{unitId} complete: {unitTitle}" onChange={e => setCommitMessage(e.target.value)} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={autoCommit} onChange={e => setAutoCommit(e.target.checked)} className="rounded" />
              Auto-commit on success
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={autoTag} onChange={e => setAutoTag(e.target.checked)} className="rounded" />
              Auto-tag on success
            </label>
          </div>
        </div>

        {/* Branch template */}
        <div className="card space-y-4">
          <h2 className="font-medium text-gray-900">Branch template</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Branch template</label>
            <input
              className="input-field font-mono text-sm"
              value={branchTemplate}
              placeholder="feature/{specId}"
              onChange={e => setBranchTemplate(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Available variables:{" "}
              <span className="font-mono text-gray-500">{"{specId}"}</span>{" "}
              <span className="font-mono text-gray-500">{"{projectId}"}</span>{" "}
              <span className="font-mono text-gray-500">{"{jiraId}"}</span>
              {" — "}leave blank for no automatic branch switching.
            </p>
          </div>
          {branchTemplate.trim() && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Preview</p>
              <p className="text-xs font-mono bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700">
                {branchPreview ? branchPreview : <span className="text-gray-400 italic">invalid template</span>}
              </p>
              <p className="text-xs text-gray-400">
                Rendered using specId=<span className="font-mono">{firstSpecId || "b1"}</span>,
                {" "}projectId=<span className="font-mono">{projId || "proj"}</span>,
                {" "}jiraId=<span className="font-mono">PROJ-42</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : isNew ? "Create Project" : "Save Changes"}
          </button>
          <Link href={isNew ? `/applications/${appId}` : `/applications/${appId}/projects/${projId}`} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  )
}

export default ProjectForm