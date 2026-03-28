"use client";

import React, { useState } from "react";
import { SpStatus, ValidationResult } from "@/types";

interface ManualFixButtonProps {
  projectId: string;
  spId: string;
  onValidationComplete: (results: ValidationResult[], newStatus: SpStatus) => void;
}

interface ValidateOnlyResponse {
  status: "passed" | "failed";
  validation: ValidationResult[];
  error?: string;
}

export function ManualFixButton({
  projectId,
  spId,
  onValidationComplete,
}: ManualFixButtonProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsValidating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spId }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error((data.error as string) || `HTTP ${res.status}`);
      }

      const data = await res.json() as ValidateOnlyResponse;
      const newStatus: SpStatus = data.status === "passed" ? "passed" : "failed";
      onValidationComplete(data.validation, newStatus);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Validation request failed"
      );
    } finally {
      setIsValidating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isValidating}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
          bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:cursor-not-allowed
          text-white disabled:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        aria-busy={isValidating}
      >
        {isValidating ? (
          <>
            <span
              className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
            Validating…
          </>
        ) : (
          <>
            <span aria-hidden>🔧</span>
            I fixed it manually — re-validate
          </>
        )}
      </button>

      {error !== null && (
        <p className="text-xs text-red-400 font-mono">
          Error: {error}
        </p>
      )}
    </div>
  );
}
