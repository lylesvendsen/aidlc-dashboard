'use client';

import { useState, useCallback } from 'react';

interface PromptTabProps {
  projectId: string;
  specFile: string;
  spId: string;
}

interface GeneratedPromptResponse {
  prompt: string;
  estimatedTokens: number;
}

export default function PromptTab({ projectId, specFile, spId }: PromptTabProps) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [estimatedTokens, setEstimatedTokens] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generated-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, specFile, spId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Request failed with status ${response.status}`);
      }

      const data: GeneratedPromptResponse = await response.json();
      setPrompt(data.prompt);
      setEstimatedTokens(data.estimatedTokens);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, specFile, spId]);

  const handleCopy = useCallback(async () => {
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  }, [prompt]);

  const formatTokenCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4 animate-spin"
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
              Generating…
            </span>
          ) : (
            'Generate prompt preview'
          )}
        </button>

        {prompt && !isLoading && (
          <span className="text-xs text-gray-400">
            Prompt generated for{' '}
            <span className="font-mono text-blue-400">{spId}</span>
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
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
      )}

      {/* Prompt output */}
      {prompt && (
        <div className="space-y-3">
          {/* Code block header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Full prompt with context
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {copied ? (
                <>
                  <svg
                    className="w-3.5 h-3.5 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Prompt code block */}
          <div className="relative rounded-md bg-gray-950 border border-gray-700 overflow-hidden">
            <pre className="overflow-x-auto overflow-y-auto max-h-96 p-4 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
              {prompt}
            </pre>
          </div>

          {/* Token count */}
          {estimatedTokens !== null && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg
                className="w-3.5 h-3.5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <span>
                Estimated tokens:{' '}
                <span className="text-gray-300 font-medium">
                  {formatTokenCount(estimatedTokens)}
                </span>{' '}
                {estimatedTokens >= 1000 && (
                  <span className="text-gray-600">
                    (~{Math.ceil(estimatedTokens / 1000)}k)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!prompt && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg
            className="w-10 h-10 text-gray-700 mb-3"
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
          <p className="text-sm text-gray-500">
            Click{' '}
            <span className="text-gray-300 font-medium">Generate prompt preview</span>{' '}
            to build the full prompt with context injection for{' '}
            <span className="font-mono text-blue-400">{spId}</span>.
          </p>
        </div>
      )}
    </div>
  );
}