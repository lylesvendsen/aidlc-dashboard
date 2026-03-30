'use client'
import { useEffect, useState } from 'react'

export function FileContentViewer({ projectId, filePath }: { projectId: string; filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({ projectId, filePath })
    fetch('/api/projects/' + projectId + '/file-content?' + params.toString())
      .then(r => r.json())
      .then((d: { content?: string; error?: string }) => {
        if (d.error) setError(d.error)
        else setContent(d.content ?? '')
      })
      .catch(() => setError('Failed to load file'))
  }, [projectId, filePath])

  if (error) return <div className="p-4 text-red-500 text-sm">{error}</div>
  if (content === null) return <div className="p-4 text-gray-400 text-sm animate-pulse">Loading...</div>
  return (
    <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap break-words">
      {content}
    </pre>
  )
}
