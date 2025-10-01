import { z } from "zod";

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
  status: z.enum(['processing', 'completed', 'failed']),
  messages: z.array(messageSchema),
  stats: z.object({
    totalMessages: z.number(),
    participants: z.number(),
    avgResponseTime: z.string(),
    sentimentScore: z.number(),
  }).optional(),
  charts: z.object({
    messageFrequency: z.array(z.object({
      date: z.string(),
      count: z.number(),
    })),
    participantActivity: z.array(z.object({
      name: z.string(),
      count: z.number(),
    })),
    hourlyActivity: z.array(z.object({
      hour: z.number(),
      count: z.number(),
    })),
    sentimentDistribution: z.array(z.object({
      name: z.string(),
      value: z.number(),
    })),
  }).optional(),
  insights: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })).optional(),
  error: z.string().optional(),
});

export const insertAnalysisSchema = z.object({
  fileName: z.string(),
  fileSize: z.number(),
  fileContent: z.string(),
});

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
