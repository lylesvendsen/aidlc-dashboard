'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

interface PromptOverrideProps {
  spId: string;
  onOverrideChange: (spId: string, override: string, keep: boolean) => void;
  initialOverride?: string;
  initialKeep?: boolean;
}

export default function PromptOverride({
  spId,
  onOverrideChange,
  initialOverride = '',
  initialKeep = false,
}: PromptOverrideProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overrideText, setOverrideText] = useState(initialOverride);
  const [keepForNext, setKeepForNext] = useState(initialKeep);

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value;
      setOverrideText(newText);
      onOverrideChange(spId, newText, keepForNext);
    },
    [spId, keepForNext, onOverrideChange]
  );

  const handleKeepChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newKeep = e.target.checked;
      setKeepForNext(newKeep);
      onOverrideChange(spId, overrideText, newKeep);
    },
    [spId, overrideText, onOverrideChange]
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const hasOverride = overrideText.trim().length > 0;

  return (
    <div className="border border-dashed border-amber-500/40 rounded-lg bg-amber-500/5">
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-left hover:bg-amber-500/10 transition-colors rounded-lg"
        aria-expanded={isExpanded}
      >
        <span className="flex items-center gap-2 font-medium text-amber-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          Add one-time instructions for this run
          {hasOverride && !isExpanded && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
              override active
            </span>
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <textarea
            value={overrideText}
            onChange={handleTextChange}
            placeholder={`Additional context for ${spId} this run only…`}
            rows={4}
            className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-y font-mono"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepForNext}
                onChange={handleKeepChange}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500/50 focus:ring-offset-0 cursor-pointer"
              />
              Keep for next run
            </label>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-800/50 rounded-md px-3 py-2 border border-gray-700/50">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-600" />
            <span>
              These instructions are not saved to the spec file. They are
              appended to the generated prompt for this run only and logged in
              the execution record.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}