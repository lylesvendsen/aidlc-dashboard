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

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': {
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
  'claude-opus-4-6': {
    inputPerMillion: 15,
    outputPerMillion: 75,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillion: 3,
  outputPerMillion: 15,
};

function getPricing(model: string): ModelPricing {
  return PRICING[model] ?? DEFAULT_PRICING;
}

function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing
): number {
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export default function CostTracker({
  subPrompts,
  model,
  isRunning,
  startedAt,
}: CostTrackerProps) {
  const [elapsed, setElapsed] = useState<number>(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();

    const tick = () => {
      setElapsed(Date.now() - startMs);
    };

    tick();

    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(Date.now() - startMs);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, startedAt]);

  const pricing = getPricing(model);

  const totals = subPrompts.reduce(
    (acc, sp) => ({
      inputTokens: acc.inputTokens + sp.inputTokens,
      outputTokens: acc.outputTokens + sp.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 }
  );

  const totalCost = calculateCost(
    totals.inputTokens,
    totals.outputTokens,
    pricing
  );

  const completedSps = subPrompts.filter(
    (sp) => sp.status === 'passed' || sp.status === 'failed'
  );

  return (
    <div className="relative flex items-center gap-4 text-sm">
      {/* Token counts */}
      <div className="flex items-center gap-1.5 text-slate-300">
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">
          Tokens
        </span>
        <span className="font-mono text-slate-200">
          {formatTokens(totals.inputTokens)}
        </span>
        <span className="text-slate-500">in</span>
        <span className="text-slate-400">/</span>
        <span className="font-mono text-slate-200">
          {formatTokens(totals.outputTokens)}
        </span>
        <span className="text-slate-500">out</span>
      </div>

      {/* Divider */}
      <span className="text-slate-600">|</span>

      {/* Cost estimate with hover breakdown */}
      <div
        className="relative flex items-center gap-1.5 cursor-default"
        onMouseEnter={() => setShowBreakdown(true)}
        onMouseLeave={() => setShowBreakdown(false)}
      >
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">
          Est. cost
        </span>
        <span className="font-mono text-emerald-400 font-semibold">
          {formatCost(totalCost)}
        </span>

        {/* Hover tooltip with per-SP breakdown */}
        {showBreakdown && completedSps.length > 0 && (
          <div
            ref={tooltipRef}
            className="absolute top-full right-0 mt-2 z-50 min-w-[280px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3"
          >
            <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">
              Per sub-prompt breakdown
            </div>
            <div className="space-y-1.5">
              {completedSps.map((sp) => {
                const spCost = calculateCost(
                  sp.inputTokens,
                  sp.outputTokens,
                  pricing
                );
                return (
                  <div
                    key={sp.spId}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          sp.status === 'passed'
                            ? 'bg-emerald-400'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="font-mono text-slate-300 truncate">
                        {sp.spId}
                      </span>
                      {sp.name && (
                        <span className="text-slate-500 truncate">
                          {sp.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span className="text-slate-400 font-mono">
                        {formatTokens(sp.inputTokens + sp.outputTokens)}
                      </span>
                      <span className="text-emerald-400 font-mono font-medium">
                        {formatCost(spCost)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-400">Total</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {formatCost(totalCost)}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              Model: {model}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <span className="text-slate-600">|</span>

      {/* Duration */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 text-xs uppercase tracking-wide font-medium">
          Duration
        </span>
        <span
          className={`font-mono ${
            isRunning ? 'text-amber-400' : 'text-slate-200'
          }`}
        >
          {formatDuration(elapsed)}
        </span>
        {isRunning && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}
