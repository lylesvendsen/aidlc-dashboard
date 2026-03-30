# D1 - Enhanced Logging System
# Version: 1.0
# Part of: AIDLC Dashboard
# Updated: March 2026

## What this unit delivers
A richer, more transparent logging experience for the run page. All log messages — errors, success, info, and system — flow into the same unified terminal exactly as they do today, but each message now carries a level that drives color coding and live filtering. A filter bar at the top of the terminal lets the developer show or hide each level independently during a live run. System-level messages narrate the runner's internal phases in real time (yellow), giving deep visibility into what the runner is actually doing at each step. All levels persist to the log file. Env vars control which levels are displayed by default.

## Context
Requires B0 (Run page v2) complete. Builds on the existing StreamEvent/ExecutionLog infrastructure. The log file format is unchanged — level is an additive field.

## Architecture principles
- All log messages go to the same terminal stream and the same log file — no separate log files or panels
- Level is an optional field on the existing `log` StreamEvent — backward compatible, unlevel messages render as info
- Color coding is CSS-class-based, not inline styles
- Filter bar state is React state only — no localStorage, no persistence
- Env vars are read server-side via `/api/log-config` — client never reads process.env
- System messages are additive — they don't replace any existing log messages
- Filtering is display-only — all levels always write to the log file

## Log levels
| Level   | Color       | When emitted                                                   |
|---------|-------------|----------------------------------------------------------------|
| error   | 🔴 Red      | SP failure, validation failure, truncation, unhandled error    |
| success | 🔵 Blue     | SP passed, unit complete, validation passed                    |
| info    | ⚪ Default  | General progress — same as current unlabelled messages         |
| system  | 🟡 Yellow   | Runner internals — see SP-01 for full list                     |

## Runner system message phases
The runner should emit `system`-level log messages narrating each of these phases:

**Spec loading**
- Spec file path being parsed
- Spec ID, title, version detected
- Number of sub-prompts found
- Sub-prompt dependency graph resolved (list any deps)

**Context collection**
- Files being scanned for injection (which paths)
- Each file selected for context injection (filename + size)
- Total context size assembled (token estimate)
- Files excluded and why (too large, binary, etc.)

**Prompt assembly**
- Model and max tokens being used
- Which constraints are active (count + preview)
- Project context length
- System prompt length
- Full prompt token estimate before sending

**API call**
- Request sent to Claude (model, timestamp)
- Streaming response started
- Truncation check result (output tokens vs limit)

**File writing**
- Each file path written (relative to appDir)
- Each file size written

**Validation**
- Each validation command being run
- Each validation command result (pass/fail + output preview)

**Git operations** (if auto-commit enabled)
- Files staged
- Commit message used
- Commit hash

**Additional ideas for future phases**
- Cache hit/miss for repeated context files
- Token budget remaining after each SP
- Estimated cost per SP (input + output tokens × rate)
- Dependency resolution: which SPs are blocked/unblocked
- Retry attempt number if a SP is being retried

## Environment variables
All vars live in the git-ignored `.env.local` alongside existing AIDLC vars.

### Default display settings (filter bar initial state)
```
AIDLC_LOG_DISPLAY_ERRORS=true
AIDLC_LOG_DISPLAY_SUCCESS=true
AIDLC_LOG_DISPLAY_INFO=true
AIDLC_LOG_DISPLAY_SYSTEM=false
```
System messages are hidden by default — too verbose for day-to-day use but one click away.

## Sub-prompts (execute in order, validate each before next)

### SP-01: Extend StreamEvent with level field and add runner system messages
Add optional `level?: "error" | "success" | "info" | "system"` to the `log` StreamEvent type.
Update the runner to tag all existing log calls with the correct level, and add new system-level
messages at every phase listed in the architecture section above.

Files to modify:
  src/types/index.ts
  src/lib/runner.ts

