"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ChatMessage, { Message } from "./ChatMessage";
import type { AssistantMode } from "./ModeSelector";

interface AssistantChatProps {
  projectId: string;
  mode: AssistantMode;
  existingSpec?: string;
  logId?: string;
  onSpecUpdate: (spec: string) => void;
  initialised: boolean;
  onInitialised: () => void;
}

type ApiMessage = { role: "user" | "assistant"; content: string };

export default function AssistantChat({
  projectId,
  mode,
  existingSpec,
  logId,
  onSpecUpdate,
  initialised,
  onInitialised,
}: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSpecPill, setShowSpecPill] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const specPillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessages = useCallback(
    async (apiMessages: ApiMessage[]) => {
      if (isStreaming) return;

      // Add streaming assistant placeholder
      const streamId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: streamId, role: "assistant", content: "", isStreaming: true },
      ]);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/spec-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            messages: apiMessages,
            mode,
            existingSpec,
            logId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("Stream failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let accumulatedSpec = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            const raw = part.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const parsed = JSON.parse(raw) as
                | { type: "text"; content: string }
                | { type: "spec"; content: string };

              if (parsed.type === "text") {
                accumulatedText += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamId
                      ? { ...m, content: accumulatedText, isStreaming: true }
                      : m
                  )
                );
              } else if (parsed.type === "spec") {
                accumulatedSpec += parsed.content;
                onSpecUpdate(accumulatedSpec);

                // Show pill
                setShowSpecPill(true);
                if (specPillTimerRef.current) clearTimeout(specPillTimerRef.current);
                specPillTimerRef.current = setTimeout(() => setShowSpecPill(false), 3000);
              }
            } catch {
              // ignore malformed chunk
            }
          }
        }

        // Finalise message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId ? { ...m, content: accumulatedText, isStreaming: false } : m
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, content: "[Cancelled]", isStreaming: false } : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, projectId, mode, existingSpec, logId, onSpecUpdate]
  );

  // Auto-open for scratch mode
  useEffect(() => {
    if (initialised) return;
    if (mode !== "scratch") return;

    onInitialised();
    void sendMessages([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialised]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    const apiMessages: ApiMessage[] = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    void sendMessages(apiMessages);
  }, [input, isStreaming, messages, sendMessages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
              <svg className="h-6 w-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400">
              {mode === "scratch"
                ? "Starting conversation…"
                : mode === "review"
                ? "Describe what you'd like Claude to review in the spec."
                : "Describe the failure you experienced."}
            </p>
          </div>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      {/* Spec pill */}
      <div
        className={[
          "mx-4 mb-0 flex items-center justify-between overflow-hidden transition-all duration-300",
          showSpecPill ? "max-h-10 opacity-100 mb-2" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 rounded-full bg-brand-50 border border-brand-200 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-medium text-brand-600">Spec preview updated ↗</span>
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-zinc-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? "Claude is thinking…" : "Type your message… (Enter to send, Shift+Enter for newline)"}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60 transition"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            {isStreaming ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
