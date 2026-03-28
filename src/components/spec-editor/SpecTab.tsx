'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface SpecTabProps {
  projectId: string;
  specFile: string;
  spId: string;
  initialBody: string;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (newBody: string) => void;
}

interface AcceptanceCriterion {
  id: string;
  text: string;
  checked: boolean;
}

function parseAcceptanceCriteria(body: string): AcceptanceCriterion[] {
  const lines = body.split('\n');
  const criteria: AcceptanceCriterion[] = [];
  let inAcceptanceSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#+\s*acceptance/i.test(trimmed) || /^acceptance:/i.test(trimmed)) {
      inAcceptanceSection = true;
      continue;
    }
    if (inAcceptanceSection) {
      if (/^#+\s/.test(trimmed) && !/^#+\s*acceptance/i.test(trimmed)) {
        inAcceptanceSection = false;
        continue;
      }
      const match = trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)/);
      if (match) {
        const checked = match[1] ? /\[x\]/i.test(match[1]) : false;
        criteria.push({
          id: `criterion-${criteria.length}`,
          text: match[2].trim(),
          checked,
        });
      } else if (trimmed.match(/^\w+-\d+\s+/)) {
        criteria.push({
          id: `criterion-${criteria.length}`,
          text: trimmed,
          checked: false,
        });
      }
    }
  }

  return criteria;
}

function rebuildBodyWithCriteria(
  originalBody: string,
  criteria: AcceptanceCriterion[]
): string {
  const lines = originalBody.split('\n');
  const result: string[] = [];
  let inAcceptanceSection = false;
  let criteriaIndex = 0;
  let acceptanceHeaderFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^#+\s*acceptance/i.test(trimmed) || /^acceptance:/i.test(trimmed)) {
      inAcceptanceSection = true;
      acceptanceHeaderFound = true;
      result.push(line);
      continue;
    }

    if (inAcceptanceSection) {
      if (/^#+\s/.test(trimmed) && !/^#+\s*acceptance/i.test(trimmed)) {
        inAcceptanceSection = false;
        result.push(line);
        continue;
      }

      const isCriterionLine =
        trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)/) ||
        trimmed.match(/^\w+-\d+\s+/);

      if (isCriterionLine) {
        if (criteriaIndex < criteria.length) {
          const criterion = criteria[criteriaIndex];
          const checked = criterion.checked ? '[x]' : '[ ]';
          result.push(`  - ${checked} ${criterion.text}`);
          criteriaIndex++;
        }
        continue;
      }

      result.push(line);
      continue;
    }

    result.push(line);
  }

  if (!acceptanceHeaderFound) {
    return originalBody;
  }

  return result.join('\n');
}

