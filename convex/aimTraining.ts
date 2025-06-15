import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const saveSession = mutation({
  args: {
    gameMode: v.string(),
    score: v.number(),
    accuracy: v.number(),
    averageReactionTime: v.number(),
    targetsHit: v.number(),
    targetsMissed: v.number(),
    duration: v.number(),
    centerHits: v.optional(v.number()),
    ringHits: v.optional(v.number()),
    edgeHits: v.optional(v.number()),
    settings: v.object({
      targetSize: v.number(),
      targetSpeed: v.number(),
      gameTime: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to save session");
    }

    return await ctx.db.insert("aimSessions", {
      userId,
      ...args,
    });
  },
});

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const sessions = await ctx.db
      .query("aimSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        bestScore: 0,
        averageAccuracy: 0,
        averageReactionTime: 0,
        recentSessions: [],
      };
    }

    const totalSessions = sessions.length;
    const bestScore = Math.max(...sessions.map(s => s.score));
    const averageAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0) / totalSessions;
    const averageReactionTime = sessions.reduce((sum, s) => sum + s.averageReactionTime, 0) / totalSessions;

    return {
      totalSessions,
      bestScore,
      averageAccuracy,
      averageReactionTime,
      recentSessions: sessions.slice(0, 10),
    };
  },
});
