"use node";

import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export type ScanStatus = "pass" | "warn" | "fail" | "info";

export interface ScanCheck {
  check: string;
  status: ScanStatus;
  detail: string;
}

/**
 * Passive, read-only reconnaissance of a target URL (the "Psychic"-style
 * fingerprint step). Enforces that the target host is inside the scope saved
 * in the user's bug bounty profile, makes only a handful of single requests,
 * and never sends anything that looks like an attack.
 */
export const passiveRecon = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not signed in.");
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("That doesn't look like a valid URL.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Only http:// and https:// targets are supported.");
    }
    const host = parsed.hostname.toLowerCase();

    const profile = await ctx.runQuery(api.bounty.getProfile);
    if (!profile) {
      throw new Error(
        "No program profile saved. Add the program's scope in the Findings tab first — the scanner only touches declared in-scope targets.",
      );
    }
    if (!hostInScope(host, profile.scope)) {
      throw new Error(
        `${host} is not inside the declared scope. Add it to the program's scope in the Findings tab before scanning.`,
      );
    }

    const checks: ScanCheck[] = [];
    const origin = parsed.origin;

    // 1. Base response + security headers
    let base: Awaited<ReturnType<typeof get>> | null = null;
    try {
      base = await get(origin, 20_000);
    } catch (error) {
      checks.push({
        check: "Reachability",
        status: "fail",
        detail: `Could not reach ${origin}: ${error instanceof Error ? error.message : "error"}`,
      });
      return { url, host, checks };
    }

    const headers = base.headers;
    checks.push({
      check: "Reachability",
      status: base.status >= 200 && base.status < 400 ? "pass" : "warn",
      detail: `HTTP ${base.status} (${base.finalUrl})`,
    });

    const server = headers["server"];
    checks.push({
      check: "Server banner",
      status: server ? "info" : "pass",
      detail: server
        ? `Server header exposed: "${server}" — helps attackers fingerprint the stack.`
        : "No server banner exposed.",
    });

    const csp = headers["content-security-policy"];
    checks.push({
      check: "Content-Security-Policy",
      status: csp ? "pass" : "fail",
      detail: csp
        ? `CSP present: ${csp.slice(0, 120)}`
        : "No CSP header. Reflected/stored XSS will execute without restriction.",
    });

    const hsts = headers["strict-transport-security"];
    checks.push({
      check: "Strict-Transport-Security",
      status: hsts ? "pass" : "fail",
      detail: hsts
        ? `HSTS present: ${hsts.slice(0, 120)}`
        : "No HSTS header — SSL-stripping and protocol-downgrade attacks are easier.",
    });

    const xfo = headers["x-frame-options"];
    const cspFrame = csp?.includes("frame-ancestors");
    checks.push({
      check: "Clickjacking protection",
      status: xfo || cspFrame ? "pass" : "warn",
      detail: xfo
        ? `X-Frame-Options: ${xfo}`
        : cspFrame
          ? "CSP frame-ancestors present."
          : "No frame-busting protection — clickjacking may be possible.",
    });

    const xcto = headers["x-content-type-options"];
    checks.push({
      check: "MIME sniffing protection",
      status: xcto === "nosniff" ? "pass" : "warn",
      detail: xcto
        ? `X-Content-Type-Options: ${xcto}`
        : "X-Content-Type-Options not set to nosniff.",
    });

    const rp = headers["referrer-policy"];
    checks.push({
      check: "Referrer-Policy",
      status: rp ? "pass" : "warn",
      detail: rp
        ? `Referrer-Policy: ${rp}`
        : "No Referrer-Policy — sensitive URLs can leak in the Referer header.",
    });

    // 2. robots.txt
    try {
      const robots = await get(`${origin}/robots.txt`, 15_000);
      if (robots.status === 200 && robots.text.trim()) {
        const disallows = robots.text
          .split("\n")
          .filter((l) => /^\s*disallow/i.test(l))
          .map((l) => l.trim())
          .slice(0, 8);
        checks.push({
          check: "robots.txt",
          status: "info",
          detail:
            disallows.length > 0
              ? `Disallowed paths exposed: ${disallows.join(", ")} — often hints at hidden areas (check if they're actually protected).`
              : "robots.txt exists with no disallow rules.",
        });
      } else {
        checks.push({
          check: "robots.txt",
          status: "info",
          detail: `No robots.txt (HTTP ${robots.status}).`,
        });
      }
    } catch {
      checks.push({
        check: "robots.txt",
        status: "info",
        detail: "Could not fetch robots.txt.",
      });
    }

    // 3. sitemap presence (read-only existence check)
    try {
      const sitemap = await get(`${origin}/sitemap.xml`, 15_000);
      checks.push({
        check: "sitemap.xml",
        status: "info",
        detail:
          sitemap.status === 200
            ? "Sitemap found — useful for enumerating pages (authorized testing only)."
            : `No sitemap.xml (HTTP ${sitemap.status}).`,
      });
    } catch {
      checks.push({
        check: "sitemap.xml",
        status: "info",
        detail: "Could not fetch sitemap.xml.",
      });
    }

    return { url, host, checks };
  },
});

/** Minimal GET with timeout, redirect-following, and capped body. */
async function get(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mythos-Recon/1.0 (authorized security testing, passive checks only)",
        Accept: "text/html,application/xml,*/*;q=0.8",
      },
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const text = (await response.text()).slice(0, 8000);
    return { status: response.status, headers, text, finalUrl: response.url };
  } finally {
    clearTimeout(timer);
  }
}

/** Does the (lowercased) host match any line of the declared scope text? */
function hostInScope(host: string, scope: string): boolean {
  const entries = scope
    .split(/\n|,/)
    .map((line) =>
      line
        .replace(/^https?:\/\//i, "")
        .replace(/^www\./i, "")
        .replace(/\/.*$/, "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  for (const entry of entries) {
    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      if (host === base || host.endsWith(`.${base}`)) return true;
    }
    if (host === entry || host.endsWith(`.${entry}`)) return true;
  }
  return false;
}
