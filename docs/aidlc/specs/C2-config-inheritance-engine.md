# C2 - Config Inheritance Engine
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
The configuration inheritance engine wired into the runner and spec assistant.
Effective config is computed from Application + Project + Spec configs with
correct cumulative and override behavior. Runner uses effective config.
Spec assistant shows effective config in its system prompt.

## Context
- C0 and C1 must be complete
- src/lib/effective-config.ts exists with getEffectiveConfig()
- src/lib/runner.ts uses project config directly — needs updating
- src/app/api/spec-assistant/route.ts needs effective config

## Architecture principles
- Runner reads EffectiveConfig not raw ProjectConfig
- Constraints: Application.globalConstraints + Project.constraints (never reducible)
- ProjectContext: Application.projectContext + "\n\n" + Project.projectContext
- Model: Spec.model ?? Project.model ?? Application.defaultModel ?? env default
- Validation: most specific level wins (spec > project > application > defaults)
- Effective config computed at run-time, never cached

## Sub-prompts (execute in order, validate each before next)

### SP-01: Update runner to use EffectiveConfig
Modify runner.ts to accept and use EffectiveConfig instead of raw Project.

Files to modify:
  src/lib/runner.ts
  src/app/api/stream/route.ts

runner.ts changes:
  - runSpec() accepts EffectiveConfig instead of Project
  - Remove direct project.constraints, project.model etc references
  - Use effectiveConfig.constraints (already merged)
  - Use effectiveConfig.projectContext (already merged)
  - Use effectiveConfig.model
  - Use effectiveConfig.maxTokens
  - Use effectiveConfig.validation

stream/route.ts changes:
  - Load Application and Project configs
  - Compute effectiveConfig via getEffectiveConfig()
  - Pass effectiveConfig to runSpec()

Acceptance:
  SP01-01  runner.ts accepts EffectiveConfig type
  SP01-02  stream route computes effective config before running
  SP01-03  Constraints from application level appear in Claude prompt
  SP01-04  npm run typecheck returns zero errors

### SP-02: Effective config API and preview
API endpoint and UI component to show the computed effective config.

Files to create:
  src/app/api/applications/[appId]/projects/[projId]/effective-config/route.ts
  src/components/config/EffectiveConfigPreview.tsx

effective-config route:
  GET returns the computed EffectiveConfig for a project
  Shows what Claude will actually receive

EffectiveConfigPreview component:
  Collapsible panel showing:
    Model: claude-sonnet-4-6 (from project)
    Max tokens: 8192 (from application default)
    Constraints: 5 total (3 from application, 2 from project)
      [lock] Never hardcode credentials    (application)
      [lock] TypeScript strict mode         (application)
      [lock] No unused imports             (application)
           All colors use Tailwind          (project)
           Async params for Next.js 15      (project)
    Context: 2 sources merged
    Validation: npm run typecheck (from project)

Used on Project page as "Show effective config" button.

Acceptance:
  SP02-01  Effective config API returns correct merged config
  SP02-02  EffectiveConfigPreview shows source of each setting
  SP02-03  Application-level constraints show lock icon
  SP02-04  npm run typecheck returns zero errors

### SP-03: Update spec assistant with effective config
Inject effective config into spec assistant system prompt.

Files to modify:
  src/app/api/spec-assistant/route.ts

Changes:
  - Load Application and Project for the current project
  - Compute effectiveConfig
  - Replace raw project.constraints and project.projectContext in system prompt
    with effectiveConfig.constraints and effectiveConfig.projectContext
  - Add section: "INHERITED CONFIGURATION (from Application level):"
    showing application globalConstraints separately so Claude knows
    which constraints cannot be removed

Acceptance:
  SP03-01  Spec assistant uses effective merged constraints
  SP03-02  System prompt shows application vs project constraints separately
  SP03-03  npm run typecheck returns zero errors

## Done when
All 3 SPs pass. Runner uses effective config. Spec assistant uses effective
config. Preview component shows inheritance chain. Zero TypeScript errors.

## Files produced by this unit
  src/lib/runner.ts                                              (modified)
  src/app/api/stream/route.ts                                    (modified)
  src/app/api/spec-assistant/route.ts                            (modified)
  src/app/api/applications/[appId]/projects/[projId]/effective-config/route.ts
  src/components/config/EffectiveConfigPreview.tsx

## Next unit
C3 - Spec Status Workflow
