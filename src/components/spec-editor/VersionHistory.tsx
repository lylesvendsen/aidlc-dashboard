'use client';

import { useState, useEffect, useCallback } from 'react';
import { VersionMeta } from '@/lib/spec-versions';

interface VersionHistoryProps {
  projectId: string;
  specId: string;
  specPath: string;
  onRestored?: () => void;
}

interface ViewModalState {
  open: boolean;
  versionId: string;
  content: string;
  timestamp: string;
}

interface RestoreConfirmState {
  open: boolean;
  versionId: string;
  timestamp: string;
}

function formatRelativeAge(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function VersionHistory({
  projectId,
  specId,
  specPath,
  onRestored,
}: VersionHistoryProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewModal, setViewModal] = useState<ViewModalState>({
    open: false,
    versionId: '',
    content: '',
    timestamp: '',
  });
  const [viewLoading, setViewLoading] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<RestoreConfirmState>({
    open: false,
    versionId: '',
    timestamp: '',
  });
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId, specId, specPath });
      const res = await fetch(`/api/spec-versions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to load versions');
      }
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [projectId, specId, specPath]);

  useEffect(() => {
    if (!collapsed) {
      void fetchVersions();
    }
  }, [collapsed, fetchVersions]);

  const handleView = async (versionId: string, timestamp: string) => {
    setViewLoading(true);
    setViewModal({ open: true, versionId, content: '', timestamp });
    try {
      const params = new URLSearchParams({ projectId, specId, versionId });
      const res = await fetch(`/api/spec-versions?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to load version content');
      }
      const data = await res.json();
      setViewModal({ open: true, versionId, content: data.content ?? '', timestamp });
    } catch (err) {
      setViewModal({
        open: true,
        versionId,
        content: err instanceof Error ? `Error: ${err.message}` : 'Error loading content',
        timestamp,
      });
    } finally {
      setViewLoading(false);
    }
  };

  const handleRestoreClick = (versionId: string, timestamp: string) => {
    setRestoreConfirm({ open: true, versionId, timestamp });
  };

  const handleRestoreConfirm = async () => {
    const { versionId } = restoreConfirm;
    setRestoring(true);
    try {
      const res = await fetch('/api/spec-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, specId, specPath, versionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to restore version');
      }
      setRestoreConfirm({ open: false, versionId: '', timestamp: '' });
      await fetchVersions();
      onRestored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setRestoreConfirm({ open: false, versionId: '', timestamp: '' });
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreCancel = () => {
    setRestoreConfirm({ open: false, versionId: '', timestamp: '' });
  };

  const handleCloseViewModal = () => {
    setViewModal({ open: false, versionId: '', content: '', timestamp: '' });
  };

  return (
    <div className="border border-gray-700 rounded-lg mt-4">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Version History</span>
          {!collapsed && versions.length > 0 && (
            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              {versions.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-gray-700 px-4 py-3">
          {error && (
            <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Loading versions…</span>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No versions saved yet. Versions are saved automatically on each spec save.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-xs text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-800 mb-2">
                <span>Timestamp</span>
                <span className="text-right">Size</span>
                <span className="text-right">Age</span>
                <span />
                <span />
              </div>
              {versions.map((v) => (
                <div
                  key={v.versionId}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center py-1.5 px-1 rounded hover:bg-gray-800/50 group"
                >
                  <span className="text-xs text-gray-300 font-mono truncate">
                    {formatTimestamp(v.timestamp)}
                  </span>
                  <span className="text-xs text-gray-500 text-right whitespace-nowrap">
                    {formatBytes(v.sizeBytes)}
                  </span>
                  <span className="text-xs text-gray-500 text-right whitespace-nowrap">
                    {formatRelativeAge(v.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleView(v.versionId, v.timestamp)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-0.5 rounded hover:bg-blue-900/20"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestoreClick(v.versionId, v.timestamp)}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors px-2 py-0.5 rounded hover:bg-amber-900/20"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Modal */}
      {viewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">Version Snapshot</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTimestamp(viewModal.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseViewModal}
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {viewLoading ? (
                <div className="flex items-center gap-2 justify-center py-8">
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Loading…</span>
                </div>
              ) : (
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-950 rounded p-3 border border-gray-800">
                  {viewModal.content}
                </pre>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
              <button
                type="button"
                onClick={() => {
                  handleRestoreClick(viewModal.versionId, viewModal.timestamp);
                  handleCloseViewModal();
                }}
                className="text-sm px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors"
              >
                Restore This Version
              </button>
              <button
                type="button"
                onClick={handleCloseViewModal}
                className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {restoreConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md">
            <div className="px-4 py-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-100">Restore Version?</h3>
            </div>
            <div className="px-4 py-4">
              <p className="text-sm text-gray-300">
                This will restore the version from{' '}
                <span className="text-amber-400 font-mono">
                  {formatTimestamp(restoreConfirm.timestamp)}
                </span>
                .
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Your current spec will be saved as a new version before restoring, so you can undo
                this action.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-700">
              <button
                type="button"
                onClick={handleRestoreCancel}
                disabled={restoring}
                className="text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreConfirm()}
                disabled={restoring}
                className="text-sm px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {restoring && (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}