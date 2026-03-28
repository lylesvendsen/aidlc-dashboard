'use client';

import React, { useState } from 'react';
import DiffViewer from './DiffViewer';

interface PendingFile {
  path: string;
  newContent: string;
  existingContent: string;
}

interface FileApprovalModalProps {
  executionId: string;
  spId: string;
  files: PendingFile[];
  onApply: (selectedFiles: PendingFile[]) => void;
  onCancel: () => void;
}

function getStatus(file: PendingFile): 'new' | 'modified' {
  return file.existingContent === '' ? 'new' : 'modified';
}

function getSizeDiff(file: PendingFile): string {
  const oldSize = new Blob([file.existingContent]).size;
  const newSize = new Blob([file.newContent]).size;
  const diff = newSize - oldSize;
  if (diff === 0) return '±0 B';
  const sign = diff > 0 ? '+' : '';
  if (Math.abs(diff) < 1024) return `${sign}${diff} B`;
  const kb = diff / 1024;
  return `${sign}${kb.toFixed(1)} KB`;
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
}

export default function FileApprovalModal({
  executionId,
  spId,
  files,
  onApply,
  onCancel,
}: FileApprovalModalProps) {
  const [checkedFiles, setCheckedFiles] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const f of files) {
        initial[f.path] = true;
      }
      return initial;
    }
  );

  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const f of files) {
        initial[f.path] = false;
      }
      return initial;
    }
  );

  const toggleCheck = (filePath: string) => {
    setCheckedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const toggleExpand = (filePath: string) => {
    setExpandedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const f of files) next[f.path] = true;
    setCheckedFiles(next);
  };

  const selectNone = () => {
    const next: Record<string, boolean> = {};
    for (const f of files) next[f.path] = false;
    setCheckedFiles(next);
  };

  const handleApply = () => {
    const selected = files.filter((f) => checkedFiles[f.path]);
    onApply(selected);
  };

  const selectedCount = Object.values(checkedFiles).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Review changes for {spId}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Execution ID: <span className="font-mono text-gray-300">{executionId}</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subheader / select controls */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 bg-gray-800/50 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{files.length} file{files.length !== 1 ? 's' : ''} proposed</span>
            <span>·</span>
            <span>{selectedCount} selected</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={selectAll}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Select all
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={selectNone}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              Select none
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 px-6 py-2 border-b border-gray-700 bg-gray-800/30 shrink-0">
          <div className="col-span-1" />
          <div className="col-span-6 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Path
          </div>
          <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Status
          </div>
          <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Size diff
          </div>
          <div className="col-span-1" />
        </div>

        {/* File list */}
        <div className="overflow-y-auto flex-1">
          {files.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              No files proposed in this response.
            </div>
          ) : (
            <ul className="divide-y divide-gray-700/50">
              {files.map((file) => {
                const status = getStatus(file);
                const sizeDiff = getSizeDiff(file);
                const isChecked = checkedFiles[file.path] ?? true;
                const isExpanded = expandedFiles[file.path] ?? false;

                return (
                  <li key={file.path} className="bg-gray-900">
                    {/* File row */}
                    <div
                      className="grid grid-cols-12 gap-2 px-6 py-3 items-center hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Checkbox */}
                      <div className="col-span-1 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(file.path)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 cursor-pointer focus:ring-blue-500 focus:ring-offset-gray-900"
                        />
                      </div>

                      {/* Path */}
                      <div className="col-span-6 min-w-0">
                        <button
                          onClick={() => toggleExpand(file.path)}
                          className="flex items-center gap-2 text-left w-full group"
                        >
                          <svg
                            className={`w-3.5 h-3.5 text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-mono text-xs text-gray-200 truncate group-hover:text-white transition-colors">
                            {file.path}
                          </span>
                        </button>
                        <p className="text-xs text-gray-500 mt-0.5 ml-5 font-mono truncate">
                          {getFileName(file.path)}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="col-span-2">
                        {status === 'new' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/40 text-green-400 border border-green-800/50">
                            New file
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/40 text-yellow-400 border border-yellow-800/50">
                            Modified
                          </span>
                        )}
                      </div>

                      {/* Size diff */}
                      <div className="col-span-2">
                        <span
                          className={`text-xs font-mono ${
                            sizeDiff.startsWith('+')
                              ? 'text-green-400'
                              : sizeDiff.startsWith('-')
                              ? 'text-red-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {sizeDiff}
                        </span>
                      </div>

                      {/* Expand toggle */}
                      <div className="col-span-1 flex justify-end">
                        <button
                          onClick={() => toggleExpand(file.path)}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Diff'}
                        </button>
                      </div>
                    </div>

                    {/* Diff viewer */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-950/50 border-t border-gray-700/50">
                        <DiffViewer
                          existingContent={file.existingContent}
                          newContent={file.newContent}
                          filePath={file.path}
                          collapsible={false}
                          defaultExpanded={true}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/30 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {selectedCount === 0 && (
              <span className="text-xs text-yellow-400">
                No files selected — nothing will be written.
              </span>
            )}
            <button
              onClick={handleApply}
              disabled={selectedCount === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Apply Selected ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}