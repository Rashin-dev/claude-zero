"use node";

import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * Zero-cost, blazing-fast model access.
 *
 * Primary: Google AI Studio (Gemini) — free tier, no credit card, thousands
 * of requests/day. Fallback: Groq — also free tier, blazing fast, used
 * automatically when Gemini is rate-limited or down, or when only the Groq
 * key is configured.
 *
 * Set keys in the Keys/API keys UI as: GOOGLE_API_KEY, GROQ_API_KEY
 */

export const ALLOWED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GROQ_BASE = "https://api.groq.com/openai/v1";

// Gemini model -> Groq free-tier fallback model.
const GROQ_FALLBACK: Record<string, string> = {
  "gemini-2.5-flash": "llama-3.3-70b-versatile",
  "gemini-2.5-flash-lite": "llama-3.1-8b-instant",
};

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

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StreamSource = {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  extract: (json: Record<string, unknown>) => string | undefined;
};

/** Minimal incremental SSE parser; the extractor maps provider JSON -> text. */
function createSseParser(
  extract: (json: Record<string, unknown>) => string | undefined,
) {
  let buffer = "";
  const onEvent = (line: string): string => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return "";
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return "";
    try {
      const json = JSON.parse(payload) as Record<string, unknown>;
      const text = extract(json);
      return typeof text === "string" ? text : "";
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

function geminiExtract(json: Record<string, unknown>): string | undefined {
  const candidates = json.candidates;
  if (!Array.isArray(candidates)) return undefined;
  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: string }> };
  };
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  let text = "";
  for (const part of parts) {
    if (typeof part?.text === "string") text += part.text;
  }
  return text || undefined;
}

function groqExtract(json: Record<string, unknown>): string | undefined {
  const choices = json.choices;
  if (!Array.isArray(choices)) return undefined;
  const delta = (choices[0] as { delta?: { content?: string } })?.delta?.content;
  return typeof delta === "string" ? delta || undefined : undefined;
}

type OpenResult =
  | { ok: true; source: StreamSource }
  | { ok: false; error: string };

async function openGeminiStream(
  model: string,
  contents: GeminiContent[],
  systemInstruction: string,
  key: string,
  signal: AbortSignal,
): Promise<OpenResult> {
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
        signal,
      },
    );
  } catch (error) {
    return {
      ok: false,
      error: `network error (${error instanceof Error ? error.message : "unknown"})`,
    };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const reason =
      response.status === 429
        ? "rate limit reached (free-tier daily quota)"
        : response.status === 400 && detail.includes("API key")
          ? "API key rejected"
          : detail.slice(0, 200) || `HTTP ${response.status}`;
    return { ok: false, error: `HTTP ${response.status}: ${reason}` };
  }
  if (!response.body) return { ok: false, error: "empty response body" };
  return {
    ok: true,
    source: { reader: response.body.getReader(), extract: geminiExtract },
  };
}

async function openGroqStream(
  model: string,
  messages: ChatMessage[],
  key: string,
  signal: AbortSignal,
): Promise<OpenResult> {
  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.4,
        max_tokens: 8192,
      }),
      signal,
    });
  } catch (error) {
    return {
      ok: false,
      error: `network error (${error instanceof Error ? error.message : "unknown"})`,
    };
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const reason =
      response.status === 429
        ? "rate limit reached (free-tier quota)"
        : detail.slice(0, 200) || `HTTP ${response.status}`;
    return { ok: false, error: `HTTP ${response.status}: ${reason}` };
  }
  if (!response.body) return { ok: false, error: "empty response body" };
  return {
    ok: true,
    source: { reader: response.body.getReader(), extract: groqExtract },
  };
}

