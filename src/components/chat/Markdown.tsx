import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-border bg-[oklch(0.105_0.004_285)]">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
            copied
              ? "text-[oklch(0.78_0.11_80)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[oklch(0.86_0.01_90)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="mythos-md text-[14.5px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, node: _node, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock =
              match !== null || String(children).includes("\n");
            if (isBlock) {
              return (
                <CodeBlock
                  language={match?.[1] ?? ""}
                  code={String(children).replace(/\n$/, "")}
                />
              );
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-[oklch(0.88_0.02_90)]"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Fenced blocks are fully handled by CodeBlock above; avoid the
          // default <pre> wrapper around them.
          pre({ children }) {
            return <>{children}</>;
          },
          p({ children }) {
            return <p className="my-3 first:mt-0 last:mb-0">{children}</p>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[oklch(0.8_0.11_85)] underline underline-offset-2 transition-colors hover:text-[oklch(0.9_0.11_85)]"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
