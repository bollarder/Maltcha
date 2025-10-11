/**
 * 🔬 Maltcha Pipeline Test Script
 * 
 * 각 단계를 독립적으로 테스트하고 결과를 JSON으로 저장합니다.
 * 
 * 사용법:
 * 1. server/sample.txt에 테스트용 카카오톡 대화 파일 준비
 * 2. 원하는 단계의 주석 해제
 * 3. npx tsx server/test-pipeline.ts 실행
 * 4. test_outputs/*.json 파일로 결과 확인
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';

// Stage 0: 파서
import { parseKakaoTalkFile, calculateStats, generateChartData } from './services/kakao-parser';

// Stage 1: Gemini 필터링
import { processBatches, mergeFilterResults } from './services/gemini-filter';

// Stage 2: Gemini 배치 요약
import { summarizeAllBatches } from './services/gemini-batch-summary';

// Stage 3: Gemini 프로파일러
import { summarizeWithGemini } from './services/gemini-summarizer';

// Stage 4: Claude 심층 분석
import { performClaudeDeepAnalysis } from './services/claude-deep-analysis';
import type { ClaudeInputPackage } from './services/claude-deep-analysis';

// Stage 5: Tea Coach
import { generateTeaCoachReport } from './services/claude-coach-tea';
import type { TeaCoachInput } from './services/claude-coach-tea';

// 유틸리티: 이전 단계 결과 불러오기
async function loadStageResult<T>(stageNumber: number): Promise<T> {
  const filePath = path.join(process.cwd(), 'test_outputs', `${stageNumber}_output.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

// 유틸리티: 결과 저장
async function saveStageResult(stageNumber: number, data: any, description: string) {
  const filePath = path.join(process.cwd(), 'test_outputs', `${stageNumber}_output.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`✅ Stage ${stageNumber}: ${description}`);
  console.log(`   📁 저장 위치: test_outputs/${stageNumber}_output.json\n`);
}

// --------------------------------------------------
// ▼▼▼ 테스트할 단계의 주석을 해제하세요 ▼▼▼
// --------------------------------------------------
async function runTest() {
  try {
    console.log('🔬 Maltcha Pipeline Test Started\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 테스트용 대화 파일 읽기
    const samplePath = path.join(process.cwd(), 'server', 'sample.txt');
    const sampleChat = await fs.readFile(samplePath, 'utf-8');
    console.log(`📖 테스트 파일 로드: server/sample.txt\n`);

    // ========================================
    // Stage 0: 카카오톡 파서
    // ========================================
    console.log('Stage 0: 카카오톡 파싱 중...');
    const parsed = parseKakaoTalkFile(sampleChat);
    const stats = calculateStats(parsed.messages, parsed.participants);
    const charts = generateChartData(parsed.messages, parsed.participants);
    
    const stage0Output = {
      messages: parsed.messages,
      participants: Array.from(parsed.participants),
      stats,
      charts,
      messageCount: parsed.messages.length,
    };
    
    await saveStageResult(0, stage0Output, '파싱 완료');

    // ========================================
    // Stage 1: Gemini 필터링 (HIGH/MEDIUM 분류)
    // ========================================
    console.log('Stage 1: Gemini 필터링 중...');
    const stage0Data = await loadStageResult<typeof stage0Output>(0);
    
    const BATCH_SIZE = 2000;
    const batches: any[] = [];
    const filterMessages = stage0Data.messages.map((m, index) => ({
      date: m.timestamp,
      user: m.participant,
      message: m.content,
      index,
    }));
    
    for (let i = 0; i < filterMessages.length; i += BATCH_SIZE) {
      batches.push(filterMessages.slice(i, i + BATCH_SIZE));
    }
    
    const relationshipType = '연인'; // 또는 원하는 관계 유형
    const userPurpose = '관계 분석'; // 또는 원하는 분석 목적
    
    const filterResults = await processBatches(batches, relationshipType, userPurpose);
    const mergedFilter = mergeFilterResults(filterResults);
    
    const stage1Output = {
      batchCount: batches.length,
      filterResults: filterResults,
      merged: {
        high: mergedFilter.high,
        medium: mergedFilter.medium,
        stats: mergedFilter.stats,
      },
      summary: {
        totalMessages: mergedFilter.stats.total,
        highCount: mergedFilter.stats.high,
        mediumCount: mergedFilter.stats.medium,
        lowCount: mergedFilter.stats.low,
        highPercent: (mergedFilter.stats.high / mergedFilter.stats.total * 100).toFixed(1),
        mediumPercent: (mergedFilter.stats.medium / mergedFilter.stats.total * 100).toFixed(1),
      }
    };
    
    await saveStageResult(1, stage1Output, '필터링 완료');

    // ========================================
    // Stage 2: Gemini 배치 요약
    // ========================================
    // console.log('Stage 2: Gemini 배치 요약 중...');
    // const stage1Data = await loadStageResult<typeof stage1Output>(1);
    // const stage0Data2 = await loadStageResult<typeof stage0Output>(0);
    // 
    // const batchSummaries = await summarizeAllBatches(
    //   stage1Data.filterResults,
    //   stage0Data2.messages
    // );
    // 
    // const stage2Output = {
    //   batchCount: batchSummaries.length,
    //   summaries: batchSummaries,
    //   totalTokens: batchSummaries.reduce((sum, b) => sum + b.token_count, 0),
    // };
    // 
    // await saveStageResult(2, stage2Output, '배치 요약 완료');

    // ========================================
    // Stage 3: Gemini 프로파일러 (FBI 프로파일)
    // ========================================
    // console.log('Stage 3: Gemini 프로파일러 중...');
    // const stage1Data3 = await loadStageResult<typeof stage1Output>(1);
    // const stage2Data = await loadStageResult<typeof stage2Output>(2);
    // 
    // const geminiSummary = await summarizeWithGemini(
    //   stage1Data3.merged,
    //   '연인', // relationshipType
    //   '관계 분석', // userPurpose
    //   stage2Data.summaries
    // );
    // 
    // const stage3Output = {
    //   geminiSummary,
    //   summary: {
    //     timelineEvents: geminiSummary.timeline?.length || 0,
    //     turningPoints: geminiSummary.turning_points?.length || 0,
    //     highIndices: geminiSummary.high_indices.length,
    //     mediumSamples: geminiSummary.medium_sample?.length || 0,
    //     relationshipHealth: geminiSummary.statistics?.relationship_health,
    //   }
    // };
    // 
    // await saveStageResult(3, stage3Output, 'FBI 프로파일 완료');

    // ========================================
    // Stage 4: Claude 심층 분석
    // ========================================
    // console.log('Stage 4: Claude 심층 분석 중...');
    // const stage0Data4 = await loadStageResult<typeof stage0Output>(0);
    // const stage3Data = await loadStageResult<typeof stage3Output>(3);
    // 
    // // HIGH 메시지 추출
    // const allHighMessages = stage3Data.geminiSummary.high_indices
    //   .filter(idx => idx >= 0 && idx < stage0Data4.messages.length)
    //   .map(idx => ({
    //     index: idx,
    //     date: stage0Data4.messages[idx].timestamp,
    //     user: stage0Data4.messages[idx].participant,
    //     message: stage0Data4.messages[idx].content,
    //   }));
    // 
    // // MEDIUM 샘플 추출 (첫 300개)
    // const mediumSamples = (stage3Data.geminiSummary.medium_sample || [])
    //   .slice(0, 300)
    //   .filter(s => s.index >= 0 && s.index < stage0Data4.messages.length)
    //   .map(s => ({
    //     index: s.index,
    //     date: stage0Data4.messages[s.index].timestamp,
    //     user: stage0Data4.messages[s.index].participant,
    //     message: stage0Data4.messages[s.index].content,
    //   }));
    // 
    // const participants = stage0Data4.participants;
    // const firstDate = stage0Data4.messages[0]?.timestamp || '';
    // const lastDate = stage0Data4.messages[stage0Data4.messages.length - 1]?.timestamp || '';
    // 
    // const claudeInput: ClaudeInputPackage = {
    //   systemPrompt: `당신은 대화 분석 전문가입니다.`,
    //   geminiSummary: stage3Data.geminiSummary,
    //   highMessages: allHighMessages,
    //   mediumSamples: mediumSamples,
    //   relationshipContext: {
    //     type: '연인',
    //     purpose: '관계 분석',
    //     participants,
    //     period: {
    //       start: firstDate,
    //       end: lastDate,
    //       duration: `${Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24))}일`,
    //     },
    //     statistics: {
    //       totalMessages: stage0Data4.messages.length,
    //       filteredHigh: allHighMessages.length,
    //       filteredMedium: mediumSamples.length,
    //       averagePerDay: Math.ceil(stage0Data4.messages.length / Math.max(1, Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (1000 * 60 * 60 * 24)))),
    //     },
    //     background: `${participants[0]}님과 ${participants[1] || '상대방'}님의 연인 관계 대화 분석입니다.`,
    //   },
    //   tokenEstimate: {
    //     systemPrompt: 200,
    //     geminiSummary: Math.ceil(JSON.stringify(stage3Data.geminiSummary).length / 2.5),
    //     highMessages: Math.ceil(allHighMessages.reduce((sum, m) => sum + m.message.length, 0) / 2.5),
    //     mediumSamples: Math.ceil(mediumSamples.reduce((sum, m) => sum + m.message.length, 0) / 2.5),
    //     relationshipContext: 200,
    //     total: 0,
    //   },
    // };
    // 
    // claudeInput.tokenEstimate.total = 
    //   claudeInput.tokenEstimate.systemPrompt +
    //   claudeInput.tokenEstimate.geminiSummary +
    //   claudeInput.tokenEstimate.highMessages +
    //   claudeInput.tokenEstimate.mediumSamples +
    //   claudeInput.tokenEstimate.relationshipContext;
    // 
    // const claudeResult = await performClaudeDeepAnalysis(claudeInput);
    // 
    // const stage4Output = {
    //   claudeInput: {
    //     tokenEstimate: claudeInput.tokenEstimate,
    //     highMessageCount: allHighMessages.length,
    //     mediumSampleCount: mediumSamples.length,
    //   },
    //   claudeResult,
    // };
    // 
    // await saveStageResult(4, stage4Output, 'Claude 심층 분석 완료');

    // ========================================
    // Stage 5: Tea Coach 보고서
    // ========================================
    // console.log('Stage 5: Tea Coach 보고서 생성 중...');
    // const stage3Data5 = await loadStageResult<typeof stage3Output>(3);
    // const stage4Data = await loadStageResult<typeof stage4Output>(4);
    // const stage0Data5 = await loadStageResult<typeof stage0Output>(0);
    // 
    // const messageSamples = stage3Data5.geminiSummary.high_indices
    //   .slice(-100)
    //   .filter(idx => idx >= 0 && idx < stage0Data5.messages.length)
    //   .map(idx => ({
    //     index: idx,
    //     date: stage0Data5.messages[idx].timestamp,
    //     user: stage0Data5.messages[idx].participant,
    //     message: stage0Data5.messages[idx].content,
    //   }));
    // 
    // const participants5 = stage0Data5.participants;
    // const teaInput: TeaCoachInput = {
    //   fbiProfile: stage3Data5.geminiSummary,
    //   therapistAnalysis: stage4Data.claudeResult.analysis,
    //   messageSamples,
    //   userName: participants5[0] || "사용자",
    //   partnerName: participants5[1] || "상대방",
    //   statistics: {
    //     totalMessages: stage0Data5.messages.length,
    //     avgMessagesPerDay: Math.ceil(stage0Data5.messages.length / Math.max(1, Math.ceil((new Date(stage0Data5.messages[stage0Data5.messages.length - 1].timestamp).getTime() - new Date(stage0Data5.messages[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)))),
    //     conversationPeriod: `${stage0Data5.messages[0]?.timestamp} ~ ${stage0Data5.messages[stage0Data5.messages.length - 1]?.timestamp}`,
    //     relationshipHealthScore: 7.5,
    //     greenFlagCount: 0,
    //     redFlagCount: 0,
    //   },
    // };
    // 
    // const teaReport = await generateTeaCoachReport(teaInput);
    // 
    // const stage5Output = {
    //   teaReport,
    //   summary: {
    //     insightCount: teaReport.insights.length,
    //     totalWords: teaReport.metadata.total_words,
    //   }
    // };
    // 
    // await saveStageResult(5, stage5Output, 'Tea Coach 보고서 완료');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 테스트 완료!\n');
    console.log('💡 다음 단계 실행 방법:');
    console.log('   1. 위 코드에서 다음 Stage 주석 해제');
    console.log('   2. npx tsx server/test-pipeline.ts 다시 실행');
    console.log('   3. test_outputs/*.json 파일로 결과 확인\n');

  } catch (error: any) {
    console.error('\n❌ 테스트 중 오류 발생:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(error.message);
    console.error('\n스택 트레이스:');
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트 실행
runTest();
