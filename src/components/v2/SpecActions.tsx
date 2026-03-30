'use client'
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function SpecActions({ appId, projId, specId, specFile }: {
  appId: string; projId: string; specId: string; specFile: string
}) {
  const router   = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/app-specs/${specId}?appId=${appId}&projId=${projId}`, { method: "DELETE" })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-red-600">Delete?</span>
        <button onClick={handleDelete} disabled={deleting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all">{deleting ? "..." : "Yes"}
        </button>
        <button onClick={() => setConfirming(false)}
          className="btn-ghost text-xs">No</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Link href={`/applications/${appId}/projects/${projId}/specs/${specId}`}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 active:scale-95 transition-all">Edit</Link>
      <Link href={`/applications/${appId}/projects/${projId}/run?specFile=${encodeURIComponent(specFile)}`}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 active:scale-95 transition-all">Run</Link>
      <button onClick={() => setConfirming(true)}
        className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all">Delete
      </button>
    </div>
  )
}
