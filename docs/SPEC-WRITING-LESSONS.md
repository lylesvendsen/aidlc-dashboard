# AIDLC Spec Writing Lessons Learned
# Version: 1.0
# Updated: March 2026
# Purpose: Lessons from real spec failures. Add to every time a spec fails
#           in a way that reveals a gap in how specs are written.

---

## Lesson 1 — Know Your File Structure Before Writing Specs

**What happened:**
B5 was written referencing files that don't exist:
  src/store/executionStore.ts        — we don't use Zustand
  src/hooks/useExecutionStream.ts    — this hook doesn't exist
  src/components/SpLabel.tsx         — doesn't exist
  src/app/projects/[projectId]/...   — wrong param name, should be [id]

**The rule:**
Before writing a spec that modifies existing files, run:
  find src -name "*.ts" -o -name "*.tsx" | head -40
  ls src/app/projects/
  ls src/components/
  ls src/hooks/
  ls src/store/ (if it exists)

Verify every file path you put in the spec actually exists.
Verify every route param name matches the actual directory name.

**In the Spec Assistant:**
The assistant should be given a filetree of the project before generating specs.
Add this to the system prompt: inject the top 3 levels of src/ as context.

---

## Lesson 2 — Know Your Architecture Before Inventing Abstractions

**What happened:**
B5 invented a Zustand store and a useExecutionStream hook because the spec
author assumed a more complex architecture than what exists. The dashboard
uses simple local React state in the run page — no global store needed.

**The rule:**
Before adding new abstractions (stores, hooks, contexts), check:
  1. Does this state need to be shared across multiple components?
  2. If not — local useState in the component is correct.
  3. If yes — check if a store already exists before creating one.

"The simplest implementation that satisfies the acceptance criteria" is always correct.
Never add architectural complexity a spec doesn't explicitly require.

**In the Spec Assistant:**
When the assistant suggests adding a store or hook, ask:
"Does this state need to be shared across multiple pages?"
If no — use local state instead.

---

## Lesson 3 — Know Your Event Types Before Referencing Them

**What happened:**
B5 referenced sp_failed as the SSE event type. The actual event type
emitted by the runner is sp_fail (no 'd').

**The rule:**
Before referencing event types, status values, or type union members in a spec,
check the actual source:
  grep -n "type:" src/lib/runner.ts | head -20
  grep -n "SpStatus|StreamEvent" src/types/index.ts

Our actual event types: "log" | "sp_start" | "sp_pass" | "sp_fail" | "done" | "error"
Our actual SP statuses: "pending" | "running" | "passed" | "failed" | "locked"
Our actual ExecutionLog statuses: "passed" | "failed" | "in_progress"

---

## Lesson 4 — Specs Written Without Codebase Context Will Fail

**What happened:**
B5 was written by Claude (in conversation) without access to the actual
codebase structure. It made educated guesses about file names, hook names,
store names, and event types — and got them all wrong.

**The rule:**
The Spec Assistant must have access to:
  1. The project filetree (top 3 levels of src/)
  2. The types/index.ts file (to know all type names and field names)
  3. The existing run page file (when modifying it)
  4. The runner.ts file (when referencing event types)

This is exactly what the file context injection in runner.ts does for
code generation — we need the same for spec generation.

**Action:**
Update the Spec Assistant system prompt to inject:
  - src/ filetree (2-3 levels deep)
  - src/types/index.ts content
  - Any files mentioned in the conversation

---

## Lesson 5 — One SP, One File (Corollary to Runner Rule)

**What happened:**
B5 had SPs modifying 2 files each (e.g. executionStore.ts AND useExecutionStream.ts
in SP-01). With the one-file-per-call runner, each file gets its own Claude call.
But if the files don't exist, those calls fail silently.

**The rule:**
Each SP should ideally modify ONE existing file. When creating new files,
one file per SP is fine. When modifying existing files, verify they exist first.

If a SP must touch two files, list them explicitly in order of dependency:
  Files to modify:
    src/app/projects/[id]/run/page.tsx   (primary change)
    src/types/index.ts                    (add new type if needed)

---

