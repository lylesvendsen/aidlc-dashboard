# B5-resume-from-failed-sp - Resume Execution from Failed Sub-Prompt
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: July 2025
# Jira: https://jira.tools.bestbuy.com/browse/PERS-12345

## What this unit delivers
Adds a "Retry" button inline next to the failed sub-prompt label in the run page console output. When clicked, it creates a brand new execution record and resumes the spec run from the failed SP onwards (using the existing `fromSpId` URL parameter mechanism). The output from the new run is appended to the existing console view. The button only appears when the overall run status is `failed`.

## Context
- B0-run-page-v2 must be complete (run page with console output viewer exists)
- B3-run-page-polish must be complete (SP labels rendered inline in output)
- The run page already supports a `fromSpId` query parameter (e.g. `?fromSpId=SP-03`) to start execution from a specific sub-prompt
- Execution records are stored as JSON in the project `logsDir`
- The run page streams output via Server-Sent Events

## Architecture principles
- The `failedSpId` is derived from the execution state already tracked in the Zustand store — no new backend state needed
- The Retry button is rendered inline in the existing SP label component, not as a separate banner
- Clicking Retry navigates to a new run URL with `fromSpId=<failedSpId>` — this naturally creates a new execution record
- Console output is NOT cleared on retry — the new run's output is appended to the existing view
- The Retry button is only rendered when run status is `failed` and the SP matches the `failedSpId`
- Never hardcode SP IDs — always derive from execution state
- All colors use Tailwind classes only

## Sub-prompts (execute in order)

### SP-01: Track failed SP ID in execution store
Extend the Zustand execution store to track which SP ID failed during a run. When the SSE stream emits a failure event for a sub-prompt, store its SP ID as `failedSpId` in the store. Clear `failedSpId` when a new run starts.

Files to modify:
  src/store/executionStore.ts  (add `failedSpId: string | null` field, add `setFailedSpId(id: string | null)` action, clear it in the run start action)
  src/hooks/useExecutionStream.ts  (call `setFailedSpId` when a sub-prompt failure event is received from the SSE stream)

Implementation details:
- `failedSpId` should be initialised to `null`
- It should be set when the SSE stream emits an event with `type: 'sp_failed'` or equivalent failure event that includes the SP ID
- It should be cleared (set to `null`) when a new execution starts
- Check the existing SSE event types in the stream handler to identify the correct failure event shape

Acceptance:
  SP01-01  `executionStore` TypeScript interface includes `failedSpId: string | null` and `setFailedSpId` action
  SP01-02  `failedSpId` is set to the correct SP ID string when a sub-prompt failure SSE event is received
  SP01-03  `failedSpId` is reset to `null` when a new run is initiated

### SP-02: Render inline Retry button next to failed SP label
In the component that renders SP labels in the console output, add an inline "Retry" button that appears only when the run status is `failed` AND the current SP label matches the `failedSpId` from the store.

Files to modify:
  src/components/SpLabel.tsx  (or equivalent component rendering SP headings in output — add conditional Retry button)

Implementation details:
- Import `failedSpId` and `status` from the execution store
- Render a small "Retry" button inline to the right of the SP label text
- Only render the button when `status === 'failed'` AND `spId === failedSpId`
- Button styling: small, secondary variant using Tailwind classes (e.g. `text-xs px-2 py-0.5 rounded border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white transition-colors`)
- Button label: `Retry`
- The button must not appear during an active/running execution
- The button must not appear on SPs that succeeded

Acceptance:
  SP02-01  Retry button renders next to the SP label that matches `failedSpId` when status is `failed`
  SP02-02  Retry button does NOT render on any SP label that does not match `failedSpId`
  SP02-03  Retry button does NOT render when run status is `running` or `success`
  SP02-04  Component compiles with no TypeScript errors and no unused imports

### SP-03: Wire up Retry button click to resume navigation
Implement the click handler for the Retry button. On click, append a user-facing message to the console output and navigate to the new run URL with the `fromSpId` query parameter set to the failed SP ID.

