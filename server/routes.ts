import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisSchema, sharedResults, insertSharedResultSchema } from "@shared/schema";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";
import { db } from "./db";
import { nanoid } from "nanoid";
import { eq, lt } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Upload and analyze conversation file
  app.post("/api/analyze", async (req, res) => {
    try {
      const validatedData = insertAnalysisSchema.parse(req.body);
      
      // Create initial analysis record
      const analysis = await storage.createAnalysis(validatedData);
      
      // Start async processing
      processAnalysis(analysis.id, validatedData.fileContent).catch(err => {
        console.error('Analysis processing error:', err);
        storage.updateAnalysis(analysis.id, { 
          status: 'failed',
          error: err.message 
        });
      });
      
      res.json(analysis);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get analysis result
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create shareable link
  app.post("/api/share/:analysisId", async (req, res) => {
    try {
      const { analysisId } = req.params;
      
      // Get the analysis
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (analysis.status !== 'completed') {
        return res.status(400).json({ message: "Can only share completed analysis" });
      }

      // Generate unique share ID
      const shareId = nanoid(10);
      
      // Calculate expiry time (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Save to database
      await db.insert(sharedResults).values({
        id: shareId,
        analysisId,
        analysisData: JSON.stringify(analysis),
        expiresAt,
      });

      res.json({ 
        shareId, 
        shareUrl: `/result/${shareId}`,
        expiresAt: expiresAt.toISOString()
      });
    } catch (error: any) {
      console.error('Share creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shared result
  app.get("/api/share/:shareId", async (req, res) => {
    try {
      const { shareId } = req.params;
      
      const result = await db.query.sharedResults.findFirst({
        where: eq(sharedResults.id, shareId),
      });

      if (!result) {
        return res.status(404).json({ message: "Shared link not found" });
      }

      // Check if expired
      if (new Date() > result.expiresAt) {
        return res.status(410).json({ message: "This link has expired" });
      }

      // Increment view count
      await db.update(sharedResults)
        .set({ viewCount: result.viewCount + 1 })
        .where(eq(sharedResults.id, shareId));

      res.json({
        ...result,
        analysisData: JSON.parse(result.analysisData),
      });
    } catch (error: any) {
      console.error('Share retrieval error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processAnalysis(analysisId: string, fileContent: string) {
  // Parse KakaoTalk file
  const parsed = parseKakaoTalkFile(fileContent);
  
  // Calculate basic stats
  const stats = calculateStats(parsed.messages, parsed.participants);
  
  // Generate chart data
  const chartData = generateChartData(parsed.messages, parsed.participants);
  
  // Update with parsed data
  await storage.updateAnalysis(analysisId, {
    messages: parsed.messages,
    stats,
    charts: {
      ...chartData,
      sentimentDistribution: [], // Will be filled by AI
    },
  });
  
  // Run AI analysis
  const aiAnalysis = await analyzeConversation(parsed.messages, stats);
  
  // Update with AI results
  await storage.updateAnalysis(analysisId, {
    status: 'completed',
    stats: {
      ...stats,
      sentimentScore: aiAnalysis.sentimentScore,
    },
    charts: {
      ...chartData,
      sentimentDistribution: aiAnalysis.sentimentDistribution,
    },
    insights: aiAnalysis.insights,
  });
}
