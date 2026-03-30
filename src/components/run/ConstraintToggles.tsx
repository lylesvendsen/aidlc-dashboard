'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

export interface ActiveConstraints {
  constraints: string[];
  validation: string[];
}

interface ValidationToggle {
  id: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_VALIDATION_TOGGLES: Omit<ValidationToggle, 'enabled'>[] = [
  { id: 'typecheck', label: 'Run typecheck after each SP' },
  { id: 'lint', label: 'Run lint after each SP' },
  { id: 'test', label: 'Run test after each SP' },
  { id: 'build', label: 'Run build after full unit' },
];

interface ConstraintTogglesProps {
  constraints: string[];
  validationCmds: string[];
  onChange: (active: ActiveConstraints) => void;
  runStarted?: boolean;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

export default function ConstraintToggles({
  constraints,
  validationCmds,
  onChange,
  runStarted,
}: ConstraintTogglesProps) {
  const [expanded, setExpanded] = useState(false);

  const [constraintStates, setConstraintStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    constraints.forEach((c) => {
      initial[c] = true;
    });
    return initial;
  });

  const [validationStates, setValidationStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_VALIDATION_TOGGLES.forEach((t) => {
      initial[t.id] = true;
    });
    return initial;
  });

  const resetAll = useCallback(() => {
    const cReset: Record<string, boolean> = {};
    constraints.forEach((c) => {
      cReset[c] = true;
    });
    setConstraintStates(cReset);

    const vReset: Record<string, boolean> = {};
    DEFAULT_VALIDATION_TOGGLES.forEach((t) => {
      vReset[t.id] = true;
    });
    setValidationStates(vReset);
  }, [constraints]);

  useEffect(() => {
    if (runStarted) {
      resetAll();
    }
  }, [runStarted, resetAll]);

  useEffect(() => {
    const activeConstraints = constraints.filter((c) => constraintStates[c] !== false);
    const activeValidation = validationCmds.filter((cmd) => {
      const toggle = DEFAULT_VALIDATION_TOGGLES.find((t) =>
        cmd.toLowerCase().includes(t.id)
      );
      if (!toggle) return true;
      return validationStates[toggle.id] !== false;
    });
    onChange({ constraints: activeConstraints, validation: activeValidation });
  }, [constraintStates, validationStates, constraints, validationCmds, onChange]);

  const disabledConstraintCount = constraints.filter(
    (c) => constraintStates[c] === false
  ).length;

  const disabledValidationCount = DEFAULT_VALIDATION_TOGGLES.filter(
    (t) => validationStates[t.id] === false
  ).length;

  const totalDisabled = disabledConstraintCount + disabledValidationCount;
  const anyDisabled = totalDisabled > 0;

  const headerLabel = anyDisabled
    ? `Constraints (${totalDisabled} disabled)`
    : 'Constraints (all active)';

  const handleConstraintToggle = (constraint: string) => {
    setConstraintStates((prev) => ({
      ...prev,
      [constraint]: !prev[constraint],
    }));
  };

  const handleValidationToggle = (id: string) => {
    setValidationStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          )}
          {headerLabel}
        </span>
        {anyDisabled && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {totalDisabled} off
          </span>
        )}
      </button>

      {expanded && (
        <div className="bg-white divide-y divide-gray-100">
          {anyDisabled && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-700">
                Some constraints are disabled for this run
              </span>
            </div>
          )}

          {constraints.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Project Constraints
              </p>
              <ul className="space-y-2">
                {constraints.map((constraint) => {
                  const enabled = constraintStates[constraint] !== false;
                  return (
                    <li key={constraint} className="flex items-center gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => handleConstraintToggle(constraint)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                          enabled
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-zinc-600 border-zinc-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span
                        title={constraint}
                        className={`text-sm leading-snug ${
                          enabled ? 'text-gray-900' : 'text-gray-400 line-through'
                        }`}
                      >
                        {truncate(constraint, 60)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Validation Commands
            </p>
            <ul className="space-y-2">
              {DEFAULT_VALIDATION_TOGGLES.map((toggle) => {
                const enabled = validationStates[toggle.id] !== false;
                return (
                  <li key={toggle.id} className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => handleValidationToggle(toggle.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                        enabled
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-zinc-600 border-zinc-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span
                      className={`text-sm ${
                        enabled ? 'text-gray-900' : 'text-gray-400 line-through'
                      }`}
                    >
                      {toggle.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}