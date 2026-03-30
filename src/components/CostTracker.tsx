'use client';

import { useState, useEffect, useRef } from 'react';

export interface SubPromptResult {
  spId: string;
  name?: string;
  inputTokens: number;
  outputTokens: number;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'locked';
}

interface CostTrackerProps {
  subPrompts: SubPromptResult[];
  model: string;
  isRunning: boolean;
  startedAt: string;
}

interface ModelPricing { inputPerMillion: number; outputPerMillion: number }

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerMillion: 3,  outputPerMillion: 15  },
  'claude-opus-4-6':   { inputPerMillion: 15, outputPerMillion: 75  },
  'claude-haiku-4-5':  { inputPerMillion: 0.25, outputPerMillion: 1.25 },
}
const DEFAULT_PRICING: ModelPricing = { inputPerMillion: 3, outputPerMillion: 15 }
const getPricing = (model: string) => PRICING[model] ?? DEFAULT_PRICING
const calcCost = (i: number, o: number, p: ModelPricing) => (i/1_000_000)*p.inputPerMillion + (o/1_000_000)*p.outputPerMillion
const fmtCost = (c: number) => c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(2)}`
const fmtTok  = (n: number) => n.toLocaleString('en-US')
const fmtDur  = (ms: number) => { const s = Math.floor(ms/1000); const m = Math.floor(s/60); return m === 0 ? `${s}s` : `${m}m ${String(s%60).padStart(2,"0")}s` }

export default function CostTracker({ subPrompts, model, isRunning, startedAt }: CostTrackerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setElapsed(Date.now() - start)
    tick()
    if (isRunning) ref.current = setInterval(tick, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [isRunning, startedAt])

  const pricing = getPricing(model)
  const totals  = subPrompts.reduce((a, s) => ({ inputTokens: a.inputTokens + s.inputTokens, outputTokens: a.outputTokens + s.outputTokens }), { inputTokens: 0, outputTokens: 0 })
  const totalCost = calcCost(totals.inputTokens, totals.outputTokens, pricing)
  const done = subPrompts.filter(s => s.status === 'passed' || s.status === 'failed')

  return (
    <div className="relative flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1.5 text-slate-300">
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Tokens</span>
        <span className="font-mono text-slate-400">{fmtTok(totals.inputTokens)}</span>
        <span className="text-slate-500">in</span>
        <span className="text-slate-400">/</span>
        <span className="font-mono text-slate-400">{fmtTok(totals.outputTokens)}</span>
        <span className="text-slate-500">out</span>
      </div>
      <span className="text-slate-600">|</span>
      <div className="relative flex items-center gap-1.5 cursor-default"
        onMouseEnter={() => setShowBreakdown(true)}
        onMouseLeave={() => setShowBreakdown(false)}>
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Est. cost</span>
        <span className="font-mono text-emerald-400 font-semibold">{fmtCost(totalCost)}</span>
        {showBreakdown && done.length > 0 && (
          <div className="absolute top-full right-0 mt-2 z-50 min-w-[280px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Per sub-prompt</div>
            <div className="space-y-1.5">
              {done.map(sp => {
                const c = calcCost(sp.inputTokens, sp.outputTokens, pricing)
                return (
                  <div key={sp.spId} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sp.status === 'passed' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="font-mono text-slate-300 truncate">{sp.spId}</span>
                      {sp.name && <span className="text-slate-500 truncate">{sp.name}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-slate-400 font-mono">{fmtTok(sp.inputTokens + sp.outputTokens)}</span>
                      <span className="text-emerald-400 font-mono font-medium">{fmtCost(c)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total</span>
              <span className="font-mono text-emerald-400 font-semibold">{fmtCost(totalCost)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">Model: {model}</div>
          </div>
        )}
      </div>
      <span className="text-slate-600">|</span>
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">Duration</span>
        <span className={`font-mono ${isRunning ? 'text-amber-400' : 'text-slate-400'}`}>{fmtDur(elapsed)}</span>
        {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
      </div>
    </div>
  )
}
