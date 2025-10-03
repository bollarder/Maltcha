// server/services/anthropic.ts
// 4단계 파이프라인: AI 추출 → 코드 계산 → AI 분석 → AI 글쓰기

import Anthropic from "@anthropic-ai/sdk";
import {
  processConversationData,
  type Message,
  type ProcessedData,
} from "./data-processor";
import {
  getSamplesForAnalysis,
  formatSamplesForAI,
} from "./conversation-sampler";

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface BasicStats {
  totalMessages: number;
  participants: number;
}

export interface ConversationAnalysis {
  sentimentScore: number;
  sentimentDistribution: { name: string; value: number }[];
  insights: { title: string; description: string }[];
  processedData?: ProcessedData;
  deepAnalysis?: {
    communicationStyle: any;
    emotionalExpression: any;
    relationshipDynamics: any;
    specialPatterns: any;
    partnerStatus: any;
  };
}

// JSON 파싱 헬퍼 함수
function parseJSON(response: any): any {
  const text = response.content[0].type === 'text' 
    ? response.content[0].text 
    : '{}';
    
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    console.error("JSON 파싱 실패");
    return {};
  }
}

// 메인 분석 함수
export async function analyzeConversation(
  messages: Message[],
  stats: BasicStats,
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = []
): Promise<ConversationAnalysis> {
  
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const userName = participants[0] || "사용자";
  const partnerName = participants[1] || "상대방";
  
  const relationshipContext =
    secondaryRelationships.length > 0
      ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")} (부가적)`
      : primaryRelationship;

  console.log("\n======== 4단계 분석 파이프라인 시작 ========");
  console.log(`관계: ${relationshipContext}, 메시지: ${messages.length}개\n`);

  // 대표 샘플 추출
  const samples = getSamplesForAnalysis(messages);
  const formattedSamples = formatSamplesForAI(samples);
  
  console.log(`샘플 추출 완료:`);
  console.log(`  - 최근 대화: ${samples.recent.length}개`);
  console.log(`  - 깊은 대화: ${samples.longestExchanges.length}개`);
  console.log(`  - 감정적 순간: ${samples.emotional.length}개`);
  console.log(`  - 키워드 기반: ${samples.preferences.length + samples.appointments.length + samples.questions.length}개`);
  console.log(`  - 시간대별: ${samples.byTimeOfDay.length}개`);
  console.log(`  - 랜덤: ${samples.random.length}개\n`);

  // ===== STEP 1: AI - 정보 찾기만 =====
  console.log("Step 1: AI 정보 추출 중...");
  
  const extractionResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4000,
    system: `당신은 정보 추출 전문가입니다. 대화에서 다음 정보만 찾아서 나열하세요:
1. 상대방이 명시적으로 "좋아한다"고 말한 것들
2. 상대방이 명시적으로 "싫어한다"고 말한 것들  
3. 날짜가 언급된 약속이나 이벤트
4. "사랑해", "보고싶어", "고마워" 등 애정 표현 문장들

**중요: 해석하지 말고, 찾은 내용만 JSON으로 출력하세요.**`,
    messages: [{
      role: 'user',
      content: `${userName}과 ${partnerName}의 대화 샘플 (총 ${messages.length}개 중 대표 샘플):

${formattedSamples}

다음 형식의 JSON으로 응답하세요:
\`\`\`json
{
  "preferences": [
    {"type": "like", "content": "좋아한다고 언급한 것"},
    {"type": "dislike", "content": "싫어한다고 언급한 것"}
  ],
  "importantDates": [
    {"date": "YYYY-MM-DD", "content": "약속/이벤트"}
  ],
  "topKeywords": [
    {"word": "자주 나온 단어", "count": 추정 빈도}
  ]
}
\`\`\``
    }]
  });
  
  const rawExtraction = parseJSON(extractionResponse);
  console.log("Step 1 완료 ✓");
  
  // ===== STEP 2: 코드 - 계산 & 가공 =====
  console.log("Step 2: 데이터 처리 및 계산 중...");
  
  const processedData = processConversationData(messages, rawExtraction);
  
  console.log("Step 2 완료 ✓");
  console.log(`  - 티키타카 지수: ${processedData.tikitakaScore}점`);
  console.log(`  - 메시지 비율: ${userName} ${(processedData.messageRatio[userName] * 100).toFixed(0)}% / ${partnerName} ${(processedData.messageRatio[partnerName] * 100).toFixed(0)}%`);
  
  // ===== STEP 3: AI - 심층 분석만 =====
  console.log("Step 3: 심층 분석 중...");
  
  const analysisResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 관계 심리 전문가입니다. 주어진 통계 데이터만을 바탕으로 
두 사람의 소통 스타일, 관계 역학, 숨겨진 패턴을 분석하세요.

**중요: 대화 원문을 보지 말고, 제공된 통계 데이터만 분석하세요.**`,
    messages: [{
      role: 'user',
      content: `${userName}과 ${partnerName}의 대화 통계 (관계: ${relationshipContext}):

${JSON.stringify(processedData, null, 2)}

이 데이터를 바탕으로 다음을 분석해주세요:
1. 소통 스타일 (경청형/주도형)
2. 감정 표현 방식
3. 관계 역학 (주도권, 친밀도 추이)
4. 특이 패턴 (반복 주제, 회피 주제)
5. 상대방 상태 및 조언

