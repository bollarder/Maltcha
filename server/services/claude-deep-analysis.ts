// Claude 심층 분석 서비스
// Gemini 요약 + HIGH 원문 + MEDIUM 샘플을 받아 전문 분석 보고서 생성

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const CLAUDE_MODEL = "claude-sonnet-4-20250514";

export interface ClaudeInputPackage {
  systemPrompt: string;
  geminiSummary: any;
  highMessages: Array<{
    index: number;
    date: string;
    user: string;
    message: string;
  }>;
  mediumSamples: Array<{
    index: number;
    date: string;
    user: string;
    message: string;
  }>;
  relationshipContext: {
    type: string;
    purpose: string;
    participants: string[];
    period: {
      start: string;
      end: string;
      duration: string;
    };
    statistics: {
      totalMessages: number;
      filteredHigh: number;
      filteredMedium: number;
      averagePerDay: number;
    };
    background: string;
  };
  tokenEstimate: {
    systemPrompt: number;
    geminiSummary: number;
    highMessages: number;
    mediumSamples: number;
    relationshipContext: number;
    total: number;
  };
}

export interface ClaudeAnalysisResult {
  analysis: {
    relationshipOverview: string;
    communicationPatterns: {
      tikitakaAnalysis: string;
      conversationFlow: string;
      responsePatterns: string;
    };
    emotionalDynamics: {
      sentimentTrends: string;
      emotionalMoments: Array<{
        type: string;
        description: string;
        context: string;
      }>;
      emotionalBalance: string;
    };
    psychologicalInsights: {
      attachmentStyle: string;
      conflictResolution: string;
      intimacyPatterns: string;
      communicationBarriers: string;
    };
    relationshipHealth: {
      currentState: string;
      strengths: string[];
      concerns: string[];
      trajectory: string;
    };
    practicalAdvice: {
      immediateActions: string[];
      longTermStrategies: string[];
      communicationTips: string[];
    };
    conclusion: string;
  };
  metadata: {
    analyzedMessages: number;
    highPriorityCount: number;
    mediumSampleCount: number;
    analysisDepth: string;
    processingTime: number;
  };
}

/**
 * Claude 심층 분석 수행
 */
