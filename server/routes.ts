import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseKakaoTalkFile, calculateStats, generateChartData } from "./services/kakao-parser";
import { analyzeConversation } from "./services/anthropic";
import { processSummaryRequest } from "./services/gemini-summarizer";
import { performClaudeDeepAnalysis, type ClaudeInputPackage } from "./services/claude-deep-analysis";
import { processBatches, mergeFilterResults, type Message as FilterMessage } from "./services/gemini-filter";
import { summarizeWithGemini } from "./services/gemini-summarizer";
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
  // 1. 파일 파싱
  console.log("\n========== 분석 시작 ==========");
  console.log("1단계: 파일 파싱 중...");
  const parsed = parseKakaoTalkFile(fileContent);
  const stats = calculateStats(parsed.messages, parsed.participants);
  const chartData = generateChartData(parsed.messages, parsed.participants);

  // 초기 업데이트: messages와 userPurpose만 저장 (stats/charts는 최종 결과에서)
  await storage.updateAnalysis(analysisId, {
    messages: parsed.messages,
    userPurpose,
  });

  // 2. Gemini API 키 확인 - 있으면 Gemini + Claude, 없으면 Claude-only
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  
  if (!hasGeminiKey) {
    console.log("⚠️  GEMINI_API_KEY 없음 - Claude-only 모드로 전환");
    
    // Claude-only 분석
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

    console.log("========== Claude-only 분석 완료 ==========\n");
    return;
  }

  // ========== Gemini + Claude 파이프라인 ==========
  console.log("========== Gemini + Claude 파이프라인 시작 ==========");
  
  try {
    // 2. 메시지를 배치로 분할 (2,000개씩)
    console.log(`2단계: ${parsed.messages.length}개 메시지를 2,000개씩 배치로 분할...`);
    const BATCH_SIZE = 2000;
    const batches: FilterMessage[][] = [];
    
    const filterMessages: FilterMessage[] = parsed.messages.map((m, index) => ({
      date: m.timestamp,
      user: m.participant,
      message: m.content,
      index,
    }));

    for (let i = 0; i < filterMessages.length; i += BATCH_SIZE) {
      batches.push(filterMessages.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`✓ 총 ${batches.length}개 배치 생성`);

    // 3. Gemini로 중요도 필터링
    console.log(`3단계: Gemini로 중요도 필터링 중... (목표: HIGH 7%, MEDIUM 13%)`);
    const filterResults = await processBatches(
      batches,
      primaryRelationship,
      userPurpose || '관계 분석'
    );
    
    const mergedFilter = mergeFilterResults(filterResults);
    console.log(`✓ 필터링 완료:`);
    console.log(`  - HIGH: ${mergedFilter.high.length}개 (${(mergedFilter.high.length / mergedFilter.stats.total * 100).toFixed(1)}%)`);
    console.log(`  - MEDIUM: ${mergedFilter.medium.length}개 (${(mergedFilter.medium.length / mergedFilter.stats.total * 100).toFixed(1)}%)`);
    console.log(`  - LOW: ${mergedFilter.stats.low}개 (${(mergedFilter.stats.low / mergedFilter.stats.total * 100).toFixed(1)}%)`);

    // 4. Gemini로 전체 패턴 요약 생성
    console.log(`4단계: Gemini로 전체 패턴 요약 생성 중...`);
    const geminiSummary = await summarizeWithGemini(mergedFilter, primaryRelationship);
    
    // 응답 검증 (high_indices와 medium_sample 모두 확인)
    if (!geminiSummary || !Array.isArray(geminiSummary.high_indices)) {
      throw new Error('Gemini 요약 응답이 유효하지 않습니다: high_indices 누락');
    }
    
    if (!Array.isArray(geminiSummary.medium_sample)) {
      console.warn('⚠️  medium_sample이 배열이 아님, 빈 배열로 대체');
      geminiSummary.medium_sample = [];
    }
    
    // medium_sample 항목 검증
    geminiSummary.medium_sample = geminiSummary.medium_sample.filter(sample => 
      sample && typeof sample.index === 'number' && sample.index >= 0
    );
    
    console.log(`✓ 요약 완료:`);
    console.log(`  - 타임라인: ${geminiSummary.timeline?.length || 0}개 이벤트`);
    console.log(`  - 전환점: ${geminiSummary.turning_points?.length || 0}개`);
    console.log(`  - HIGH 인덱스: ${geminiSummary.high_indices.length}개`);
    console.log(`  - MEDIUM 샘플: ${geminiSummary.medium_sample.length}개 (검증 후)`);

    // 5. HIGH 원문 추출 (유효한 메시지만)
    console.log(`5단계: HIGH 원문 추출 중...`);
    const highMessages = geminiSummary.high_indices
      .filter(index => index >= 0 && index < parsed.messages.length)
      .map(index => ({
        index,
        date: parsed.messages[index].timestamp,
        user: parsed.messages[index].participant,
        message: parsed.messages[index].content,
      }));
    
    const mediumSamples = (geminiSummary.medium_sample || [])
      .filter(sample => sample.index >= 0 && sample.index < parsed.messages.length)
      .map(sample => ({
        index: sample.index,
        date: parsed.messages[sample.index].timestamp,
        user: parsed.messages[sample.index].participant,
        message: parsed.messages[sample.index].content,
      }));
    
    console.log(`✓ 원문 추출 완료: HIGH ${highMessages.length}개, MEDIUM ${mediumSamples.length}개`);

    // 6. Claude 입력 패키지 구성
    console.log(`6단계: Claude 심층 분석 준비 중...`);
    
    const participants = Array.from(new Set(parsed.messages.map(m => m.participant)));
    const firstDate = parsed.messages[0]?.timestamp || '';
    const lastDate = parsed.messages[parsed.messages.length - 1]?.timestamp || '';
    
    const claudeInput: ClaudeInputPackage = {
      systemPrompt: `당신은 대화 분석 전문가입니다.

관계 유형: ${primaryRelationship}
분석 목적: ${userPurpose || '관계 분석'}

아래 제공된 정보를 바탕으로 깊이 있는 관계 분석을 수행하세요:

1. Gemini 요약: 전체 타임라인과 주요 전환점
2. HIGH 메시지 전문: 관계의 핵심 순간들
3. MEDIUM 샘플: 일상적이지만 의미 있는 대화들

분석 시 고려사항:
- 관계의 진화 과정
- 커뮤니케이션 패턴
- 감정의 변화
- 갈등과 해결 과정
- 관계의 건강도

최종 인사이트를 제공해주세요.`,
      geminiSummary,
      highMessages,
      mediumSamples,
      relationshipContext: {
        type: primaryRelationship,
        purpose: userPurpose || '관계 분석',
        participants,
        period: {
          start: firstDate,
          end: lastDate,
          duration: `${Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24))}일`,
        },
        statistics: {
          totalMessages: parsed.messages.length,
          filteredHigh: highMessages.length,
          filteredMedium: mediumSamples.length,
          averagePerDay: Math.ceil(parsed.messages.length / Math.max(1, Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)))),
        },
        background: `${participants[0]}님과 ${participants[1] || '상대방'}님의 ${primaryRelationship} 관계 대화 분석입니다. ${firstDate}부터 ${lastDate}까지 총 ${parsed.messages.length}개의 메시지가 교환되었으며, 이 중 ${highMessages.length}개의 핵심 순간과 ${mediumSamples.length}개의 의미있는 대화를 추출했습니다.`,
      },
      tokenEstimate: {
        systemPrompt: Math.ceil(500 / 2.5),
        geminiSummary: Math.ceil(JSON.stringify(geminiSummary).length / 2.5),
        highMessages: Math.ceil(highMessages.reduce((sum, m) => sum + m.message.length, 0) / 2.5),
        mediumSamples: Math.ceil(mediumSamples.reduce((sum, m) => sum + m.message.length, 0) / 2.5),
        relationshipContext: Math.ceil(500 / 2.5),
        total: 0,
      },
    };
    
    claudeInput.tokenEstimate.total = 
      claudeInput.tokenEstimate.systemPrompt +
      claudeInput.tokenEstimate.geminiSummary +
      claudeInput.tokenEstimate.highMessages +
      claudeInput.tokenEstimate.mediumSamples +
      claudeInput.tokenEstimate.relationshipContext;
    
    console.log(`✓ Claude 입력 패키지 준비 완료 (추정 토큰: ${claudeInput.tokenEstimate.total.toLocaleString()})`);

    // 7. Claude로 심층 분석
    console.log(`7단계: Claude로 심층 분석 실행 중...`);
    const claudeResult = await performClaudeDeepAnalysis(claudeInput);
    console.log(`✓ Claude 분석 완료`);

    // 8. Claude 결과를 storage 형식으로 변환
    console.log(`8단계: 결과 변환 및 저장 중...`);
    
    // practicalAdvice를 insights 형식으로 변환 (null guard 추가)
    const immediateActions = Array.isArray(claudeResult.analysis.practicalAdvice?.immediateActions) 
      ? claudeResult.analysis.practicalAdvice.immediateActions.join(', ')
      : '분석 진행 중입니다.';
    
    const longTermStrategies = Array.isArray(claudeResult.analysis.practicalAdvice?.longTermStrategies)
      ? claudeResult.analysis.practicalAdvice.longTermStrategies.join(', ')
      : '분석 진행 중입니다.';
    
    const communicationTips = Array.isArray(claudeResult.analysis.practicalAdvice?.communicationTips)
      ? claudeResult.analysis.practicalAdvice.communicationTips.join(', ')
      : '분석 진행 중입니다.';
    
    const insights = [
      {
        title: "💡 즉시 실행 가능한 조언",
        description: immediateActions,
      },
      {
        title: "🎯 장기 전략",
        description: longTermStrategies,
      },
      {
        title: "💬 소통 팁",
        description: communicationTips,
      },
      {
        title: "🔍 관계 건강도",
        description: claudeResult.analysis.relationshipHealth?.currentState || '분석 진행 중입니다.',
      },
      {
        title: "✨ 전문가 결론",
        description: claudeResult.analysis.conclusion || '분석 진행 중입니다.',
      },
    ];

    await storage.updateAnalysis(analysisId, {
      status: "completed",
      stats: {
        ...stats,
        sentimentScore: 5, // 기본값 (Gemini sentiment 없음)
      },
      charts: {
        ...chartData,
        sentimentDistribution: [], // Gemini sentiment 없음
      },
      insights,
      deepAnalysis: claudeResult.analysis, // Claude 전체 분석 저장
    });

    console.log("========== Gemini + Claude 파이프라인 완료 ==========\n");
    
  } catch (error) {
    // Gemini 파이프라인 실패 시 Claude-only로 fallback
    console.error("⚠️  Gemini 파이프라인 실패, Claude-only로 전환:", error);
    
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

    console.log("========== Claude-only 분석 완료 (fallback) ==========\n");
  }
}
