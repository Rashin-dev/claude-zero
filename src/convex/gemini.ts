"use node";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Zero-cost, blazing-fast model access via Google AI Studio (Gemini).
 * The free tier needs no credit card and gives thousands of requests/day.
 *
 * Set the API key in the Keys/API keys UI as: GOOGLE_API_KEY
 */

export const ALLOWED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const SYSTEM_PROMPT = `You are Mythos, a fast, precise coding agent.
Rules you must follow:
- Give complete, correct, copy-pasteable solutions inside fenced code blocks tagged with the language (e.g. \`\`\`python, \`\`\`tsx, \`\`\`bash).
- When the user asks to build something, provide every file in its own fenced block with a filename comment as the first line.
- Prefer the simplest approach that works; include only relevant code, not stubs.
- Explain briefly and directly. No filler, no apologies, no disclaimers.
- If you are unsure about environment specifics, state your assumption in one line and proceed.`;

/** Minimal incremental SSE parser for Gemini's streaming generateContent. */
function createSseParser() {
  let buffer = "";
  const onEvent = (line: string): string => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return "";
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return "";
    try {
      const json = JSON.parse(payload);
      const parts: Array<{ text?: string }> | undefined =
        json?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return "";
      let text = "";
      for (const part of parts) {
        if (typeof part?.text === "string") text += part.text;
      }
      return text;
    } catch {
      return "";
    }
  };
  return {
    push(chunk: string, emit: (text: string) => void) {
      buffer += chunk;
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const text = onEvent(line);
        if (text) emit(text);
      }
    },
    flush(emit: (text: string) => void) {
      const text = onEvent(buffer);
      buffer = "";
      if (text) emit(text);
    },
  };
}

export const streamChat = action({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
    model: v.string(),
  },
  handler: async (ctx, { conversationId, assistantMessageId, model }) => {
    const finish = async (error?: string) => {
      try {
        await ctx.runMutation(api.chat.finishMessage, {
          messageId: assistantMessageId,
          error,
        });
      } catch {
        // best effort — the message otherwise stays in streaming state
      }
    };

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      await finish("Not signed in.");
      return;
    }

    if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
      await finish(`Unknown model: ${model}`);
      return;
    }

    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
      await finish(
        "No Gemini API key configured. Add GOOGLE_API_KEY in the Keys/API keys tab, then try again.",
      );
      return;
    }

    const context = await ctx.runQuery(internal.chat.getStreamContext, {
      conversationId,
      assistantMessageId,
    });
    if (!context) {
      await finish("Conversation not found.");
      return;
    }

    const contents = context.messages
      .filter(
        (m) => m._id !== assistantMessageId && m.content.trim().length > 0,
      )
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_BASE}/models/${model}:generateContent?alt=sse&key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 8192,
            },
          }),
          signal: controller.signal,
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      await finish(
        `Could not reach the Gemini API (${error instanceof Error ? error.message : "network error"}).`,
      );
      return;
    }
    clearTimeout(timeout);

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      const hint = detail.includes("API key")
        ? "Your Gemini API key looks invalid. Check GOOGLE_API_KEY in the Keys/API keys tab."
        : detail.includes("not found") || detail.includes("404")
          ? `Model "${model}" is unavailable. Try a different model in the sidebar.`
          : "Check the Gemini API status and your key.";
      await finish(`Model error (${response.status}). ${hint}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    let pending = "";
    let streamError: string | null = null;

    const flush = async (): Promise<boolean> => {
      if (!pending) return true;
      const text = pending;
      pending = "";
      try {
        await ctx.runMutation(api.chat.appendChunk, {
          messageId: assistantMessageId,
          text,
        });
      } catch {
        return false;
      }
      // Honor the Stop button: the client sets canceled on this message.
      const canceled = await ctx.runQuery(internal.chat.isMessageCanceled, {
        messageId: assistantMessageId,
      });
      return !canceled;
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }), (text) => {
          pending += text;
        });
        if (pending.length >= 96) {
          const keepGoing = await flush();
          if (!keepGoing) {
            await finish();
            return;
          }
        }
      }
      parser.flush((text) => {
        pending += text;
      });
      await flush();
    } catch (error) {
      streamError =
        error instanceof Error && error.name === "AbortError"
          ? "The request timed out. Try again or switch to a faster model."
          : `Streaming failed (${error instanceof Error ? error.message : "unknown error"}).`;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }

    await finish(streamError ?? undefined);
  },
});
