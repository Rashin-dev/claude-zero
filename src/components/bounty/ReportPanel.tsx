import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import {
  generateReport,
  type FindingData,
  type Platform,
  type Severity,
} from "@/lib/reportTemplates";
import { Check, Copy, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "hackerone", label: "HackerOne" },
  { value: "bugcrowd", label: "Bugcrowd" },
  { value: "intigriti", label: "Intigriti" },
];

const PRIORITY: Record<string, string> = {
  critical: "P1",
  high: "P2",
  medium: "P3",
  low: "P4",
};

export function ReportPanel() {
  const profile = useQuery(api.bounty.getProfile);
  const findings = useQuery(api.bounty.listFindings);

  const [platform, setPlatform] = useState<Platform>("hackerone");
  const [findingId, setFindingId] = useState<string>("all");
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [platformInit, setPlatformInit] = useState(false);

  // Prefer the platform saved in the program profile (once, then editable).
  useEffect(() => {
    if (
      profile &&
      !platformInit &&
      PLATFORMS.some((p) => p.value === profile.platform)
    ) {
      setPlatformInit(true);
      setPlatform(profile.platform as Platform);
    }
  }, [profile, platformInit]);

  const selectedPlatform: Platform = platform;

  const handleGenerate = () => {
    if (!findings || findings.length === 0) {
      setReport("No findings yet — add findings in the Findings tab first.");
      return;
    }
    const program = {
      platform: selectedPlatform,
      programName: profile?.programName ?? "",
      scope: profile?.scope ?? "",
      rules: profile?.rules ?? "",
    };
    const data: FindingData[] = findings.map((f) => ({
      ...f,
      severity: f.severity as Severity,
    }));
    setReport(
      generateReport(
        selectedPlatform,
        data,
        program,
        findingId === "all" ? undefined : findingId,
      ),
    );
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-[oklch(0.8_0.11_85)]" />
          <h2 className="text-[15px] font-semibold tracking-tight">
            Generate report
          </h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Platform style
            </label>
            <Select
              value={selectedPlatform}
              onValueChange={(v) => setPlatform(v as Platform)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              What to report
            </label>
            <Select value={findingId} onValueChange={setFindingId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All findings (summary)</SelectItem>
                {(findings ?? []).map((f) => (
                  <SelectItem key={f._id} value={f._id}>
                    {PRIORITY[f.severity] ?? "P?"} · {f.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={handleGenerate} className="gap-1.5">
            <FileText className="size-4" /> Generate report
          </Button>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          Per-finding reports follow each platform's convention (HackerOne:
          weakness + CVSS first; Bugcrowd: P1–P4 priority + structured PoC;
          Intigriti: vulnerability class + evidence-led). The summary is a
          triage document covering all findings.
        </p>
      </section>

      {report && (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-[13px] font-medium">Report preview</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copy}
              className="gap-1.5 text-[12px]"
            >
              {copied ? (
                <Check className="size-3.5 text-[oklch(0.78_0.11_80)]" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[12.5px] leading-relaxed text-[oklch(0.86_0.01_90)]">
            {report}
          </pre>
        </section>
      )}
    </div>
  );
}
