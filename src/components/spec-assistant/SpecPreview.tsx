"use client";

import React, { useRef, useState } from "react";

interface SpecPreviewProps {
  content: string;
  onSave: () => void;
}

export default function SpecPreview({ content, onSave }: SpecPreviewProps) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEmpty = content.trim() === "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const lines = content.split("\n");

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand-400" />
          <span className="text-sm font-medium text-zinc-700">Spec Preview</span>
          {!isEmpty && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
              {lines.length} lines
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-800"
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={onSave}
                className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save to Specs
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-50">
            <svg className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-400">Your spec will appear here as we talk</p>
            <p className="mt-1 text-xs text-zinc-300">Claude will generate and update the spec as the conversation progresses</p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="group hover:bg-zinc-50">
                  <td className="select-none border-r border-zinc-100 px-3 py-0 text-right font-mono text-xs text-zinc-300 w-10 align-top leading-5">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-0 font-mono text-xs text-zinc-800 whitespace-pre leading-5">
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
