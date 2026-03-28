# B4 - Jira Support and Methodology Integration
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
Three improvements in one unit:
1. Jira ticket URL support in spec metadata — parsed from the spec header, displayed
   as a clickable ticket ID badge on spec cards, and prepended to git commit messages.
2. AIDLC-METHODOLOGY.md wired into the Spec Assistant as a steering file — injected
   into every system prompt so Claude generates better specs from the start.
3. Spec Assistant bug fixes — duplicate message rendering and Enter key not sending.

## Context
- B0-B3 must be complete
- AIDLC-METHODOLOGY.md exists at aidlc-dashboard/docs/AIDLC-METHODOLOGY.md
- Spec assistant at src/app/api/spec-assistant/route.ts
- Spec parser at src/lib/specs.ts
- Project page at src/app/projects/[id]/page.tsx
- Runner at src/lib/runner.ts

## Architecture principles
- Jira URL lives in the spec file header as: # Jira: {url}
- Ticket ID is extracted from URL using: /browse\/([A-Z]+-\d+)/
- Never require Jira — it is always optional
- Methodology doc is read from disk at request time — not hardcoded in the route
- Spec assistant page component owns the Enter key handler — not the API route

## Sub-prompts (execute in order, validate each before next)

### SP-01: Jira URL parsing and SpecFile type update
Add jiraUrl and jiraTicketId fields to SpecFile and update the spec parser.

Files to modify:
  src/types/index.ts          (add jiraUrl?: string and jiraTicketId?: string to SpecFile)
  src/lib/specs.ts            (parse # Jira: line from spec header, extract ticket ID)

Parser logic:
  - Scan header lines (lines starting with #) for: # Jira: {url}
  - Extract the URL after "Jira: "
  - Extract ticket ID using regex: /browse\/([A-Z]+-\d+)/
  - Store both on the SpecFile object
  - If no Jira line present: jiraUrl = undefined, jiraTicketId = undefined

Acceptance:
  SP01-01  SpecFile type has optional jiraUrl and jiraTicketId fields
  SP01-02  Parser extracts jiraUrl from # Jira: line in spec header
  SP01-03  Parser extracts jiraTicketId as just the ID (e.g. PERS-10266) from the URL
  SP01-04  Spec without Jira line has undefined jiraUrl and jiraTicketId
  SP01-05  npm run typecheck returns zero errors

### SP-02: Jira badge on spec card and commit message prefix
Display ticket ID on spec card and prepend to auto-generated commit messages.

Files to modify:
  src/app/projects/[id]/page.tsx   (add Jira badge to spec card)
  src/lib/runner.ts                (prepend [TICKET-ID] to commit message when present)

Spec card Jira badge:
  - Show only when spec.jiraTicketId is defined
  - Render as a small clickable badge/chip: [PERS-10266]
  - Clicking opens spec.jiraUrl in a new tab
  - Badge style: text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200
    rounded px-1.5 py-0.5 hover:bg-blue-100
  - Place badge inline after the spec title and status badge
  - Show nothing (no placeholder) when jiraTicketId is undefined

Commit message format:
  With Jira:    [PERS-10266] B4 complete: Jira support and methodology integration
  Without Jira: B4 complete: Jira support and methodology integration
  Extract from: spec.jiraTicketId if defined

Acceptance:
  SP02-01  Spec card shows Jira badge when spec has # Jira: in header
  SP02-02  Badge shows ticket ID only (PERS-10266) not full URL
  SP02-03  Clicking badge opens Jira URL in new tab
  SP02-04  Spec card shows nothing where badge would be when no Jira URL set
  SP02-05  Runner prepends [TICKET-ID] to commit message when jiraTicketId present
  SP02-06  Runner commit message unchanged when no jiraTicketId
  SP02-07  npm run typecheck returns zero errors

### SP-03: Wire AIDLC-METHODOLOGY.md into Spec Assistant
Inject the methodology doc as a steering file in every spec assistant conversation.

Files to modify:
  src/app/api/spec-assistant/route.ts   (read and inject methodology doc)

Implementation:
  - Read docs/AIDLC-METHODOLOGY.md from disk using fs.readFileSync
  - Path: path.resolve(process.cwd(), "docs/AIDLC-METHODOLOGY.md")
  - If file does not exist: continue without it (graceful degradation)
  - Inject as a dedicated section in the system prompt before project context:

  System prompt structure:
    1. AIDLC STEERING RULES (from AIDLC-METHODOLOGY.md)
    2. PROJECT CONTEXT (from project.projectContext)
    3. EXISTING SPECS (list of spec IDs and titles)
    4. MODE INSTRUCTIONS (scratch / review / failure)
    5. TASK (generate spec / review spec / analyse failure)

Acceptance:
  SP03-01  Spec assistant system prompt includes AIDLC-METHODOLOGY.md content
  SP03-02  Missing methodology doc does not crash the route — logs warning and continues
  SP03-03  Methodology content appears before project context in system prompt
  SP03-04  npm run typecheck returns zero errors

### SP-04: Fix Spec Assistant bugs
Fix duplicate message rendering and Enter key not sending.

Files to modify:
  src/app/projects/[id]/spec-assistant/page.tsx   (fix Enter key and duplicate render)

Bug 1 — Duplicate message rendering:
  The streaming response renders twice. The cause is the assistant message being
  both appended as a new message AND updated in place simultaneously.
  Fix: Initialize the assistant message slot once, then only update it in place.
  Pattern:
    setMessages(m => [...m, { role: "assistant", content: "" }])  // once, before stream
    // then during stream:
    setMessages(m => {
      const updated = [...m]
      updated[updated.length - 1] = { role: "assistant", content: assistantText }
      return updated
    })

Bug 2 — Enter key not sending:
  The onKeyDown handler fires on Enter but the send function checks !input.trim()
  which fails when the input hasn't committed yet after typing via automation.
  For real users: ensure the onKeyDown handler calls e.preventDefault() on Enter
  and calls sendMessage() directly.
  Fix: onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }}}

Acceptance:
  SP04-01  Typing a message and pressing Enter sends it
  SP04-02  Assistant response appears exactly once (not duplicated)
  SP04-03  Spec preview updates as conversation progresses
  SP04-04  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. Spec cards show Jira badges for specs with Jira headers.
Commit messages include [TICKET-ID] prefix when Jira URL is in spec.
Spec Assistant has methodology doc injected and duplicate bug is fixed.

## Files produced by this unit
  src/types/index.ts          (modified)
  src/lib/specs.ts            (modified)
  src/app/projects/[id]/page.tsx  (modified)
  src/lib/runner.ts           (modified)
  src/app/api/spec-assistant/route.ts  (modified)
  src/app/projects/[id]/spec-assistant/page.tsx  (modified)

## Next unit
B5 - Audit Trail and State Management
