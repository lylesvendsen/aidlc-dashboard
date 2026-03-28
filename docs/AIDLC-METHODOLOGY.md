# AIDLC Methodology & Steering Rules
# Version: 2.0
# Updated: March 2026
# Based on: AWS AI-DLC specification-first methodology (specs.md/aidlc/overview)
# Purpose: Injected into every Spec Assistant conversation as a steering file.
#           Read this before generating any spec. These rules are mandatory.

---

## What AIDLC Is

AIDLC (AI-Driven Development Lifecycle) is a specification-first methodology where
humans define what to build and AI implements it under human supervision.

The three core principles, borrowed from the AWS/Kiro formalization:

1. **Specification-First** — Specs are updated before code. The spec is always the
   source of truth. Code is a byproduct of the spec, never the other way around.

2. **Human-in-the-Loop** — AI proposes. Humans validate. At every checkpoint —
   dry run, SP completion, unit completion — a human reviews before proceeding.

3. **Traceability** — Every file written can be traced to a specific sub-prompt,
   which traces to a spec, which traces to a requirement or Jira ticket.

---

## The Three Phases

### Phase 1 — Inception (What & Why)

Before writing a spec, answer these questions:

- **User story**: As a [role], I want [capability] so that [outcome].
- **Acceptance scenario**: Given [context], when [action], then [result].
- **Jira ticket**: What ticket tracks this work? (optional but recommended)
- **Dependencies**: Which prior units must be complete?

The Spec Assistant should elicit these answers through conversation before
generating a spec. Do not skip inception — specs written without it are vague.

### Phase 2 — Construction (How)

The spec file. This is what AIDLC runs.

Each spec defines:
- The architecture decisions for this unit
- Sub-prompts with explicit file paths and acceptance criteria
- Validation commands that run after each SP

### Phase 3 — Operations (Run & Verify)

The dashboard executes the spec:
- Dry run validates spec parsing
- Live run writes files and runs validation
- Execution log provides the audit trail
- Git commit records what was built and why

---

## Spec File Structure (Mandatory)

Every spec file must follow this exact structure. Do not deviate.

```markdown
# {UnitID} - {Title}
# Version: 1.0
# Part of: {ProjectName} AIDLC
# Updated: {Month Year}
# Jira: https://jira.tools.bestbuy.com/browse/{TICKET-ID}   ← optional but encouraged

## What this unit delivers
[One clear paragraph. What exists after this unit that did not exist before.
Name the specific files, components, or API endpoints that will be created.]

## Context
[Which prior units must be complete. What environment must be running.
What files already exist that this unit builds on.]

## Architecture principles
[Decisions locked in for this unit. Never violate these in implementation.]

## Sub-prompts (execute in order, validate each before next)

### SP-01: {Name}
[What to build. Be specific.]

Files to create:
  src/path/to/new-file.ts
  src/path/to/component.tsx

Files to modify:
  src/path/to/existing.ts   (add X function, update Y interface)

Acceptance:
  SP01-01  [One testable criterion]
  SP01-02  [Another criterion]

## Done when
[The final gate. One sentence, verifiable in under 60 seconds.]

## Files produced by this unit
  src/path/to/every/file.ts
  src/path/to/created.tsx

## Next unit
{NextID} - {NextTitle}
```

---

## Unit ID Conventions

- Series letter + number: A0, A1, B0, B1, C0...
- A = core application, B = dashboard/tooling, C = next major series
- Sequential within series, starting at 0
- Filename: `{ID}-{kebab-case-title}.md` — e.g. `B4-jira-ticket-support.md`
- Never include the Jira ticket ID in the filename

---

## Sub-Prompt Sizing Rules (Critical)

These rules exist because violating them causes token truncation and silent failures.

**Max 1 file per Claude API call.**
The runner calls Claude once per file. This is enforced in the runner.
This means each SP can have multiple files — they are written one at a time.

**Max 3 files per SP.**
If a SP needs more than 3 files, split into two SPs.
Each SP should have one clear purpose.

**Max ~300 lines per file.**
If a file will be longer than 300 lines, give it its own SP.

**Separate create from modify.**
Files being created and files being modified are different risks.
When possible, put modifications in their own SP so failures are isolated.

**Never mix unrelated concerns.**
SP-01 creates types. SP-02 creates components. SP-03 wires them.
Never put "create the component AND update three existing pages" in one SP.

---

## Acceptance Criteria Rules

Every criterion must pass this test: **Can a human verify it in under 30 seconds
without running the full application?**

**Good criteria:**
  ✓  npm run typecheck returns zero errors
  ✓  Clicking the Delete button opens a confirmation modal
  ✓  The spec card shows the Jira ticket ID as a clickable link
  ✓  dispatch() returns new state without mutating the input object
  ✓  File written to src/lib/jira.ts with extractTicketId function

**Bad criteria (too vague — rewrite these):**
  ✗  Component works correctly
  ✗  Follows best practices
  ✗  Looks good
  ✗  Code is clean and readable

**Criteria ID format:**
  SP01-01, SP01-02... for SP-01
  SP02-01, SP02-02... for SP-02
  Must be unique within the spec.

---

## Steering Rules (Apply to Every Run)

These are the mandatory constraints that apply to ALL specs in this project.
They are equivalent to Kiro's `.kiro/steering/aws-aidlc-rules` file.