export default function SpecTab({
  projectId,
  specFile,
  spId,
  initialBody,
  onDirtyChange,
  onSave,
}: SpecTabProps) {
  const [body, setBody] = useState(initialBody);
  const [criteria, setCriteria] = useState<AcceptanceCriterion[]>(() =>
    parseAcceptanceCriteria(initialBody)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  const hasCriteria = criteria.length > 0;

  const getBodyWithoutCriteria = useCallback((fullBody: string): string => {
    const lines = fullBody.split('\n');
    const result: string[] = [];
    let inAcceptanceSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (/^#+\s*acceptance/i.test(trimmed) || /^acceptance:/i.test(trimmed)) {
        inAcceptanceSection = true;
        result.push(line);
        continue;
      }

      if (inAcceptanceSection) {
        if (/^#+\s/.test(trimmed) && !/^#+\s*acceptance/i.test(trimmed)) {
          inAcceptanceSection = false;
          result.push(line);
          continue;
        }
        const isCriterionLine =
          trimmed.match(/^[-*]\s+(\[[ xX]\]\s+)?(.+)/) ||
          trimmed.match(/^\w+-\d+\s+/);
        if (isCriterionLine) {
          continue;
        }
        result.push(line);
        continue;
      }

      result.push(line);
    }

    return result.join('\n');
  }, []);

  const markDirty = useCallback(
    (dirty: boolean) => {
      isDirtyRef.current = dirty;
      setIsDirty(dirty);
      onDirtyChange(dirty);
    },
    [onDirtyChange]
  );

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(e.target.value);
      markDirty(true);
      setSaveError(null);
      setSaveSuccess(false);
    },
    [markDirty]
  );

  const handleCriterionToggle = useCallback(
    (id: string) => {
      setCriteria((prev) =>
        prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
      );
      markDirty(true);
      setSaveError(null);
      setSaveSuccess(false);
    },
    [markDirty]
  );

  const handleCriterionTextChange = useCallback(
    (id: string, text: string) => {
      setCriteria((prev) =>
        prev.map((c) => (c.id === id ? { ...c, text } : c))
      );
      markDirty(true);
      setSaveError(null);
      setSaveSuccess(false);
    },
    [markDirty]
  );

  const buildFinalBody = useCallback((): string => {
    if (!hasCriteria) return body;
    return rebuildBodyWithCriteria(body, criteria);
  }, [body, criteria, hasCriteria]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const finalBody = buildFinalBody();

    try {
      const response = await fetch(
        `/api/specs/${encodeURIComponent(projectId)}/save-sp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specFile,
            spId,
            spBody: finalBody,
          }),
        }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      markDirty(false);
      setSaveSuccess(true);
      onSave(finalBody);

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [buildFinalBody, projectId, specFile, spId, markDirty, onSave]);

  useEffect(() => {
    setBody(initialBody);
    setCriteria(parseAcceptanceCriteria(initialBody));
    markDirty(false);
    setSaveError(null);
    setSaveSuccess(false);
  }, [initialBody, markDirty]);

  const displayBody = hasCriteria ? getBodyWithoutCriteria(body) : body;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Main body textarea */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`spec-body-${spId}`}
            className="text-xs font-semibold text-gray-400 uppercase tracking-wide"
          >
            Spec Body
          </label>
          {isDirty && (
            <span
              className="w-2 h-2 rounded-full bg-yellow-400 shrink-0"
              title="Unsaved changes"
              aria-label="Unsaved changes"
            />
          )}
        </div>
        <textarea
          id={`spec-body-${spId}`}
          value={displayBody}
          onChange={handleBodyChange}
          rows={12}
          className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-600"
          placeholder="Sub-prompt spec body..."
          spellCheck={false}
        />
      </div>

      {/* Acceptance criteria checklist */}
      {hasCriteria && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Acceptance Criteria
          </span>
          <div className="flex flex-col gap-1 bg-gray-800 border border-gray-600 rounded-md p-3">
            {criteria.map((criterion) => (
              <div
                key={criterion.id}
                className="flex items-start gap-2 group"
              >
                <input
                  type="checkbox"
                  id={`${spId}-${criterion.id}`}
                  checked={criterion.checked}
                  onChange={() => handleCriterionToggle(criterion.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 shrink-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={criterion.text}
                  onChange={(e) =>
                    handleCriterionTextChange(criterion.id, e.target.value)
                  }
                  className={`flex-1 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 ${
                    criterion.checked
                      ? 'line-through text-gray-500'
                      : 'text-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        >
          {isSaving ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
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
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            'Save'
          )}
        </button>

        {saveSuccess && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Saved
          </span>
        )}

        {saveError && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <svg
              className="w-4 h-4"
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
            {saveError}
          </span>
        )}

        <div className="flex-1" />

        {isDirty && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span
              className="w-1.5 h-1.5 rounded-full bg-yellow-400"
              aria-hidden="true"
            />
            Unsaved changes
          </span>
        )}

        <span className="text-xs text-gray-500 font-mono">{spId}</span>
      </div>
    </div>
  );
}