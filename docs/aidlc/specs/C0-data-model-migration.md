# C0 - Data Model, Schemas, and Migration
# Version: 1.0
# Part of: AIDLC Dashboard AIDLC
# Updated: March 2026

## What this unit delivers
The new three-level hierarchy data model: Application → Project → Spec.
New directory structure under data/. JSON schemas for all three config levels.
Auto-migration script that converts existing flat projects into Applications
with a single child Project. All existing functionality continues working.

## Context
- B0-B4 must be complete
- Current data structure: data/projects/{id}.json (flat)
- New structure: data/applications/{app-id}/application.config.json
                              projects/{proj-id}/project.config.json
                                        specs/{spec-id}/spec.config.json
                                                        {spec-id}.md

## Architecture principles
- Migration is non-destructive — old data/projects/ preserved until confirmed
- Spec .md files move into data/applications/.../specs/{spec-id}/
- spec-id is human-readable (e.g. B4-jira-support) with collision detection
- Constraints are cumulative — spec cannot remove Application-level constraints
- Override settings (model, git, validation) — lower levels win
- resolvePath() used everywhere paths are read from config
- All new types exported from src/types/index.ts

## Sub-prompts (execute in order, validate each before next)

### SP-01: Define schema types
Add all new types to src/types/index.ts.

Files to modify:
  src/types/index.ts

New types to add:

  SpecStatus = "draft" | "spec-review" | "ready" | "executed" |
               "execution-review" | "accepted" | "rejected"

  ApplicationConfig:
    id, name, description, createdAt, updatedAt
    rootDir?: string             (base dir for all relative paths)
    defaultModel?: string
    globalConstraints?: string[] (cumulative — always appended)
    defaultValidation?: { afterEachSubPrompt: string[], afterUnit: string[] }
    projectContext?: string      (cumulative — appended to all projects)

  ProjectConfig:
    id, name, description, applicationId, createdAt, updatedAt
    appDir, specDir (relative to application rootDir or absolute)
    model?: string               (overrides application defaultModel)
    projectContext?: string      (cumulative — appended to all specs)
    constraints?: string[]       (cumulative — appended to application constraints)
    validation?: { afterEachSubPrompt: string[], afterUnit: string[] }
    git?: { autoCommit, autoTag, commitMessage, tagTemplate }
    maxTokens?: number

  SpecConfig:
    id, applicationId, projectId, createdAt, updatedAt
    filePath: string             (absolute path to the .md file)
    status: SpecStatus
    jiraUrl?: string
    jiraTicketId?: string
    model?: string               (overrides project model)
    validation?: { afterEachSubPrompt: string[], afterUnit: string[] }
    git?: { branch?, commitMessage?, tagTemplate? }
    maxTokens?: number
    reviewNotes?: string         (populated on Rejected transition)

  EffectiveConfig:              (computed — what the runner actually uses)
    model: string
    maxTokens: number
    constraints: string[]        (application + project + spec, cumulative)
    projectContext: string       (application + project, cumulative)
    validation: { afterEachSubPrompt: string[], afterUnit: string[] }
    git: { autoCommit, autoTag, commitMessage, tagTemplate }
    appDir: string               (resolved absolute path)
    specDir: string              (resolved absolute path)
    logsDir: string              (resolved absolute path)

Acceptance:
  SP01-01  All new types exported from src/types/index.ts
  SP01-02  SpecStatus union has all 7 values
  SP01-03  npm run typecheck returns zero errors

### SP-02: Application and Project config lib
Write src/lib/applications.ts and src/lib/projects-v2.ts.

Files to create:
  src/lib/applications.ts
  src/lib/projects-v2.ts
  src/lib/effective-config.ts

applications.ts:
  getApplicationsDir(): string   returns path.join(DATA_DIR, "applications")
  listApplications(): ApplicationConfig[]
  getApplication(id: string): ApplicationConfig | null
  saveApplication(app: ApplicationConfig): void
  deleteApplication(id: string): void

projects-v2.ts:
  getProjectsDir(appId: string): string
  listProjects(appId: string): ProjectConfig[]
  getProject(appId: string, projId: string): ProjectConfig | null
  saveProject(project: ProjectConfig): void

