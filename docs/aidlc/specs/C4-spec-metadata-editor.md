# C4 - Spec Metadata Editor
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
A dedicated metadata editor for spec.config.json that lives separately from
the spec .md content. Keeps the spec document clean and portable while
giving engineers control over per-spec configuration overrides.
Includes Jira URL, model override, validation override, git override,
and review notes.

## Context
- C0, C1, C2, C3 must be complete
- SpecConfig type defined in src/types/index.ts
- src/lib/spec-configs.ts has getSpecConfig() and saveSpecConfig()

## Architecture principles
- Spec .md content = pure instructions, never configuration
- spec.config.json = all metadata and overrides for this spec
- Metadata editor is a side panel on the spec detail page
- Override fields show current inherited value as placeholder
- Empty override = inherit from project/application
- Jira URL auto-extracts ticket ID for display and commit messages

## Sub-prompts (execute in order, validate each before next)

### SP-01: Spec metadata API
CRUD API for spec.config.json.

Files to create:
  src/app/api/applications/[appId]/projects/[projId]/specs/[specId]/config/route.ts

Routes:
  GET    — returns SpecConfig
  PUT    — updates SpecConfig (partial update — only provided fields changed)
  DELETE — resets field to inherited value (sets to undefined)

Validation:
  jiraUrl: must match https://jira.tools.bestbuy.com/browse/[A-Z]+-[0-9]+
  model: must be a known model string
  maxTokens: must be between 1024 and 64000

Acceptance:
  SP01-01  GET returns current SpecConfig
  SP01-02  PUT updates specified fields only
  SP01-03  Invalid jiraUrl rejected with clear error
  SP01-04  jiraTicketId auto-extracted from jiraUrl on save
  SP01-05  npm run typecheck returns zero errors

### SP-02: Spec metadata editor component
Side panel component for editing spec metadata.

Files to create:
  src/components/specs/SpecMetadataEditor.tsx

Fields:
  Jira ticket
    URL input with validation
    Shows extracted ticket ID as preview: "PERS-10266"
    Link icon opens Jira URL in new tab

  Model override
    Dropdown: (inherit from project) | claude-sonnet-4-6 | claude-opus-4-6 | claude-haiku-4-5
    Shows current inherited value in gray when not overriding
    Small badge: "overriding project" when set

  Max tokens override
    Number input, min 1024 max 64000
    Shows inherited value as placeholder
    Small badge: "overriding project" when set

  Validation commands override
    Textarea, one command per line
    Shows inherited commands as placeholder
    Small badge: "overriding project" when set

  Git overrides
    Commit message format (shows inherited format as placeholder)
    Branch override (optional)

  Review notes (read-only if status is not rejected, editable if rejected)

  Save button (saves all changed fields)
  Reset to inherited (clears all overrides)

Acceptance:
  SP02-01  All fields render with correct inherited placeholders
  SP02-02  Override badge appears when field differs from inherited value
  SP02-03  Jira URL validates and extracts ticket ID
  SP02-04  Save updates spec.config.json
  SP02-05  Reset clears all overrides
  SP02-06  npm run typecheck returns zero errors

### SP-03: Wire metadata editor into spec detail page
Add metadata editor panel to spec detail page.

Files to modify:
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx

Layout:
  Two-column layout:
    Left (flex-1): Spec .md content viewer/editor (existing)
    Right (320px): SpecMetadataEditor panel (new)

  Right panel sections:
    Status (SpecStatusBadge + transition buttons)
    ——————
    Metadata (SpecMetadataEditor)
    ——————
    Effective config (EffectiveConfigPreview, collapsed by default)

Acceptance:
  SP03-01  Spec detail page shows two-column layout
  SP03-02  Metadata panel shows on right
  SP03-03  Status section shows badge and transition buttons
  SP03-04  Effective config section is collapsible
  SP03-05  npm run typecheck returns zero errors

### SP-04: New spec flow updates
Update the New Spec flow to create spec.config.json alongside the .md file.

Files to modify:
  src/app/applications/[appId]/projects/[projId]/specs/new/page.tsx
  src/app/api/applications/[appId]/projects/[projId]/specs/route.ts

New spec creation:
  - Generate spec-id from title (using generateSpecId())
  - Check spec-id availability (using isSpecIdAvailable())
  - Show collision warning if duplicate
  - On save: create spec directory, write .md file, write spec.config.json
  - Initial status: "draft"
  - Jira URL field in New Spec form (optional)

Acceptance:
  SP04-01  New spec form shows spec-id preview from title
  SP04-02  Duplicate spec-id shows clear error
  SP04-03  Created spec has spec.config.json with status "draft"
  SP04-04  Jira URL in new spec form populates spec.config.json
  SP04-05  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. Spec metadata editor working. New spec creates spec.config.json.
Spec detail page shows metadata panel. Zero TypeScript errors.

## Files produced by this unit
  src/app/api/applications/[appId]/projects/[projId]/specs/[specId]/config/route.ts
  src/components/specs/SpecMetadataEditor.tsx
  src/app/applications/[appId]/projects/[projId]/specs/[specId]/page.tsx  (modified)
  src/app/applications/[appId]/projects/[projId]/specs/new/page.tsx
  src/app/api/applications/[appId]/projects/[projId]/specs/route.ts

## Next unit
C5 - Cross-Application Dashboard and Reporting
