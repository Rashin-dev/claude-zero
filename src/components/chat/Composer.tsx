import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ComposerProps {
  streaming: boolean;
  busy?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({
  streaming,
  busy = false,
  onSend,
  onStop,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to 8 rows.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    setValue("");
    onSend(text);
  };

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] transition-colors focus-within:border-[oklch(0.8_0.11_85/40%)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={
              streaming
                ? "Mythos is writing…"
                : "Ask Mythos to write, fix, or explain code…"
            }
            className="max-h-[220px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          {streaming ? (
            <Button
              type="button"
              size="icon"
              onClick={onStop}
              className="size-10 shrink-0 rounded-xl"
              aria-label="Stop generating"
            >
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={!value.trim() || busy}
              className="size-10 shrink-0 rounded-xl"
              aria-label="Send message"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Free tier via Gemini ·
          your key stays server-side
        </p>
      </div>
    </div>
  );
}
