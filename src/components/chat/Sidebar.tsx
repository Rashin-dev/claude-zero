import type { Doc } from "@/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LogOut, MessageSquarePlus, Sparkles, Trash2, Zap } from "lucide-react";

export const MODELS = [
  { value: "gemini-2.5-flash", label: "2.5 Flash", hint: "Best balance" },
  {
    value: "gemini-2.5-flash-lite",
    label: "2.5 Flash-Lite",
    hint: "Fastest",
  },
] as const;

interface SidebarProps {
  conversations: Doc<"conversations">[] | undefined;
  selectedId: string | null;
  model: string;
  userName: string | null;
  userEmail: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onModelChange: (model: string) => void;
  onSignOut: () => void;
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")
  ).toUpperCase();
}

export function Sidebar({
  conversations,
  selectedId,
  model,
  userName,
  userEmail,
  onSelect,
  onNewChat,
  onDelete,
  onModelChange,
  onSignOut,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex size-8 items-center justify-center rounded-lg border border-[oklch(0.8_0.11_85/45%)] bg-[oklch(0.8_0.11_85/10%)]">
          <Sparkles className="size-4 text-[oklch(0.8_0.11_85)]" />
        </div>
        <div>
          <p className="text-[15px] font-semibold tracking-tight">Mythos</p>
          <p className="text-[11px] text-muted-foreground">coding agent</p>
        </div>
      </div>

      <div className="px-3">
        <Button
          type="button"
          onClick={onNewChat}
          className="w-full gap-2 rounded-lg"
          variant="secondary"
        >
          <MessageSquarePlus className="size-4" /> New chat
        </Button>
      </div>

      {/* Conversations */}
      <div className="mt-4 flex-1 overflow-y-auto px-3 pb-2">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Recent
        </p>
        {!conversations || conversations.length === 0 ? (
          <p className="px-2 text-xs leading-relaxed text-muted-foreground/80">
            No conversations yet.
          </p>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conversation) => {
              const active = conversation._id === selectedId;
              return (
                <div
                  key={conversation._id}
                  className={cn(
                    "group flex items-center rounded-lg pr-1 transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(conversation._id)}
                    className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] text-foreground/90"
                    title={conversation.title}
                  >
                    {conversation.title}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Delete conversation"
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{conversation.title}” and all of its messages will be
                          permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(conversation._id)}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model + user */}
      <div className="space-y-3 border-t border-sidebar-border p-3">
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Zap className="size-3" /> Model
          </p>
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-background/60 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  <span className="flex items-center gap-2">
                    {m.label}
                    <span className="text-[11px] text-muted-foreground">
                      {m.hint}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-background/40 p-2">
          <Avatar className="size-8">
            <AvatarImage src={undefined} />
            <AvatarFallback className="bg-muted text-[11px] font-semibold">
              {initials(userName, userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium">
              {userName || "Guest"}
            </p>
            {userEmail && (
              <p className="truncate text-[11px] text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSignOut}
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
