import Link from "next/link"

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">

      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          AI-Driven Development Lifecycle
        </div>
        <h1 className="text-4xl font-semibold text-gray-900 leading-tight">
          AIDLC Dashboard
        </h1>
        <p className="text-xl text-gray-500 leading-relaxed max-w-2xl">
          A self-bootstrapping orchestration layer that turns structured specs into working code — one sub-prompt at a time, with full visibility into every step.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/applications" className="btn-primary">View Applications</Link>
          <Link href="/how-it-works" className="btn-secondary">How it works</Link>
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">What it does</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: "◎",
              title: "Spec-driven execution",
              desc: "Write structured markdown specs with sub-prompts. The runner executes them in order, validating after each step before proceeding.",
            },
            {
              icon: "⟳",
              title: "Self-healing runs",
              desc: "Failed sub-prompts pause the run. Fix manually and re-validate, or let the runner retry. Resume from any point without re-running earlier steps.",
            },
            {
              icon: "⬡",
              title: "Application hierarchy",
              desc: "Organise work into Applications → Projects → Specs. Each level inherits context, constraints, and validation settings.",
            },
            {
              icon: "◈",
              title: "Live run terminal",
              desc: "Color-coded log stream with system narration. Filter by errors, success, info, and system messages. Token count and cost tracked in real time.",
            },
            {
              icon: "✦",
              title: "Context injection",
              desc: "Reference existing files in your spec and they are automatically injected into Claude's prompt — no copy-pasting required.",
            },
            {
              icon: "⌘",
              title: "Validation pipeline",
              desc: "Run typecheck, lint, and tests after every sub-prompt. Toggle individual checks on or off per run without editing the spec.",
            },
            {
              icon: "↯",
              title: "Spec assistant",
              desc: "Conversational spec builder. Describe a feature and the assistant drafts a structured spec with sub-prompts and acceptance criteria.",
            },
            {
              icon: "⊞",
              title: "System tests",
              desc: "Built-in test suite validates the runner itself — self-healing canary, token limit stress, context injection, dry-run correctness.",
            },
          ].map((f) => (
            <div key={f.title} className="card space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-lg font-mono">{f.icon}</span>
                <h3 className="font-medium text-gray-900">{f.title}</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data model */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">Data model</h2>
        <div className="card">
          <div className="flex items-start gap-0 text-sm font-mono">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="w-24 text-right text-gray-400 shrink-0">Application</span>
                <span className="text-gray-300">─</span>
                <span className="text-blue-600">appDir, specDir, logsDir, model, globalConstraints</span>
              </div>
              <div className="flex items-center gap-3 pl-8">
                <span className="w-16 text-right text-gray-400 shrink-0">Project</span>
                <span className="text-gray-300">─</span>
                <span className="text-blue-600">specDirFilter, constraints, validation commands</span>
              </div>
              <div className="flex items-center gap-3 pl-16">
                <span className="w-8 text-right text-gray-400 shrink-0">Spec</span>
                <span className="text-gray-300">─</span>
                <span className="text-blue-600">SP-01 → SP-02 → … → SP-N (sequential, validated)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">Get started</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: "/applications/new",  label: "New application",  desc: "Set up a new codebase with directories and model" },
            { href: "/how-it-works",       label: "How it works",     desc: "Full walkthrough of the spec format and runner" },
            { href: "/applications",       label: "Applications",     desc: "Browse existing applications and their specs" },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="card hover:border-blue-200 hover:bg-blue-50 transition-colors group block">
              <p className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{l.label} →</p>
              <p className="text-sm text-gray-500 mt-1">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
