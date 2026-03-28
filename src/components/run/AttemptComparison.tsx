'use client';

import { useState } from 'react';

interface AttemptData {
  attemptIndex: number;
  filesWritten?: string[];
  validationOutput?: string;
  error?: string;
  note?: string;
  status?: string;
  exitCode?: number;
  duration?: number;
}

interface AttemptComparisonProps {
  spId: string;
  attempts: AttemptData[];
  onClose: () => void;
}

function diffLines(left: string, right: string): { left: string[]; right: string[]; diffMap: Set<number> } {
  const leftLines = left.split('\n');
  const rightLines = right.split('\n');
  const maxLen = Math.max(leftLines.length, rightLines.length);
  const diffMap = new Set<number>();

  for (let i = 0; i < maxLen; i++) {
    if ((leftLines[i] ?? '') !== (rightLines[i] ?? '')) {
      diffMap.add(i);
    }
  }

  return { left: leftLines, right: rightLines, diffMap };
}

function renderLines(lines: string[], diffMap: Set<number>, side: 'left' | 'right'): React.ReactNode {
  return lines.map((line, i) => {
    const isDiff = diffMap.has(i);
    const bgClass = isDiff
      ? side === 'left'
        ? 'bg-red-900/30 text-red-200'
        : 'bg-green-900/30 text-green-200'
      : 'text-gray-300';

    return (
      <div key={i} className={`font-mono text-xs px-2 py-px whitespace-pre-wrap break-all ${bgClass}`}>
        {line || '\u00A0'}
      </div>
    );
  });
}

function AttemptColumn({ attempt }: { attempt: AttemptData }) {
  const filesText = attempt.filesWritten && attempt.filesWritten.length > 0
    ? attempt.filesWritten.join('\n')
    : '(none)';
  const validationText = attempt.validationOutput ?? '(none)';
  const errorText = attempt.error ?? '(none)';

  return { filesText, validationText, errorText };
}

interface SideBySideSectionProps {
  label: string;
  leftText: string;
  rightText: string;
  leftIndex: number;
  rightIndex: number;
}