### TypeScript
- Strict mode throughout — no implicit any
- Never import variables, types, or modules not used in the file
- Exact field names matter — always check the type definition before using a field
- Type union values are case-sensitive and exact: `"in_progress"` not `"in-progress"`

### Next.js 15
- Dynamic route params are async: `{ params }: { params: Promise<{ id: string }> }`
- Always `const { id } = await params` before using
- tsconfig include must be scoped: `"src/**/*.ts"` not `"**/*.ts"`
- Do not use `next lint` for validation — use `eslint .` directly

### Components
- All colors use Tailwind utility classes — never hardcoded hex
- Buttons always include `whitespace-nowrap` to prevent text wrapping
- Components accept variant props, not style props
- Specify whether exports are default or named — never leave it ambiguous
- Specify exact prop names when one component uses another

### File Paths
- All paths relative to appDir root
- Always use `path.resolve(appDir, filePath)` — never string concatenation
- Never hardcode absolute paths in source files

### API Routes
- Next.js 15 async params pattern on every route handler
- All routes return `NextResponse.json()` — never raw `Response`

---

## Lessons Learned (Hard-Won Knowledge)

Every item here was discovered through a real AIDLC run failure.

### Silent Failures
**filesWritten = [] but SP marked passed.**
The runner used to mark SPs passed even with zero files written.
Now the runner detects this and fails explicitly.

**Truncated JSON = zero files.**
If Claude's response hits max_tokens mid-JSON, the response is unparseable.
The runner now detects output_tokens === max_tokens and fails the SP.
Solution: one file per call, 8192 default max_tokens.

### Common TypeScript Errors
**Unused imports:** Claude imports things it doesn't use. Lint fails.
Fix: Add "Never import unused variables, types, or modules" to constraints.

**Wrong field names on ExecutionLog:**
- `specId` → use `unitId`
- `startedAt` → use `timestamp`
- `createdAt` → use `timestamp`
- `overallStatus` → use `status`

**Wrong field names on SpecFile:**
- `path` → use `filePath`
- `content` → use `rawContent`
- `name` → use `title`

**Wrong status values:**
Our ExecutionLog.status union is: `"passed" | "failed" | "in_progress"`
Not: `"running"`, `"success"`, `"completed"`, `"error"`, `"in-progress"`

**Default vs named exports:**
Always specify in the spec. Mismatch causes TS2614 error.

**Prop name mismatch:**
Always specify exact prop names in the spec.
Example: `filePath` not `filename` when passing to DiffViewer.

### Firebase
**firebase-admin in tests:** Use emulator-only init when VITEST=true.
**FIREBASE_PRIVATE_KEY:** Always `.replace(/\\n/g, "\n")` before cert().
**Auth emulator:** Set FIREBASE_AUTH_EMULATOR_HOST before initializeApp.

### tRPC
**createCallerFactory doesn't exist in tRPC v10.**
Use `appRouter.createCaller(ctx)` instead.

### npm
**npm install:** Always retry with `--legacy-peer-deps` on failure.
**Peer dependency errors:** Common with firebase + React 19. Use legacy flag.

---

## Git Commit Message Format

### With Jira ticket:
`[TICKET-ID] {unitId} complete: {unitTitle}`
Example: `[PERS-10266] B4 complete: Jira ticket support`

### Without Jira ticket:
`{unitId} complete: {unitTitle}`
Example: `B4 complete: Jira ticket support`

Extract ticket ID from URL: `/browse\/([A-Z]+-\d+)/`

---

## Audit Trail

When you manually fix a SP failure, document it.
This is the equivalent of the AWS AI-DLC `aidlc-docs/audit.md`.

Format for manual fixes:
```
[DATE] [SP-ID] MANUAL FIX: [what was wrong] → [what you changed]
Example: [2026-03-28] [B3-SP-04] MANUAL FIX: graph.ts used wrong field names
         (startedAt, overallStatus) → changed to (timestamp, status)
```

Store these in: `docs/aidlc/audit.md` in the project repo.

---

## What Makes a Good Spec

A good spec answers all five questions without ambiguity:

1. **What will exist after this unit that doesn't exist now?** (What this unit delivers)
2. **Exactly which files will be created or modified?** (File lists in each SP)
3. **How will we know it works?** (Acceptance criteria)
4. **What architectural decisions are locked in?** (Architecture principles)
5. **What can go wrong?** (Constraints + lessons learned applied)

If you can read the spec and still have questions about implementation,
the spec is not done yet.

---

## What Makes a Bad Spec

- SPs with more than 3 files
- No explicit file paths — Claude guesses wrong paths without them
- Acceptance criteria containing "works correctly", "looks good", or "best practices"
- No Context section — Claude doesn't know what already exists
- No distinction between files to create vs files to modify
- SPs that are secretly dependent on each other without saying so
- Missing the "Done when" gate

---

## The Self-Bootstrapping Story

The AIDLC Dashboard was built using AIDLC itself. B0 through B3 ran against
the dashboard's own codebase. The dashboard improved its own run page,
built a spec assistant, added diff views, and added a dependency graph.

Every spec is in the git history with its execution logs as the audit trail.

This is the enterprise pitch:
- Structured: every feature starts with a spec
- Auditable: every file traces to a sub-prompt traces to a requirement
- Human-controlled: dry run gate + per-SP validation + manual fix flow
- Self-improving: the tool that runs specs was built using the same tool
