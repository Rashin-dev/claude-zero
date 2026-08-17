import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const DEFAULT_TITLE = "New chat";

/**
 * Create a conversation for the signed-in user.
 */
export const createConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      userId: user._id,
      title: DEFAULT_TITLE,
      mode: "chat",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * List the signed-in user's conversations, most recently updated first.
 */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("conversations")
      .withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Get the messages of a conversation, oldest first. Returns [] if the
 * conversation doesn't belong to the signed-in user.
 */
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) return [];

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  },
});

/**
 * Store the user's message and create the (initially empty) assistant
 * message that the streaming action will fill in. Returns the assistant
 * message id. Also auto-titles the conversation from the first message.
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.string(),
    mode: v.optional(v.string()), // workspace mode: "chat" | "coding" | "bounty"
  },
  handler: async (ctx, { conversationId, content, model, mode }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();
    if (mode && mode !== conversation.mode) {
      await ctx.db.patch(conversationId, { mode });
    }
    await ctx.db.insert("messages", {
      conversationId,
      role: "user",
      content,
      createdAt: now,
    });

    const assistantId = await ctx.db.insert("messages", {
      conversationId,
      role: "assistant",
      content: "",
      model,
      streaming: true,
      createdAt: now + 1,
    });

    if (conversation.title === DEFAULT_TITLE) {
      const firstLine = content.trim().split("\n")[0];
      const title =
        firstLine.length > 42 ? `${firstLine.slice(0, 42)}…` : firstLine;
      await ctx.db.patch(conversationId, {
        title: title || DEFAULT_TITLE,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(conversationId, { updatedAt: now });
    }

    return assistantId;
  },
});

/**
 * Append a chunk of streamed text to an assistant message. No-ops if the
 * message was canceled, already finished, or belongs to another user.
 */
export const appendChunk = mutation({
  args: { messageId: v.id("messages"), text: v.string() },
  handler: async (ctx, { messageId, text }) => {
    if (!text) return;
    const user = await getCurrentUser(ctx);
    if (!user) return;

    const message = await ctx.db.get(messageId);
    if (!message || message.role !== "assistant" || message.canceled) return;

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== user._id) return;

    await ctx.db.patch(messageId, { content: message.content + text });
  },
});

/**
 * Mark the assistant message as no longer streaming, optionally with an
 * error message to surface in the UI.
 */
export const finishMessage = mutation({
  args: {
    messageId: v.id("messages"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, error }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return;

    const message = await ctx.db.get(messageId);
    if (!message) return;

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== user._id) return;

    await ctx.db.patch(messageId, {
      streaming: false,
      ...(error ? { error } : {}),
    });
  },
});

/**
 * Ask the streaming action to stop filling in this assistant message.
 */
export const stopGeneration = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return;

    const message = await ctx.db.get(messageId);
    if (!message) return;

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== user._id) return;

    await ctx.db.patch(messageId, { canceled: true, streaming: false });
  },
});

/**
 * Internal: load everything the streaming action needs to build the prompt
 * and verify ownership. Returns null when the conversation is missing or
 * doesn't belong to the signed-in user.
 */
export const getStreamContext = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, { conversationId, assistantMessageId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) return null;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();

    return { messages, mode: conversation.mode ?? "chat" };
  },
});

/**
 * Internal: check whether an assistant message has been canceled (the Stop
 * button), so the streaming action can stop early.
 */
export const isMessageCanceled = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    return message?.canceled === true;
  },
});

/**
 * Delete a conversation and all of its messages.
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not signed in");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error("Conversation not found");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(conversationId);
  },
});
