import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";
import { processSummaryRequest } from "./services/gemini-summarizer";
import { nanoid } from "nanoid";

function generateId(): string {
  return nanoid();
}

export function registerRoutes(app: Express): Server {
  app.post("/api/analyze", async (req, res) => {
    try {
      const { 
        content, 
        primaryRelationship = "친구", 
        secondaryRelationships = [] 
      } = req.body;

      if (!content) {
        return res.status(400).json({ message: "No content provided" });
      }

      const analysis = await storage.createAnalysis({
        fileName: "conversation.txt",
        fileSize: content.length,
      });

      res.json({ analysisId: analysis.id });

      processAnalysis(
        analysis.id, 
        content, 
        primaryRelationship, 
        secondaryRelationships
      ).catch((error) => {
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

  // Gemini 최종 요약 API
  app.post("/api/summarize", async (req, res) => {
    try {
      const { filterResult, relationshipType = "친구" } = req.body;

      if (!filterResult) {
        return res.status(400).json({ message: "No filter result provided" });
      }

      console.log(`Received filter result: ${filterResult.stats?.total || 0} messages`);

      // Gemini API로 요약 생성 (서버 메모리에서만 처리)
      const summary = await processSummaryRequest(filterResult, relationshipType);

      // 결과 반환 후 서버 메모리 자동 해제
      res.json(summary);
    } catch (error: any) {
      console.error("Summarize API error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processAnalysis(
  analysisId: string, 
  fileContent: string,
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = []
) {
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

  const aiAnalysis = await analyzeConversation(
    parsed.messages, 
    stats,
    primaryRelationship,
    secondaryRelationships,
    { useMultiTurn: true }
  );

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
  });
}
