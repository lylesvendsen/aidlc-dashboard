import type { LogLevel, StreamEvent } from "@/types"

/**
 * Per-level visibility in the run page terminal only.
 * Does not affect the execution log file: all levels are always persisted server-side
 * (`ExecutionLog.logLines`) and the client keeps the full in-memory entry list.
 */
export type LogFilterState = {
  errors: boolean
  success: boolean
  info: boolean
  system: boolean
}

/** Defaults match `/api/log-config` when env vars are unset. */
export const DEFAULT_LOG_FILTERS: LogFilterState = {
  errors: true,
  success: true,
  info: true,
  system: false,
}

/** Ensures every key is a boolean so one missing key cannot blank multiple visibility buckets. */
export function normalizeLogFilters(
  f: Partial<LogFilterState> | LogFilterState | undefined,
): LogFilterState {
  return {
    errors: f?.errors ?? DEFAULT_LOG_FILTERS.errors,
    success: f?.success ?? DEFAULT_LOG_FILTERS.success,
    info: f?.info ?? DEFAULT_LOG_FILTERS.info,
    system: f?.system ?? DEFAULT_LOG_FILTERS.system,
  }
}

function coerceLogLevel(raw: unknown): LogLevel {
  if (raw === "error" || raw === "success" || raw === "info" || raw === "system") return raw
  return "info"
}

/**
 * Maps each SSE event to exactly one log level for filtering.
 * Each toggle controls only its bucket: errors ↔ `errors`, success ↔ `success`, etc.
 */
export function levelFromStreamEvent(ev: StreamEvent): LogLevel {
  switch (ev.type) {
    case "log":
      return coerceLogLevel(ev.level)
    case "error":
    case "sp_fail":
      return "error"
    case "done":
    case "sp_pass":
      return "success"
    case "sp_start":
      return "info"
    default:
      return "info"
  }
}

const LEVEL_TO_FILTER: Record<LogLevel, keyof LogFilterState> = {
  error: "errors",
  success: "success",
  info: "info",
  system: "system",
}

export function filterKeyForLevel(level: LogLevel): keyof LogFilterState {
  return LEVEL_TO_FILTER[level]
}

/** Display-only: whether a line should render for this level given the toggles. */
export function entryVisible(level: LogLevel, f: LogFilterState): boolean {
  const normalized = normalizeLogFilters(f)
  return normalized[filterKeyForLevel(level)]
}
