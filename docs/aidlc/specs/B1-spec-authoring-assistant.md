# B1 - Spec Authoring Assistant
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
A conversational spec builder at the project level. Engineers describe
a feature in plain English. Claude interviews them and produces a
complete AIDLC spec file ready to run. Three modes: from scratch,
spec review, and learn from failure. Real-time spec preview builds
as the conversation progresses.

## Context
B0 must be complete.
ANTHROPIC_API_KEY must be set in .env.local.
Uses project model and projectContext automatically.

## Architecture principles
- Conversational UI on left, live spec preview on right
- Spec preview updates in real time as Claude responds
- Spec is not saved until user explicitly clicks Save
- Assistant knows existing specs to avoid ID conflicts
- All three modes use the same conversational interface
- System prompt injects full project context + SPEC-TEMPLATE structure

## Sub-prompts (execute in order)

### SP-01: Spec assistant API route
Server-side streaming Claude conversation handler.

Files to create:
  src/app/api/spec-assistant/route.ts

POST body:
  {
    projectId:     string
    messages:      { role: "user"|"assistant", content: string }[]
    mode:          "scratch" | "review" | "failure"
    existingSpec?: string
    logId?:        string
  }

Streaming response chunks (Server-Sent Events):
  { type: "text", content: string }   conversational reply
  { type: "spec", content: string }   updated spec markdown

System prompt includes:
  Project name, stack, context
  Project constraints
  List of existing spec IDs and titles
  Full SPEC-TEMPLATE.md structure
  Mode-specific instructions below

Mode scratch instructions:
  Ask clarifying questions before generating spec:
  What does this feature do for the user?
  Which existing units does it depend on?
  What are the edge cases?
  How will we know it works?
  Then generate complete spec following template exactly.

Mode review instructions:
  Analyse the provided spec and identify:
  Acceptance criteria that are not automatically testable
  Sub-prompts larger than 5 files or 5 criteria (suggest splitting)
  Missing file paths in build instructions
  Architectural violations vs project principles
  Missing constraints specific to this feature

Mode failure instructions:
  Read the provided execution log carefully.
  Identify patterns in the failures.
  Suggest specific improvements to the spec:
  New acceptance criteria to catch the failure earlier
  New constraints to prevent the pattern
  Sub-prompts to split or clarify
  File paths that were missing from the spec

Acceptance:
  SP01-01  POST returns streaming SSE response
  SP01-02  Project context injected into system prompt
  SP01-03  Existing spec IDs listed to avoid conflicts
  SP01-04  Spec chunks update preview separately from text
  SP01-05  All three modes return contextually appropriate responses
  SP01-06  Streaming works correctly without buffering

### SP-02: Conversational UI
Chat interface with real-time spec preview.

Files to create:
  src/components/spec-assistant/AssistantChat.tsx
  src/components/spec-assistant/ChatMessage.tsx
  src/components/spec-assistant/ModeSelector.tsx
  src/components/spec-assistant/SpecPreview.tsx
  src/components/spec-assistant/SaveSpecModal.tsx

ModeSelector:
  Three cards side by side:
    Build from scratch — blank spec from conversation
    Review existing spec — improve an existing spec
    Learn from failure — fix spec based on run failures
  Selected card highlighted with brand border

AssistantChat:
  Scrollable message history
  Input field + Send button at bottom
  Streaming response with animated typing indicator
  Spec update pill: "Spec preview updated ↗" when spec chunk arrives

ChatMessage:
  User: right-aligned, brand-50 background
  Assistant: left-aligned, surface background
  Code blocks syntax highlighted
  Markdown rendered (bold, lists, headers)

SpecPreview:
  Shows current generated spec markdown
  Monospace font, line numbers
  Copy to clipboard button
  Save to specs directory button (opens SaveSpecModal)
  Scrollable independently from chat
  Empty state: "Your spec will appear here as we talk"

SaveSpecModal:
  Shows auto-generated filename from spec ID + title
  Allows filename override
  Shows full target path (project specDir + filename)
  Warning if filename already exists in specDir
  Confirm Save and Cancel buttons
  On save: toast + link to run the spec + link to edit

Acceptance:
  SP02-01  ModeSelector shows three modes, selection persists
  SP02-02  User and assistant messages styled differently
  SP02-03  Streaming response shows typing indicator
  SP02-04  Spec preview updates as spec chunks arrive
  SP02-05  Copy button copies full spec content
  SP02-06  SaveSpecModal shows correct target path
  SP02-07  Filename conflict warning appears correctly
  SP02-08  Save writes file to specDir on disk

### SP-03: Spec assistant page and entry points
Full page layout and navigation entry points.

Files to create:
  src/app/projects/[id]/spec-assistant/page.tsx

Files to modify:
  src/app/projects/[id]/page.tsx       (add New Spec button)
  src/app/projects/[id]/specs/[specId]/page.tsx  (add Review button)
  src/app/projects/[id]/logs/[logId]/page.tsx    (add Analyse failure button)

Page layout:
  Header: "Spec Assistant" + project name + mode badge
  Body two columns equal width:
    Left: ModeSelector (top) + AssistantChat (below, flex-grow)
    Right: SpecPreview (sticky, full height)

Entry points:
  Project page "New Spec" button → spec-assistant in scratch mode
  Spec card "Review" button → spec-assistant in review mode with spec content
  Failed log detail "Analyse failure" button → spec-assistant in failure mode with log

Pre-population:
  Review mode: loads spec content into first assistant message context
  Failure mode: loads log summary into first assistant message context
  Scratch mode: assistant opens with first clarifying question automatically

Acceptance:
  SP03-01  Page renders with mode selector and empty chat
  SP03-02  Scratch mode opens with first question from Claude
  SP03-03  Review mode pre-loads spec content automatically
  SP03-04  Failure mode pre-loads log summary automatically
  SP03-05  All three entry points navigate to correct mode
  SP03-06  Back navigation returns to previous page

## Done when
All SP tests pass. Spec assistant generates complete specs from
conversation in all three modes. Specs save to disk and are runnable.
Zero TypeScript errors. Zero lint errors. npm run build succeeds.

## Files produced by this unit
  src/components/spec-assistant/
    AssistantChat.tsx
    ChatMessage.tsx
    ModeSelector.tsx
    SpecPreview.tsx
    SaveSpecModal.tsx
  src/app/projects/[id]/spec-assistant/page.tsx
  src/app/api/spec-assistant/route.ts

## Next unit
B2 - Spec Editor Improvements
