"use client";

import React, { useState, useEffect, useCallback } from "react";

interface FilesListProps {
  files: string[];
  projectId: string;
}

interface FileModalProps {
  filePath: string;
  projectId: string;
  onClose: () => void;
}

interface FileInfo {
  path: string;
  relativePath: string;
  sizeBytes: number;
  content: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileModal({ filePath, projectId, onClose }: FileModalProps) {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        filePath,
      });
      const res = await fetch(`/api/projects/${projectId}/file-content?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error((data.error as string) || `HTTP ${res.status}`);
      }
      const data = await res.json() as FileInfo;
      setFileInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load file");
    } finally {
      setLoading(false);
    }
  }, [filePath, projectId]);

  useEffect(() => {
    void fetchFile();
  }, [fetchFile]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const displayPath = filePath.split("/").pop() ?? filePath;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      role="dialog"
      aria-modal="true"
      aria-label={`File content: ${displayPath}`}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <div className="flex flex-col">
            <span className="text-sm font-mono text-zinc-200 truncate max-w-xl">
              {filePath}
            </span>
            {fileInfo && (
              <span className="text-xs text-zinc-500 mt-0.5">
                {formatBytes(fileInfo.sizeBytes)}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors p-1 rounded"
            aria-label="Close file viewer"
          >
            ✕
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">
              <span className="animate-spin mr-2">⏳</span> Loading file…
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm font-mono">
              Error: {error}
            </div>
          )}
          {!loading && !error && fileInfo && (
            <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-words">
              {fileInfo.content}
            </pre>
          )}
        </div>

        {/* Modal footer */}
        <div className="border-t border-zinc-700 px-4 py-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function FilesList({ files, projectId }: FilesListProps) {
  const [openFile, setOpenFile] = useState<string | null>(null);

  if (!files || files.length === 0) {
    return (
      <div className="text-zinc-500 text-sm italic px-1">
        No files written by this sub-prompt.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
        Files Written ({files.length})
      </p>
      <div className="border border-zinc-700 rounded overflow-hidden">
        {files.map((filePath, index) => {
          const segments = filePath.replace(/\\/g, "/").split("/");
          const fileName = segments[segments.length - 1] ?? filePath;
          const dirPath = segments.slice(0, -1).join("/");

          return (
            <button
              key={`${filePath}-${index}`}
              type="button"
              onClick={() => setOpenFile(filePath)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-800 transition-colors bg-zinc-900 ${
                index < files.length - 1 ? "border-b border-zinc-700" : ""
              }`}
            >
              <span className="text-blue-400 flex-shrink-0 select-none" aria-hidden>
                📄
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-zinc-200 font-mono text-xs truncate block">
                  {fileName}
                </span>
                {dirPath && (
                  <span className="text-zinc-500 font-mono text-xs truncate block">
                    {dirPath}
                  </span>
                )}
              </span>
              <span className="text-zinc-500 text-xs flex-shrink-0 hover:text-blue-400 transition-colors">
                View
              </span>
            </button>
          );
        })}
      </div>

      {openFile !== null && (
        <FileModal
          filePath={openFile}
          projectId={projectId}
          onClose={() => setOpenFile(null)}
        />
      )}
    </div>
  );
}
