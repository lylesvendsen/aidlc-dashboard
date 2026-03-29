export type SpecStatus =
  | "draft"
  | "spec-review"
  | "ready"
  | "executed"
  | "execution-review"
  | "accepted"
  | "rejected"

export interface ApplicationConfig {
  id:                 string
  name:               string
  description?:       string
  appDir:             string
  specDir:            string
  logsDir:            string
  rootDir:            string
  defaultModel?:      string
  globalConstraints?: string[]
  defaultValidation?: { afterEachSubPrompt: string[]; afterUnit: string[] }
  projectContext?:    string
  git?:               Record<string, unknown>
  createdAt:          string
  updatedAt:          string
}

export interface ProjectConfig {
  id:              string
  applicationId:   string
  name:            string
  description?:    string
  specDirFilter?:  string
  model?:          string
  projectContext?: string
  constraints?:    string[]
  validation?:     { afterEachSubPrompt: string[]; afterUnit: string[] }
  git?:            Record<string, unknown>
  createdAt:       string
  updatedAt:       string
}

export interface SpecConfig {
  id:            string
  applicationId: string
  projectId:     string
  filePath:      string
  status:        SpecStatus
  jiraUrl?:      string
  jiraTicketId?: string
  model?:        string
  validation?:   { afterEachSubPrompt: string[]; afterUnit: string[] }
  git?:          Record<string, unknown>
  maxTokens?:    number
  reviewNotes?:  string
  createdAt:     string
  updatedAt:     string
}
