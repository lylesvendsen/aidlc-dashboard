"use client";

import React from "react";

export type AssistantMode = "scratch" | "review" | "failure";

interface ModeSelectorProps {
  selected: AssistantMode;
  onSelect: (mode: AssistantMode) => void;
  disabled?: boolean;
}

const MODES: {
  id: AssistantMode;
  label: string;
  subtitle: string;
  icon: string;
  description: string;
}[] = [
  {
    id: "scratch",
    label: "Build from scratch",
    subtitle: "New feature spec",
    icon: "✦",
    description: "Describe a feature in plain English and Claude will interview you to produce a complete spec.",
  },
  {
    id: "review",
    label: "Review existing spec",
    subtitle: "Improve a spec",
    icon: "◎",
    description: "Upload an existing spec and Claude will analyse it for gaps, untestable criteria, and improvements.",
  },
  {
    id: "failure",
    label: "Learn from failure",
    subtitle: "Fix from run logs",
    icon: "⚡",
    description: "Paste a failed execution log and Claude will suggest specific spec improvements to prevent recurrence.",
  },
];

export default function ModeSelector({ selected, onSelect, disabled }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {MODES.map((mode) => {
        const isSelected = selected === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            disabled={disabled}
            className={[
              "flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-150",
              isSelected
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-zinc-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
              disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            ].join(" ")}
            aria-pressed={isSelected}
          >
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-lg text-base",
                isSelected ? "bg-brand-500 text-white" : "bg-zinc-100 text-zinc-500",
              ].join(" ")}
            >
              {mode.icon}
            </span>
            <span
              className={[
                "text-sm font-semibold leading-tight",
                isSelected ? "text-brand-700" : "text-zinc-800",
              ].join(" ")}
            >
              {mode.label}
            </span>
            <span className="text-xs text-zinc-500 leading-snug">{mode.description}</span>
          </button>
        );
      })}
    </div>
  );
}
