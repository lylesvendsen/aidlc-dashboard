import * as fs from 'fs/promises'
import * as path from 'path'

export interface SpAttemptTokens {
  inputTokens: number
  outputTokens: number
}

export interface SpAttempt {
  index: number
  status: 'passed' | 'failed' | 'running'
  error: string | null
  timestamp: string
  durationMs: number | null
  tokens: SpAttemptTokens | null
}

interface ValidationCommandResult {
  command: string
  passed: boolean
  output?: string
  error?: string
}

interface SpResult {
  spId: string
  status: 'passed' | 'failed' | 'running'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  inputTokens?: number
  outputTokens?: number
  validationResults?: ValidationCommandResult[]
  error?: string
}

interface ExecutionLogEntry {
  unitId?: string
  unit?: string
  startedAt?: string
  completedAt?: string
  subPrompts?: SpResult[]
  spResults?: SpResult[]
}

function getUnitIdFromLog(entry: ExecutionLogEntry): string | null {
  return entry.unitId ?? entry.unit ?? null
}

function getSpResults(entry: ExecutionLogEntry): SpResult[] {
  return entry.subPrompts ?? entry.spResults ?? []
}

function extractErrorSummary(spResult: SpResult): string | null {
  if (spResult.error) {
    return spResult.error.slice(0, 120)
  }
  if (spResult.validationResults) {
    const failed = spResult.validationResults.find((v) => !v.passed)
    if (failed) {
      const detail = failed.error ?? failed.output ?? ''
      const firstLine = detail.split('\n').find((l) => l.trim().length > 0) ?? ''
      return `${failed.command} — ${firstLine.slice(0, 80)}`.trim()
    }
  }
  return null
}

export async function getAttemptsForSp(
  logsDir: string,
  unitId: string,
  spId: string
): Promise<SpAttempt[]> {
  const resolvedLogsDir = path.resolve(logsDir)

  let filenames: string[]
  try {
    filenames = await fs.readdir(resolvedLogsDir)
  } catch {
    return []
  }

  const jsonFiles = filenames
    .filter((f) => f.endsWith('.json'))
    .sort()

  const attempts: SpAttempt[] = []

  for (const filename of jsonFiles) {
    const filePath = path.resolve(resolvedLogsDir, filename)
    let entry: ExecutionLogEntry
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      entry = JSON.parse(raw) as ExecutionLogEntry
    } catch {
      continue
    }

    const logUnitId = getUnitIdFromLog(entry)
    if (logUnitId !== null && logUnitId !== unitId) {
      continue
    }

    const spResults = getSpResults(entry)
    const spResult = spResults.find((sp) => sp.spId === spId)
    if (!spResult) {
      continue
    }

    const timestamp = spResult.startedAt ?? entry.startedAt ?? new Date(0).toISOString()
    const durationMs =
      spResult.durationMs != null
        ? spResult.durationMs
        : spResult.startedAt && spResult.completedAt
        ? new Date(spResult.completedAt).getTime() - new Date(spResult.startedAt).getTime()
        : null

    const tokens: SpAttemptTokens | null =
      spResult.inputTokens != null && spResult.outputTokens != null
        ? { inputTokens: spResult.inputTokens, outputTokens: spResult.outputTokens }
        : null

    attempts.push({
      index: attempts.length + 1,
      status: spResult.status,
      error: extractErrorSummary(spResult),
      timestamp,
      durationMs,
      tokens,
    })
  }

  return attempts
}
