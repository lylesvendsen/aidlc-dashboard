# B6 - Spec Assistant Interactive Options
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
The Spec Assistant gains a structured options UI. When Claude asks a clarifying
question it can return clickable option chips alongside the conversational text.
Users click one or more options instead of typing. An "Other..." option always
expands an inline text field for free-form answers. Multi-select questions show
checkboxes and a Confirm button.

## Context
- B4 must be complete
- Spec assistant page: src/app/projects/[id]/spec-assistant/page.tsx
- Spec assistant API route: src/app/api/spec-assistant/route.ts
- The streaming SSE response currently emits: { type: "text", content: string }
  and { type: "spec", content: string }
- A new event type "options" will be added to the stream

## Architecture principles
- Options are returned by Claude as a structured SSE event alongside text
- The page component renders options as chips below the assistant message
- Clicking an option sends it as a user message automatically
- "Other..." always appears as the last option and expands an inline input
- Multi-select shows checkboxes — user confirms with a Confirm button
- Options are cleared after the user responds
- Options never replace the text response — they appear below it
- StreamEvent type gains a new "options" variant

## Sub-prompts (execute in order, validate each before next)

### SP-01: Add options event type to StreamEvent and API route
Extend the streaming protocol to support structured options.

Files to modify:
  src/types/index.ts
  src/app/api/spec-assistant/route.ts

StreamEvent update:
  Add to the union: { type: "options"; message: string; options: OptionSet }

  OptionSet interface (add to types/index.ts):
    interface OptionSet {
      question:    string
      multiSelect: boolean
      options:     string[]
    }

API route changes:
  After Claude responds with conversational text, parse the response to detect
  if it contains a question with enumerable options.

  Inject this instruction into the spec assistant system prompt:
    "When you ask a clarifying question that has a finite set of answers,
     append a JSON block at the very end of your response in this format:
     |||OPTIONS|||
     { \"question\": \"...\" , \"multiSelect\": false, \"options\": [\"Option A\", \"Option B\", \"Other\"] }
     |||END|||
     Always include \"Other\" as the last option.
     For questions where multiple answers apply (e.g. \"select all that apply\"),
     set multiSelect to true.
     For open-ended questions with no finite options, do not include the OPTIONS block."

  Parse the OPTIONS block from Claude response before streaming:
    - Extract JSON between |||OPTIONS||| and |||END|||
    - Strip the OPTIONS block from the text before streaming text chunks
    - After streaming text, emit: { type: "options", message: "", options: parsedOptionSet }

Acceptance:
  SP01-01  OptionSet interface exported from src/types/index.ts
  SP01-02  StreamEvent union includes options variant
  SP01-03  System prompt instructs Claude to append OPTIONS blocks
  SP01-04  API route strips OPTIONS block from text before streaming
  SP01-05  API route emits options SSE event after text stream completes
  SP01-06  npm run typecheck returns zero errors

### SP-02: Options UI component
Render clickable option chips below assistant messages.

Files to create:
  src/components/spec-assistant/OptionChips.tsx

Files to modify:
  src/app/projects/[id]/spec-assistant/page.tsx

OptionChips props:
  optionSet:    OptionSet
  onSelect:     (value: string) => void    (single select)
  onMultiConfirm: (values: string[]) => void  (multi select)
  disabled:     boolean  (true while sending)

Single select rendering:
  Row of pill buttons, one per option
  Style: border border-gray-200 rounded-full px-3 py-1.5 text-sm hover:bg-gray-50
  Selected/hover: bg-brand-50 border-brand-300 text-brand-700
  "Other..." is always last — clicking it reveals an inline text input + Send button

Multi select rendering:
  Each option is a checkbox row
  "Other..." checkbox reveals an inline text input when checked
  Confirm button at bottom: btn-primary — disabled until at least one selected
  Sends comma-joined selected values as a single user message

Placement in page.tsx:
  OptionChips renders below the latest assistant message
  Only shown for the most recent assistant message (not history)
  Cleared after user responds (set activeOptions to null)
  While sending: disabled=true on all chips

State in page.tsx:
  const [activeOptions, setActiveOptions] = useState<OptionSet | null>(null)
  Set when options SSE event received
  Cleared when user selects an option or types a manual response

Acceptance:
  SP02-01  Option chips render below the latest assistant message
  SP02-02  Clicking a single-select chip sends it as a user message
  SP02-03  "Other..." reveals an inline text input
  SP02-04  Typing in Other and pressing Enter or clicking Send sends the text
  SP02-05  Multi-select shows checkboxes with Confirm button
  SP02-06  Confirm sends comma-joined selections as one message
  SP02-07  Options cleared after user responds
  SP02-08  Chips disabled while a message is sending
  SP02-09  npm run typecheck returns zero errors

## Done when
All 2 SPs pass. Spec assistant shows clickable option chips when Claude asks
clarifying questions. Single and multi-select both work. Other... expands inline.
Zero TypeScript errors.

## Files produced by this unit
  src/types/index.ts                                    (modified)
  src/app/api/spec-assistant/route.ts                   (modified)
  src/components/spec-assistant/OptionChips.tsx         (new)
  src/app/projects/[id]/spec-assistant/page.tsx         (modified)

## Next unit
B7 - Spec Assistant Session Persistence and Re-run Controls
