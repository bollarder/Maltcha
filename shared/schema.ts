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
  userPurpose: z.string().optional(),
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
  // Claude 심층 분석 결과
  claudeAnalysis: z
    .object({
      relationshipOverview: z.string(),
      communicationPatterns: z.object({
        tikitakaAnalysis: z.string(),
        conversationFlow: z.string(),
        responsePatterns: z.string(),
      }),
      emotionalDynamics: z.object({
        sentimentTrends: z.string(),
        emotionalMoments: z.array(
          z.object({
            type: z.string(),
            description: z.string(),
            context: z.string(),
          })
        ),
        emotionalBalance: z.string(),
      }),
      psychologicalInsights: z.object({
        attachmentStyle: z.string(),
        conflictResolution: z.string(),
        intimacyPatterns: z.string(),
        communicationBarriers: z.string(),
      }),
      relationshipHealth: z.object({
        currentState: z.string(),
        strengths: z.array(z.string()),
        concerns: z.array(z.string()),
        trajectory: z.string(),
      }),
      practicalAdvice: z.object({
        immediateActions: z.array(z.string()),
        longTermStrategies: z.array(z.string()),
        communicationTips: z.array(z.string()),
      }),
      conclusion: z.string(),
    })
    .optional(),
  // Multi-turn 심층 분석 결과 (Turn 1, Turn 2)
  deepAnalysis: z
    .object({
      turn1: z.any().optional(),
      turn2: z.any().optional(),
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
