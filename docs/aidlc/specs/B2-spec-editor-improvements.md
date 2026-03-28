# B2 - Spec Editor Improvements
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
Enhanced spec editor with three tabs per sub-prompt (Spec / Generated
Prompt / Last Response), inline editing that writes to disk, prompt
override mode for one-time nudges, diff view before files are applied,
spec version history, and single-file regeneration.

## Context
B0 and B1 must be complete.
Existing spec editor at src/app/projects/[id]/specs/[specId]/page.tsx
gets enhanced — not replaced.
Version snapshots stored in project logsDir/spec-versions/

## Architecture principles
- Spec tab edits write back to the .md file on disk immediately on save
- Generated Prompt tab is read-only — computed on demand
- Last Response tab is read-only — read from execution log
- Version history is append-only — never deletes old versions
- Diff view shows before write — user approves per file

## Sub-prompts (execute in order)

### SP-01: SP accordion with three tabs
Add tabbed view to each sub-prompt in the spec editor.

Files to create:
  src/components/spec-editor/SubPromptAccordion.tsx
  src/components/spec-editor/SpecTab.tsx
  src/components/spec-editor/PromptTab.tsx
  src/components/spec-editor/ResponseTab.tsx
  src/app/api/generated-prompt/route.ts

SubPromptAccordion:
  Header: SP ID, name, last run status badge, expand/collapse arrow
  When expanded: shows three tabs
  Tabs: Spec | Generated Prompt | Last Response
  Tab switching does not lose scroll position

SpecTab:
  Editable textarea showing SP body text from spec file
  Acceptance criteria rendered as editable checklist
  Save button — writes changes back to .md file
  Dirty indicator (yellow dot) when unsaved changes exist
  Unsaved changes warning if user tries to close accordion

PromptTab:
  Button: "Generate prompt preview"
  On click calls /api/generated-prompt to build full prompt
  Shows full prompt with context injection in code block
  Read-only with Copy button
  Shows estimated token count below

ResponseTab:
  Shows last Claude response for this SP from most recent execution log
  If no log exists: "This SP has not been run yet"
  Sections: Files (list with content viewer) | Commands | Notes
  JSON viewer for raw response toggle

generated-prompt route:
  POST { projectId, specFile, spId }
  Reads spec file, builds full prompt for that SP
  Injects project context and constraints
  Returns { prompt: string, estimatedTokens: number }

Acceptance:
  SP01-01  Three tabs render for each SP in spec editor
  SP01-02  SpecTab shows editable SP body
  SP01-03  Save writes updated SP back to spec file on disk
  SP01-04  Dirty indicator appears on unsaved changes
  SP01-05  PromptTab generates and shows full prompt on demand
  SP01-06  PromptTab shows estimated token count
  SP01-07  ResponseTab shows last Claude response
  SP01-08  ResponseTab shows empty state if no run exists

### SP-02: Prompt override mode
One-time additional instructions for a specific SP run.

Files to create:
  src/components/spec-editor/PromptOverride.tsx
  src/app/api/run-with-override/route.ts

PromptOverride component:
  Collapsible panel shown in run page per SP
  Label: "Add one-time instructions for this run"
  Textarea: additional context appended to generated prompt
  Checkbox: "Keep for next run" (default unchecked)
  Note: "These instructions are not saved to the spec file"

run-with-override route:
  Same as /api/stream but accepts overrides map:
  { [spId]: string }
  Appends override text to generated prompt for that SP
  Logs override text in execution attempt record
  Override cleared after run unless Keep is checked

Acceptance:
  SP02-01  Override panel appears per SP in run page
  SP02-02  Override text appended to generated prompt
  SP02-03  Override logged in execution attempt record
  SP02-04  Override cleared after run unless Keep checked
  SP02-05  Override does not modify the spec file on disk

### SP-03: Diff view before applying files
Show proposed file changes before Claude writes them to disk.

Files to create:
  src/components/run/DiffViewer.tsx
  src/components/run/FileApprovalModal.tsx
  src/app/api/preview-run/route.ts

preview-run route:
  POST { projectId, specFile, spId, overrides? }
  Calls Claude and gets response
  Does NOT write files to disk
  Stores pending response in server-side session map (keyed by executionId)
  Returns { executionId, files: [{path, newContent, existingContent}] }

