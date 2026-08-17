import type { Doc } from "@/convex/_generated/dataModel";
import { ChatThread } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { cn } from "@/lib/utils";
import { FileSearch, FileText, Radar, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { FindingsPanel } from "./FindingsPanel";
import { ReportPanel } from "./ReportPanel";
import { ScannerPanel } from "./ScannerPanel";

const TABS = [
  { value: "agent", label: "Agent", icon: ShieldAlert },
  { value: "scan", label: "Scan", icon: Radar },
  { value: "findings", label: "Findings", icon: FileSearch },
  { value: "report", label: "Report", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["value"];

interface BountyWorkspaceProps {
  messages: Doc<"messages">[] | undefined;
  streaming: boolean;
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function BountyWorkspace({
  messages,
  streaming,
  busy,
  onSend,
  onStop,
}: BountyWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("agent");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              tab === t.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <ShieldAlert className="size-3 text-[oklch(0.8_0.11_85)]" />
          scope &amp; rules enforced · no stealth, ever
        </span>
      </div>

      {tab === "agent" && (
        <>
          <ChatThread
            messages={messages}
            onSend={onSend}
            variant="bounty"
          />
          <Composer
            streaming={streaming}
            busy={busy}
            onSend={onSend}
            onStop={onStop}
          />
        </>
      )}
      {tab === "scan" && (
        <div className="flex-1 overflow-y-auto">
          <ScannerPanel />
        </div>
      )}
      {tab === "findings" && (
        <div className="flex-1 overflow-y-auto">
          <FindingsPanel />
        </div>
      )}
      {tab === "report" && (
        <div className="flex-1 overflow-y-auto">
          <ReportPanel />
        </div>
      )}
    </div>
  );
}
