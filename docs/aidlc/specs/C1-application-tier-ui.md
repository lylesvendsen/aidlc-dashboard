# C1 - Application Tier UI
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
The Application tier in the dashboard UI. The Projects list page becomes an
Applications list. Each Application has its own page showing its Projects.
Navigation updates throughout. Existing Project pages updated to work under
the new hierarchy. Migration banner prompts users to migrate.

## Context
- C0 must be complete
- src/lib/applications.ts exists
- src/lib/projects-v2.ts exists
- Current routes: /projects, /projects/[id]
- New routes: /applications, /applications/[appId], /applications/[appId]/projects/[projId]

## Architecture principles
- Old /projects routes redirect to /applications for back-compat
- Application page shows Projects list + Application-level config summary
- Project page URL changes to /applications/[appId]/projects/[projId]
- Migration banner shown when data/projects/ still exists
- All existing spec/run/log routes updated to include appId

## Sub-prompts (execute in order, validate each before next)

### SP-01: Applications list page
Replace the projects list with an applications list.

Files to create:
  src/app/applications/page.tsx
  src/app/api/applications/route.ts

Files to modify:
  src/app/projects/page.tsx    (redirect to /applications)

Applications list page shows:
  - Each application as a card with name, description, project count, spec count
  - "New Application" button
  - Migration banner if data/projects/ exists with unmigrated projects:
    "You have {n} projects using the old format. Migrate now →"
    Banner links to migration trigger

API route GET /api/applications:
  Returns list of ApplicationConfig objects

Acceptance:
  SP01-01  /applications shows all applications
  SP01-02  /projects redirects to /applications
  SP01-03  Migration banner shows when old projects exist
  SP01-04  npm run typecheck returns zero errors

### SP-02: Application detail page
Shows an Application's Projects and config summary.

Files to create:
  src/app/applications/[appId]/page.tsx
  src/app/api/applications/[appId]/route.ts

Application page shows:
  - Application name, description, Edit Config button
  - Config summary: rootDir, defaultModel, globalConstraints count
  - Projects list (cards with name, spec count, last run status)
  - "New Project" button
  - Recent runs across all projects in this application

Acceptance:
  SP02-01  /applications/[appId] shows application detail
  SP02-02  Projects list shows all projects under this application
  SP02-03  Config summary shows inherited settings
  SP02-04  npm run typecheck returns zero errors

### SP-03: Update Project page to new URL structure
Move project page to new URL and update all internal links.

Files to create:
  src/app/applications/[appId]/projects/[projId]/page.tsx
  src/app/api/applications/[appId]/projects/[projId]/route.ts

Files to modify:
  src/app/projects/[id]/page.tsx    (redirect to new URL)

Project page at new URL shows same content as before plus:
  - Breadcrumb: Applications → [App Name] → [Project Name]
  - Inherited config indicator: "Inheriting {n} constraints from [App Name]"
  - Effective config preview button: "Show effective config"

All spec/run/log links updated to include appId in path.

Acceptance:
  SP03-01  /applications/[appId]/projects/[projId] shows project detail
  SP03-02  /projects/[id] redirects to new URL
  SP03-03  Breadcrumb shows correct hierarchy
  SP03-04  Inherited config indicator shows correct count
  SP03-05  npm run typecheck returns zero errors

### SP-04: Application config editor
Edit page for Application-level configuration.

Files to create:
  src/app/applications/[appId]/config/page.tsx
  src/app/api/applications/[appId]/config/route.ts

Config editor fields:
  - Name, description
  - Root directory (with relative path tip)
  - Default model
  - Global constraints (textarea, one per line)
  - Default validation commands
  - Application-level project context (textarea)

Note: Global constraints show a lock icon — these cannot be removed at
project or spec level (cumulative only).

Acceptance:
  SP04-01  Application config editor saves correctly
  SP04-02  Global constraints show lock icon
  SP04-03  Root directory uses resolvePath
  SP04-04  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. Applications list, Application detail, and updated Project
pages all working. Migration banner visible. Zero TypeScript errors.

## Files produced by this unit
  src/app/applications/page.tsx
  src/app/applications/[appId]/page.tsx
  src/app/applications/[appId]/config/page.tsx
  src/app/applications/[appId]/projects/[projId]/page.tsx
  src/app/api/applications/route.ts
  src/app/api/applications/[appId]/route.ts
  src/app/api/applications/[appId]/config/route.ts
  src/app/api/applications/[appId]/projects/[projId]/route.ts

## Next unit
C2 - Config Inheritance Engine
