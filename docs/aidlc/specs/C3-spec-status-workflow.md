# C3 - Spec Status Workflow
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
The spec status lifecycle: Draft → Spec Review → Ready → Executed →
Execution Review → Accepted / Rejected → Draft.
Status badge on spec cards. Transition buttons with confirmation where needed.
Runner automatically sets status to Executed on passing run.
Rejected transition captures review notes.

## Context
- C0, C1, C2 must be complete
- SpecStatus type defined in src/types/index.ts
- SpecConfig has status field
- src/lib/spec-configs.ts has saveSpecConfig()

## Architecture principles
- Status stored in spec.config.json alongside the spec .md file
- Runner sets status = "executed" automatically on passing run
- All other transitions are manual (human decision)
- Rejected transition captures reviewNotes field
- Status badge colors: draft=gray, spec-review=yellow, ready=green,
  executed=blue, execution-review=purple, accepted=emerald, rejected=red
- Transition buttons only show valid next states

## Sub-prompts (execute in order, validate each before next)

### SP-01: Status badge component and transition API
Build the status badge and the API for transitioning status.

Files to create:
  src/components/specs/SpecStatusBadge.tsx
  src/app/api/applications/[appId]/projects/[projId]/specs/[specId]/status/route.ts

SpecStatusBadge props:
  status: SpecStatus
  size?: "sm" | "md"

Status colors:
  draft:            bg-gray-100 text-gray-600
  spec-review:      bg-yellow-50 text-yellow-700 border border-yellow-200
  ready:            bg-green-50 text-green-700 border border-green-200
  executed:         bg-blue-50 text-blue-700 border border-blue-200
  execution-review: bg-purple-50 text-purple-700 border border-purple-200
  accepted:         bg-emerald-50 text-emerald-700 border border-emerald-200
  rejected:         bg-red-50 text-red-700 border border-red-200

Status API route:
  PATCH { status: SpecStatus, reviewNotes?: string }
  Validates transition is allowed
  Updates spec.config.json
  Returns updated SpecConfig

  Allowed transitions:
    draft            → spec-review
    spec-review      → ready | draft
    ready            → executed (runner only) | draft
    executed         → execution-review
    execution-review → accepted | rejected
    rejected         → draft

Acceptance:
  SP01-01  SpecStatusBadge renders correct color for each status
  SP01-02  Status API validates allowed transitions
  SP01-03  Invalid transitions return 400 with error message
  SP01-04  Rejected transition saves reviewNotes
  SP01-05  npm run typecheck returns zero errors

### SP-02: Transition buttons on spec detail page
Add status badge and transition buttons to the spec card and spec detail page.

Files to modify:
  src/app/applications/[appId]/projects/[projId]/page.tsx
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx

Spec card on project page:
  - Show SpecStatusBadge inline with spec title
  - Single "Advance" button that transitions to the next logical state
  - Tooltip shows what the transition will do

Spec detail page:
  - Large SpecStatusBadge in header
  - Transition buttons for all valid next states
  - Rejected state shows reviewNotes if present
  - "Add review notes" textarea shown when transitioning to rejected

Rejection modal:
  - Title: "Reject this spec?"
  - Review notes textarea (required)
  - Confirm Reject and Cancel buttons

Acceptance:
  SP02-01  Spec cards show status badge
  SP02-02  Transition buttons only show valid next states
  SP02-03  Rejection requires review notes
  SP02-04  Review notes displayed on rejected specs
  SP02-05  npm run typecheck returns zero errors

### SP-03: Runner sets status to Executed on passing run
Update runner to automatically transition spec status to "executed" on pass.

Files to modify:
  src/lib/runner.ts

On successful run completion:
  - Load SpecConfig for the spec being run
  - If status is "ready", transition to "executed"
  - If status is anything else, transition to "executed" (run always wins)
  - Save updated SpecConfig
  - Log status transition in execution log

Acceptance:
  SP03-01  Passing run sets spec status to "executed"
  SP03-02  Status change logged in execution log
  SP03-03  Failed run does not change spec status
  SP03-04  npm run typecheck returns zero errors

### SP-04: Status filter on project page
Add status filter tabs to the project spec list.

Files to modify:
  src/app/applications/[appId]/projects/[projId]/page.tsx

Add filter tabs above spec list:
  All | Draft | Spec Review | Ready | Executed | Execution Review | Accepted | Rejected

  Shows count badge on each tab.
  Filters spec list to show only specs with that status.
  "All" is default.

Acceptance:
  SP04-01  Status filter tabs appear above spec list
  SP04-02  Each tab shows correct count
  SP04-03  Filtering works correctly for each status
  SP04-04  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. Status lifecycle fully functional. Runner sets Executed
automatically. Manual transitions work with correct validation.
Zero TypeScript errors.

## Files produced by this unit
  src/components/specs/SpecStatusBadge.tsx
  src/app/api/applications/[appId]/projects/[projId]/specs/[specId]/status/route.ts
  src/app/applications/[appId]/projects/[projId]/page.tsx         (modified)
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx
  src/lib/runner.ts                                                (modified)

## Next unit
C4 - Spec Metadata Editor
