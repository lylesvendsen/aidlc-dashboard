# B5 - Resume from Failed Sub-Prompt
# Version: 2.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026
# Jira: https://jira.tools.bestbuy.com/browse/PERS-12345

## What this unit delivers
A "Retry from here" button appears inline in the run page next to the failed SP
in the sub-prompt status list. Clicking it appends a divider to the console and
navigates to a new run with fromSpId set to the failed SP. No new stores, hooks,
or components needed — all changes are in the existing run page.

## Context
- B0 must be complete — run page at src/app/projects/[id]/run/page.tsx
- The run page uses local useState for spStatus: Record<string, SpStatus>
- SSE stream emits events with type "sp_fail" and spId field
- The run page reads fromSpId from searchParams and passes to /api/stream
- /api/stream accepts fromSpId query param

## Context files
  src/app/projects/[id]/run/page.tsx
  src/types/index.ts

## Architecture principles
- All changes in src/app/projects/[id]/run/page.tsx only — no new files
- failedSpId derived from spStatus: Object.entries(spStatus).find(([,s]) => s === "failed")?.[0]
- Retry navigates using router.push — does not reload the page
- Console output is NOT cleared on retry — new output appends below a divider line
- Retry button only visible when overall run is failed and spId matches failedSpId
- All colors use Tailwind classes only
- Route param is id not projectId

## Sub-prompts (execute in order, validate each before next)

### SP-01: Add Retry button and auto-start to run page
Single SP — all changes to src/app/projects/[id]/run/page.tsx

Files to modify:
  src/app/projects/[id]/run/page.tsx

Changes:

1. Derive failedSpId from spStatus state:
   const failedSpId = Object.entries(spStatus)
     .find(([, s]) => s === "failed")?.[0] ?? null

2. Add retry function:
   const retry = (fromSp: string) => {
     setLines(l => [...l,
       "---",
       "--- Retrying from " + fromSp + " ---",
       "---"
     ])
     setDone(false)
     setDryRunPassed(false)
     router.push(
       "/projects/" + id + "/run" +
       "?specFile=" + encodeURIComponent(specFile) +
       "&fromSpId=" + fromSp
     )
   }

3. Add Retry button in the sub-prompt status list.
   Render inline to the right of the SP name, only when:
     done === true AND overallStatus === "failed" AND spId === failedSpId
   Button style:
     text-xs px-2 py-0.5 rounded border border-amber-400 text-amber-600
     hover:bg-amber-50 whitespace-nowrap ml-2 transition-colors
   Button label: Retry from here

4. Add auto-start useEffect for when fromSpId is in URL:
   useEffect(() => {
     if (fromSpId && !running && !done) {
       start(false)
     }
   }, [])

Acceptance:
  SP01-01  Retry button appears next to the failed SP when run status is failed
  SP01-02  Retry button does not appear on passed SPs
  SP01-03  Retry button does not appear while run is in progress
  SP01-04  Clicking Retry appends divider lines to console and navigates with fromSpId
  SP01-05  When fromSpId in URL on page load, run starts automatically
  SP01-06  npm run typecheck returns zero errors

## Done when
SP01 passes. Failed SP shows Retry button. Clicking resumes from that SP.
Console appends new output below a visible divider.

## Files produced by this unit
  src/app/projects/[id]/run/page.tsx  (modified)

## Next unit
B6 - Spec Assistant Interactive Options
