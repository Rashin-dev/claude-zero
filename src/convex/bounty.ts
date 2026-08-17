import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const PLATFORMS = [
  "hackerone",
  "bugcrowd",
  "intigriti",
  "custom",
] as const;

/**
 * The signed-in user's bug bounty program profile (scope + rules of
 * engagement), or null if not set up yet. One profile per user.
 */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return (
      (await ctx.db
        .query("bountyProfiles")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first()) ?? null
    );
  },
});

/**
 * Create or update the signed-in user's program profile.
 */
export const saveProfile = mutation({
  args: {
    platform: v.string(),
    programName: v.string(),
    scope: v.string(),
    rules: v.string(),
    learnings: v.optional(v.string()),
  },
  handler: async (ctx, { platform, programName, scope, rules, learnings }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const existing = await ctx.db
      .query("bountyProfiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const data = {
      platform,
      programName,
      scope,
      rules,
      learnings: learnings ?? "",
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("bountyProfiles", { userId: user._id, ...data });
  },
});

/**
 * All findings recorded by the signed-in user, newest first.
 */
export const listFindings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("bountyFindings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Record a new finding.
 */
export const addFinding = mutation({
  args: {
    title: v.string(),
    severity: v.string(),
    cwe: v.string(),
    cvss: v.optional(v.string()),
    description: v.string(),
    impact: v.string(),
    reproduction: v.string(),
    remediation: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");
    const { status, ...rest } = args;
    return await ctx.db.insert("bountyFindings", {
      userId: user._id,
      ...rest,
      status: status ?? "open",
      createdAt: Date.now(),
    });
  },
});

/**
 * Update an existing finding.
 */
export const updateFinding = mutation({
  args: {
    findingId: v.id("bountyFindings"),
    title: v.string(),
    severity: v.string(),
    cwe: v.string(),
    cvss: v.optional(v.string()),
    description: v.string(),
    impact: v.string(),
    reproduction: v.string(),
    remediation: v.string(),
  },
  handler: async (ctx, { findingId, ...fields }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const finding = await ctx.db.get(findingId);
    if (!finding || finding.userId !== user._id) {
      throw new Error("Finding not found");
    }
    await ctx.db.patch(findingId, fields);
  },
});

/**
 * Quick triage: flip a finding's status (open / confirmed / false_positive /
 * duplicate / fixed) without rewriting the whole finding.
 */
export const setFindingStatus = mutation({
  args: {
    findingId: v.id("bountyFindings"),
    status: v.string(),
  },
  handler: async (ctx, { findingId, status }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const finding = await ctx.db.get(findingId);
    if (!finding || finding.userId !== user._id) {
      throw new Error("Finding not found");
    }
    await ctx.db.patch(findingId, { status });
  },
});

/**
 * Persist a completed passive scan so it shows up in the hunt dashboard.
 */
export const recordScan = mutation({
  args: {
    url: v.string(),
    host: v.string(),
    failCount: v.number(),
    warnCount: v.number(),
    checks: v.array(
      v.object({
        check: v.string(),
        status: v.string(),
        detail: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");
    await ctx.db.insert("bountyScans", {
      userId: user._id,
      ...args,
      createdAt: Date.now(),
    });
  },
});

/**
 * Recent passive scans for the signed-in user, newest first.
 */
export const listScans = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("bountyScans")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(25);
  },
});

/**
 * Delete a finding.
 */
export const deleteFinding = mutation({
  args: { findingId: v.id("bountyFindings") },
  handler: async (ctx, { findingId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const finding = await ctx.db.get(findingId);
    if (!finding || finding.userId !== user._id) {
      throw new Error("Finding not found");
    }
    await ctx.db.delete(findingId);
  },
});
