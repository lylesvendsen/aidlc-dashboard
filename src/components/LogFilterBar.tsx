"use client"

import { normalizeLogFilters, type LogFilterState } from "@/lib/logDisplay"

type ToggleKey = keyof LogFilterState

const TOGGLES: { key: ToggleKey; label: string; dotClass: string }[] = [
  { key: "errors", label: "Errors", dotClass: "bg-red-600" },
  { key: "success", label: "Success", dotClass: "bg-blue-600" },
  { key: "info", label: "Info", dotClass: "bg-gray-400" },
  { key: "system", label: "System", dotClass: "bg-yellow-500" },
]

export interface LogFilterBarProps {
  initialFilters: LogFilterState
  value: LogFilterState
  onChange: (next: LogFilterState) => void
}

export function LogFilterBar({ initialFilters, value, onChange }: LogFilterBarProps) {
  const v = normalizeLogFilters(value)
  const init = normalizeLogFilters(initialFilters)

  const toggle = (key: ToggleKey) => {
    onChange({ ...v, [key]: !v[key] })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <span className="text-xs text-gray-500 mr-1" title="Show or hide lines in the terminal only. The log file always contains every message.">
        Log filters
      </span>
      {TOGGLES.map(({ key, label, dotClass }) => {
        const active = v[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-pressed={active}
            title={init[key] ? "On by default from env" : "Off by default from env"}
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all " +
              (active
                ? "border-gray-600 bg-gray-800 text-gray-100 opacity-100"
                : "border-gray-700/50 bg-gray-950/40 text-gray-500 opacity-40 grayscale hover:opacity-70 hover:grayscale-0 hover:text-gray-400 hover:border-gray-600/60")
            }
          >
            <span className={"h-2 w-2 rounded-full shrink-0 " + dotClass} aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
