'use client';

import { useState, useCallback } from 'react';

interface DependencyAnnotatorProps {
  spId: string;
  specContent: string;
  onUpdate: (updatedContent: string) => void;
}

function parseDependenciesFromContent(specContent: string, spId: string): string[] {
  const lines = specContent.split('\n');
  const normalizedId = spId.toUpperCase().replace(/^SP-?/, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^###\s+SP-(\w+):/i);
    if (headingMatch) {
      const headingId = headingMatch[1].toUpperCase();
      if (headingId === normalizedId) {
        if (i > 0) {
          const prevLine = lines[i - 1];
          const dependsMatch = prevLine.match(/^<!--\s*sp-depends:\s*(.*?)\s*-->$/);
          if (dependsMatch) {
            const raw = dependsMatch[1].trim();
            if (!raw) return [];
            return raw.split(',').map((p) => p.trim()).filter(Boolean);
          }
        }
        return [];
      }
    }
  }
  return [];
}

function updateDependenciesInContent(
  specContent: string,
  spId: string,
  paths: string[]
): string {
  const lines = specContent.split('\n');
  const normalizedId = spId.toUpperCase().replace(/^SP-?/, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^###\s+SP-(\w+):/i);
    if (headingMatch) {
      const headingId = headingMatch[1].toUpperCase();
      if (headingId === normalizedId) {
        const commentLine =
          paths.length > 0
            ? `<!-- sp-depends: ${paths.join(', ')} -->`
            : null;

        const prevLine = i > 0 ? lines[i - 1] : null;
        const prevIsDependsComment =
          prevLine !== null &&
          /^<!--\s*sp-depends:.*-->$/.test(prevLine);

        if (prevIsDependsComment) {
          if (commentLine !== null) {
            lines[i - 1] = commentLine;
          } else {
            lines.splice(i - 1, 1);
          }
        } else {
          if (commentLine !== null) {
            lines.splice(i, 0, commentLine);
          }
        }

        return lines.join('\n');
      }
    }
  }

  return specContent;
}

export default function DependencyAnnotator({
  spId,
  specContent,
  onUpdate,
}: DependencyAnnotatorProps) {
  const existingPaths = parseDependenciesFromContent(specContent, spId);

  const [paths, setPaths] = useState<string[]>(existingPaths);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please enter a file path.');
      return;
    }
    if (paths.includes(trimmed)) {
      setError('This path is already in the list.');
      return;
    }
    setError(null);
    const newPaths = [...paths, trimmed];
    setPaths(newPaths);
    setInputValue('');
    const updated = updateDependenciesInContent(specContent, spId, newPaths);
    onUpdate(updated);
  }, [inputValue, paths, specContent, spId, onUpdate]);

  const handleRemove = useCallback(
    (index: number) => {
      const newPaths = paths.filter((_, i) => i !== index);
      setPaths(newPaths);
      const updated = updateDependenciesInContent(specContent, spId, newPaths);
      onUpdate(updated);
    },
    [paths, specContent, spId, onUpdate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="mb-3 text-sm font-medium text-gray-700">
        Files this SP requires to already exist
      </p>

      {paths.length > 0 && (
        <ul className="mb-3 space-y-1">
          {paths.map((filePath, index) => (
            <li
              key={`${filePath}-${index}`}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-1.5"
            >
              <span className="font-mono text-xs text-gray-700 break-all">
                {filePath}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-3 flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                aria-label={`Remove ${filePath}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {paths.length === 0 && (
        <p className="mb-3 text-xs text-gray-400 italic">
          No dependencies specified.
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. apps/web/src/lib/firebase.ts"
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-mono text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="flex-shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
        >
          Add
        </button>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      {paths.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Saved as{' '}
          <code className="font-mono">
            {'<!-- sp-depends: '}
            {paths.join(', ')}
            {' -->'}
          </code>{' '}
          in spec file.
        </p>
      )}
    </div>
  );
}

export { parseDependenciesFromContent, updateDependenciesInContent };