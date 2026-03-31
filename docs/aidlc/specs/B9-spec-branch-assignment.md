# B9 - Spec Branch Assignment
# Version: 1.0
# Part of: AIDLC Dashboard
# Updated: March 2026

## What this unit delivers
Branch-per-spec workflow. Each spec can have an assigned branch. When the runner
starts, it automatically switches to that branch (creating it if it does not exist)
before executing any sub-prompts. A project-level default branch template is used
when no branch is explicitly assigned to a spec. The branch assignment is visible
on the spec list and run page.

## Context
- Requires B0 (Run page) complete
- Requires GitBranchIndicator (from earlier session work) for display
- Branch switching uses the same git helpers from session.ts (B8) or standalone if B8 not yet run

## Architecture principles
- Branch resolution order: spec.branch > project.branchTemplate rendered > "none"
- Template variables: {specId}, {projectId}, {jiraId} — missing vars render as empty string
- Branch switching happens ONCE before SP-01 — not between SPs
- If checkout fails and there are uncommitted changes: emit system warning, continue on current branch
- If checkout fails for any other reason: fail the run with a clear error
- "none" / empty template means no branch switching (current behaviour preserved)
- Branch is stored on spec.config.json — not in the .md file
- Project branchTemplate is stored on project.config.json

## Branch template examples
| Template                    | Spec B1 + Jira PROJ-42 | Result                        |
|-----------------------------|------------------------|-------------------------------|
| feature/{specId}            | B1                     | feature/b1                    |
| aidlc/{projectId}/{specId}  | proj / B1              | aidlc/proj/b1                 |
| feature/{jiraId}-{specId}   | PROJ-42 / B1           | feature/proj-42-b1            |
| develop                     | (any)                  | develop                       |
| (empty)                     | (any)                  | no branch switch              |

All template values are lowercased and non-alphanumeric chars replaced with hyphens.

## Sub-prompts (execute in order, validate each before next)

### SP-01: Branch template config on Project and Spec types
Add branchTemplate to ProjectConfig and branch to SpecConfig in the v2 types.
Update the project and spec edit forms to include these fields.

Files to modify:
  src/lib/v2/types.ts
  src/app/applications/[appId]/projects/[projId]/edit/ProjectForm.tsx
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx

ProjectConfig additions:
  branchTemplate?: string   // e.g. "feature/{specId}" or "" for none

SpecConfig additions:
  branch?: string           // explicit override, or leave empty to use template

ProjectForm additions:
  A "Branch template" text input with placeholder "feature/{specId}"
  Helper text showing available variables: {specId} {projectId} {jiraId}
  Preview showing rendered example using the first spec in the project

Spec editor additions:
  A "Branch override" text input, placeholder "Leave empty to use project template"
  Shows rendered branch name below the input using current spec values

Acceptance:
  SP01-01  ProjectConfig has optional branchTemplate field
  SP01-02  SpecConfig has optional branch field
  SP01-03  ProjectForm renders branch template input with variable hint
  SP01-04  Spec editor renders branch override input
  SP01-05  npm run typecheck passes

### SP-02: Branch resolution utility
Create a utility function that resolves the effective branch name for a spec
given the project template and spec override.

Files to modify:
  src/lib/session.ts  (add resolveBranch function)
  OR create src/lib/branch.ts if session.ts does not exist

Exports:
  resolveBranch(spec: SpecFile, project: Project, specConfig?: SpecConfig): string | null
    Returns null if no branch is configured (no switch needed)
    Returns the rendered branch name otherwise

  renderTemplate(template: string, vars: { specId: string; projectId: string; jiraId?: string }): string
    Lowercases, replaces non-alphanumeric with hyphens, trims hyphens from ends
    Empty template or all-whitespace returns null

  ensureBranch(appDir: string, branch: string): Promise<{ created: boolean; switched: boolean; error?: string }>
    Checks if branch exists locally: git branch --list <name>
    If not: git checkout -b <name>
    If yes: git checkout <name>
    Returns error string on failure without throwing

Acceptance:
  SP02-01  resolveBranch returns null when no template and no override
  SP02-02  resolveBranch uses spec.branch when set
  SP02-03  resolveBranch falls back to project branchTemplate when spec.branch is empty
  SP02-04  renderTemplate replaces all three variables correctly
  SP02-05  renderTemplate returns null for empty/whitespace template
  SP02-06  ensureBranch creates branch if it does not exist
  SP02-07  npm run typecheck passes

### SP-03: Runner integration
Update the runner to resolve and switch branches before SP-01 executes.

Files to modify:
  src/lib/runner.ts

Logic (insert after spec loading, before the SP loop):
  const targetBranch = resolveBranch(spec, project, specConfig)
  if (targetBranch && !dryRun) {
    yield* emit(log, { type: "log", level: "system", message: "Branch: switching to " + targetBranch })
    const result = await ensureBranch(project.appDir, targetBranch)
    if (result.error) {
      if (result.error.includes("uncommitted")) {
        yield* emit(log, { type: "log", level: "error", message: "Branch: cannot switch — uncommitted changes. Continuing on current branch." })
      } else {
        yield* emit(log, { type: "error", message: "Branch switch failed: " + result.error })
        return
      }
    } else {
      yield* emit(log, { type: "log", level: "system",
        message: "Branch: " + (result.created ? "created and switched to " : "switched to ") + targetBranch })
    }
  }

Acceptance:
  SP03-01  Runner emits system log showing branch switch before first SP
  SP03-02  Runner creates branch if it does not exist
  SP03-03  Runner emits error and continues if uncommitted changes block switch
  SP03-04  Runner fails cleanly on other git errors
  SP03-05  dryRun skips branch switching
  SP03-06  npm run typecheck passes

### SP-04: Branch display in spec list and run page
Show the resolved branch name on the spec list row and run page header.

Files to modify:
  src/app/applications/[appId]/projects/[projId]/page.tsx
  src/app/applications/[appId]/projects/[projId]/run/page.tsx

Spec list row additions:
  After the status badge, show a small branch pill if a branch is configured:
  <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">⎇ feature/b1</span>
  The rendered branch name is computed server-side from the project template + spec values

Run page additions:
  Below the spec name in the header, show the target branch:
  <span className="text-xs text-gray-400">⎇ <span className="font-mono">feature/b1</span></span>
  This is populated from the stream — the runner emits the branch name in a system log
  OR the run page reads it from the URL param (pass branch as query param from spec list)

Acceptance:
  SP04-01  Spec list shows branch pill for specs with a configured branch
  SP04-02  Run page header shows target branch name
  SP04-03  npm run typecheck passes
  SP04-04  npm run build passes

## Done when
Project edit form has a branch template field. Spec editor has a branch override.
Runner switches branches automatically before running. Spec list and run page
show the target branch. All existing tests pass.

## Files produced by this unit
  src/lib/v2/types.ts (modified)
  src/lib/branch.ts (or session.ts modified)
  src/lib/runner.ts (modified)
  src/app/applications/[appId]/projects/[projId]/edit/ProjectForm.tsx (modified)
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx (modified)
  src/app/applications/[appId]/projects/[projId]/page.tsx (modified)
  src/app/applications/[appId]/projects/[projId]/run/page.tsx (modified)

## Next unit
B10 - Human-Readable Project IDs
