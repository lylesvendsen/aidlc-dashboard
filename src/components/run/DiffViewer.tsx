'use client';

import React, { useState, useMemo } from 'react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  leftLineNum: number | null;
  rightLineNum: number | null;
}

interface DiffViewerProps {
  existingContent: string;
  newContent: string;
  filePath: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  // LCS-based diff using Myers-like DP
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  const ops: Array<{ type: 'added' | 'removed' | 'unchanged'; content: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'unchanged', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', content: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'removed', content: oldLines[i - 1] });
      i--;
    }
  }

  let leftLineNum = 1;
  let rightLineNum = 1;

  for (const op of ops) {
    if (op.type === 'unchanged') {
      result.push({
        type: 'unchanged',
        content: op.content,
        leftLineNum: leftLineNum++,
        rightLineNum: rightLineNum++,
      });
    } else if (op.type === 'removed') {
      result.push({
        type: 'removed',
        content: op.content,
        leftLineNum: leftLineNum++,
        rightLineNum: null,
      });
    } else {
      result.push({
        type: 'added',
        content: op.content,
        leftLineNum: null,
        rightLineNum: rightLineNum++,
      });
    }
  }

  return result;
}

interface SideBySideLine {
  leftLineNum: number | null;
  leftContent: string | null;
  leftType: 'removed' | 'unchanged' | null;
  rightLineNum: number | null;
  rightContent: string | null;
  rightType: 'added' | 'unchanged' | null;
}

function buildSideBySide(diffLines: DiffLine[]): SideBySideLine[] {
  const rows: SideBySideLine[] = [];

  // Group consecutive removed/added lines together
  let idx = 0;
  while (idx < diffLines.length) {
    const line = diffLines[idx];

    if (line.type === 'unchanged') {
      rows.push({
        leftLineNum: line.leftLineNum,
        leftContent: line.content,
        leftType: 'unchanged',
        rightLineNum: line.rightLineNum,
        rightContent: line.content,
        rightType: 'unchanged',
      });
      idx++;
    } else if (line.type === 'removed') {
      // Collect consecutive removed lines
      const removedLines: DiffLine[] = [];
      while (idx < diffLines.length && diffLines[idx].type === 'removed') {
        removedLines.push(diffLines[idx]);
        idx++;
      }
      // Collect consecutive added lines
      const addedLines: DiffLine[] = [];
      while (idx < diffLines.length && diffLines[idx].type === 'added') {
        addedLines.push(diffLines[idx]);
        idx++;
      }

      const maxLen = Math.max(removedLines.length, addedLines.length);
      for (let k = 0; k < maxLen; k++) {
        const rem = removedLines[k];
        const add = addedLines[k];
        rows.push({
          leftLineNum: rem ? rem.leftLineNum : null,
          leftContent: rem ? rem.content : null,
          leftType: rem ? 'removed' : null,
          rightLineNum: add ? add.rightLineNum : null,
          rightContent: add ? add.content : null,
          rightType: add ? 'added' : null,
        });
      }
    } else {
      // added without preceding removed
      rows.push({
        leftLineNum: null,
        leftContent: null,
        leftType: null,
        rightLineNum: line.rightLineNum,
        rightContent: line.content,
        rightType: 'added',
      });
      idx++;
    }
  }

  return rows;
}