## Lesson 6 — Dry Run Passing Means Nothing About Spec Quality

**What happened:**
B5 dry run showed all 4 SPs passing in 0s. This gave false confidence.
Dry run only validates that the spec file is parseable — not that the
file paths are correct, not that the abstractions exist, not that the
event types are right.

**The rule:**
Dry run = spec parses correctly.
Dry run ≠ spec is correct.

Before running live, manually review:
  1. Every file path in the spec — does it exist? (ls or find)
  2. Every type/interface reference — does it exist? (grep in types/index.ts)
  3. Every event type reference — does it match the runner? (grep in runner.ts)
  4. Every route param name — does it match the directory? (ls src/app/projects/)

---

## Lesson 7 — The Spec Assistant Needs Codebase Awareness

**The pattern we keep seeing:**
Specs written in the Spec Assistant without codebase access invent:
  - Files that don't exist
  - Stores that aren't needed
  - Event types that don't match
  - Route params that are wrong

**The fix:**
B4 wired in AIDLC-METHODOLOGY.md. Next we need to wire in:
  1. The project filetree (2 levels deep, injected per project)
  2. src/types/index.ts (always injected — it's the ground truth)
  3. Any file the user mentions in conversation (from existing file context injection)

This is the single highest-impact improvement to spec quality.
Add this to the B4 spec assistant route improvements.

---

## Summary Checklist Before Running Any Spec Live

Run through this before clicking Run Live:

  [ ] Every file path in the spec exists on disk (ls or find to verify)
  [ ] Every route param name matches the actual directory ([id] not [projectId])
  [ ] Every type/interface name exists in src/types/index.ts
  [ ] Every status value matches the actual union type
  [ ] Every SSE event type matches what runner.ts emits
  [ ] No new abstractions (stores, hooks) added without checking if they exist
  [ ] Each SP has at most 3 files
  [ ] Each SP has a clear single purpose
  [ ] All acceptance criteria are testable in under 30 seconds

---

## Lesson 8 — Spec-Level Context Control

**What happened:**
Specs written without codebase context invent wrong file paths, wrong abstractions,
wrong event types. The spec assistant does not know what files exist or what the
codebase architecture looks like. B5 invented a Zustand store, a useExecutionStream
hook, and a SpLabel component — none of which exist.

**The concept (credit: Lyle Svendsen):**
Give developers explicit control over what context gets injected into each
spec's Claude prompt. Three levels:

  Level 1 — Dynamic (always on)
  Files mentioned by path in SP bodies are auto-injected if they exist on disk.

  Level 2 — Explicit override
  Developer lists exact files in a ## Context files section in the spec.
  These are injected regardless of whether they appear in the SP body.
    ## Context files
      src/types/index.ts
      src/app/projects/[id]/run/page.tsx

  Level 3 — Dependency graph (automatic)
  Runner reads ## Files produced by this unit from prior unit specs and
  injects those files automatically. When B5 says B0 must be complete,
  the runner injects all files B0 produced. Zero manual curation.

**The rule:**
Default = dynamic + dependency graph.
Override with ## Context files when you know exactly what Claude needs.
src/types/index.ts should always be in context for any spec touching types.

**The spec assistant fix:**
Inject into every spec assistant conversation:
  - src/ filetree (2 levels deep)
  - src/types/index.ts content
  - Produced files from each prior spec

This is implemented in B7 - Spec-Level Context Control.

---

## Summary Checklist Before Running Any Spec Live (Updated)

Run through this before clicking Run Live:

  [ ] Every file path in the spec exists on disk (ls or find to verify)
  [ ] Every route param name matches the actual directory ([id] not [projectId])
  [ ] Every type/interface name exists in src/types/index.ts
  [ ] Every status value matches the actual union type
  [ ] Every SSE event type matches what runner.ts emits (sp_fail not sp_failed)
  [ ] No new abstractions (stores, hooks) added without checking if they exist
  [ ] Each SP has at most 3 files
  [ ] Each SP has a clear single purpose
  [ ] All acceptance criteria are testable in under 30 seconds
  [ ] ## Context files section lists any files Claude needs to read
