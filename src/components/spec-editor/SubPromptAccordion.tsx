'use client';

import { useState, useRef, useCallback } from 'react';
import SpecTab from './SpecTab';
import PromptTab from './PromptTab';
import ResponseTab from './ResponseTab';

type TabId = 'spec' | 'prompt' | 'response';

type RunStatus = 'success' | 'error' | 'running' | 'pending' | null;

interface SubPromptAccordionProps {
  projectId: string;
  specFile: string;
  spId: string;
  spName: string;
  spBody: string;
  lastRunStatus?: RunStatus;
  onSave?: (spId: string, newBody: string) => void;
}

function StatusBadge({ status }: { status: RunStatus }) {
  if (!status) return null;

  const config: Record<NonNullable<RunStatus>, { label: string; classes: string }> = {
    success: { label: 'Passed', classes: 'bg-green-900 text-green-300 border border-green-700' },
    error: { label: 'Failed', classes: 'bg-red-900 text-red-300 border border-red-700' },
    running: { label: 'Running', classes: 'bg-blue-900 text-blue-300 border border-blue-700' },
    pending: { label: 'Pending', classes: 'bg-yellow-900 text-yellow-300 border border-yellow-700' },
  };

  const { label, classes } = config[status];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes}`}>
      {label}
    </span>
  );
}

export default function SubPromptAccordion({
  projectId,
  specFile,
  spId,
  spName,
  spBody,
  lastRunStatus = null,
  onSave,
}: SubPromptAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('spec');
  const [isDirty, setIsDirty] = useState(false);
  const scrollPositions = useRef<Record<TabId, number>>({ spec: 0, prompt: 0, response: 0 });
  const tabContentRef = useRef<HTMLDivElement>(null);

  const handleTabSwitch = useCallback(
    (newTab: TabId) => {
      if (tabContentRef.current) {
        scrollPositions.current[activeTab] = tabContentRef.current.scrollTop;
      }
      setActiveTab(newTab);
      requestAnimationFrame(() => {
        if (tabContentRef.current) {
          tabContentRef.current.scrollTop = scrollPositions.current[newTab];
        }
      });
    },
    [activeTab]
  );

  const handleToggleExpand = useCallback(() => {
    if (isExpanded && isDirty) {
      const confirmed = window.confirm(
        `You have unsaved changes in ${spId}. Close anyway and discard changes?`
      );
      if (!confirmed) return;
      setIsDirty(false);
    }
    setIsExpanded((prev) => !prev);
  }, [isExpanded, isDirty, spId]);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const handleSave = useCallback(
    (newBody: string) => {
      setIsDirty(false);
      onSave?.(spId, newBody);
    },
    [spId, onSave]
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'spec', label: 'Spec' },
    { id: 'prompt', label: 'Generated Prompt' },
    { id: 'response', label: 'Last Response' },
  ];

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        aria-expanded={isExpanded}
      >
        {/* SP ID */}
        <span className="font-mono text-sm font-semibold text-blue-400 shrink-0">
          {spId}
        </span>

        {/* SP Name */}
        <span className="flex-1 text-sm font-medium text-gray-200 truncate">
          {spName}
        </span>

        {/* Dirty indicator */}
        {isDirty && (
          <span
            className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          />
        )}

        {/* Status badge */}
        <StatusBadge status={lastRunStatus} />

        {/* Expand/collapse arrow */}
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

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-700">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700 bg-gray-800" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabSwitch(tab.id)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeTab === tab.id
                    ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
                aria-selected={activeTab === tab.id}
                role="tab"
              >
                {tab.label}
                {tab.id === 'spec' && isDirty && (
                  <span
                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400"
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div
            ref={tabContentRef}
            className="overflow-y-auto max-h-[600px]"
            role="tabpanel"
          >
            {activeTab === 'spec' && (
              <SpecTab
                projectId={projectId}
                specFile={specFile}
                spId={spId}
                initialBody={spBody}
                onDirtyChange={handleDirtyChange}
                onSave={handleSave}
              />
            )}
            {activeTab === 'prompt' && (
              <PromptTab
                projectId={projectId}
                specFile={specFile}
                spId={spId}
              />
            )}
            {activeTab === 'response' && (
              <ResponseTab
                projectId={projectId}
                spId={spId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}