# B10 - Human-Readable Project IDs
# Version: 1.0
# Part of: AIDLC Dashboard
# Updated: March 2026

## What this unit delivers
Project and application IDs are currently random base-36 strings (e.g. mn9v6f06zxlh).
This spec replaces that with human-readable slugs (e.g. aidlc-dashboard, overboardom-app)
that are auto-generated from the name on creation, with collision detection and manual
override. Existing IDs are NOT migrated — this only affects new projects and applications.

## Context
- Requires no prior units
- Existing data files at data/v2/applications/{id}/ are unaffected
- The slug generation runs client-side in the New Application and New Project forms
- IDs are set once at creation and never changed (URLs are stable)

## Architecture principles
- Slugs are generated from the name: lowercase, spaces to hyphens, strip special chars
- Max length: 48 chars
- Suffix "-app" is added to application IDs, "-proj" optionally to project IDs
- Collision detection: check existing IDs via API before allowing creation
- Manual override: user can edit the suggested slug before submitting
- Validation: only a-z, 0-9, hyphens allowed; must start with a letter; no consecutive hyphens
- Random fallback: if slug is taken after 3 attempts (appending -2, -3), fall back to current random ID

## Slug generation examples
| Name                        | Type        | Generated ID                  |
|-----------------------------|-------------|-------------------------------|
| AIDLC Dashboard             | Application | aidlc-dashboard               |
| OverBoardom                 | Application | overboardom                   |
| My New App                  | Application | my-new-app                    |
| API Bootstrap               | Project     | api-bootstrap                 |
| User Auth & Permissions     | Project     | user-auth-permissions         |

## Sub-prompts (execute in order, validate each before next)

### SP-01: Slug generation utility
Create a shared utility for slug generation and validation.

Files to create:
  src/lib/slugify.ts

Exports:
  slugify(name: string): string
    Lowercase, replace spaces and underscores with hyphens
    Strip anything not a-z 0-9 or hyphen
    Collapse consecutive hyphens to one
    Trim leading/trailing hyphens
    Truncate to 48 chars at a word boundary

  isValidSlug(slug: string): boolean
    Must match /^[a-z][a-z0-9-]{1,47}$/
    No consecutive hyphens
    Must start with letter

  suggestApplicationId(name: string): string
    slugify(name) — no suffix needed

  suggestProjectId(name: string): string
    slugify(name) — no suffix needed

Acceptance:
  SP01-01  slugify("AIDLC Dashboard") returns "aidlc-dashboard"
  SP01-02  slugify("User Auth & Permissions!") returns "user-auth-permissions"
  SP01-03  slugify("  My  App  ") returns "my-app"
  SP01-04  isValidSlug("aidlc-dashboard") returns true
  SP01-05  isValidSlug("123-bad") returns false (starts with number)
  SP01-06  isValidSlug("bad--slug") returns false (consecutive hyphens)
  SP01-07  npm run typecheck passes

### SP-02: New Application form — slug field
Update the New Application form to show a generated ID field with live preview,
validation feedback, and collision detection.

Files to modify:
  src/app/applications/new/page.tsx

Changes:
  - Add an "Application ID" field below the Name field
  - Auto-populate from name as user types (debounced 300ms)
  - Show green checkmark when slug is valid and available
  - Show red error when slug is invalid or taken
  - Allow manual editing — once edited manually, stop auto-updating from name
  - Collision check: GET /api/applications?checkId={slug} returns { available: boolean }
  - Submit uses the slug as the ID instead of generateId()

Acceptance:
  SP02-01  Application ID field appears in New Application form
  SP02-02  Field auto-populates from name with 300ms debounce
  SP02-03  Green checkmark shows for valid available slugs
  SP02-04  Red error shows for invalid or taken slugs
  SP02-05  Manual edit stops auto-population
  SP02-06  Created application uses slug as its ID
  SP02-07  npm run typecheck passes

### SP-03: New Project form — slug field
Update the New Project form with the same slug field pattern.

Files to modify:
  src/app/applications/[appId]/projects/new/page.tsx

Same pattern as SP-02 but for projects:
  - "Project ID" field below Name
  - Auto-populate from name
  - Collision check: GET /api/applications/{appId}/projects?checkId={slug}
  - Submit uses slug as ID

Acceptance:
  SP03-01  Project ID field appears in New Project form
  SP03-02  Field auto-populates from name
  SP03-03  Availability check works correctly
  SP03-04  Created project uses slug as its ID
  SP03-05  npm run typecheck passes

### SP-04: Collision check API endpoints
Add checkId query param support to the applications and projects list endpoints.

Files to modify:
  src/app/api/applications/route.ts
  src/app/api/applications/[appId]/projects/route.ts

Changes:
  GET /api/applications?checkId=my-app
    Returns { available: true } if no application with that ID exists
    Returns { available: false } if taken

  GET /api/applications/{appId}/projects?checkId=my-project
    Returns { available: true/false } for project ID within that application

Acceptance:
  SP04-01  GET /api/applications?checkId=existing-id returns { available: false }
  SP04-02  GET /api/applications?checkId=new-id returns { available: true }
  SP04-03  Project endpoint works the same way
  SP04-04  npm run typecheck passes
  SP04-05  npm run build passes

## Done when
New applications and projects get human-readable slugs generated from their name.
Users can edit the suggested slug. Collision detection prevents duplicates.
Existing applications and projects are unaffected.

## Files produced by this unit
  src/lib/slugify.ts
  src/app/applications/new/page.tsx (modified)
  src/app/applications/[appId]/projects/new/page.tsx (modified)
  src/app/api/applications/route.ts (modified)
  src/app/api/applications/[appId]/projects/route.ts (modified)

## Next unit
B11 - TBD
