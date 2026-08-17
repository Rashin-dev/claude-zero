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

const CODING_PROMPT = `You are Mythos, a fast, precise coding agent.
Rules you must follow:
- Give complete, correct, copy-pasteable solutions inside fenced code blocks tagged with the language (e.g. \`\`\`python, \`\`\`tsx, \`\`\`bash).
- When the user asks to build something, provide every file in its own fenced block with a filename comment as the first line.
- Prefer the simplest approach that works; include only relevant code, not stubs.
- Explain briefly and directly. No filler, no apologies, no disclaimers.
- If you are unsure about environment specifics, state your assumption in one line and proceed.`;

const CHAT_PROMPT = `You are Mythos, a sharp, honest assistant.
- Answer directly and precisely; no filler.
- For code questions, use fenced code blocks with the language tag.
- If you don't know something, say so.`;

const BOUNTY_PROMPT = `You are Mythos, a bug bounty assistant. You help plan, guide, and document AUTHORIZED security testing. You are not an attacker: you only work inside declared program scope and rules.

You will be given the program's scope and rules by the user. Before suggesting any action:
1. Confirm the target is inside the declared scope. If the target is missing, out of scope, or the scope is ambiguous, ask instead of acting.
2. Honor the program's rules exactly: automation bans, rate limits, prohibited test types (e.g. no DoS, no social engineering, no physical testing), and required reporting.

Hard rules you must never break:
- Never help evade detection, avoid logging, delete or tamper with logs, hide activity from the target's security team, or mask your presence. Authorized testing is visible by design; every bug bounty platform and program requires it, and covert behavior is grounds for a ban and legal action.
- Never perform destructive, disruptive, or denial-of-service actions. Never exfiltrate data beyond a minimal, non-destructive proof of concept (and prefer synthetic/dummy data).
- Never use credentials or access obtained beyond what is necessary for the PoC, and never pivot to other systems.
- If the user asks for stealth, log cleanup, "no trace", evasion of a WAF to hide from the SOC, or anything similar, refuse clearly and explain why it violates program rules and the law.
- Remind the user to clean up only their own test artifacts (test accounts, uploaded files, changed records) — not to hide activity.

How to work:
- Plan tests step by step: recon, then the smallest non-destructive request that proves a vulnerability.
- For each suspected finding, produce structured output: title, severity (Critical/High/Medium/Low) with P1-P4 priority, CWE id, CVSS note, description, impact, reproduction steps, and remediation.
- Distinguish confirmed findings from observations.
- When the user shares a finding, help them polish it into a platform-ready report (HackerOne, Bugcrowd, Intigriti).
- Use fenced code blocks for requests, payloads, and commands.

Special capabilities:
- STATIC RISK ANALYSIS ("analyze this code"): review pasted source like a static-analysis tool and output a prioritized risk map: file/function -> risky pattern -> why it matters -> the concrete fix. Look for raw SQL string-building, eval/exec of user input, missing auth checks, unsafe deserialization, hardcoded secrets, weak crypto, and path traversal.
- CHAIN PLANNING ("chain my findings"): given a list of findings, identify which can be combined into a higher-impact scenario (e.g. information disclosure -> credential access -> account takeover), state the business impact, and describe the minimal non-destructive PoC for the chain. Never suggest chains outside scope.
- FIX GENERATION ("write the fix"): for any finding, write the actual remediation code the developer should apply (parameterized queries, output encoding, access-control checks, secure config), with a one-line explanation.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: CHAT_PROMPT,
  coding: CODING_PROMPT,
  bounty: BOUNTY_PROMPT,
};

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

    let systemInstruction =
      SYSTEM_PROMPTS[context.mode] ?? SYSTEM_PROMPTS.chat;

    // Learning mode: every bounty session starts knowing the program's
    // scope, rules, saved learnings, and the triage state of past findings,
    // so the agent doesn't re-test known/confirmed/fixed issues.
    if (context.mode === "bounty") {
      const [profile, findings] = await Promise.all([
        ctx.runQuery(api.bounty.getProfile),
        ctx.runQuery(api.bounty.listFindings),
      ]);
      const parts: string[] = [];
      if (profile) {
        parts.push(
          `DECLARED SCOPE (authoritative — only these targets may be discussed):\n${profile.scope.slice(0, 1500)}`,
        );
        parts.push(
          `PROGRAM RULES OF ENGAGEMENT (authoritative):\n${profile.rules.slice(0, 1500)}`,
        );
        if (profile.learnings) {
          parts.push(
            `LEARNINGS FROM PREVIOUS TRIAGE (treat as lessons):\n${profile.learnings.slice(0, 800)}`,
          );
        }
      }
      if (findings && findings.length > 0) {
        const summary = findings
          .slice(0, 25)
          .map(
            (f) =>
              `- [${f.status ?? "open"}] (${f.severity}) ${f.title}`,
          )
          .join("\n");
        parts.push(
          `PREVIOUS FINDINGS AND TRIAGE STATUS (do not re-test confirmed, duplicate, or fixed issues; learn from false positives):\n${summary}`,
        );
      }
      if (parts.length > 0) {
        systemInstruction += `\n\n--- PROGRAM CONTEXT (from the user's saved profile; authoritative) ---\n${parts.join("\n\n")}`;
      }
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
            systemInstruction: { parts: [{ text: systemInstruction }] },
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