effective-config.ts:
  getEffectiveConfig(app: ApplicationConfig, project: ProjectConfig): EffectiveConfig
  Rules:
    model: spec.model ?? project.model ?? app.defaultModel ?? env default
    maxTokens: spec.maxTokens ?? project.maxTokens ?? env default
    constraints: [...app.globalConstraints, ...project.constraints]  (cumulative)
    projectContext: [app.projectContext, project.projectContext].filter(Boolean).join("\n\n")
    validation: spec.validation ?? project.validation ?? app.defaultValidation ?? defaults
    git: merge project.git with spec.git overrides

Acceptance:
  SP02-01  applications.ts CRUD functions work correctly
  SP02-02  projects-v2.ts CRUD functions work correctly
  SP02-03  getEffectiveConfig merges correctly with cumulative constraints
  SP02-04  npm run typecheck returns zero errors

### SP-03: Spec config lib and spec-id validation
Write src/lib/spec-configs.ts with collision detection for spec IDs.

Files to create:
  src/lib/spec-configs.ts

spec-configs.ts:
  getSpecConfigDir(appId, projId, specId): string
  getSpecConfigPath(appId, projId, specId): string
  listSpecConfigs(appId, projId): SpecConfig[]
  getSpecConfig(appId, projId, specId): SpecConfig | null
  saveSpecConfig(config: SpecConfig): void

  validateSpecId(id: string): { valid: boolean; error?: string }
  Rules:
    - Only letters, numbers, hyphens (no spaces, no special chars)
    - Minimum 2 characters, maximum 60
    - Must start with a letter
    - Regex: /^[a-zA-Z][a-zA-Z0-9-]{1,59}$/

  isSpecIdAvailable(appId, projId, id): boolean
  Checks that no existing spec in this project has the same id

  generateSpecId(title: string): string
  Converts "B4 - Jira Support" → "B4-jira-support"
  Strips special chars, lowercases, replaces spaces with hyphens

Acceptance:
  SP03-01  validateSpecId rejects spaces, special chars, short IDs
  SP03-02  isSpecIdAvailable returns false for duplicate IDs
  SP03-03  generateSpecId converts titles correctly
  SP03-04  npm run typecheck returns zero errors

### SP-04: Migration script
Write the migration script that converts existing flat projects to the new hierarchy.

Files to create:
  src/lib/migration.ts
  src/app/api/migrate/route.ts

migration.ts:
  migrateToV2(): MigrationResult

  For each project in data/projects/{id}.json:
    1. Create Application:
       - id: project.id + "-app"
       - name: project.name
       - rootDir: parent dir of project.appDir
       - defaultModel: project.model
       - globalConstraints: project.constraints
       - defaultValidation: project.validation
       - projectContext: project.projectContext

    2. Create Project under Application:
       - id: project.id
       - name: project.name
       - applicationId: application.id
       - appDir: project.appDir (relative if possible)
       - specDir: computed (specs will move here)
       - git: project.git

    3. For each spec in project.specDir:
       - Parse the .md file
       - Create spec directory: data/applications/{appId}/projects/{projId}/specs/{specId}/
       - Copy .md file into spec directory
       - Create spec.config.json with:
           status: "executed" if prior passing log exists, else "draft"
           jiraUrl: extracted from spec header if present
           jiraTicketId: extracted from jiraUrl

    4. Write migration log to data/migration-v2.log

  Returns: { applications: number, projects: number, specs: number, errors: string[] }

migrate API route:
  POST /api/migrate — triggers migration, returns result
  GET  /api/migrate — returns migration status (done/pending)

Acceptance:
  SP04-01  Migration creates correct Application for each existing Project
  SP04-02  Migration creates correct Project under each Application
  SP04-03  Spec .md files copied to new directory structure
  SP04-04  spec.config.json created for each spec with correct status
  SP04-05  Migration log written to data/migration-v2.log
  SP04-06  npm run typecheck returns zero errors

## Done when
All 4 SPs pass. New data model in place. Migration script works.
Existing projects accessible via new hierarchy. Zero TypeScript errors.

## Files produced by this unit
  src/types/index.ts                    (modified)
  src/lib/applications.ts               (new)
  src/lib/projects-v2.ts                (new)
  src/lib/effective-config.ts           (new)
  src/lib/spec-configs.ts               (new)
  src/lib/migration.ts                  (new)
  src/app/api/migrate/route.ts          (new)

## Next unit
C1 - Application Tier UI
