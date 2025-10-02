import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";
import { nanoid } from "nanoid";

function generateId(): string {
  return nanoid();
}

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze", async (req, res) => {
    try {
      const { fileName, fileSize, fileContent } = req.body;

      if (!fileContent) {
        return res.status(400).json({ message: "No content provided" });
      }

      const analysis = await storage.createAnalysis({
        fileName,
        fileSize,
      });

      res.json({ id: analysis.id });

      processAnalysis(analysis.id, fileContent).catch((error) => {
        console.error("Analysis error:", error);
        storage.updateAnalysis(analysis.id, {
          status: "failed",
          error: error.message,
        });
      });
    } catch (error: any) {
      console.error("API error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getAnalysis(id);

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
  const parsed = parseKakaoTalkFile(fileContent);

  const stats = calculateStats(parsed.messages, parsed.participants);

  const chartData = generateChartData(parsed.messages, parsed.participants);

  await storage.updateAnalysis(analysisId, {
    messages: parsed.messages,
    stats,
    charts: {
      ...chartData,
      sentimentDistribution: [],
    },
  });

  const aiAnalysis = await analyzeConversation(parsed.messages, stats);

  await storage.updateAnalysis(analysisId, {
    status: "completed",
    stats: {
      ...stats,
      sentimentScore: aiAnalysis.sentimentScore,
    },
    charts: {
      ...chartData,
      sentimentDistribution: aiAnalysis.sentimentDistribution,
    },
    insights: aiAnalysis.insights,
    stage1Data: aiAnalysis.stage1Data,
    stage2Data: aiAnalysis.stage2Data,
  });
}
