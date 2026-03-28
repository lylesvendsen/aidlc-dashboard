# B0 - Run Page v2
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
A completely redesigned run page giving engineers full visibility into spec
execution. Sub-prompt tree with status, attempt history, inline validation
output, manual fix flow, token cost tracker, and execution gating.
Engineers never need to drop to the CLI to understand what happened.

## Context
- aidlc-dashboard running at localhost:7777
- Existing run page at src/app/projects/[id]/run/page.tsx gets replaced
- All new components go in src/components/run/
- zustand already in package.json

## Architecture principles
- Run page split into two panels: left tree (320px), right detail + log
- SSE stream from /api/stream drives all live updates
- No page refresh needed at any point during execution
- Execution logs are source of truth for attempt history
- Execution gating: cannot run a SP if any previous SP has not passed

## Sub-prompts (execute in order)

### SP-01: Sub-prompt tree component
Persistent left panel showing all SPs with live status.

Files to create:
  src/components/run/SubPromptTree.tsx
  src/components/run/SubPromptNode.tsx
  src/components/run/AttemptBadge.tsx

SubPromptTree props:
  spec:          SpecFile
  currentSpId:   string | null
  spStatuses:    Record<string, "pending"|"running"|"passed"|"failed"|"locked">
  attemptCounts: Record<string, number>
  logs:          ExecutionLog[]
  onSpClick:     (spId: string) => void
  onRerun:       (spId: string) => void
  onManualFix:   (spId: string) => void

SubPromptNode shows:
  Status icon: — pending, pulsing ⏳ running, ✓ passed, ✗ failed, 🔒 locked
  SP ID (monospace) and name
  AttemptBadge if attempt count > 1
  Expand arrow — opens inline detail
  Re-run button on failed or current SP only
  Manual fix button on failed SP

Execution gating:
  SP is locked if any prior SP has not passed
  Can always re-run current failed SP
  Can re-run passed SP with confirmation dialog
  Cannot run locked SP

Acceptance:
  SP01-01  Tree renders all SPs from spec in order
  SP01-02  Passed SPs show green check icon
  SP01-03  Failed SPs show red X with re-run button
  SP01-04  Running SP shows pulsing animation
  SP01-05  Locked SPs are gray and unclickable
  SP01-06  Attempt badge appears when count > 1
  SP01-07  Clicking SP node expands inline detail

### SP-02: Inline validation output per SP
Each expanded SP node shows structured validation results.

Files to create:
  src/components/run/ValidationResults.tsx
  src/components/run/FilesList.tsx
  src/components/run/ManualFixButton.tsx

ValidationResults props:
  validation: ValidationResult[]

Renders each command as a row:
  ✓  npm run typecheck    0 errors
  ✗  npm run lint         2 errors  [expand]
  —  npm run test         skipped

Clicking a failed row expands full error output in code block.
Skipped rows show when a prior command failed.

FilesList:
  Lists every file written by the SP
  Each file is clickable — opens content in a modal
  Shows file size and relative path

ManualFixButton:
  Appears when SP has failed validation
  Label: "I fixed it manually — re-validate"
  Calls validation commands only without calling Claude
  Shows spinner during validation
  Updates SP status on result

Acceptance:
  SP02-01  Validation rows show correct pass/fail per command
  SP02-02  Failed rows expand to show full error output
  SP02-03  Skipped rows appear when prior command failed
  SP02-04  ManualFixButton triggers validation-only re-run
  SP02-05  FilesList shows all files written by this SP
  SP02-06  File content viewer opens on click

### SP-03: Attempt history per SP
Track and display all previous attempts for each SP.

Files to create:
  src/components/run/AttemptHistory.tsx
  src/lib/attempts.ts

attempts.ts:
  getAttemptsForSp(logsDir, unitId, spId): Promise<SpAttempt[]>
  Reads all execution log JSON files for this unit
  Groups and returns attempts for the given SP ID
  Each attempt: { index, status, error, timestamp, durationMs, tokens }

AttemptHistory renders timeline:
  Attempt 1  ✗  npm run lint — 2 errors  3 min ago
  Attempt 2  ✗  npm run test — 0 tests   2 min ago
  Attempt 3  ✓  Passed                   just now

Current in-progress attempt shown as pulsing row.

Acceptance:
  SP03-01  History shows all previous attempts for SP
  SP03-02  Each row shows status, error summary, timestamp
  SP03-03  In-progress attempt shown as pulsing row
  SP03-04  Passed attempts green, failed red

### SP-04: Token and cost tracker
Live token usage and estimated cost in run page header.

Files to create:
  src/components/run/CostTracker.tsx

CostTracker props:
  subPrompts: SubPromptResult[]
  model:      string
  isRunning:  boolean
  startedAt:  string

Pricing constants:
  claude-sonnet-4-6: input $3/M, output $15/M
  claude-opus-4-6:   input $15/M, output $75/M

Displays in header:
  Tokens: 12,450 in / 4,230 out
  Est. cost: $0.10
  Duration: 2m 14s (live counter while running)

Shows subtotal per completed SP on hover.

Acceptance:
  SP04-01  Token counts update after each SP completes
  SP04-02  Cost estimate correct for model used
  SP04-03  Duration counter updates every second while running
  SP04-04  Hover shows per-SP breakdown

### SP-05: Redesigned run page layout
Wire all components into the new two-panel run page.

Files to modify:
  src/app/projects/[id]/run/page.tsx  (full replacement)

Layout:
  Header bar:
    Spec name + status badge
    CostTracker
    Action buttons: Start | Pause | Resume | Re-run from start
  Body two columns:
    Left 320px fixed: SubPromptTree
    Right flex: active SP detail (ValidationResults, FilesList,
                AttemptHistory) + live log stream below

Live log stream (terminal panel):
  Dark background (#111)
  Bright green text (text-green-300)
  Monospace font
  Timestamps on each line: [17:26:32] message
  Auto-scrolls to bottom
  Max height 300px with overflow-y-auto

State management with zustand:
  Store: runStore — spStatuses, attemptCounts, logLines, activeSpId
  Persists in sessionStorage so nav away and back works
  Clears on new run start

Acceptance:
  SP05-01  Two-panel layout renders on all screen sizes
  SP05-02  Left tree updates in real time via SSE
  SP05-03  Right panel shows active SP detail
  SP05-04  Log stream timestamps and auto-scrolls
  SP05-05  State persists if user navigates away mid-run
  SP05-06  Action buttons control execution correctly
  SP05-07  Execution gating prevents running locked SPs

## Done when
All component tests pass. Run page shows full tree, attempt history,
inline validation, cost tracker, manual fix flow, and live log.
Zero TypeScript errors. Zero lint errors. npm run build succeeds.

## Files produced by this unit
  src/components/run/
    SubPromptTree.tsx
    SubPromptNode.tsx
    AttemptBadge.tsx
    ValidationResults.tsx
    FilesList.tsx
    ManualFixButton.tsx
    AttemptHistory.tsx
    CostTracker.tsx
  src/lib/attempts.ts
  src/app/projects/[id]/run/page.tsx

## Next unit
B1 - Spec Authoring Assistant
