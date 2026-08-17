import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { ScanCheck } from "@/convex/bountyScan";
import { cn } from "@/lib/utils";
import { CheckCircle2, Info, Loader2, Radar, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";

const STATUS_META: Record<
  ScanCheck["status"],
  { icon: typeof Info; label: string; className: string }
> = {
  pass: {
    icon: CheckCircle2,
    label: "Pass",
    className: "text-[oklch(0.72_0.15_150)]",
  },
  warn: {
    icon: ShieldAlert,
    label: "Warn",
    className: "text-[oklch(0.78_0.13_55)]",
  },
  fail: {
    icon: XCircle,
    label: "Fail",
    className: "text-[oklch(0.72_0.18_25)]",
  },
  info: {
    icon: Info,
    label: "Info",
    className: "text-muted-foreground",
  },
};

export function ScannerPanel() {
  const passiveRecon = useAction(api.bountyScan.passiveRecon);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<ScanCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState("");

  const run = async () => {
    const target = url.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    setChecks(null);
    try {
      const result = await passiveRecon({ url: target });
      setChecks(result.checks);
      setLastUrl(result.host);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Radar className="size-4 text-[oklch(0.8_0.11_85)]" />
          <h2 className="text-[15px] font-semibold tracking-tight">
            Passive scan
          </h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Fingerprints a target with read-only checks: security headers,
          robots.txt, sitemap. A handful of single requests — nothing that
          looks like an attack. The target must be inside the scope you saved
          in the Findings tab, or the scan refuses to run.
        </p>
        <div className="mt-4 flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://in-scope-target.example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
          />
          <Button type="button" onClick={run} disabled={loading || !url.trim()} className="shrink-0 gap-1.5">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radar className="size-4" />
            )}
            Scan
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </section>

      {checks && (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[13px] font-medium">
              Results for <span className="font-mono text-[oklch(0.8_0.11_85)]">{lastUrl}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {checks.filter((c) => c.status === "fail").length} fails ·{" "}
              {checks.filter((c) => c.status === "warn").length} warnings
            </p>
          </div>
          <ul className="divide-y divide-border">
            {checks.map((check) => {
              const meta = STATUS_META[check.status];
              return (
                <li key={check.check} className="flex gap-3 px-4 py-3">
                  <meta.icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {check.check}
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.className, "bg-current/10")}>
                        {meta.label}
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {check.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