export default function DiffViewer({
  existingContent,
  newContent,
  filePath,
  collapsible = false,
  defaultExpanded = true,
}: DiffViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const diffLines = useMemo(
    () => computeDiff(existingContent, newContent),
    [existingContent, newContent]
  );

  const sideBySide = useMemo(
    () => buildSideBySide(diffLines),
    [diffLines]
  );

  const addedCount = useMemo(
    () => diffLines.filter((l) => l.type === 'added').length,
    [diffLines]
  );

  const removedCount = useMemo(
    () => diffLines.filter((l) => l.type === 'removed').length,
    [diffLines]
  );

  const isNewFile = existingContent === '';

  const summary = isNewFile
    ? `New file · +${addedCount} lines`
    : `+${addedCount} -${removedCount} lines`;

  const getCellClass = (type: 'added' | 'removed' | 'unchanged' | null): string => {
    if (type === 'added') return 'bg-green-950 text-green-200';
    if (type === 'removed') return 'bg-red-950 text-red-200';
    return 'bg-zinc-900 text-zinc-300';
  };

  const getLineNumClass = (type: 'added' | 'removed' | 'unchanged' | null): string => {
    if (type === 'added') return 'bg-green-900 text-green-400 select-none';
    if (type === 'removed') return 'bg-red-900 text-red-400 select-none';
    return 'bg-zinc-800 text-zinc-500 select-none';
  };

  const getGutterSymbol = (type: 'added' | 'removed' | 'unchanged' | null): string => {
    if (type === 'added') return '+';
    if (type === 'removed') return '-';
    return ' ';
  };

  return (
    <div className="border border-zinc-700 rounded-lg overflow-hidden">
      {/* Header / Summary */}
      <div
        className={`flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700 ${
          collapsible ? 'cursor-pointer hover:bg-zinc-750' : ''
        }`}
        onClick={collapsible ? () => setExpanded((e) => !e) : undefined}
      >
        <div className="flex items-center gap-3 min-w-0">
          {collapsible && (
            <span className="text-zinc-400 text-xs flex-shrink-0">
              {expanded ? '▼' : '▶'}
            </span>
          )}
          <span className="text-zinc-200 text-sm font-mono truncate">{filePath}</span>
          {isNewFile && (
            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-green-800 text-green-200 font-medium">
              NEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-xs font-mono">
            {addedCount > 0 && (
              <span className="text-green-400">+{addedCount}</span>
            )}
            {addedCount > 0 && removedCount > 0 && (
              <span className="text-zinc-500"> / </span>
            )}
            {removedCount > 0 && (
              <span className="text-red-400">-{removedCount}</span>
            )}
          </span>
          {collapsible && (
            <span className="text-zinc-500 text-xs">{summary}</span>
          )}
        </div>
      </div>

      {/* Diff table */}
      {(!collapsible || expanded) && (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          {sideBySide.length === 0 ? (
            <div className="px-4 py-6 text-center text-zinc-500 text-sm bg-zinc-900">
              No differences found
            </div>
          ) : (
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-800 border-b border-zinc-700">
                  <th className="w-10 px-2 py-1 text-zinc-500 font-normal text-right border-r border-zinc-700">
                    #
                  </th>
                  <th className="w-4 px-1 py-1 text-zinc-500 font-normal border-r border-zinc-700"></th>
                  <th className="px-3 py-1 text-left text-zinc-400 font-normal border-r border-zinc-600 w-1/2">
                    {isNewFile ? 'Empty' : 'Before'}
                  </th>
                  <th className="w-10 px-2 py-1 text-zinc-500 font-normal text-right border-r border-zinc-700">
                    #
                  </th>
                  <th className="w-4 px-1 py-1 text-zinc-500 font-normal border-r border-zinc-700"></th>
                  <th className="px-3 py-1 text-left text-zinc-400 font-normal w-1/2">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {sideBySide.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-zinc-800 last:border-b-0">
                    {/* Left line number */}
                    <td
                      className={`px-2 py-0.5 text-right text-xs w-10 border-r border-zinc-700 ${getLineNumClass(
                        row.leftType
                      )}`}
                    >
                      {row.leftLineNum !== null ? row.leftLineNum : ''}
                    </td>
                    {/* Left gutter symbol */}
                    <td
                      className={`px-1 py-0.5 text-center w-4 border-r border-zinc-700 ${getLineNumClass(
                        row.leftType
                      )}`}
                    >
                      {row.leftContent !== null ? getGutterSymbol(row.leftType) : ''}
                    </td>
                    {/* Left content */}
                    <td
                      className={`px-3 py-0.5 whitespace-pre border-r border-zinc-600 w-1/2 ${getCellClass(
                        row.leftType
                      )}`}
                    >
                      {row.leftContent !== null ? row.leftContent : (
                        <span className="opacity-0">​</span>
                      )}
                    </td>
                    {/* Right line number */}
                    <td
                      className={`px-2 py-0.5 text-right text-xs w-10 border-r border-zinc-700 ${getLineNumClass(
                        row.rightType
                      )}`}
                    >
                      {row.rightLineNum !== null ? row.rightLineNum : ''}
                    </td>
                    {/* Right gutter symbol */}
                    <td
                      className={`px-1 py-0.5 text-center w-4 border-r border-zinc-700 ${getLineNumClass(
                        row.rightType
                      )}`}
                    >
                      {row.rightContent !== null ? getGutterSymbol(row.rightType) : ''}
                    </td>
                    {/* Right content */}
                    <td
                      className={`px-3 py-0.5 whitespace-pre w-1/2 ${getCellClass(
                        row.rightType
                      )}`}
                    >
                      {row.rightContent !== null ? row.rightContent : (
                        <span className="opacity-0">​</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}