export async function performClaudeDeepAnalysis(
  input: ClaudeInputPackage
): Promise<ClaudeAnalysisResult> {
  const startTime = Date.now();

  // 안전한 값 추출
  const totalTokens = input.tokenEstimate?.total || 0;
  const highCount = Array.isArray(input.highMessages) ? input.highMessages.length : 0;
  const mediumCount = Array.isArray(input.mediumSamples) ? input.mediumSamples.length : 0;

  console.log('\n=== Claude 심층 분석 시작 ===');
  console.log(`토큰 추정: ${totalTokens.toLocaleString()}개`);
  console.log(`HIGH 메시지: ${highCount}개`);
  console.log(`MEDIUM 샘플: ${mediumCount}개\n`);

  // Claude API용 메시지 형식으로 변환
  const userContent = formatUserContent(input);

  try {
    // Claude API 호출 (단일 호출로 전체 분석)
    console.log('🤖 Claude API 호출 중...');
    
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000, // 9,500 토큰 목표, 여유있게 16K 설정
      temperature: 0.7,
      system: input.systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    console.log('✅ Claude 응답 수신');

    // 응답 안전하게 추출
    const content = response.content;
    if (!Array.isArray(content) || content.length === 0) {
      console.warn('⚠️  Claude 응답에 content가 없음');
      const analysis = createFallbackAnalysis('Claude 응답을 받지 못했습니다.');
      const processingTime = Date.now() - startTime;
      const analyzedMessages = input.relationshipContext?.statistics?.totalMessages || 0;

      return {
        analysis,
        metadata: {
          analyzedMessages,
          highPriorityCount: highCount,
          mediumSampleCount: mediumCount,
          analysisDepth: 'failed',
          processingTime,
        },
      };
    }

    // 모든 text 세그먼트 수집
    const textSegments = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .filter(text => text && text.length > 0);

    if (textSegments.length === 0) {
      console.warn('⚠️  Claude 응답에 text 세그먼트가 없음');
      const analysis = createFallbackAnalysis('Claude 응답에 텍스트가 포함되지 않았습니다.');
      const processingTime = Date.now() - startTime;
      const analyzedMessages = input.relationshipContext?.statistics?.totalMessages || 0;

      return {
        analysis,
        metadata: {
          analyzedMessages,
          highPriorityCount: highCount,
          mediumSampleCount: mediumCount,
          analysisDepth: 'partial',
          processingTime,
        },
      };
    }

    // 모든 텍스트 세그먼트 결합
    const analysisText = textSegments.join('\n\n');

    const analysis = parseClaudeResponse(analysisText);

    const processingTime = Date.now() - startTime;

    console.log(`⏱️  처리 시간: ${(processingTime / 1000).toFixed(1)}초`);
    console.log('=== Claude 심층 분석 완료 ===\n');

    // 안전한 메타데이터 생성
    const analyzedMessages = input.relationshipContext?.statistics?.totalMessages || 0;

    return {
      analysis,
      metadata: {
        analyzedMessages,
        highPriorityCount: highCount,
        mediumSampleCount: mediumCount,
        analysisDepth: 'comprehensive',
        processingTime,
      },
    };
  } catch (error) {
    console.error('❌ Claude 분석 실패:', error);
    throw new Error(
      `Claude 분석 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
  }
}

/**
 * 사용자 메시지 내용 포맷팅
 */
function formatUserContent(input: ClaudeInputPackage): string {
  // 안전한 기본값 설정
  const context = input.relationshipContext || {};
  const type = context.type || '관계';
  const purpose = context.purpose || '분석';
  const participants = Array.isArray(context.participants) ? context.participants : [];
  const participantsText = participants.length > 0 ? participants.join(' 과 ') : '참여자';
  
  const period = context.period || {};
  const periodStart = period.start || '시작일';
  const periodEnd = period.end || '종료일';
  const duration = period.duration || '기간';
  
  const stats = context.statistics || {};
  const totalMessages = stats.totalMessages || 0;
  const filteredHigh = stats.filteredHigh || 0;
  const filteredMedium = stats.filteredMedium || 0;
  const averagePerDay = stats.averagePerDay || 0;

  return `# 분석 개요

**관계 유형**: ${type}
**분석 목적**: ${purpose}
**참여자**: ${participantsText}
**분석 기간**: ${periodStart} ~ ${periodEnd} (${duration})

## 데이터 규모
- 전체 메시지: ${totalMessages.toLocaleString()}개
- HIGH 중요 메시지: ${filteredHigh.toLocaleString()}개 (전체 분석)
- MEDIUM 의미있는 메시지: ${filteredMedium.toLocaleString()}개 (샘플 분석)
- 일평균 메시지: ${averagePerDay}개

---

# Gemini AI 거시적 분석 요약

Gemini가 ${totalMessages.toLocaleString()}개의 전체 메시지를 분석한 결과입니다:

${JSON.stringify(input.geminiSummary, null, 2)}

---

# HIGH 중요 메시지 원문 (${input.highMessages?.length || 0}개)

다음은 관계의 전환점, 갈등, 중요 의사결정, 감정 변화를 포함하는 핵심 메시지들입니다:

${Array.isArray(input.highMessages) 
  ? input.highMessages.map(m => {
      const index = m?.index ?? '?';
      const date = m?.date || '날짜미상';
      const user = m?.user || '사용자';
      const message = m?.message || '';
      return `[${index}] ${date} ${user}: ${message}`;
    }).join('\n')
  : '메시지 없음'}

---

# MEDIUM 의미있는 메시지 샘플 (${input.mediumSamples?.length || 0}개)

일상적이지만 의미 있는 대화, 계획, 중요 일상의 대표 샘플입니다:

${Array.isArray(input.mediumSamples)
  ? input.mediumSamples.map(m => {
      const index = m?.index ?? '?';
      const date = m?.date || '날짜미상';
      const user = m?.user || '사용자';
      const message = m?.message || '';
      return `[${index}] ${date} ${user}: ${message}`;
    }).join('\n')
  : '샘플 없음'}

---

# 관계 맥락

${context.background || '관계 맥락 정보가 제공되지 않았습니다.'}

---

# 분석 요청

위의 모든 정보를 종합하여 다음과 같은 심층 분석을 제공해주세요:

1. **관계 전체 개요**: Gemini의 거시적 패턴과 HIGH 메시지의 미시적 뉘앙스를 결합한 종합 분석
2. **커뮤니케이션 패턴**: 티키타카 분석, 대화 흐름, 응답 패턴
3. **감정 역동성**: 감정 트렌드, 감정적 순간들, 감정 균형
4. **심리학적 통찰**: 애착 유형, 갈등 해결 방식, 친밀감 패턴, 소통 장벽
5. **관계 건강도**: 현재 상태, 강점, 우려사항, 향후 방향
6. **실질적 조언**: 즉각 실행 가능한 행동, 장기 전략, 소통 팁
7. **종합 결론**: 관계의 본질과 미래 전망

**중요**: 구체적인 대화 예시를 인용하며 분석하고, 심리학적 관점에서 깊이 있는 통찰을 제공하세요.

다음 JSON 형식으로 응답해주세요:

\`\`\`json
{
  "relationshipOverview": "전체 관계에 대한 종합적 개요 (500자 이상)",
  "communicationPatterns": {
    "tikitakaAnalysis": "대화 리듬과 티키타카 패턴 분석",
    "conversationFlow": "대화 흐름과 전개 방식",
    "responsePatterns": "응답 패턴과 상호작용 스타일"
  },
  "emotionalDynamics": {
    "sentimentTrends": "시간에 따른 감정 변화 추이",
    "emotionalMoments": [
      {
        "type": "감정 유형 (예: 갈등, 화해, 애정표현)",
        "description": "순간에 대한 설명",
        "context": "대화 인용 및 맥락"
      }
    ],
    "emotionalBalance": "두 사람의 감정 균형 분석"
  },
  "psychologicalInsights": {
    "attachmentStyle": "애착 유형 분석 (안정형/회피형/불안형 등)",
    "conflictResolution": "갈등 해결 패턴과 방식",
    "intimacyPatterns": "친밀감 표현과 발전 패턴",
    "communicationBarriers": "소통 장벽과 오해의 원인"
  },
  "relationshipHealth": {
    "currentState": "현재 관계 상태 진단",
    "strengths": ["강점 1", "강점 2", "강점 3"],
    "concerns": ["우려사항 1", "우려사항 2"],
    "trajectory": "관계의 향후 방향성"
  },
  "practicalAdvice": {
    "immediateActions": ["즉시 실행 가능한 조언 1", "조언 2", "조언 3"],
    "longTermStrategies": ["장기적 전략 1", "전략 2"],
    "communicationTips": ["소통 팁 1", "팁 2", "팁 3"]
  },
  "conclusion": "종합 결론 및 마무리 조언 (300자 이상)"
}
\`\`\``;
}

/**
 * Claude 응답 파싱
 */
function parseClaudeResponse(responseText: string): any {
  try {
    // JSON 추출
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('⚠️  JSON 형식을 찾을 수 없어 기본 응답 생성');
      return createFallbackAnalysis(responseText);
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    // 필수 필드 검증
    if (!parsed.relationshipOverview || !parsed.communicationPatterns) {
      console.warn('⚠️  필수 필드 누락, 기본값으로 보완');
      return {
        ...createFallbackAnalysis(responseText),
        ...parsed,
      };
    }

    return parsed;
  } catch (error) {
    console.error('JSON 파싱 오류:', error);
    return createFallbackAnalysis(responseText);
  }
}

/**
 * Fallback 분석 생성
 */
function createFallbackAnalysis(rawText: string): any {
  return {
    relationshipOverview: rawText.substring(0, 500) || '분석 결과를 처리하는 중 문제가 발생했습니다.',
    communicationPatterns: {
      tikitakaAnalysis: '대화 패턴 분석 중...',
      conversationFlow: '대화 흐름 분석 중...',
      responsePatterns: '응답 패턴 분석 중...',
    },
    emotionalDynamics: {
      sentimentTrends: '감정 트렌드 분석 중...',
      emotionalMoments: [],
      emotionalBalance: '감정 균형 분석 중...',
    },
    psychologicalInsights: {
      attachmentStyle: '애착 유형 분석 중...',
      conflictResolution: '갈등 해결 분석 중...',
      intimacyPatterns: '친밀감 패턴 분석 중...',
      communicationBarriers: '소통 장벽 분석 중...',
    },
    relationshipHealth: {
      currentState: '관계 상태 진단 중...',
      strengths: [],
      concerns: [],
      trajectory: '방향성 분석 중...',
    },
    practicalAdvice: {
      immediateActions: [],
      longTermStrategies: [],
      communicationTips: [],
    },
    conclusion: rawText.substring(0, 300) || '분석을 완료하지 못했습니다.',
  };
}