Files to modify:
  src/components/SpLabel.tsx  (add onClick handler)
  src/store/executionStore.ts  (add `appendConsoleMessage` action if not already present)

Implementation details:
- On click, call `appendConsoleMessage` to append a line to the console output such as: `\n--- Retrying from ${failedSpId} ---\n`
- Then use `router.push` (Next.js `useRouter`) to navigate to the current run page URL with `?fromSpId=<failedSpId>` appended
- The navigation URL format should be: `/projects/<projectId>/run?specId=<specId>&fromSpId=<failedSpId>`
- Derive `projectId` and `specId` from the current URL using `useParams` and `useSearchParams`
- Do not hardcode any IDs or paths

Acceptance:
  SP03-01  Clicking Retry appends a `--- Retrying from SP-XX ---` message to the console output
  SP03-02  Clicking Retry navigates to the correct URL containing `fromSpId=<failedSpId>` as a query parameter
  SP03-03  `projectId` and `specId` in the navigation URL match the current page's params
  SP03-04  No hardcoded project IDs, spec IDs, or SP IDs anywhere in the implementation

### SP-04: Verify fromSpId is correctly consumed by run page and execution API
Confirm that the existing `fromSpId` query parameter is correctly read by the run page and passed through to the execution API so that the runner starts from the specified SP. If any gap exists, implement the missing wiring.

Files to modify:
  src/app/projects/[projectId]/run/page.tsx  (verify/add reading of `fromSpId` from searchParams and passing to execution trigger)
  src/app/api/projects/[projectId]/execute/route.ts  (verify/add handling of `fromSpId` in request body to skip SPs before the specified one)

Implementation details:
- The run page should read `fromSpId` from `searchParams` and include it in the POST body when triggering execution
- The execute API route should accept `fromSpId` in the request body
- When `fromSpId` is provided, the runner should skip all SPs whose index is before the matching SP ID
- Use the async params pattern for Next.js 15: `const { projectId } = await params`
- If `fromSpId` is not provided or is `null`, the runner executes all SPs as normal (no regression)
- Log a clear message in the SSE stream when resuming from a specific SP: `Resuming from ${fromSpId}...`

Acceptance:
  SP04-01  Run page reads `fromSpId` from `searchParams` and includes it in the execution POST request body
  SP04-02  Execute API route accepts `fromSpId` in request body without TypeScript errors
  SP04-03  When `fromSpId` is provided, SPs before the specified ID are skipped and not executed
  SP04-04  When `fromSpId` is absent, all SPs execute normally (no regression)
  SP04-05  SSE stream emits a `Resuming from SP-XX...` message at the start when `fromSpId` is set

## Done when
- SP01-01  `executionStore` includes `failedSpId: string | null` and `setFailedSpId` action
- SP01-02  `failedSpId` set correctly on sub-prompt failure SSE event
- SP01-03  `failedSpId` cleared on new run start
- SP02-01  Retry button renders only next to the failed SP label when status is `failed`
- SP02-02  Retry button absent on non-failed SP labels
- SP02-03  Retry button absent during `running` or `success` status
- SP02-04  No TypeScript errors or unused imports in SpLabel component
- SP03-01  Retry click appends `--- Retrying from SP-XX ---` to console output
- SP03-02  Retry click navigates to URL with correct `fromSpId` query param
- SP03-03  Navigation URL contains correct `projectId` and `specId`
- SP03-04  No hardcoded IDs anywhere
- SP04-01  Run page passes `fromSpId` to execution POST body
- SP04-02  Execute API accepts `fromSpId` without TypeScript errors
- SP04-03  SPs before `fromSpId` are skipped when param is provided
- SP04-04  All SPs run when `fromSpId` is absent
- SP04-05  SSE emits resume message when `fromSpId` is set

## Files produced by this unit
  src/store/executionStore.ts  (modified)
  src/hooks/useExecutionStream.ts  (modified)
  src/components/SpLabel.tsx  (modified)
  src/app/projects/[projectId]/run/page.tsx  (modified)
  src/app/api/projects/[projectId]/execute/route.ts  (modified)

## Next unit
B6 - TBD