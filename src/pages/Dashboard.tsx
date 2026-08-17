import { ChatThread } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { MODELS, Sidebar } from "@/components/chat/Sidebar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { Menu, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const LAST_CONVERSATION_KEY = "mythos-last-conversation";
const MODEL_KEY = "mythos-model";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const conversations = useQuery(api.chat.listConversations);
  const createConversation = useMutation(api.chat.createConversation);
  const sendMessage = useMutation(api.chat.sendMessage);
  const deleteConversation = useMutation(api.chat.deleteConversation);
  const stopGeneration = useMutation(api.chat.stopGeneration);
  const streamChat = useAction(api.gemini.streamChat);

  const [selectedId, setSelectedId] = useState<Id<"conversations"> | null>(
    () => {
      const saved = readStorage(LAST_CONVERSATION_KEY);
      return saved ? (saved as Id<"conversations">) : null;
    },
  );
  const [model, setModel] = useState<string>(() => {
    const saved = readStorage(MODEL_KEY);
    return MODELS.some((m) => m.value === saved) ? saved! : MODELS[0].value;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const messages = useQuery(
    api.chat.getMessages,
    selectedId ? { conversationId: selectedId } : "skip",
  );

  const streaming = messages?.some((m) => m.streaming === true) ?? false;

  // Drop a stale saved conversation id (e.g. after it was deleted).
  useEffect(() => {
    if (!conversations || !selectedId) return;
    if (!conversations.some((c) => c._id === selectedId)) {
      setSelectedId(null);
      try {
        localStorage.removeItem(LAST_CONVERSATION_KEY);
      } catch {
        // ignore
      }
    }
  }, [conversations, selectedId]);

  const handleNewChat = useCallback(() => {
    setSelectedId(null);
    try {
      localStorage.removeItem(LAST_CONVERSATION_KEY);
    } catch {
      // ignore
    }
    setSidebarOpen(false);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id as Id<"conversations">);
    writeStorage(LAST_CONVERSATION_KEY, id);
    setSidebarOpen(false);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteConversation({
          conversationId: id as Id<"conversations">,
        });
        if (selectedId === id) {
          setSelectedId(null);
          try {
            localStorage.removeItem(LAST_CONVERSATION_KEY);
          } catch {
            // ignore
          }
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete chat",
        );
      }
    },
    [deleteConversation, selectedId],
  );

  const handleStop = useCallback(async () => {
    const streamingMessage = messages?.find((m) => m.streaming === true);
    if (!streamingMessage) return;
    try {
      await stopGeneration({ messageId: streamingMessage._id });
    } catch {
      // best effort
    }
  }, [messages, stopGeneration]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current || streaming) return;
      busyRef.current = true;
      setBusy(true);
      try {
        let conversationId = selectedId;
        if (!conversationId) {
          conversationId = await createConversation();
          setSelectedId(conversationId);
          writeStorage(LAST_CONVERSATION_KEY, conversationId);
        }
        const assistantMessageId = await sendMessage({
          conversationId,
          content: trimmed,
          model,
        });
        // Errors surface on the assistant message via finishMessage.
        void streamChat({
          conversationId,
          assistantMessageId,
          model,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to send message",
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [selectedId, model, streaming, createConversation, sendMessage, streamChat],
  );

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate("/");
  }, [signOut, navigate]);

  const title =
    conversations?.find((c) => c._id === selectedId)?.title ?? "New chat";

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] shrink-0 border-r border-sidebar-border transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          conversations={conversations}
          selectedId={selectedId}
          model={model}
          userName={user?.name ?? null}
          userEmail={user?.email ?? null}
          onSelect={handleSelect}
          onNewChat={handleNewChat}
          onDelete={handleDelete}
          onModelChange={(value) => {
            setModel(value);
            writeStorage(MODEL_KEY, value);
          }}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>
          {streaming && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[oklch(0.8_0.11_85/30%)] bg-[oklch(0.8_0.11_85/8%)] px-2.5 py-0.5 text-[11px] text-[oklch(0.8_0.11_85)]">
              <span
                className="size-1.5 rounded-full bg-[oklch(0.8_0.11_85)]"
                style={{
                  animation: "mythos-blink 1s steps(1) infinite",
                }}
              />
              writing…
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
              <Sparkles className="size-3 text-[oklch(0.8_0.11_85)]" />
              free tier · {MODELS.find((m) => m.value === model)?.label ?? model}
            </span>
          </div>
        </header>

        <ChatThread messages={messages} onSend={handleSend} />

        <Composer
          streaming={streaming}
          busy={busy}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
