import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Severity } from "@/lib/reportTemplates";
import { SEVERITY_META } from "@/lib/reportTemplates";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";

const FINDING_STATUSES = [
  { value: "open", label: "Open" },
  { value: "confirmed", label: "Confirmed" },
  { value: "false_positive", label: "False positive" },
  { value: "duplicate", label: "Duplicate" },
  { value: "fixed", label: "Fixed" },
] as const;
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const PLATFORMS = ["hackerone", "bugcrowd", "intigriti", "custom"] as const;

const EMPTY_FINDING = {
  title: "",
  severity: "medium" as Severity,
  cwe: "",
  cvss: "",
  description: "",
  impact: "",
  reproduction: "",
  remediation: "",
};

export function FindingsPanel() {
  const profile = useQuery(api.bounty.getProfile);
  const findings = useQuery(api.bounty.listFindings);
  const saveProfile = useMutation(api.bounty.saveProfile);
  const addFinding = useMutation(api.bounty.addFinding);
  const updateFinding = useMutation(api.bounty.updateFinding);
  const deleteFinding = useMutation(api.bounty.deleteFinding);
  const setFindingStatus = useMutation(api.bounty.setFindingStatus);

  const [platform, setPlatform] = useState("hackerone");
  const [programName, setProgramName] = useState("");
  const [scope, setScope] = useState("");
  const [rules, setRules] = useState("");
  const [learnings, setLearnings] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [finding, setFinding] = useState({ ...EMPTY_FINDING });
  const [profileInit, setProfileInit] = useState(false);

  // Once the saved profile loads, mirror it into the form's local state so
  // edits edit real state instead of fighting the query value.
  useEffect(() => {
    if (profile && !profileInit) {
      setProfileInit(true);
      setPlatform(profile.platform);
      setProgramName(profile.programName);
      setScope(profile.scope);
      setRules(profile.rules);
      setLearnings(profile.learnings ?? "");
    }
  }, [profile, profileInit]);

  const setFindingField = (field: keyof typeof EMPTY_FINDING, value: string) =>
    setFinding((f) => ({ ...f, [field]: value }));

  const handleSaveProfile = async () => {
    if (!programName.trim()) {
      toast.error("Give the program a name first.");
      return;
    }
    await saveProfile({ platform, programName, scope, rules, learnings });
    toast.success("Program profile saved.");
  };

  const handleStartEdit = (f: Doc<"bountyFindings">) => {
    setEditingId(f._id);
    setFinding({
      title: f.title,
      severity: f.severity as Severity,
      cwe: f.cwe,
      cvss: f.cvss ?? "",
      description: f.description,
      impact: f.impact,
      reproduction: f.reproduction,
      remediation: f.remediation,
    });
  };

  const handleSaveFinding = async () => {
    if (!finding.title.trim()) {
      toast.error("A finding needs a title.");
      return;
    }
    const payload = {
      title: finding.title,
      severity: finding.severity,
      cwe: finding.cwe,
      cvss: finding.cvss || undefined,
      description: finding.description,
      impact: finding.impact,
      reproduction: finding.reproduction,
      remediation: finding.remediation,
    };
    if (editingId) {
      await updateFinding({
        findingId: editingId as Id<"bountyFindings">,
        ...payload,
      });
      toast.success("Finding updated.");
    } else {
      await addFinding(payload);
      toast.success("Finding added.");
    }
    setEditingId(null);
    setFinding({ ...EMPTY_FINDING });
  };

  const handleDelete = async (id: string) => {
    await deleteFinding({ findingId: id as Id<"bountyFindings"> });
    if (editingId === id) {
      setEditingId(null);
      setFinding({ ...EMPTY_FINDING });
    }
    toast.success("Finding deleted.");
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      {/* Program profile */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-[oklch(0.8_0.11_85)]" />
          <h2 className="text-[15px] font-semibold tracking-tight">
            Program profile
          </h2>
          <p className="ml-auto text-[11px] text-muted-foreground">
            The agent checks these before suggesting anything
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="program-name">Program / target name</Label>
            <Input
              id="program-name"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="e.g. acme-public-bug-bounty"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="program-platform">Reporting platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger id="program-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="program-scope">In-scope assets</Label>
            <Textarea
              id="program-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={4}
              placeholder={"Paste the program's scope here:\n- https://app.example.com\n- *.api.example.com"}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="program-rules">Rules of engagement</Label>
            <Textarea
              id="program-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={4}
              placeholder={"Paste the program's rules here:\n- no automated scanning\n- no DoS\n- rate limits..."}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="program-learnings">Learnings (memory)</Label>
            <Textarea
              id="program-learnings"
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              rows={3}
              placeholder={"Lessons from past triage — injected into every agent session:\ne.g. 'login endpoint uses raw SQL — check every auth endpoint for it'"}
            />
            <p className="text-[11px] text-muted-foreground">
              Every bounty session starts knowing this, your scope, rules, and
              the triage status of past findings — so nothing known is re-tested.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" onClick={handleSaveProfile} className="gap-1.5">
            <Save className="size-4" /> Save profile
          </Button>
          {profile !== undefined && !profile && (
            <p className="text-[11px] text-muted-foreground">
              Not saved yet — scope and rules are enforced once you save.
            </p>
          )}
        </div>
      </section>

      {/* Findings list */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          Findings{" "}
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            ({findings?.length ?? 0})
          </span>
        </h2>
        {!findings || findings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No findings yet. Add the first one below, or ask the agent to help
            structure one in the Agent tab.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {findings.map((f) => {
              const meta = SEVERITY_META[f.severity as Severity] ?? SEVERITY_META.medium;
              return (
                <li
                  key={f._id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5"
                >
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                      f.severity === "critical" && "bg-destructive/15 text-destructive",
                      f.severity === "high" && "bg-[oklch(0.7_0.13_55/15%)] text-[oklch(0.78_0.13_55)]",
                      f.severity === "medium" && "bg-[oklch(0.78_0.11_80/15%)] text-[oklch(0.78_0.11_80)]",
                      f.severity === "low" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {meta.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{f.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {f.cwe || "CWE not set"} · {meta.label}
                    </p>
                  </div>
                  <Select
                    value={f.status ?? "open"}
                    onValueChange={(value) =>
                      void setFindingStatus({
                        findingId: f._id,
                        status: value,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-[132px] shrink-0 text-[11.5px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FINDING_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleStartEdit(f)}
                    aria-label="Edit finding"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(f._id)}
                    aria-label="Delete finding"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add / edit finding */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {editingId ? "Edit finding" : "Add finding"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="finding-title">Title</Label>
            <Input
              id="finding-title"
              value={finding.title}
              onChange={(e) => setFindingField("title", e.target.value)}
              placeholder="e.g. SQL injection in product search leads to auth bypass"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-severity">Severity</Label>
            <Select
              value={finding.severity}
              onValueChange={(v) => setFindingField("severity", v)}
            >
              <SelectTrigger id="finding-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEVERITY_META[s].label} ({SEVERITY_META[s].priority})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-cwe">CWE</Label>
            <Input
              id="finding-cwe"
              value={finding.cwe}
              onChange={(e) => setFindingField("cwe", e.target.value)}
              placeholder="e.g. 89"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-cvss">CVSS vector (optional)</Label>
            <Input
              id="finding-cvss"
              value={finding.cvss}
              onChange={(e) => setFindingField("cvss", e.target.value)}
              placeholder="e.g. CVSS:3.1/AV:N/AC:L/..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finding-impact">Impact</Label>
            <Input
              id="finding-impact"
              value={finding.impact}
              onChange={(e) => setFindingField("impact", e.target.value)}
              placeholder="e.g. full account takeover of any user"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="finding-description">Description</Label>
            <Textarea
              id="finding-description"
              value={finding.description}
              onChange={(e) => setFindingField("description", e.target.value)}
              rows={3}
              placeholder="What the vulnerability is and where it lives"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="finding-reproduction">Steps to reproduce</Label>
            <Textarea
              id="finding-reproduction"
              value={finding.reproduction}
              onChange={(e) => setFindingField("reproduction", e.target.value)}
              rows={4}
              placeholder={"1. Request...\n2. Observe...\n3. Impact..."}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="finding-remediation">Remediation</Label>
            <Textarea
              id="finding-remediation"
              value={finding.remediation}
              onChange={(e) => setFindingField("remediation", e.target.value)}
              rows={3}
              placeholder="How the team should fix it"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button type="button" onClick={handleSaveFinding} className="gap-1.5">
            <Plus className="size-4" />
            {editingId ? "Save changes" : "Add finding"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setFinding({ ...EMPTY_FINDING });
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
