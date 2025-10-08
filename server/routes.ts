import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";
import { processSummaryRequest } from "./services/gemini-summarizer";
import { performClaudeDeepAnalysis, type ClaudeInputPackage } from "./services/claude-deep-analysis";
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
        secondaryRelationships = [],
        userPurpose
      } = req.body;

      if (!content) {
        return res.status(400).json({ message: "No content provided" });
      }

      if (!userPurpose || typeof userPurpose !== 'string' || !userPurpose.trim()) {
        return res.status(400).json({ message: "분석 목적을 입력해주세요" });
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
        secondaryRelationships,
        userPurpose
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

  // Claude 심층 분석 API
  app.post("/api/analyze/claude", async (req, res) => {
    try {
      const claudeInput: ClaudeInputPackage = req.body;

      // 입력 검증
      if (!claudeInput || typeof claudeInput !== 'object') {
        return res.status(400).json({ message: "Invalid request body" });
      }

      if (!claudeInput.systemPrompt || typeof claudeInput.systemPrompt !== 'string') {
        return res.status(400).json({ message: "Missing or invalid systemPrompt" });
      }

      if (!claudeInput.relationshipContext || typeof claudeInput.relationshipContext !== 'object') {
        return res.status(400).json({ message: "Missing or invalid relationshipContext" });
      }

      if (!claudeInput.relationshipContext.type || !claudeInput.relationshipContext.purpose) {
        return res.status(400).json({ message: "Missing relationshipContext.type or purpose" });
      }

      if (!Array.isArray(claudeInput.highMessages)) {
        return res.status(400).json({ message: "Missing or invalid highMessages array" });
      }

      if (!Array.isArray(claudeInput.mediumSamples)) {
        return res.status(400).json({ message: "Missing or invalid mediumSamples array" });
      }

      if (!claudeInput.tokenEstimate || typeof claudeInput.tokenEstimate !== 'object') {
        return res.status(400).json({ message: "Missing or invalid tokenEstimate" });
      }

      // 토큰 제한 검증 (200K 이하)
      const totalTokens = claudeInput.tokenEstimate.total || 0;
      if (totalTokens <= 0 || totalTokens > 200000) {
        return res.status(400).json({ 
          message: `Invalid token estimate: ${totalTokens} (must be between 1 and 200,000)` 
        });
      }

      console.log('\n🔬 Claude 심층 분석 요청 수신');
      console.log(`- 관계: ${claudeInput.relationshipContext.type}`);
      console.log(`- 목적: ${claudeInput.relationshipContext.purpose}`);
      console.log(`- HIGH 메시지: ${claudeInput.highMessages.length}개`);
      console.log(`- MEDIUM 샘플: ${claudeInput.mediumSamples.length}개`);
      console.log(`- 추정 토큰: ${totalTokens.toLocaleString()}개\n`);

      // Claude API로 심층 분석 수행 (서버 메모리에서만 처리)
      const result = await performClaudeDeepAnalysis(claudeInput);

      // 결과 반환 후 서버 메모리 자동 해제
      res.json(result);

      console.log('✅ Claude 분석 결과 전송 완료\n');
    } catch (error: any) {
      console.error("Claude analysis API error:", error);
      res.status(500).json({ 
        message: error.message || "Claude 분석 중 오류가 발생했습니다" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function processAnalysis(
  analysisId: string, 
  fileContent: string,
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = [],
  userPurpose?: string
) {
  const parsed = parseKakaoTalkFile(fileContent);

  const stats = calculateStats(parsed.messages, parsed.participants);

  const chartData = generateChartData(parsed.messages, parsed.participants);

  await storage.updateAnalysis(analysisId, {
    messages: parsed.messages,
    userPurpose,
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
    { useMultiTurn: true, userPurpose }
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
    deepAnalysis: aiAnalysis.deepAnalysis,
  });
}
