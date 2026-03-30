import Link from "next/link"

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">

      <div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Home</Link>
        <h1 className="text-3xl font-semibold mt-4 mb-2">How AIDLC works</h1>
        <p className="text-gray-500 leading-relaxed">
          AIDLC is an AI-driven development lifecycle tool. You write structured specs, and the runner
          executes them against your codebase by calling Claude — one file at a time, one sub-prompt at a time.
        </p>
      </div>

      {/* Step 1 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">1. Set up an Application</h2>
        <p className="text-gray-600 leading-relaxed">
          An Application points the dashboard at a codebase. Navigate to <Link href="/applications/new" className="text-blue-600 underline">New Application</Link> and fill in:
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            ["App directory", "Absolute path to the root of your codebase (e.g. /Users/you/my-app)"],
            ["Spec directory", "Where your .md spec files live (e.g. /Users/you/my-app/docs/aidlc/specs)"],
            ["Logs directory", "Where execution logs are written (e.g. /Users/you/my-app/docs/aidlc/logs)"],
            ["Model", "Claude model to use — claude-sonnet-4-6 is the default"],
            ["Global constraints", "Rules injected into every prompt (e.g. 'Use TypeScript strict mode')"],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3 card py-2 px-3">
              <span className="font-mono text-blue-600 shrink-0 w-32">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">2. Create a Project</h2>
        <p className="text-gray-600 leading-relaxed">
          Projects group related specs within an Application. They inherit app-level settings and can override the model, add constraints, and configure validation commands. A typical project represents one feature area or module of the codebase.
        </p>
        <div className="card text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Validation commands</span> run after every sub-prompt — e.g. <code className="font-mono bg-gray-100 px-1 rounded">npm run typecheck</code>, <code className="font-mono bg-gray-100 px-1 rounded">npm run lint</code>. If they fail, the run stops.</p>
          <p><span className="font-medium">Project context</span> is injected into every prompt — use it to describe the codebase architecture, conventions, or anything Claude should always know.</p>
        </div>
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">3. Write a Spec</h2>
        <p className="text-gray-600 leading-relaxed">
          Specs are markdown files. Each spec delivers one unit of work broken into sequential sub-prompts (SPs). Use the <strong>Spec Assistant</strong> to generate one conversationally, or write it manually.
        </p>
        <div className="card font-mono text-xs text-gray-700 space-y-1 bg-gray-50">
          <p className="text-blue-600"># B1 - My Feature</p>
          <p className="text-gray-400"># Version: 1.0</p>
          <p className="mt-2 text-gray-500">## What this unit delivers</p>
          <p>A brief description of what this spec produces.</p>
          <p className="mt-2 text-gray-500">## Context files</p>
          <p>  src/lib/myLib.ts</p>
          <p className="mt-2 text-gray-500">### SP-01: Do the first thing</p>
          <p>Write a function that does X. Read myLib.ts for context.</p>
          <p className="mt-1 text-gray-500">Files to create:</p>
          <p>  src/lib/feature.ts</p>
          <p className="mt-1 text-gray-500">Acceptance:</p>
          <p>  SP01-01  src/lib/feature.ts exists</p>
          <p>  SP01-02  npm run typecheck passes</p>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {[
            ["## Context files", "Files listed here are read from disk and injected into every prompt in the spec."],
            ["### SP-NN: Title", "Each sub-prompt is a heading. The body is the prompt sent to Claude for that step."],
            ["Files to create:", "List the files Claude should write for this SP. One per line, relative to appDir."],
            ["Acceptance:", "Checklist items validated after the SP completes. Failures stop the run."],
            ["## Pre-run command", "Optional shell command run once before any SP — useful for clearing scratch directories."],
            ["## Next unit", "Link to the next spec in the sequence — used to build the dependency graph."],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-3 card py-2 px-3">
              <code className="font-mono text-blue-600 shrink-0 text-xs w-36">{k}</code>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Step 4 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">4. Run a Spec</h2>
        <p className="text-gray-600 leading-relaxed">
          Click <strong>Run</strong> next to any spec on the project page. The run page shows:
        </p>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            ["Token counter", "Live input/output token counts and estimated cost per run, with per-SP hover breakdown."],
            ["Log terminal", "Color-coded stream: 🔴 errors, 🔵 success, ⚪ info, 🟡 system narration. Filter each level independently."],
            ["Sub-prompt panel", "Each SP row shows status, files written, and validation results. Click to expand."],
            ["Constraint toggles", "Toggle individual constraints and validation commands off for a single run without editing the spec."],
            ["Retry", "If an SP fails, fix the code and hit Retry from here — previous SPs are skipped."],
            ["Manual fix", "Fixed the issue by hand? Hit I fixed it manually → re-validate to re-run validation without re-calling Claude."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-3 card py-2 px-3">
              <span className="font-medium text-gray-700 shrink-0 w-36">{k}</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Step 5 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">5. Resume and iterate</h2>
        <p className="text-gray-600 leading-relaxed">
          AIDLC is designed to be run multiple times. The typical cycle is:
        </p>
        <ol className="space-y-2 text-sm text-gray-600 list-none">
          {[
            "Run the spec — it executes until the first validation failure.",
            "Read the error in the expanded SP panel or log terminal.",
            "Fix the issue manually in your IDE, or let the runner retry.",
            "Resume from the failed SP — the runner picks up where it left off.",
            "Once all SPs pass, the execution log is saved to logsDir.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 card py-2 px-3">
              <span className="font-mono text-blue-500 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-2">Tips for writing good specs</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          {[
            "Keep each SP focused on one file or one logical change — smaller prompts produce better output.",
            "Use Files to create: to explicitly list output files — don't rely on Claude to infer them.",
            "Reference real file paths in your SP body — they get injected as context automatically.",
            "Write precise acceptance criteria — vague criteria like 'works correctly' don't help the runner.",
            "Use a Pre-run command to clean scratch directories so failed runs don't contaminate retries.",
            "Use project context to describe architectural conventions once rather than repeating them in every SP.",
            "Name your SPs clearly — the SP name appears in the run page and makes debugging faster.",
          ].map((tip) => (
            <li key={tip} className="flex gap-3 card py-2 px-3">
              <span className="text-blue-500 shrink-0 mt-0.5">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Nav */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">← Home</Link>
        <Link href="/applications" className="btn-primary text-sm">Go to Applications →</Link>
      </div>

    </div>
  )
}
