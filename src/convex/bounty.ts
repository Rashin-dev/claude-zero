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
  },
  handler: async (ctx, { platform, programName, scope, rules }) => {
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");
    return await ctx.db.insert("bountyFindings", {
      userId: user._id,
      ...args,
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