FileApprovalModal:
  Opens when preview-run returns
  Header: "Review changes for SP-XX"
  List of files with three columns: path, status (new/modified), size diff
  Each file row expands to show DiffViewer
  Checkbox per file: Apply (default checked) / Skip
  Apply Selected button: writes only checked files, continues execution
  Cancel button: discards pending response

DiffViewer:
  Side-by-side diff: existing (left, red lines) vs new (right, green lines)
  Unchanged lines shown in gray
  Line numbers on both sides
  Collapsible per file with summary: +X -Y lines

Acceptance:
  SP03-01  Preview mode calls Claude but holds files in memory
  SP03-02  FileApprovalModal shows all proposed files
  SP03-03  Diff correctly shows existing vs new content
  SP03-04  New files show empty left side
  SP03-05  Per-file apply/skip checkboxes work
  SP03-06  Only checked files written to disk on Apply
  SP03-07  Cancel discards all pending changes

### SP-04: Spec version history
Automatic versioning of spec files on every save.

Files to create:
  src/lib/spec-versions.ts
  src/components/spec-editor/VersionHistory.tsx
  src/app/api/spec-versions/route.ts

spec-versions.ts:
  saveVersion(specPath, logsDir, content): void
  Writes timestamped snapshot to logsDir/spec-versions/{specId}/
  Filename: {specId}-{YYYYMMDD-HHmmss}.md

  listVersions(specPath, logsDir): VersionMeta[]
  Returns list sorted newest first:
  { versionId, timestamp, sizeBytes, specId }

  getVersion(logsDir, specId, versionId): string
  Returns content of a specific version

  restoreVersion(specPath, logsDir, specId, versionId): void
  Saves current as new version first, then writes old version to specPath

VersionHistory component:
  Collapsible panel at bottom of spec editor
  List of versions: timestamp, size, relative age
  View button: opens version in read-only modal
  Restore button: confirmation dialog then restores
  Versions auto-saved on every spec save

Acceptance:
  SP04-01  Version saved automatically on every spec save
  SP04-02  Version list shows timestamp and size
  SP04-03  View opens version content in read-only modal
  SP04-04  Restore shows confirmation then restores
  SP04-05  Restore saves current as new version before overwriting
  SP04-06  Version history panel collapsible in spec editor

### SP-05: Single file regeneration
Regenerate one specific file without re-running the whole SP.

Files to create:
  src/components/run/RegenerateFileButton.tsx
  src/app/api/regenerate-file/route.ts

RegenerateFileButton:
  Appears next to each file in FilesList component
  Opens RegenerateFileModal

RegenerateFileModal:
  Header: "Regenerate {filename}"
  Shows current file content (read-only, collapsible)
  Optional instructions field: "Focus on..."
  Generate button calls /api/regenerate-file
  Shows DiffViewer of new vs current content
  Apply and Cancel buttons

regenerate-file route:
  POST { projectId, specFile, spId, filePath, instructions? }
  Builds focused prompt: full spec + SP body + current file content
  Appends instructions if provided
  Returns { newContent: string } — does NOT write to disk

Acceptance:
  SP05-01  Regenerate button appears per file in FilesList
  SP05-02  Modal opens with optional instructions field
  SP05-03  New content returned without writing to disk
  SP05-04  DiffViewer shows new vs current content
  SP05-05  Apply writes only that one file
  SP05-06  Cancel discards without any disk writes

## Done when
All SP tests pass. Spec editor has three-tab SP view, prompt override,
diff approval flow, version history, and single-file regeneration.
Zero TypeScript errors. Zero lint errors. npm run build succeeds.

## Files produced by this unit
  src/components/spec-editor/
    SubPromptAccordion.tsx
    SpecTab.tsx
    PromptTab.tsx
    ResponseTab.tsx
    PromptOverride.tsx
    VersionHistory.tsx
  src/components/run/
    DiffViewer.tsx
    FileApprovalModal.tsx
    RegenerateFileButton.tsx
  src/lib/spec-versions.ts
  src/app/api/generated-prompt/route.ts
  src/app/api/preview-run/route.ts
  src/app/api/regenerate-file/route.ts
  src/app/api/spec-versions/route.ts

## Next unit
B3 - Run Page Polish