function SideBySideSection({ label, leftText, rightText, leftIndex, rightIndex }: SideBySideSectionProps) {
  const { left, right, diffMap } = diffLines(leftText, rightText);

  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 px-2 py-1 text-xs text-gray-400 border-b border-gray-700">
            Attempt {leftIndex + 1}
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            {renderLines(left, diffMap, 'left')}
          </div>
        </div>
        <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 px-2 py-1 text-xs text-gray-400 border-b border-gray-700">
            Attempt {rightIndex + 1}
          </div>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            {renderLines(right, diffMap, 'right')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttemptComparison({ spId, attempts, onClose }: AttemptComparisonProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 2) {
        return [prev[1], index];
      }
      return [...prev, index];
    });
  };

  const canCompare = selectedIndices.length === 2;

  const leftAttempt = canCompare ? attempts.find((a) => a.attemptIndex === selectedIndices[0]) : null;
  const rightAttempt = canCompare ? attempts.find((a) => a.attemptIndex === selectedIndices[1]) : null;

  const leftCol = leftAttempt ? AttemptColumn({ attempt: leftAttempt }) : null;
  const rightCol = rightAttempt ? AttemptColumn({ attempt: rightAttempt }) : null;

  const statusColor = (status?: string) => {
    if (status === 'passed') return 'text-green-400';
    if (status === 'failed') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-6xl bg-gray-850 border border-gray-700 rounded-lg shadow-2xl bg-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-white">Attempt Comparison</h2>
            <p className="text-xs text-gray-400 mt-0.5">SP: {spId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none px-2"
            aria-label="Close comparison"
          >
            ×
          </button>
        </div>

        {/* Attempt selection */}
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-2">
            Select exactly two attempts to compare
            {selectedIndices.length > 0 && (
              <span className="ml-2 text-gray-300">
                ({selectedIndices.length} selected)
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {attempts.map((attempt) => {
              const isSelected = selectedIndices.includes(attempt.attemptIndex);
              const selectionOrder = selectedIndices.indexOf(attempt.attemptIndex);
              return (
                <button
                  key={attempt.attemptIndex}
                  onClick={() => toggleSelect(attempt.attemptIndex)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold leading-none">
                      {selectionOrder + 1}
                    </span>
                  )}
                  {!isSelected && (
                    <span className="w-4 h-4 rounded-full border border-gray-500 flex items-center justify-center">
                    </span>
                  )}
                  <span>Attempt {attempt.attemptIndex + 1}</span>
                  <span className={`${statusColor(attempt.status)}`}>
                    {attempt.status ?? 'unknown'}
                  </span>
                </button>
              );
            })}
          </div>

          {canCompare && (
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-900/50 border border-red-700 inline-block"></span>
                Removed / changed in left
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-900/50 border border-green-700 inline-block"></span>
                Added / changed in right
              </span>
            </div>
          )}
        </div>

        {/* Comparison panel */}
        <div className="px-4 py-4">
          {!canCompare && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Select two attempts above to see a side-by-side comparison
            </div>
          )}

          {canCompare && leftAttempt && rightAttempt && leftCol && rightCol && (
            <div>
              {/* Summary row */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-800 rounded border border-gray-700 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-300 mb-1">
                    Attempt {leftAttempt.attemptIndex + 1}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>
                      Status:{' '}
                      <span className={statusColor(leftAttempt.status)}>
                        {leftAttempt.status ?? 'unknown'}
                      </span>
                    </span>
                    {leftAttempt.exitCode !== undefined && (
                      <span>Exit: {leftAttempt.exitCode}</span>
                    )}
                    {leftAttempt.duration !== undefined && (
                      <span>Duration: {(leftAttempt.duration / 1000).toFixed(1)}s</span>
                    )}
                    {leftAttempt.filesWritten && (
                      <span>Files: {leftAttempt.filesWritten.length}</span>
                    )}
                  </div>
                  {leftAttempt.note && (
                    <p className="text-xs text-gray-400 italic mt-1">📝 {leftAttempt.note}</p>
                  )}
                </div>
                <div className="bg-gray-800 rounded border border-gray-700 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-300 mb-1">
                    Attempt {rightAttempt.attemptIndex + 1}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>
                      Status:{' '}
                      <span className={statusColor(rightAttempt.status)}>
                        {rightAttempt.status ?? 'unknown'}
                      </span>
                    </span>
                    {rightAttempt.exitCode !== undefined && (
                      <span>Exit: {rightAttempt.exitCode}</span>
                    )}
                    {rightAttempt.duration !== undefined && (
                      <span>Duration: {(rightAttempt.duration / 1000).toFixed(1)}s</span>
                    )}
                    {rightAttempt.filesWritten && (
                      <span>Files: {rightAttempt.filesWritten.length}</span>
                    )}
                  </div>
                  {rightAttempt.note && (
                    <p className="text-xs text-gray-400 italic mt-1">📝 {rightAttempt.note}</p>
                  )}
                </div>
              </div>

              <SideBySideSection
                label="Files Written"
                leftText={leftCol.filesText}
                rightText={rightCol.filesText}
                leftIndex={leftAttempt.attemptIndex}
                rightIndex={rightAttempt.attemptIndex}
              />

              <SideBySideSection
                label="Validation Output"
                leftText={leftCol.validationText}
                rightText={rightCol.validationText}
                leftIndex={leftAttempt.attemptIndex}
                rightIndex={rightAttempt.attemptIndex}
              />

              <SideBySideSection
                label="Error"
                leftText={leftCol.errorText}
                rightText={rightCol.errorText}
                leftIndex={leftAttempt.attemptIndex}
                rightIndex={rightAttempt.attemptIndex}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}