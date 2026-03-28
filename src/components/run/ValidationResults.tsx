"use client";

import React, { useState } from "react";
import { ValidationResult } from "@/types";

interface ValidationResultsProps {
  validation: ValidationResult[];
}

function StatusIcon({ status }: { status: ValidationResult["status"] }) {
  if (status === "passed") {
    return (
      <span className="text-green-400 font-bold select-none" aria-label="passed">
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-red-400 font-bold select-none" aria-label="failed">
        ✗
      </span>
    );
  }
  return (
    <span className="text-zinc-500 font-bold select-none" aria-label="skipped">
      —
    </span>
  );
}

function ValidationRow({ result, isExpanded, onToggle }: {
  result: ValidationResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const canExpand = result.status === "failed" && result.output.trim().length > 0;

  const rowBg = result.status === "passed"
    ? "hover:bg-zinc-800"
    : result.status === "failed"
    ? "hover:bg-zinc-800"
    : "opacity-60 cursor-default";

  const summaryText = result.status === "passed"
    ? result.errorCount !== undefined
      ? `${result.errorCount} errors`
      : "passed"
    : result.status === "failed"
    ? result.errorCount !== undefined
      ? `${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}`
      : "failed"
    : "skipped";

  return (
    <div className="border border-zinc-700 rounded mb-1 overflow-hidden">
      <button
        type="button"
        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-mono transition-colors ${
          canExpand ? "cursor-pointer " + rowBg : "cursor-default " + rowBg
        } bg-zinc-900`}
        onClick={canExpand ? onToggle : undefined}
        aria-expanded={canExpand ? isExpanded : undefined}
        disabled={!canExpand}
      >
        <StatusIcon status={result.status} />
        <span className="flex-1 text-zinc-200 truncate">{result.command}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            result.status === "passed"
              ? "bg-green-900 text-green-300"
              : result.status === "failed"
              ? "bg-red-900 text-red-300"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {summaryText}
        </span>
        {canExpand && (
          <span
            className={`text-zinc-400 text-xs transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▶
          </span>
        )}
      </button>

      {canExpand && isExpanded && (
        <div className="border-t border-zinc-700 bg-zinc-950 p-3">
          <pre className="text-xs text-red-300 font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
            {result.output}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ValidationResults({ validation }: ValidationResultsProps) {
  const [expandedCommands, setExpandedCommands] = useState<Set<number>>(
    new Set()
  );

  if (!validation || validation.length === 0) {
    return (
      <div className="text-zinc-500 text-sm italic px-1">
        No validation results yet.
      </div>
    );
  }

  function toggleExpanded(index: number) {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
        Validation
      </p>
      {validation.map((result, index) => (
        <ValidationRow
          key={`${result.command}-${index}`}
          result={result}
          isExpanded={expandedCommands.has(index)}
          onToggle={() => toggleExpanded(index)}
        />
      ))}
    </div>
  );
}
