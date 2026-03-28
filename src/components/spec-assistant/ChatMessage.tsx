"use client";

import React from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <pre
          key={`code-${i}`}
          className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100 font-mono"
        >
          {lang && (
            <div className="mb-1 text-zinc-400 text-xs">{lang}</div>
          )}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Heading h3
    if (line.startsWith("### ")) {
      result.push(
        <h3 key={`h3-${i}`} className="mt-3 mb-1 text-sm font-bold text-zinc-800">
          {renderInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Heading h2
    if (line.startsWith("## ")) {
      result.push(
        <h2 key={`h2-${i}`} className="mt-3 mb-1 text-base font-bold text-zinc-800">
          {renderInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading h1
    if (line.startsWith("# ")) {
      result.push(
        <h1 key={`h1-${i}`} className="mt-3 mb-1 text-lg font-bold text-zinc-800">
          {renderInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (line.match(/^[-*] /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listItems.push(
          <li key={i} className="ml-4 list-disc">
            {renderInline(lines[i].slice(2))}
          </li>
        );
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 text-sm">
          {listItems}
        </ul>
      );
      continue;
    }

    // Ordered list item
    if (line.match(/^\d+\. /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        const content = lines[i].replace(/^\d+\. /, "");
        listItems.push(
          <li key={i} className="ml-4 list-decimal">
            {renderInline(content)}
          </li>
        );
        i++;
      }
      result.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5 text-sm">
          {listItems}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      result.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    result.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return result;
}

function renderInline(text: string): React.ReactNode {
  // Split on bold (**text**) and inline code (`code`)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s);
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)$/s);

    const boldIdx = boldMatch ? remaining.indexOf("**") : Infinity;
    const codeIdx = codeMatch ? remaining.indexOf("`") : Infinity;

    if (boldIdx === Infinity && codeIdx === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (boldIdx <= codeIdx && boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
    } else if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={key++} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-700">
          {codeMatch[2]}
        </code>
      );
      remaining = codeMatch[3];
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return <>{parts}</>;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "rounded-tr-sm bg-brand-50 text-zinc-800"
            : "rounded-tl-sm bg-white text-zinc-800 shadow-sm ring-1 ring-zinc-100",
        ].join(" ")}
      >
        {message.isStreaming && message.content === "" ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
          </div>
        ) : isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-sm">{renderMarkdown(message.content)}</div>
        )}
        {message.isStreaming && message.content !== "" && (
          <span className="inline-block h-4 w-0.5 bg-brand-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
