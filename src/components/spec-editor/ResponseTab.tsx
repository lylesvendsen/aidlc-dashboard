'use client';

import { useState, useCallback } from 'react';

interface ResponseTabProps {
  projectId: string;
  spId: string;
}

interface FileEntry {
  path: string;
  content: string;
}

interface ClaudeResponse {
  files?: FileEntry[];
  commands?: string[];
  notes?: string;
  [key: string]: unknown;
}

interface ExecutionLog {
  spId?: string;
  response?: ClaudeResponse;
  rawResponse?: unknown;
  timestamp?: string;
}

function FileContentViewer({ file }: { file: FileEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      >
        <span className="font-mono text-xs text-blue-300 truncate">{file.path}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="bg-gray-950 border-t border-gray-700">
          <pre className="overflow-x-auto overflow-y-auto max-h-64 p-3 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {file.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function FilesSection({ files }: { files: FileEntry[] }) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No files in this response.</p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file, index) => (
        <FileContentViewer key={`${file.path}-${index}`} file={file} />
      ))}
    </div>
  );
}

function CommandsSection({ commands }: { commands: string[] }) {
  if (commands.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No commands in this response.</p>
    );
  }

  return (
    <div className="space-y-1">
      {commands.map((cmd, index) => (
        <div
          key={index}
          className="flex items-start gap-2 px-3 py-2 bg-gray-800 rounded-md border border-gray-700"
        >
          <span className="text-green-400 font-mono text-xs mt-0.5 shrink-0">$</span>
          <span className="font-mono text-xs text-gray-200 break-all">{cmd}</span>
        </div>
      ))}
    </div>
  );
}

function NotesSection({ notes }: { notes: string }) {
  return (
    <div className="p-3 bg-gray-800 rounded-md border border-gray-700">
      <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{notes}</p>
    </div>
  );
}

function RawJsonViewer({ data }: { data: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      >
        <span className="text-xs font-medium text-gray-400">
          {isExpanded ? 'Hide' : 'Show'} raw JSON response
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && (
        <div className="bg-gray-950 border-t border-gray-700">
          <pre className="overflow-x-auto overflow-y-auto max-h-96 p-4 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

type SectionId = 'files' | 'commands' | 'notes';

export default function ResponseTab({ projectId, spId }: ResponseTabProps) {
  const [log, setLog] = useState<ExecutionLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('files');

  const loadLastResponse = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/logs?projectId=${encodeURIComponent(projectId)}&spId=${encodeURIComponent(spId)}&latest=true`
      );

      if (response.status === 404) {
        setLog(null);
        setHasLoaded(true);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            `Request failed with status ${response.status}`
        );
      }

      const data: ExecutionLog = await response.json();
      setLog(data);
      setHasLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load response');
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, spId]);

  const handleLoadClick = useCallback(() => {
    loadLastResponse();
  }, [loadLastResponse]);

  const sections: { id: SectionId; label: string }[] = [
    { id: 'files', label: 'Files' },
    { id: 'commands', label: 'Commands' },
    { id: 'notes', label: 'Notes' },
  ];

  const claudeResponse = log?.response ?? null;
  const files: FileEntry[] = claudeResponse?.files ?? [];
  const commands: string[] = claudeResponse?.commands ?? [];
  const notes: string = claudeResponse?.notes ?? '';

  if (!hasLoaded && !isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-400">
          Load the last Claude response for{' '}
          <span className="font-mono text-blue-400">{spId}</span>.
        </p>
        <button
          type="button"
          onClick={handleLoadClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          Load last response
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center gap-3">
        <svg
          className="w-5 h-5 animate-spin text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm text-gray-400">Loading last response…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 p-3 bg-red-900/40 border border-red-700 rounded-md">
          <svg
            className="w-4 h-4 text-red-400 mt-0.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-sm text-red-300">{error}</p>
        </div>
        <button
          type="button"
          onClick={handleLoadClick}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!log || !claudeResponse) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
        <svg
          className="w-10 h-10 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm text-gray-400 font-medium">
          This SP has not been run yet
        </p>
        <p className="text-xs text-gray-600">
          Run this sub-prompt to see the last Claude response here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-0">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded-t-md ${
              activeSection === section.id
                ? 'text-blue-400 border-b-2 border-blue-400 -mb-px bg-gray-900'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            role="tab"
            aria-selected={activeSection === section.id}
          >
            {section.label}
            {section.id === 'files' && files.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                {files.length}
              </span>
            )}
            {section.id === 'commands' && commands.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                {commands.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Section content */}
      <div role="tabpanel">
        {activeSection === 'files' && <FilesSection files={files} />}
        {activeSection === 'commands' && <CommandsSection commands={commands} />}
        {activeSection === 'notes' && (
          notes ? (
            <NotesSection notes={notes} />
          ) : (
            <p className="text-sm text-gray-500 italic">No notes in this response.</p>
          )
        )}
      </div>

      {/* Raw JSON toggle */}
      <div className="pt-2 border-t border-gray-800">
        <RawJsonViewer data={log.rawResponse ?? claudeResponse} />
      </div>

      {/* Reload button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleLoadClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reload
        </button>
      </div>
    </div>
  );
}