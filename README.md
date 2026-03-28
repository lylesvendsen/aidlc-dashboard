# aidlc-dashboard

Local web dashboard for managing AIDLC projects, specs, prompts, and execution.
Runs at http://localhost:7777.

## Quick start

```bash
npm install
cp .env.local .env.local   # edit ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:7777

## Features

- Project management (multiple projects, each with their own config)
- Spec viewer and editor with markdown support
- AI-powered sub-prompt generator
- Live execution with real-time streaming output
- Full execution history with per-sub-prompt breakdown
- Undo any run (git reset to pre-run state)
- Config editor (edit all project settings in browser)

## Data storage

Projects are stored as JSON files in `data/projects/`.
Specs are read/written directly from your project's specDir.
Logs are read/written from your project's logsDir.
No database required.