export const streamChat = action({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
    model: v.string(),
  },
  handler: async (ctx, { conversationId, assistantMessageId, model }) => {
    const finish = async (error?: string, servedModel?: string) => {
      try {
        await ctx.runMutation(api.chat.finishMessage, {
          messageId: assistantMessageId,
          error,
          model: servedModel,
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

    const geminiKey = process.env.GOOGLE_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    if (!geminiKey && !groqKey) {
      await finish(
        "No API key configured. Add GOOGLE_API_KEY (Gemini, free tier) in the Keys/API keys tab. You can also add GROQ_API_KEY as an automatic free fallback.",
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

    // Keep the conversation inside the free tier's context window (and fast):
    // send the most recent history, newest-first, up to a character budget.
    // The last message is always kept, even if it's huge on its own.
    const MAX_HISTORY_CHARS = 120_000;
    const history = context.messages.filter(
      (m) => m._id !== assistantMessageId && m.content.trim().length > 0,
    );
    const contents: GeminiContent[] = [];
    let used = 0;
    let trimmed = false;
    for (let i = history.length - 1; i >= 0; i--) {
      const message = history[i];
      const size = message.content.length;
      if (contents.length > 0 && used + size > MAX_HISTORY_CHARS) {
        trimmed = true;
        break;
      }
      used += size;
      contents.unshift({
        role: message.role === "user" ? "user" : "model",
        parts: [{ text: message.content }],
      });
    }
    if (trimmed) {
      systemInstruction +=
        "\n\n(Note: the earliest part of this conversation was trimmed to stay within limits. If you need details from it, ask the user.)";
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemInstruction },
      ...contents.map((c) => ({
        role: c.role === "user" ? ("user" as const) : ("assistant" as const),
        content: c.parts[0].text,
      })),
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    // Pick a provider: Gemini first; Groq free tier as automatic fallback.
    let source: StreamSource | null = null;
    let servedModel = model;

    if (geminiKey) {
      const primary = await openGeminiStream(
        model,
        contents,
        systemInstruction,
        geminiKey,
        controller.signal,
      );
      if (primary.ok) {
        source = primary.source;
      } else if (groqKey) {
        const fallbackModel = GROQ_FALLBACK[model] ?? "llama-3.3-70b-versatile";
        const fallback = await openGroqStream(
          fallbackModel,
          messages,
          groqKey,
          controller.signal,
        );
        if (fallback.ok) {
          source = fallback.source;
          servedModel = `groq/${fallbackModel}`;
        } else {
          clearTimeout(timeout);
          await finish(
            `Gemini failed (${primary.error}) and the Groq fallback failed too (${fallback.error}).`,
          );
          return;
        }
      } else {
        clearTimeout(timeout);
        await finish(
          `Gemini error (${primary.error}). Add GROQ_API_KEY in the Keys/API keys tab to enable automatic free-tier fallback.`,
        );
        return;
      }
    } else if (groqKey) {
      const fallbackModel = GROQ_FALLBACK[model] ?? "llama-3.3-70b-versatile";
      const attempt = await openGroqStream(
        fallbackModel,
        messages,
        groqKey,
        controller.signal,
      );
      if (!attempt.ok) {
        clearTimeout(timeout);
        await finish(`Groq error (${attempt.error}).`);
        return;
      }
      source = attempt.source;
      servedModel = `groq/${fallbackModel}`;
    }

    if (!source) {
      clearTimeout(timeout);
      await finish("No model provider available.");
      return;
    }

    // Count this request against the free-tier quota (best effort).
    try {
      await ctx.runMutation(api.chat.recordUsage, {
        date: new Date().toISOString().slice(0, 10),
      });
    } catch {
      // the usage meter is a convenience, not a dependency
    }

    const decoder = new TextDecoder();
    const parser = createSseParser(source.extract);
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
        const { done, value } = await source.reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }), (text) => {
          pending += text;
        });
        if (pending.length >= 240) {
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
      clearTimeout(timeout);
      try {
        source.reader.releaseLock();
      } catch {
        // already released
      }
    }

    await finish(streamError ?? undefined, servedModel);
  },
});
