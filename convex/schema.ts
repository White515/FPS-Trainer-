import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  aimSessions: defineTable({
    userId: v.id("users"),
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
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
