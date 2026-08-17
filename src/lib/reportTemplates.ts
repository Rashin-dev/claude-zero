export type Severity = "critical" | "high" | "medium" | "low";
export type Platform = "hackerone" | "bugcrowd" | "intigriti";

export interface FindingData {
  _id: string;
  title: string;
  severity: Severity;
  cwe: string;
  cvss?: string;
  description: string;
  impact: string;
  reproduction: string;
  remediation: string;
}

export interface ProgramData {
  platform: string;
  programName: string;
  scope: string;
  rules: string;
}

export const SEVERITY_META: Record<
  Severity,
  { label: string; priority: string; cvssRange: string }
> = {
  critical: { label: "Critical", priority: "P1", cvssRange: "9.0 – 10.0" },
  high: { label: "High", priority: "P2", cvssRange: "7.0 – 8.9" },
  medium: { label: "Medium", priority: "P3", cvssRange: "4.0 – 6.9" },
  low: { label: "Low", priority: "P4", cvssRange: "0.1 – 3.9" },
};

const w = (s: string) => (s?.trim() ? s.trim() : "—");
const cweId = (cwe: string) => w(cwe).replace(/^CWE-?/i, "");

/** HackerOne style: one vulnerability per report, weakness + CVSS upfront. */
export function hackeroneReport(f: FindingData, p: ProgramData): string {
  const sev = SEVERITY_META[f.severity];
  return `# ${w(f.title)}

**Weakness:** CWE-${cweId(f.cwe)}
**Severity:** ${sev.label} (${sev.priority}) — CVSS ${f.cvss?.trim() || sev.cvssRange}
**Program:** ${w(p.programName)} | **Platform:** HackerOne

## Summary
${w(f.description)}

## Impact
${w(f.impact)}

## Steps To Reproduce
${w(f.reproduction)}

## Proof of Concept
See reproduction steps. Attach screenshots, request/response pairs, or a minimal PoC file here.

## Mitigation / Remediation
${w(f.remediation)}

## References
- CWE-${cweId(f.cwe)}: https://cwe.mitre.org/data/definitions/${cweId(f.cwe)}.html
`;
}

/** Bugcrowd style: priority P1–P4, vulnerability type, structured PoC. */
export function bugcrowdReport(f: FindingData, p: ProgramData): string {
  const sev = SEVERITY_META[f.severity];
  return `# ${w(f.title)}

**Vulnerability Type:** CWE-${cweId(f.cwe)}
**Priority:** ${sev.priority} (${sev.label})
**CVSS:** ${f.cvss?.trim() || `${sev.cvssRange} (approximate)`}
**Program:** ${w(p.programName)} | **Platform:** Bugcrowd

## Description
${w(f.description)}

## Steps To Reproduce
${w(f.reproduction)}

## Proof of Concept
### Request
\`\`\`
(include the exact HTTP request used)
\`\`\`

### Response
\`\`\`
(include the relevant part of the response / evidence)
\`\`\`

### Evidence
(attach screenshots or a short recording)

## Impact
${w(f.impact)}

## Remediation
${w(f.remediation)}

## References
- CWE-${cweId(f.cwe)}: https://cwe.mitre.org/data/definitions/${cweId(f.cwe)}.html
`;
}

/** Intigriti style: vulnerability class, impact/CVSS, evidence-led. */
export function intigritiReport(f: FindingData, p: ProgramData): string {
  const sev = SEVERITY_META[f.severity];
  return `# ${w(f.title)}

**Vulnerability Class:** CWE-${cweId(f.cwe)}
**Impact (CVSS):** ${f.cvss?.trim() || sev.cvssRange} — ${sev.label} (${sev.priority})
**Program:** ${w(p.programName)} | **Platform:** Intigriti

## Description
${w(f.description)}

## Steps To Reproduce
${w(f.reproduction)}

## Evidence
Include a clear screenshot or request/response excerpt demonstrating the issue.

## Impact
${w(f.impact)}

## Remediation
${w(f.remediation)}

## References
- CWE-${cweId(f.cwe)}: https://cwe.mitre.org/data/definitions/${cweId(f.cwe)}.html
`;
}

/** Executive summary across all findings — useful for tracking and triage. */
export function summaryReport(findings: FindingData[], p: ProgramData): string {
  const order: Severity[] = ["critical", "high", "medium", "low"];
  const sorted = [...findings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );
  const rows = sorted
    .map(
      (f) =>
        `| ${SEVERITY_META[f.severity].priority} | ${SEVERITY_META[f.severity].label} | ${w(f.title)} | CWE-${cweId(f.cwe)} |`,
    )
    .join("\n");

  return `# Bug Bounty Summary — ${w(p.programName)}

**Platform:** ${w(p.platform)} | **Findings:** ${findings.length} | **Generated:** ${new Date().toISOString().slice(0, 10)}

## Findings Overview

| Priority | Severity | Title | CWE |
| --- | --- | --- | --- |
${rows || "| — | — | No findings recorded yet | — |"}

## Scope (declared)
${w(p.scope).slice(0, 2000)}

## Rules of Engagement (declared)
${w(p.rules).slice(0, 2000)}

## Per-Finding Details
${sorted
  .map((f, i) => {
    const sev = SEVERITY_META[f.severity];
    return `### ${i + 1}. ${w(f.title)} (${sev.priority} — ${sev.label})
- **CWE:** CWE-${cweId(f.cwe)}
- **CVSS:** ${f.cvss?.trim() || sev.cvssRange}

**Description:** ${w(f.description)}

**Reproduction:** ${w(f.reproduction)}

**Impact:** ${w(f.impact)}

**Remediation:** ${w(f.remediation)}
`;
  })
  .join("\n")}`;
}

export function generateReport(
  platform: Platform,
  findings: FindingData[],
  profile: ProgramData,
  selectedFindingId?: string,
): string {
  const program: ProgramData = {
    platform,
    programName: profile.programName,
    scope: profile.scope,
    rules: profile.rules,
  };

  if (selectedFindingId) {
    const finding = findings.find((f) => f._id === selectedFindingId);
    if (!finding) return "Select a finding to generate a report.";
    if (platform === "hackerone") return hackeroneReport(finding, program);
    if (platform === "bugcrowd") return bugcrowdReport(finding, program);
    return intigritiReport(finding, program);
  }
  return summaryReport(findings, program);
}
