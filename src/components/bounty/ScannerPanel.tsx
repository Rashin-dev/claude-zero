import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { ScanCheck } from "@/convex/bountyScan";
import type { Severity } from "@/lib/reportTemplates";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Radar,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";

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

/** Canned finding templates per scanner check, so a failed check becomes a
 *  structured finding in one click.
 *
 *  Header/hardening checks are tagged `ineligible: true`: HackerOne's core
 *  ineligible list closes them standalone, so they get an explanation note
 *  instead of a one-click promotion. Only checks with real exploit potential
 *  (future additions) promote into Findings. */
const CHECK_TEMPLATES: Record<
  string,
  {
    severity: Severity;
    cwe: string;
    title: string;
    description: string;
    impact: string;
    reproduction: string;
    remediation: string;
    ineligible?: boolean;
    note?: string;
  }
> = {
  "Content-Security-Policy": {
    severity: "medium",
    cwe: "693",
    title: "Missing Content-Security-Policy (CSP) header",
    description:
      "The application does not send a Content-Security-Policy header, so reflected or stored XSS executes without browser-level restrictions.",
    impact:
      "Raises the impact of any XSS: script injection, data theft, and session hijacking become trivially exploitable.",
    reproduction:
      "Passive check: response headers contain no content-security-policy header.",
    remediation:
      "Serve a strict CSP (start with `default-src 'self'`), test it, and include it on all responses.",
    ineligible: true,
    note: "'Content-Security-Policy configuration opinions' are ineligible standalone. Use it only as an amplifier: missing CSP + a confirmed XSS makes that XSS Critical instead of a hard sell.",
  },
  "Strict-Transport-Security": {
    severity: "medium",
    cwe: "319",
    title: "Missing Strict-Transport-Security (HSTS) header",
    description:
      "The application does not send an HSTS header, so browsers will connect over plain HTTP if downgraded.",
    impact:
      "Enables SSL-stripping and protocol-downgrade attacks that can capture credentials and session tokens.",
    reproduction:
      "Passive check: response headers contain no strict-transport-security header.",
    remediation:
      "Add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` and submit the domain to the HSTS preload list.",
    ineligible: true,
    note: "'SSL/TLS configurations' are ineligible standalone. Only relevant if you can demonstrate an actual downgrade/MITM scenario with real impact.",
  },
  "Clickjacking protection": {
    severity: "low",
    cwe: "1021",
    title: "Missing clickjacking protection",
    description:
      "No X-Frame-Options or CSP frame-ancestors directive is set, so the page can be embedded in a third-party frame.",
    impact:
      "An attacker can overlay invisible UI and trick users into performing unintended actions (clickjacking).",
    reproduction:
      "Passive check: no x-frame-options header and no frame-ancestors in CSP.",
    remediation:
      "Set `X-Frame-Options: DENY` (or SAMEORIGIN) and/or `frame-ancestors 'none'` in the CSP.",
    ineligible: true,
    note: "'Clickjacking on pages with no sensitive actions' is ineligible. Report only if the page has sensitive actions (payment, account changes, privilege changes) AND you can build a working PoC.",
  },
  "MIME sniffing protection": {
    severity: "low",
    cwe: "693",
    title: "Missing X-Content-Type-Options: nosniff",
    description:
      "The response does not declare X-Content-Type-Options: nosniff, allowing browsers to sniff and reinterpret file types.",
    impact:
      "Increases the risk of stored XSS via uploaded files that browsers render as HTML/script despite the declared type.",
    reproduction:
      "Passive check: response headers lack x-content-type-options: nosniff.",
    remediation:
      "Serve `X-Content-Type-Options: nosniff` on all responses.",
    ineligible: true,
    note: "'Missing best practices' are ineligible standalone. Only meaningful combined with a real stored-XSS/upload issue.",
  },
  "Referrer-Policy": {
    severity: "low",
    cwe: "200",
    title: "Missing Referrer-Policy header",
    description:
      "No Referrer-Policy is set, so the full URL (including tokens in query strings) may leak in the Referer header to third parties.",
    impact: "Sensitive query-string data (reset tokens, session ids) can leak to external sites.",
    reproduction:
      "Passive check: response headers contain no referrer-policy header.",
    remediation:
      "Set `Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer` for sensitive apps).",
    ineligible: true,
    note: "Optional hardening is ineligible standalone. Only relevant if you can show a token leaking via Referer in a realistic scenario.",
  },
};

export function ScannerPanel() {
  const passiveRecon = useAction(api.bountyScan.passiveRecon);
  const addFinding = useMutation(api.bounty.addFinding);
  const recordScan = useMutation(api.bounty.recordScan);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<ScanCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());

  const run = async () => {
    const target = url.trim();
    if (!target) return;
    setLoading(true);
    setError(null);
    setChecks(null);
    setAdded(new Set());
    try {
      const result = await passiveRecon({ url: target });
      setChecks(result.checks);
      setLastUrl(result.host);
      // Persist for the hunt dashboard (best effort).
      try {
        await recordScan({
          url: target,
          host: result.host,
          failCount: result.checks.filter((c) => c.status === "fail").length,
          warnCount: result.checks.filter((c) => c.status === "warn").length,
          checks: result.checks,
        });
      } catch {
        // dashboard history is best-effort
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  };

  const promote = async (check: ScanCheck) => {
    const template = CHECK_TEMPLATES[check.check];
    if (!template) return;
    try {
      await addFinding({
        title: template.title,
        severity: template.severity,
        cwe: template.cwe,
        description: `${template.description}\n\nEvidence (scan): ${check.detail}`,
        impact: template.impact,
        reproduction: `${template.reproduction}\nTarget: ${lastUrl}`,
        remediation: template.remediation,
      });
      setAdded((prev) => new Set(prev).add(check.check));
      toast.success("Added to findings — edit it in the Findings tab.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add finding");
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
          in the Findings tab, or the scan refuses to run. Header gaps are
          observations, not findings: HackerOne's core ineligible list closes
          them standalone — use them to amplify real vulnerabilities (e.g.
          missing CSP + confirmed XSS).
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
          <Button
            type="button"
            onClick={run}
            disabled={loading || !url.trim()}
            className="shrink-0 gap-1.5"
          >
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
              Results for{" "}
              <span className="font-mono text-[oklch(0.8_0.11_85)]">
                {lastUrl}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              {checks.filter((c) => c.status === "fail").length} fails ·{" "}
              {checks.filter((c) => c.status === "warn").length} warnings
            </p>
          </div>
          <ul className="divide-y divide-border">
            {checks.map((check) => {
              const meta = STATUS_META[check.status];
              const template = CHECK_TEMPLATES[check.check];
              const isAdded = added.has(check.check);
              const canPromote =
                template && (check.status === "fail" || check.status === "warn");
              return (
                <li key={check.check} className="flex gap-3 px-4 py-3">
                  <meta.icon
                    className={cn("mt-0.5 size-4 shrink-0", meta.className)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      {check.check}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {check.detail}
                    </p>
                    {template?.ineligible && (
                      <p className="mt-1.5 max-w-xl rounded-md border border-muted/70 bg-muted/30 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold">H1 ineligible standalone —</span>{" "}
                        {template.note}
                      </p>
                    )}
                  </div>
                  {canPromote && !template?.ineligible && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => promote(check)}
                      disabled={isAdded}
                      className={cn(
                        "shrink-0 gap-1.5 text-[12px]",
                        isAdded &&
                          "border-[oklch(0.72_0.15_150/40%)] text-[oklch(0.72_0.15_150)]",
                      )}
                    >
                      {isAdded ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      {isAdded ? "Added" : "Finding"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
