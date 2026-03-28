'use client'

import React from 'react'
import type { SpAttempt } from '@/lib/attempts'

function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

function formatDuration(ms: number | null): string | null {
  if (ms === null) return null
  if (ms < 1000) return `${ms}ms`
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return `${min}m ${remSec}s`
}

interface StatusIconProps {
  status: SpAttempt['status']
}

function StatusIcon({ status }: StatusIconProps) {
  if (status === 'passed') {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0"
        aria-label="passed"
      >
        ✓
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex-shrink-0"
        aria-label="failed"
      >
        ✗
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs flex-shrink-0 animate-pulse"
        aria-label="running"
      >
        ⏳
      </span>
    )
  }
  return null
}

interface AttemptRowProps {
  attempt: SpAttempt
}

function AttemptRow({ attempt }: AttemptRowProps) {
  const isRunning = attempt.status === 'running'
  const isPassed = attempt.status === 'passed'
  const isFailed = attempt.status === 'failed'

  const rowBase =
    'flex items-start gap-3 px-3 py-2 rounded-md text-sm transition-colors'
  const rowColor = isRunning
    ? 'bg-yellow-50 animate-pulse'
    : isPassed
    ? 'bg-green-50'
    : isFailed
    ? 'bg-red-50'
    : 'bg-gray-50'

  const labelColor = isPassed
    ? 'text-green-700'
    : isFailed
    ? 'text-red-700'
    : isRunning
    ? 'text-yellow-700'
    : 'text-gray-600'

  const duration = formatDuration(attempt.durationMs)

  return (
    <div className={`${rowBase} ${rowColor}`}>
      <StatusIcon status={attempt.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-medium ${labelColor}`}>
            Attempt {attempt.index}
          </span>
          {isRunning && (
            <span className="text-yellow-600 text-xs">In progress…</span>
          )}
          {isPassed && !isRunning && (
            <span className="text-green-600 text-xs">Passed</span>
          )}
          {isFailed && attempt.error && (
            <span className="text-red-600 text-xs truncate max-w-xs" title={attempt.error}>
              {attempt.error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-gray-400 text-xs">
            {formatRelativeTime(attempt.timestamp)}
          </span>
          {duration !== null && (
            <>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-gray-400 text-xs">{duration}</span>
            </>
          )}
          {attempt.tokens !== null && (
            <>
              <span className="text-gray-300 text-xs">·</span>
              <span className="text-gray-400 text-xs">
                {attempt.tokens.inputTokens.toLocaleString()}↑{' '}
                {attempt.tokens.outputTokens.toLocaleString()}↓
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export interface AttemptHistoryProps {
  attempts: SpAttempt[]
  spId: string
  isRunning?: boolean
}

export function AttemptHistory({ attempts, spId, isRunning = false }: AttemptHistoryProps) {
  const hasRunningAttempt = attempts.some((a) => a.status === 'running')
  const displayAttempts =
    isRunning && !hasRunningAttempt
      ? [
          ...attempts,
          {
            index: attempts.length + 1,
            status: 'running' as const,
            error: null,
            timestamp: new Date().toISOString(),
            durationMs: null,
            tokens: null,
          },
        ]
      : attempts

  if (displayAttempts.length === 0) {
    return (
      <div className="text-gray-400 text-sm px-3 py-2">
        No attempts yet for {spId}.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">
        Attempt History
      </h4>
      {displayAttempts.map((attempt) => (
        <AttemptRow key={attempt.index} attempt={attempt} />
      ))}
    </div>
  )
}

export default AttemptHistory
