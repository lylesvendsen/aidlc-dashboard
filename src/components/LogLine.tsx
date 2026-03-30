import type { LogLevel } from "@/types"

const levelClass: Record<LogLevel, string> = {
  error: "log-error",
  success: "log-success",
  info: "log-info",
  system: "log-system",
}

export interface LogLineProps {
  timestamp: string
  message: string
  level: LogLevel
}

export function LogLine({ timestamp, message, level }: LogLineProps) {
  const cls = levelClass[level] ?? "log-info"
  const showLabel = level !== "info"

  return (
    <p className={`font-mono text-sm ${cls}`}>
      <span className="text-gray-500">[{timestamp}]</span>
      {showLabel && (
        <span className="ml-2 font-medium opacity-90">[{level.toUpperCase()}]</span>
      )}
      <span className="ml-2 whitespace-pre-wrap break-words">{message}</span>
    </p>
  )
}