다음 형식의 JSON으로 응답하세요:
\`\`\`json
{
  "communicationStyle": {
    "${userName}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]},
    "${partnerName}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]}
  },
  "emotionalExpression": {
    "emojiDependency": {"${userName}": "high/medium/low", "${partnerName}": "high/medium/low"},
    "emotionalAsymmetry": "한 문장 분석"
  },
  "relationshipDynamics": {
    "powerBalance": "균형적/한쪽 주도",
    "intimacyTrend": "increasing/stable/decreasing"
  },
  "specialPatterns": {
    "recurringTopics": ["주제1", "주제2"],
    "happyMoments": [{"timestamp": "날짜", "context": "맥락"}]
  },
  "partnerStatus": {
    "currentState": "최근 상대방 상태 추론",
    "suggestion": "조언"
  }
}
\`\`\``
    }]
  });
  
  const deepAnalysis = parseJSON(analysisResponse);
  console.log("Step 3 완료 ✓");
  
  // ===== STEP 4: AI - 글쓰기만 =====
  console.log("Step 4: 인사이트 생성 중...");
  
  const reportResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4000,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다. 
분석 결과를 따뜻하고 친근하게 전달하는 것이 당신의 역할입니다.

관계 유형에 맞는 톤을 사용하세요:
- 연인/썸: 애정 어린 톤, 감정에 초점
- 업무/파트너: 전문적이고 효율적인 톤
- 가족: 따뜻하고 존중하는 톤
- 친구: 편안하고 솔직한 톤

**중요**: 구체적인 예시를 들 때는 제공된 대화 샘플에서 실제 메시지를 인용하세요.`,
    messages: [{
      role: 'user',
      content: `다음 데이터와 분석 결과를 바탕으로, ${userName}님을 위한 4개의 인사이트를 작성해주세요.

**관계 유형: ${relationshipContext}**

**통계 데이터:**
${JSON.stringify(processedData, null, 2)}

**심층 분석:**
${JSON.stringify(deepAnalysis, null, 2)}

**대화 샘플 (구체적인 예시 작성 시 참고):**
${formattedSamples.slice(0, 2000)}

다음 형식의 JSON 배열로 응답하세요:
\`\`\`json
[
  {
    "title": "💬 티키타카 지수: ${processedData.tikitakaScore}점",
    "description": "구체적인 설명과 칭찬. 실제 대화 패턴을 예로 들기 (4-5문장)"
  },
  {
    "title": "🎭 ${partnerName}님의 대화 스타일",
    "description": "타입과 특징을 구체적으로 설명. 대화 샘플에서 예시 인용 (4-5문장)"
  },
  {
    "title": "📝 ${partnerName}님의 취향 노트",
    "description": "좋아하는 것/싫어하는 것을 대화 샘플 기반으로 구체적으로 (4-5문장)"
  },
  {
    "title": "💭 Tea의 조언",
    "description": "현재 관계 상황 분석과 실용적 제안. 따뜻하고 구체적으로 (4-5문장)"
  }
]
\`\`\`

**규칙:**
- 정확히 4개만 출력
- ${relationshipContext} 관계에 맞는 톤
- 구체적인 수치와 실제 대화 예시 포함
- 따뜻하고 친근한 어조
- 각 인사이트는 4-5문장으로 충분히 자세하게`
    }]
  });
  
  const insightsArray = parseJSON(reportResponse);
  const insights = Array.isArray(insightsArray) ? insightsArray : [
    {
      title: `💬 티키타카 지수: ${processedData.tikitakaScore}점`,
      description: `${userName}님과 ${partnerName}님의 ${processedData.totalMessages}개 메시지를 분석했어요!`,
    },
    {
      title: "🎭 대화 스타일",
      description: "서로 다른 스타일이지만 잘 어울려요.",
    },
    {
      title: "📝 특별한 순간들",
      description: "대화 속에서 진심으로 소통했던 순간들이 있어요.",
    },
    {
      title: "💭 Tea의 조언",
      description: `${relationshipContext} 관계에서 지금처럼 계속 소통하면 더 깊은 관계가 될 거예요.`,
    },
  ];
  
  console.log("Step 4 완료 ✓");
  console.log("======== 분석 완료 ========\n");
  
  // 최종 결과 조합
  const sentimentScore = Math.round(
    (processedData.sentimentRatio.positive * 100 +
      processedData.sentimentRatio.neutral * 50) /
      (processedData.sentimentRatio.positive +
        processedData.sentimentRatio.neutral +
        processedData.sentimentRatio.negative)
  );

  const sentimentDistribution = [
    {
      name: "긍정적",
      value: Math.round(processedData.sentimentRatio.positive * 100),
    },
    {
      name: "중립적",
      value: Math.round(processedData.sentimentRatio.neutral * 100),
    },
    {
      name: "부정적",
      value: Math.round(processedData.sentimentRatio.negative * 100),
    },
  ];

  return {
    sentimentScore,
    sentimentDistribution,
    insights: insights.slice(0, 4),
    processedData,
    deepAnalysis,
  };
}
