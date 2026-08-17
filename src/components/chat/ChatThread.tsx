import type { Doc } from "@/convex/_generated/dataModel";
import { Code2, KeyRound, MessageSquare, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Markdown } from "./Markdown";

const SUGGESTIONS = [
  {
    icon: Code2,
    label: "Write a script",
    prompt:
      "Write a Python script that batch-resizes all images in a folder to a max width of 1280px.",
  },
  {
    icon: MessageSquare,
    label: "Explain a concept",
    prompt:
      "Explain the difference between interfaces and type aliases in TypeScript, with a small example of each.",
  },
  {
    icon: Wand2,
    label: "Build something",
    prompt:
      "Build a tiny REST API with Express and SQLite: endpoints for creating and listing notes, with a schema.",
  },
  {
    icon: KeyRound,
    label: "Fix a problem",
    prompt:
      "Give me a robust regex in JavaScript for validating email addresses, and explain its parts.",
  },
];

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-[oklch(0.8_0.11_85)]"
          style={{ animation: `mythos-blink 1s steps(1) ${i * 0.18}s infinite` }}
        />
      ))}
    </span>
  );
}

function MessageItem({
  message,
  isStreaming,
}: {
  message: Doc<"messages">;
  isStreaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5 text-[14.5px] leading-relaxed text-secondary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const showThinking = isStreaming && message.content.length === 0;

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-[oklch(0.8_0.11_85/35%)] bg-[oklch(0.8_0.11_85/10%)]">
        <Sparkles className="size-3.5 text-[oklch(0.8_0.11_85)]" />
      </div>
      <div className="min-w-0 flex-1">
        {message.error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive">
            {message.error}
          </div>
        ) : showThinking ? (
          <ThinkingDots />
        ) : message.content ? (
          <>
            <Markdown content={message.content} />
            {isStreaming && <span className="mythos-caret" />}
          </>
        ) : null}
        {message.model && !message.error && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {message.model}
          </p>
        )}
      </div>
    </div>
  );
}

interface ChatThreadProps {
  messages: Doc<"messages">[] | undefined;
  onSend: (prompt: string) => void;
}

export function ChatThread({ messages, onSend }: ChatThreadProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const streaming =
    messages?.some((m) => m.streaming === true) ?? false;
  const list = messages ?? [];

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [list, streaming]);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        stickToBottom.current =
          el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      }}
      className="flex-1 overflow-y-auto"
    >
      {list.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-[oklch(0.8_0.11_85/30%)] bg-[oklch(0.8_0.11_85/8%)]">
            <Sparkles className="size-5 text-[oklch(0.8_0.11_85)]" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">
            What are we building?
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Ask for a script, a full file, a refactor, or an explanation.
            Answers stream in fast — free tier, no credit card.
          </p>
          <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => onSend(suggestion.prompt)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-[oklch(0.8_0.11_85/40%)] hover:bg-muted/40"
              >
                <suggestion.icon className="mt-0.5 size-4 shrink-0 text-[oklch(0.8_0.11_85)]" />
                <div>
                  <p className="text-sm font-medium">{suggestion.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {suggestion.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {list.map((message) => (
            <MessageItem
              key={message._id}
              message={message}
              isStreaming={message.streaming === true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
