'use client';

import { useState, useEffect } from 'react';
import DiffViewer from './DiffViewer';

interface RegenerateFileButtonProps {
  projectId: string;
  specFile: string;
  spId: string;
  filePath: string;
}

interface RegenerateFileModalProps {
  projectId: string;
  specFile: string;
  spId: string;
  filePath: string;
  onClose: () => void;
}

function RegenerateFileModal({
  projectId,
  specFile,
  spId,
  filePath,
  onClose,
}: RegenerateFileModalProps) {
  const [currentContent, setCurrentContent] = useState<string>('');
  const [newContent, setNewContent] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentContentCollapsed, setCurrentContentCollapsed] = useState(true);
  const filename = filePath.split('/').pop() ?? filePath;

  useEffect(() => {
    async function loadCurrentContent() {
      setIsLoadingCurrent(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`
        );
        if (res.ok) {
          const data = await res.json() as { content: string };
          setCurrentContent(data.content ?? '');
        } else {
          setCurrentContent('');
        }
      } catch {
        setCurrentContent('');
      } finally {
        setIsLoadingCurrent(false);
      }
    }
    void loadCurrentContent();
  }, [projectId, filePath]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setNewContent(null);
    try {
      const res = await fetch('/api/regenerate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          specFile,
          spId,
          filePath,
          instructions: instructions.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? 'Failed to regenerate file');
      }
      const data = await res.json() as { newContent: string };
      setNewContent(data.newContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApply() {
    if (newContent === null) return;
    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: newContent }),
      });
      if (!res.ok) {
        const errData = await res.json() as { error?: string };
        throw new Error(errData.error ?? 'Failed to write file');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-white">
            Regenerate{' '}
            <span className="text-blue-400 font-mono">{filename}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Current file content */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 text-sm font-medium text-gray-300 transition-colors"
              onClick={() => setCurrentContentCollapsed((c) => !c)}
            >
              <span>Current file content</span>
              <svg
                className={`w-4 h-4 transition-transform ${currentContentCollapsed ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {!currentContentCollapsed && (
              <div className="bg-gray-950 p-4">
                {isLoadingCurrent ? (
                  <p className="text-gray-500 text-sm">Loading...</p>
                ) : currentContent ? (
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                    {currentContent}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm italic">File does not exist yet (new file)</p>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Optional instructions{' '}
              <span className="text-gray-500 font-normal">(e.g. &quot;Focus on...&quot;)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Focus on improving error handling..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-vertical"
            />
          </div>

          {/* Generate button */}
          <div>
            <button
              onClick={() => void handleGenerate()}
              disabled={isGenerating || isLoadingCurrent}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:text-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isGenerating && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Diff viewer */}
          {newContent !== null && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Proposed changes</h3>
              <DiffViewer
                filePath={filename}
                existingContent={currentContent}
                newContent={newContent}
                defaultExpanded
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {newContent !== null && (
            <button
              onClick={() => void handleApply()}
              disabled={isApplying}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:text-green-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isApplying && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {isApplying ? 'Applying...' : 'Apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RegenerateFileButton({
  projectId,
  specFile,
  spId,
  filePath,
}: RegenerateFileButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        title="Regenerate this file"
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-600 hover:border-gray-500 rounded transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Regenerate
      </button>
      {modalOpen && (
        <RegenerateFileModal
          projectId={projectId}
          specFile={specFile}
          spId={spId}
          filePath={filePath}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}