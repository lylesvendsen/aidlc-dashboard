"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import type { Project, SpecFile, ExecutionLog } from "@/types"

type Mode = "scratch" | "review" | "failure"
type Message = { role: "user" | "assistant"; content: string }

export default function SpecAssistantPage() {
  const { appId, projId } = useParams<{ appId: string; projId: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const mode         = (searchParams.get("mode") as Mode) ?? "scratch"
  const specFilename = searchParams.get("spec") ?? undefined
  const logId        = searchParams.get("logId") ?? undefined

  const [project,    setProject]    = useState<Project | null>(null)
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState("")
  const [sending,    setSending]    = useState(false)
  const [specContent, setSpecContent] = useState("")
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [filename,   setFilename]   = useState("")
  const [showSave,   setShowSave]   = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/applications/" + appId).then(r => r.json()).then(setProject)
  }, [appId, projId])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // Auto-start with opening message
  useEffect(() => {
    if (!project) return
    const opening: Message = {
      role: "assistant",
      content: mode === "scratch"
        ? "Hi! I'll help you build a new AIDLC spec. What feature or unit of work do you want to create a spec for?"
        : mode === "review"
        ? "I'll review your spec and suggest improvements. Share the spec content or I can load it from your spec directory."
        : "I'll analyse your execution log and suggest spec improvements. Share the log details or describe what failed.",
    }
    setMessages([opening])
  }, [project, mode])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg: Message = { role: "user", content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setSending(true)

    try {
      const res = await fetch("/api/spec-assistant", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          projectId: projId,
          messages:  newMessages,
          mode,
          existingSpec: specFilename,
          logId,
        }),
      })

      const reader  = res.body?.getReader()
      const decoder = new TextDecoder()
      let   assistantText = ""
      let   newSpec       = ""

      setMessages(m => [...m, { role: "assistant", content: "" }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n\n").filter(l => l.startsWith("data: "))
        for (const line of lines) {
          try {
            const event = JSON.parse(line.replace("data: ", ""))
            if (event.type === "text") {
              assistantText += event.content
              setMessages(m => {
                const updated = [...m]
                updated[updated.length - 1] = { role: "assistant", content: assistantText }
                return updated
              })
            }
            if (event.type === "spec") {
              newSpec = event.content
              setSpecContent(event.content)
              // Auto-generate filename from spec heading
              const match = event.content.match(/^#\s+(\S+)\s+-\s+(.+)/m)
              if (match) {
                const id2   = match[1].trim()
                const title = match[2].trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40)
                setFilename(id2 + "-" + title + ".md")
              }
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: "Sorry, something went wrong. Please try again." }])
    } finally {
      setSending(false)
    }
  }

  const saveSpec = async () => {
    if (!filename || !specContent) return
    setSaving(true)
    const res = await fetch("/api/app-specs?appId=" + appId + "&projId=" + projId, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filename, content: specContent }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setShowSave(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const modeLabel = mode === "scratch" ? "Build from scratch" : mode === "review" ? "Review spec" : "Learn from failure"
  const modeBg    = mode === "scratch" ? "bg-brand-50 text-brand-700" : mode === "review" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"

  if (!project) return <p className="text-gray-400 p-8">Loading...</p>

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Spec Assistant</h1>
          <span className={"text-xs font-medium px-2 py-1 rounded-full " + modeBg}>{modeLabel}</span>
        </div>
        <button onClick={() => router.push(`/applications/${appId}/projects/${projId}`)} className="btn-ghost text-sm">Back</button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Left: Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1"
          >
            {messages.map((msg, i) => (
              <div key={i} className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={
                  "max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap " +
                  (msg.role === "user"
                    ? "bg-brand-500 text-white"
                    : "bg-white border border-gray-200 text-gray-800")
                }>
                  {msg.content || (sending && i === messages.length - 1
                    ? <span className="text-gray-400 animate-pulse">Thinking...</span>
                    : "")}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2 shrink-0">
            <textarea
              className="input-field flex-1 resize-none overflow-y-auto"
              placeholder="Type your message..."
              value={input}
              rows={1}
              style={{ maxHeight: "calc(1.5rem * 15 + 1.5rem)", overflowY: "auto" }}
              onChange={e => {
                setInput(e.target.value)
                const t = e.target
                t.style.height = "auto"
                t.style.height = Math.min(t.scrollHeight, 360) + "px"
              }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              disabled={sending}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        {/* Right: Spec Preview */}
        <div className="w-96 shrink-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Spec preview</p>
            {specContent && (
              <button
                onClick={() => setShowSave(true)}
                className="btn-secondary text-xs"
              >
                Save to specs
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto card font-mono text-xs leading-relaxed whitespace-pre-wrap bg-gray-50 text-gray-700">
            {specContent
              ? specContent
              : <p className="text-gray-400 not-italic" style={{ fontFamily: "inherit" }}>
                  Your spec will appear here as the conversation progresses.
                </p>
            }
          </div>

          {saved && (
            <p className="text-xs text-green-600 mt-2">✓ Spec saved successfully</p>
          )}
        </div>
      </div>

      {/* Save modal */}
      {showSave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card max-w-md w-full mx-4 space-y-4">
            <h2 className="font-semibold text-lg">Save spec</h2>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Filename</label>
              <input
                className="input-field font-mono"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="B4-my-feature.md"
              />
              <p className="text-xs text-gray-400">
                Will save to: {project.specDir}/{filename}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={saveSpec} disabled={saving || !filename} className="btn-primary">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setShowSave(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
