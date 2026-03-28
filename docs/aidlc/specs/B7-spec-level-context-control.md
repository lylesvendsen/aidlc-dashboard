# B7 - Spec-Level Context Control
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
Three levels of context injection for spec execution:
1. Explicit context — developer lists files in ## Context files section of spec
2. Dependency graph — runner auto-injects files produced by prior units listed in ## Context
3. Spec Assistant awareness — assistant gets filetree + types/index.ts before generating specs

Engineers never again write specs that reference wrong file paths, wrong type names,
or non-existent abstractions.

## Context
- B4 must be complete (spec assistant route + AIDLC-METHODOLOGY.md injected)
- src/lib/runner.ts handles file context injection
- src/app/api/spec-assistant/route.ts handles assistant system prompt
- src/lib/specs.ts parses spec files
- Each spec has ## Files produced by this unit and ## Context sections

## Architecture principles
- Context injection happens in runner.ts at the per-file call level
- Dependency graph context is parsed from spec files on disk at run time
- Spec assistant gets filetree injected once per conversation start
- src/types/index.ts is always injected into the spec assistant
- Never inject more than 3000 lines total of context — summarize if needed
- Explicit ## Context files in a spec override but do not replace dynamic injection

## Sub-prompts (execute in order, validate each before next)

### SP-01: Parse ## Context files section from spec files
Add context files parsing to the spec parser.

Files to modify:
  src/lib/specs.ts
  src/types/index.ts

Add to SpecFile type in src/types/index.ts:
  contextFiles?: string[]   (files explicitly listed in ## Context files section)

Add to parseSpec in src/lib/specs.ts:
  Parse ## Context files section — lines that start with src/, apps/, packages/
  Store as contextFiles array on the SpecFile object

Acceptance:
  SP01-01  SpecFile type has contextFiles?: string[] field
  SP01-02  parseSpec extracts file paths from ## Context files section
  SP01-03  Spec without ## Context files section has contextFiles = []
  SP01-04  npm run typecheck returns zero errors

### SP-02: Inject context files into per-file Claude calls
When a SP has explicit context files or dependency-graph files, inject them.

Files to modify:
  src/lib/runner.ts

Changes to writeOneFile function:
  1. Read explicit context files from spec.contextFiles
  2. Read dependency files from prior units:
     - Parse ## Context section of spec for unit IDs (e.g. "B0 must be complete")
     - Find those unit specs in specDir
     - Read their ## Files produced by this unit sections
     - Those files become additional context
  3. Merge with existing getExistingFileContents result
  4. Always include src/types/index.ts if it exists in appDir

Add helper: getContextFilesFromDependencies(spec, project): string[]
  - Scans spec.rawContent for "## Context" section
  - Extracts unit IDs mentioned (B0, A0, etc.)
  - Finds matching spec files in project.specDir
  - Reads their "Files produced by this unit" sections
  - Returns the file paths

Acceptance:
  SP02-01  Explicit contextFiles from spec are injected into writeOneFile prompt
  SP02-02  Files produced by prior units are injected when listed in ## Context
  SP02-03  src/types/index.ts always injected if it exists
  SP02-04  Total injected context capped at 3000 lines (truncate oldest first)
  SP02-05  npm run typecheck returns zero errors

### SP-03: Inject filetree and types into spec assistant
Give the spec assistant codebase awareness before generating specs.

Files to modify:
  src/app/api/spec-assistant/route.ts

Add to system prompt after AIDLC-METHODOLOGY.md and before project context:

  CODEBASE STRUCTURE (top 2 levels of src/):
  {filetree of src/ directory, depth 2}

  TYPE DEFINITIONS (ground truth for all types):
  {content of src/types/index.ts}

  EXISTING SPEC IDS AND THEIR PRODUCED FILES:
  {for each spec: ID, title, files produced}

Implementation:
  - Read src/ filetree using same getFiletree helper (depth 2)
  - Read src/types/index.ts content
  - Parse all specs in project.specDir for their produced files
  - Inject all three into system prompt
  - If types file > 200 lines, inject first 200 lines only

Acceptance:
  SP03-01  Spec assistant system prompt includes src/ filetree (depth 2)
  SP03-02  Spec assistant system prompt includes src/types/index.ts content
  SP03-03  Spec assistant system prompt includes produced files per prior spec
  SP03-04  Missing types file does not crash the route
  SP03-05  npm run typecheck returns zero errors

### SP-04: Add ## Context files section to spec template
Update the New Spec page template to include the new section.

Files to modify:
  src/app/projects/[id]/specs/new/page.tsx

Add to SPEC_TEMPLATE after ## Context section:

  ## Context files
  [List files Claude should read before implementing this spec.
   src/types/index.ts is always included automatically.
   Add other files when Claude needs to understand existing implementations.]

Acceptance:
  SP04-01  New spec template includes ## Context files section with instructions
  SP04-02  Section appears after ## Context and before ## Architecture principles
  SP04-03  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. Runner injects explicit context files and dependency-produced files.
Spec assistant knows the codebase structure, types, and prior unit outputs.
New spec template includes ## Context files section.

## Files produced by this unit
  src/types/index.ts                              (modified)
  src/lib/specs.ts                                (modified)
  src/lib/runner.ts                               (modified)
  src/app/api/spec-assistant/route.ts             (modified)
  src/app/projects/[id]/specs/new/page.tsx        (modified)

## Next unit
B8 - Audit Trail and State Management
