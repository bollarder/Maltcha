import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisSchema } from "@shared/schema";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";

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
