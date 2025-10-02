import { z } from "zod";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Conversation message structure
export const messageSchema = z.object({
  timestamp: z.string(),
  participant: z.string(),
  content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

// Analysis result structure
export const analysisResultSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  uploadedAt: z.string(),
  status: z.enum(["processing", "completed", "failed"]),
  messages: z.array(messageSchema),
  stats: z
    .object({
      totalMessages: z.number(),
      participants: z.number(),
      avgResponseTime: z.string(),
      sentimentScore: z.number(),
    })
    .optional(),
  charts: z
    .object({
      messageFrequency: z.array(
        z.object({
          date: z.string(),
          count: z.number(),
        }),
      ),
      participantActivity: z.array(
        z.object({
          name: z.string(),
          count: z.number(),
        }),
      ),
      hourlyActivity: z.array(
        z.object({
          hour: z.number(),
          count: z.number(),
        }),
      ),
      sentimentDistribution: z.array(
        z.object({
          name: z.string(),
          value: z.number(),
        }),
      ),
    })
    .optional(),
  insights: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  // Stage 1 데이터 추가
  stage1Data: z
    .object({
      basicStats: z.any().optional(),
      keyInfo: z.any().optional(),
    })
    .optional(),
  // Stage 2 데이터 추가
  stage2Data: z
    .object({
      communicationStyle: z.any().optional(),
      languagePattern: z.any().optional(),
      emotionalExpression: z.any().optional(),
      relationshipDynamics: z.any().optional(),
      specialPatterns: z.any().optional(),
      partnerStatus: z.any().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export const insertAnalysisSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// Shared results table for shareable links
export const sharedResults = pgTable("shared_results", {
  id: varchar("id", { length: 10 }).primaryKey(),
  analysisId: varchar("analysis_id", { length: 255 }).notNull(),
  analysisData: text("analysis_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  viewCount: integer("view_count").notNull().default(0),
});

export const insertSharedResultSchema = createInsertSchema(sharedResults).omit({
  createdAt: true,
  viewCount: true,
});

export const selectSharedResultSchema = createSelectSchema(sharedResults);

export type InsertSharedResult = z.infer<typeof insertSharedResultSchema>;
export type SharedResult = typeof sharedResults.$inferSelect;
