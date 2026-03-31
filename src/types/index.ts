export interface Project {
  id:             string
  name:           string
  description:    string
  appDir:         string
  specDir:        string
  logsDir:        string
  model:          string
  maxTokens?:      number
  projectContext: string
  constraints:    string[]
  validation: {
    afterEachSubPrompt: string[]
    afterUnit:          string[]
  }
  git: {
    autoCommit:    boolean
    autoTag:       boolean
    commitMessage: string
    tagTemplate:   string
  }
  createdAt: string
  updatedAt: string
}

export interface SubPromptDef {
  id:       string
  name:     string
  body:     string
  criteria: string[]
}

export interface SpecFile {
  id:             string
  filename:       string
  title:          string
  summary:        string
  version:        string
  filePath:       string
  subPrompts:     SubPromptDef[]
  rawContent:     string
  lastRunAt?:     string
  lastStatus?:    "passed" | "failed"
  jiraUrl?:       string
  jiraTicketId?:  string
}

export type SpStatus = "pending" | "running" | "passed" | "failed" | "locked"

export interface ValidationResult {
  command:     string
  status:      "passed" | "failed" | "skipped"
  passed:      boolean
  output:      string
  errorCount?: number
}

export interface SubPromptResult {
  id:           string
  name:         string
  status:       "passed" | "failed" | "skipped" | "pending"
  durationMs:   number
  tokens:       { input: number; output: number }
  filesWritten: string[]
  commandsRun:  string[]
  validation:   ValidationResult[]
  error?:       string
}

export type LogLevel = "error" | "success" | "info" | "system"

/** Persisted stream line (additive field on execution log JSON). */
export interface ExecutionLogLine {
  timestamp: string
  message:   string
  level?:    LogLevel
}

export interface ExecutionLog {
  id:              string
  projectId:       string
  unitId:          string
  unitTitle:       string
  specFile:        string
  specVersion:     string
  timestamp:       string
  status:          "passed" | "failed" | "in_progress"
  durationMs:      number
  subPrompts:      SubPromptResult[]
  finalValidation: ValidationResult[]
  git?:            { commit: string; tag: string; message: string }
  gitStateBeforeRun?: string
  error?:          string
  /** Full terminal stream with levels; display filters do not affect this. */
  logLines?:       ExecutionLogLine[]
}

export interface StreamEvent {
  type:    "log" | "sp_start" | "sp_pass" | "sp_fail" | "sp_files_pending" | "done" | "error"
  message: string
  /** Only meaningful when type === "log"; omitted means info on the client. */
  level?:  LogLevel
  spId?:   string
  spName?:      string
  inputTokens?:  number
  outputTokens?:      number
  logId?:             string
  durationMs?:        number
  filesWritten?:      string[]
  pendingFiles?:      { path: string; newContent: string; existingContent: string }[]
  validationResults?: { command: string; status: string; output: string; errorCount?: number }[]
}