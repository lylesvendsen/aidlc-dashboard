export interface Project {
  id:             string
  name:           string
  description:    string
  appDir:         string
  specDir:        string
  logsDir:        string
  model:          string
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
  id:          string
  filename:    string
  title:       string
  summary:     string
  version:     string
  filePath:    string
  subPrompts:  SubPromptDef[]
  rawContent:  string
  lastRunAt?:  string
  lastStatus?: "passed" | "failed"
}

export interface ValidationResult {
  command: string
  passed:  boolean
  output:  string
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
}

export interface StreamEvent {
  type:    "log" | "sp_start" | "sp_pass" | "sp_fail" | "done" | "error"
  message: string
  spId?:   string
  spName?: string
}
