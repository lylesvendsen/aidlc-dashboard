# B3 - Run Page Polish
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
Final run experience polish: constraint toggles on run page, SP dependency
annotations in specs, per-attempt notes, side-by-side attempt comparison,
and a project dependency graph on the project overview page.

## Context
B0, B1, B2 must be complete.

## Architecture principles
- Constraint toggles are run-time only — never modify project config file
- Dependency annotations stored as metadata comments in spec file
- Attempt notes stored in execution log JSON alongside the attempt
- Dependency graph computed from Next unit field in each spec
- Graph is read-only — no editing via graph UI

## Sub-prompts (execute in order)

### SP-01: Constraint toggles on run page
Quick on/off switches for constraints during a specific run.

Files to create:
  src/components/run/ConstraintToggles.tsx

ConstraintToggles props:
  constraints:       string[]
  validationCmds:    string[]
  onChange:          (active: ActiveConstraints) => void

ActiveConstraints type:
  { constraints: string[], validation: string[] }

Renders two sections:
  Section 1 — Project constraints (from project config)
  Each as toggle switch with constraint text truncated to 60 chars
  Full text on hover tooltip

  Section 2 — Validation commands
  Four individual toggles:
    Run typecheck after each SP (default on)
    Run lint after each SP (default on)
    Run test after each SP (default on)
    Run build after full unit (default on)

Warning banner (amber) when any toggle is off:
  "Some constraints are disabled for this run"

Toggles reset to all-on when new run starts.
Collapsed by default — "Constraints (all active)" header.

Acceptance:
  SP01-01  Toggle panel shows all project constraints
  SP01-02  Validation command toggles work independently
  SP01-03  Disabled constraints excluded from run execution
  SP01-04  Warning banner appears when any toggle is off
  SP01-05  Panel header shows count of disabled constraints
  SP01-06  All toggles reset to on when new run starts

### SP-02: SP dependency annotations
Specify which files must exist before a SP can run.

Files to create:
  src/components/spec-editor/DependencyAnnotator.tsx
  src/lib/dependency-checker.ts

DependencyAnnotator (in spec editor per SP tab):
  Label: "Files this SP requires to already exist"
  List of file paths (relative to appDir)
  Add file path input + Add button
  Remove button per path
  Saved as metadata comment in spec file immediately above the SP heading:
    <!-- sp-depends: apps/web/src/lib/firebase.ts, apps/web/package.json -->

dependency-checker.ts:
  parseDependencies(specContent, spId): string[]
  Reads depends-on comment for the given SP
  Returns list of required file paths

  checkDependencies(spec, spId, appDir): MissingDependency[]
  Returns list of files that do not exist in appDir
  { path: string, required: true }

Runner calls checkDependencies before executing each SP.
If missing dependencies found:
  SP shown as blocked in tree with list of missing files
  User can click "Skip dependency check and run anyway"

Acceptance:
  SP02-01  Dependency paths saved as comment in spec file
  SP02-02  parseDependencies reads comment correctly
  SP02-03  checkDependencies returns missing files correctly
  SP02-04  Runner blocks SP when dependencies missing
  SP02-05  Missing files listed in SP node in run tree
  SP02-06  Skip check option allows override

### SP-03: Per-attempt notes and side-by-side comparison
Add notes to attempts and compare two attempts.

Files to create:
  src/components/run/AttemptNotes.tsx
  src/components/run/AttemptComparison.tsx
  src/app/api/attempt-notes/route.ts

AttemptNotes:
  Appears below each attempt row in AttemptHistory
  Small textarea + Save note button
  Saved notes shown inline in muted text
  Example use: "Fixed PROJECT_ID unused var manually"

attempt-notes route:
  POST { logId, spId, attemptIndex, note }
  Reads log JSON, adds note to correct attempt, writes back

AttemptComparison:
  Activated by selecting two attempts with checkboxes in AttemptHistory
  "Compare selected" button appears when exactly two are checked
  Opens full-width panel:
    Left column: Attempt N — files written, validation output, error
    Right column: Attempt M — same structure
    Differences highlighted between columns

Acceptance:
  SP03-01  Note textarea appears per attempt in history
  SP03-02  Note saves to execution log JSON
  SP03-03  Saved note displays inline below attempt row
  SP03-04  Two attempt checkboxes enable Compare button
  SP03-05  Comparison panel shows both attempts side by side
  SP03-06  Differences highlighted between attempts

### SP-04: Project dependency graph
Visual map of all specs and their run status.

Files to create:
  src/components/projects/DependencyGraph.tsx
  src/lib/graph.ts

graph.ts:
  buildGraph(specs: SpecFile[], logs: ExecutionLog[]): GraphData
  GraphData: { nodes: GraphNode[], edges: GraphEdge[] }
  GraphNode: { id, title, status, filePath }
  GraphEdge: { from, to }
  Reads Next unit field from each spec to build edges
  Status computed from most recent execution log per unit

DependencyGraph component:
  Horizontal flow left to right: A0 → A1 → A2 → A3
  Each node: rounded rect with ID badge + title + status dot
  Colors:
    Not run: gray border, gray text
    Passed:  green border, green dot
    Failed:  red border, red dot
    Running: blue border, pulsing blue dot
  Edges: gray arrows between nodes
  Clicking node navigates to that spec detail page
  Shown on project detail page below the specs list
  Responsive: wraps to multiple rows on narrow screens

Acceptance:
  SP04-01  Graph renders all specs as nodes
  SP04-02  Edges connect specs via Next unit field
  SP04-03  Status colors match current execution status
  SP04-04  Clicking node navigates to spec page
  SP04-05  Graph updates when new specs added or run
  SP04-06  Nodes without Next unit field have no outgoing edge

## Done when
All SP tests pass. Run page has constraint toggles and dependency
checking. Spec editor has dependency annotations. Attempts have notes
and comparison. Project page has dependency graph.
Zero TypeScript errors. Zero lint errors. npm run build succeeds.

## Files produced by this unit
  src/components/run/
    ConstraintToggles.tsx
    AttemptNotes.tsx
    AttemptComparison.tsx
  src/components/spec-editor/
    DependencyAnnotator.tsx
  src/components/projects/
    DependencyGraph.tsx
  src/lib/
    dependency-checker.ts
    graph.ts
  src/app/api/
    attempt-notes/route.ts

## Next unit
C0 - (next major feature series)
