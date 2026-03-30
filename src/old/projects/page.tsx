"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import type { Project } from "@/types"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(setProjects).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new" className="btn-primary">New Project</Link>
      </div>

      {loading && <p className="text-gray-400">Loading...</p>}

      {!loading && projects.length === 0 && (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-lg mb-4">No projects yet</p>
          <Link href="/projects/new" className="btn-secondary">Create your first project</Link>
        </div>
      )}

      <div className="grid gap-4">
        {projects.map(p => (
          <Link key={p.id} href={"/projects/" + p.id} className="card hover:border-brand-300 transition-colors block">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-lg">{p.name}</h2>
                {p.description && <p className="text-gray-500 text-sm mt-1">{p.description}</p>}
              </div>
              <span className="text-xs text-gray-400 font-mono">{p.model}</span>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-gray-400">
              <span>App: {p.appDir || "not set"}</span>
              <span>Specs: {p.specDir || "not set"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