Acceptance:
  SP01-01  `log` StreamEvent has optional `level` field with union type
  SP01-02  All existing SP failure/error log calls emit `level: "error"`
  SP01-03  All existing SP pass/complete log calls emit `level: "success"`
  SP01-04  Spec loading phase emits system messages: file path, ID, title, sub-prompt count
  SP01-05  Context collection phase emits system messages: each file scanned, each file selected, total size
  SP01-06  Prompt assembly phase emits system messages: model, tokens, constraints, context lengths
  SP01-07  API call phase emits system messages: request sent, streaming started, truncation check
  SP01-08  File writing phase emits system messages: each file path and size
  SP01-09  Validation phase emits system messages: each command run, each result
  SP01-10  npm run typecheck passes

### SP-02: Log config API
Create a GET endpoint that reads the four `AIDLC_LOG_DISPLAY_*` env vars and returns their
parsed boolean values with documented defaults. The run page fetches this once on mount to
initialize the filter bar.

Files to create:
  src/app/api/log-config/route.ts

Acceptance:
  SP02-01  GET /api/log-config returns `{ errors: bool, success: bool, info: bool, system: bool }`
  SP02-02  Missing env vars use defaults (errors/success/info=true, system=false)
  SP02-03  npm run typecheck passes

### SP-03: Log level colors and LogLine component
Add four CSS classes to globals.css. Create a `LogLine` component that renders a single log
entry with the correct color, a level prefix label, and the existing timestamp.

Color classes:
  .log-error   — red-600
  .log-success — blue-600
  .log-info    — existing terminal text color (no change)
  .log-system  — yellow-500

Files to create:
  src/components/LogLine.tsx

Files to modify:
  src/app/globals.css

Acceptance:
  SP03-01  LogLine renders timestamp + optional level label + message
  SP03-02  Each level applies the correct color class
  SP03-03  Messages with no level render as info (default terminal color)
  SP03-04  npm run typecheck passes

### SP-04: Live filter bar
Create a `LogFilterBar` component with four toggle buttons — Errors, Success, Info, System.
Each button has a colored dot matching its log level. Clicking toggles that level on/off.
Active/inactive state is visually distinct (filled vs outlined). The component accepts initial
state from the log-config API response.

Files to create:
  src/components/LogFilterBar.tsx

Acceptance:
  SP04-01  Four toggle buttons render at top of terminal with correct colors
  SP04-02  Active state is visually distinct from inactive
  SP04-03  onChange fires with updated `{ errors, success, info, system }` state
  SP04-04  Accepts `initialFilters` prop and applies on mount
  SP04-05  npm run typecheck passes

### SP-05: Wire into run page
Update the run page to:
1. Fetch `/api/log-config` on mount to initialize filter state
2. Render `<LogFilterBar>` above the terminal
3. Replace raw log line rendering with `<LogLine>` for each message
4. Filter the displayed messages based on active filter state (all messages still received and stored)
5. All log levels continue to be written to the log file (filtering is display-only)

Files to modify:
  src/app/projects/[id]/run/page.tsx

Acceptance:
  SP05-01  Filter bar appears above terminal and initializes from log-config API
  SP05-02  Toggling a filter immediately hides/shows matching log lines
  SP05-03  Hidden messages are not lost — re-enabling filter shows them
  SP05-04  System messages appear in yellow inline with other messages
  SP05-05  Log file still receives all messages regardless of filter state
  SP05-06  npm run typecheck passes
  SP05-07  npm run build passes

## Done when
Running any spec shows color-coded log output with system phase messages narrating each step.
Filter bar correctly hides/shows each level in real time. All messages appear in the unified
terminal stream. Log file contains all messages regardless of display filter.

## Files produced by this unit
  src/types/index.ts (modified)
  src/lib/runner.ts (modified)
  src/app/api/log-config/route.ts
  src/components/LogLine.tsx
  src/components/LogFilterBar.tsx
  src/app/projects/[id]/run/page.tsx (modified)
  src/app/globals.css (modified)

## Next unit
[D2 - TBD]
