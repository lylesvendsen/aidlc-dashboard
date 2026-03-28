# B5 - Resume from Failed Sub-Prompt
# Version: 2.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026
# Jira: https://jira.tools.bestbuy.com/browse/PERS-12345

## What this unit delivers
A "Retry from here" button appears inline in the run page log next to the failed
SP line. Clicking it navigates to a new run with fromSpId set to the failed SP,
appending new output to the existing console. No new stores or hooks needed —
the run page already tracks SP status in local React state.

## Context
- B0 must be complete — run page at src/app/projects/[id]/run/page.tsx
- The run page uses local useState for spStatus: Record<string, SpStatus>
- SSE stream emits sp_fail events with spId field
- The run page already reads fromSpId from searchParams and passes to /api/stream
- /api/stream already accepts fromSpId query param
- Route params use [id] not [projectId]

## Architecture principles
- No new stores, hooks, or components — modify the existing run page only
- failedSpId is derived from spStatus local state — never stored separately
- Retry button navigates using router.push with fromSpId param
- Console output is NOT cleared on retry — new output appends below a divider
- Retry button only visible when overall status is failed
- All colors use Tailwind classes only

## Sub-prompts (execute in order, validate each before next)

### SP-01: Add Retry button to run page
Add inline Retry button next to the failed SP in the sub-prompt status list.
Clicking navigates to resume from that SP. Console shows a divider then new output.

Files to modify:
  src/app/projects/[id]/run/page.tsx

Changes:
  1. Derive failedSpId from spStatus:
     const failedSpId = Object.entries(spStatus).find(([, s]) => s === "failed")?.[0] ?? null

  2. Add Retry button in the sub-prompt status list next to the failed SP:
     {status === "failed" && spId === failedSpId && (
       <button onClick={() => retry(spId)} className="...">
         Retry from here
       </button>
     )}

  3. Add retry function:
     const retry = (fromSp: string) => {
       setLines(l => [...l, "--- Retrying from " + fromSp + " ---"])
       setSpStatus({})
       setDone(false)
       router.push(
         "/projects/" + id + "/run" +
         "?specFile=" + encodeURIComponent(specFile) +
         "&fromSpId=" + fromSp
       )
     }

  4. When fromSpId is set in searchParams, auto-start the run:
     useEffect(() => {
       if (fromSpId && !running && !done) start(false)
     }, [])

  Retry button style:
    text-xs px-2 py-0.5 rounded border border-amber-400 text-amber-600
    hover:bg-amber-50 whitespace-nowrap ml-2

Acceptance:
  SP01-01  Retry button appears next to failed SP when run status is failed
  SP01-02  Retry button does not appear on passed SPs
  SP01-03  Retry button does not appear while run is in progress
  SP01-04  Clicking Retry appends divider line to console and navigates with fromSpId
  SP01-05  When fromSpId in URL and run not started, run starts automatically
  SP01-06  npm run typecheck returns zero errors

## Done when
SP01 passes. Failed SP shows Retry button. Clicking it resumes from that SP.
Console appends new output below a divider line.

## Files produced by this unit
  src/app/projects/[id]/run/page.tsx  (modified)

## Next unit
B6 - Spec Assistant Interactive Options
