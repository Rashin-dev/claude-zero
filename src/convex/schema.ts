import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    conversations: defineTable({
      userId: v.id("users"),
      title: v.string(),
      mode: v.optional(v.string()), // "chat" | "coding" | "bounty"
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_updated", ["userId", "updatedAt"]),

    bountyProfiles: defineTable({
      userId: v.id("users"),
      platform: v.string(), // hackerone | bugcrowd | intigriti | custom
      programName: v.string(),
      scope: v.string(),
      rules: v.string(),
      learnings: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    bountyFindings: defineTable({
      userId: v.id("users"),
      title: v.string(),
      severity: v.string(), // critical | high | medium | low
      cwe: v.string(),
      cvss: v.optional(v.string()),
      description: v.string(),
      impact: v.string(),
      reproduction: v.string(),
      remediation: v.string(),
      status: v.optional(v.string()), // open | confirmed | false_positive | duplicate | fixed
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    bountyScans: defineTable({
      userId: v.id("users"),
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
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // Per-day model request counter, so the free tier's daily quota is
    // visible (and never a surprise).
    dailyUsage: defineTable({
      userId: v.id("users"),
      date: v.string(), // YYYY-MM-DD (UTC)
      count: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_date", ["userId", "date"]),

    messages: defineTable({
      conversationId: v.id("conversations"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      model: v.optional(v.string()),
      streaming: v.optional(v.boolean()),
      canceled: v.optional(v.boolean()),
      error: v.optional(v.string()),
      // Transient streaming state shown to the user (e.g. "retry:3/10").
      // Cleared when the message finishes or starts streaming content.
      status: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_conversation", ["conversationId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
