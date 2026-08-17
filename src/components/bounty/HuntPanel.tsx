import { api } from "@/convex/_generated/api";
import type { Severity } from "@/lib/reportTemplates";
import { SEVERITY_META } from "@/lib/reportTemplates";
import { cn } from "@/lib/utils";
import { Activity, FileSearch, FileText, Radar, ShieldCheck } from "lucide-react";
import { useQuery } from "convex/react";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  confirmed: "Confirmed",
  false_positive: "False positive",
  duplicate: "Duplicate",
  fixed: "Fixed",
};

const STATUS_CLASS: Record<string, string> = {
  open: "bg-muted text-muted-foreground",
  confirmed: "bg-[oklch(0.78_0.11_80/15%)] text-[oklch(0.78_0.11_80)]",
  false_positive: "bg-destructive/10 text-destructive",
  duplicate: "bg-[oklch(0.66_0.08_285/15%)] text-[oklch(0.75_0.08_285)]",
  fixed: "bg-[oklch(0.72_0.15_150/15%)] text-[oklch(0.72_0.15_150)]",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function HuntPanel() {
  const scans = useQuery(api.bounty.listScans);
  const findings = useQuery(api.bounty.listFindings);

  const findingsList = findings ?? [];
  const scansList = scans ?? [];

  const byStatus = (s: string) =>
    findingsList.filter((f) => (f.status ?? "open") === s).length;

  const severityCounts = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    count: findingsList.filter((f) => f.severity === sev).length,
  }));
  const maxSeverity = Math.max(1, ...severityCounts.map((s) => s.count));

  const pipeline = [
    {
      icon: Radar,
      label: "Scans",
      value: scansList.length,
      detail: `${scansList.reduce((a, s) => a + s.failCount + s.warnCount, 0)} issues flagged`,
    },
    {
      icon: FileSearch,
      label: "Findings open",
      value: byStatus("open"),
      detail: `${findingsList.length} total recorded`,
    },
    {
      icon: ShieldCheck,
      label: "Confirmed",
      value: byStatus("confirmed"),
      detail: "ready to report",
    },
    {
      icon: FileText,
      label: "Fixed",
      value: byStatus("fixed"),
      detail: `${byStatus("false_positive")} false positives filtered`,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-[oklch(0.8_0.11_85)]" />
          <h2 className="text-[15px] font-semibold tracking-tight">
            Hunt dashboard
          </h2>
          <p className="ml-auto text-[11px] text-muted-foreground">
            live · updates as you work
          </p>
        </div>

        {/* Pipeline */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {pipeline.map((stage) => (
            <div
              key={stage.label}
              className="rounded-xl border border-border bg-background/40 p-4"
            >
              <stage.icon className="size-4 text-[oklch(0.8_0.11_85)]" />
              <p className="mt-3 text-2xl font-semibold tracking-tight">
                {stage.value}
              </p>
              <p className="text-[12px] font-medium text-foreground/90">
                {stage.label}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {stage.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Severity breakdown */}
        <div className="mt-5">
          <p className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            Findings by severity
          </p>
          <div className="mt-3 space-y-2.5">
            {severityCounts.map(({ severity, count }) => {
              const meta = SEVERITY_META[severity];
              return (
                <div key={severity} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-[12px] font-medium">
                    {meta.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        severity === "critical" && "bg-destructive",
                        severity === "high" && "bg-[oklch(0.7_0.13_55)]",
                        severity === "medium" && "bg-[oklch(0.78_0.11_80)]",
                        severity === "low" && "bg-muted-foreground/40",
                      )}
                      style={{ width: `${(count / maxSeverity) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-[12px] text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Recent scans */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[13px] font-medium">Recent scans</p>
          </div>
          {scansList.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-muted-foreground">
              No scans yet — run one in the Scan tab.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {scansList.slice(0, 8).map((scan) => (
                <li key={scan._id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[oklch(0.8_0.11_85)]">
                      {scan.host}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(scan.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-2 text-[11px]">
                    <span className="text-destructive">
                      {scan.failCount} fails
                    </span>
                    <span className="text-[oklch(0.78_0.13_55)]">
                      {scan.warnCount} warnings
                    </span>
                    <span className="text-muted-foreground">
                      {scan.checks.length} checks
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent findings */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5">
            <p className="text-[13px] font-medium">Recent findings</p>
          </div>
          {findingsList.length === 0 ? (
            <p className="px-4 py-6 text-[12.5px] text-muted-foreground">
              No findings yet — promote them from the Scan tab or add them in
              Findings.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {findingsList.slice(0, 8).map((finding) => {
                const status = finding.status ?? "open";
                return (
                  <li key={finding._id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          STATUS_CLASS[status] ?? STATUS_CLASS.open,
                        )}
                      >
                        {STATUS_LABELS[status] ?? status}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                        {finding.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {SEVERITY_META[finding.severity as Severity]?.priority ??
                          "P?"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

