"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SaveSpecModalProps {
  specContent: string;
  projectId: string;
  specDir: string;
  onClose: () => void;
}

function deriveFilename(content: string): string {
  // Try to extract spec ID from content like "# B2 - Title" or "# SP-01: Title"
  const idMatch = content.match(/^#\s+([A-Za-z][A-Za-z0-9-]*(?:-[A-Za-z0-9]+)*)\s*[-:]/m);
  const titleMatch = content.match(/^#\s+[^\n]+[-:]\s*([^\n]+)/m);

  let base = "new-spec";
  if (idMatch) {
    const id = idMatch[1].toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (titleMatch) {
      const title = titleMatch[1]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40)
        .replace(/-$/, "");
      base = `${id}-${title}`;
    } else {
      base = id;
    }
  } else if (titleMatch) {
    const title = titleMatch[1]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50)
      .replace(/-$/, "");
    base = title || "new-spec";
  }
  return `${base}.md`;
}

export default function SaveSpecModal({
  specContent,
  projectId,
  specDir,
  onClose,
}: SaveSpecModalProps) {
  const router = useRouter();
  const [filename, setFilename] = useState(() => deriveFilename(specContent));
  const [existingFiles, setExistingFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing spec files in the specDir
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/specs?projectId=${encodeURIComponent(projectId)}`);
        if (res.ok) {
          const data = (await res.json()) as { specs: { filename: string }[] };
          setExistingFiles(data.specs.map((s) => s.filename));
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, [projectId]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const normalizedFilename = filename.trim().endsWith(".md")
    ? filename.trim()
    : `${filename.trim()}.md`;

  const conflictExists = existingFiles.includes(normalizedFilename);
  const targetPath = `${specDir}/${normalizedFilename}`;

  const handleSave = async () => {
    if (!normalizedFilename || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: normalizedFilename,
          content: specContent,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      setSaved(true);
      setToast({ message: `Saved as ${normalizedFilename}`, type: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      setToast({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const specId = normalizedFilename.replace(/\.md$/, "");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <h2 id="save-modal-title" className="text-base font-semibold text-zinc-900">
              Save Spec
            </h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">
            {saved ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800">Spec saved successfully</p>
                    <p className="text-xs text-green-600 font-mono mt-0.5">{targetPath}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/projects/${projectId}/run?specId=${encodeURIComponent(specId)}`)}
                    className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition text-center"
                  >
                    Run this spec →
                  </button>
                  <button
                    onClick={() => router.push(`/projects/${projectId}/specs/${encodeURIComponent(specId)}`)}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition text-center"
                  >
                    Edit spec →
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                {/* Filename input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-700" htmlFor="spec-filename">
                    Filename
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      id="spec-filename"
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm text-zinc-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      placeholder="my-feature-spec.md"
                    />
                  </div>
                </div>

                {/* Target path */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-zinc-700">Target path</p>
                  <div className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="font-mono text-xs text-zinc-500 break-all">{targetPath}</p>
                  </div>
                </div>

                {/* Conflict warning */}
                {conflictExists && (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-sm text-amber-700">
                      A file named <span className="font-mono font-medium">{normalizedFilename}</span> already exists in the specs directory. Saving will overwrite it.
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving || !normalizedFilename.trim()}
                    className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {saving ? "Saving…" : conflictExists ? "Overwrite & Save" : "Confirm Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-lg ring-1",
            toast.type === "success"
              ? "bg-green-600 text-white ring-green-700"
              : "bg-red-600 text-white ring-red-700",
          ].join(" ")}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-white/70 hover:text-white transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
