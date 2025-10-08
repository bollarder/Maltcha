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

// Multi-turn 분석 함수 (필요시 구현)
let analyzeConversationMultiTurnSafe: any = null;
try {
  const multiTurnModule = require("./anthropic-multiturn");
  analyzeConversationMultiTurnSafe =
    multiTurnModule.analyzeConversationMultiTurnSafe;
} catch (error) {
  // anthropic-multiturn.ts 파일이 없으면 무시
}

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
  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";

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
  secondaryRelationships: string[] = [],
  options: {
    useMultiTurn?: boolean;
    fallbackOnError?: boolean;
    userPurpose?: string;
  } = {},
): Promise<ConversationAnalysis> {
  const { useMultiTurn = true, fallbackOnError = true, userPurpose } = options;

  // Multi-turn 사용 (새 방식)
  if (useMultiTurn) {
    if (!analyzeConversationMultiTurnSafe) {
      console.warn(
        "⚠️ Multi-turn 모듈을 찾을 수 없습니다. 기존 4단계 방식으로 진행합니다.",
      );
      return await analyzeConversation4Stage(
        messages,
        stats,
        primaryRelationship,
        secondaryRelationships,
        userPurpose,
      );
    }

    try {
      console.log("🔄 Multi-turn 분석 시작");
      return await analyzeConversationMultiTurnSafe(
        messages,
        stats,
        primaryRelationship,
        secondaryRelationships,
        userPurpose,
      );
    } catch (error) {
      console.error("Multi-turn 분석 실패:", error);

      // Fallback: 기존 방식으로 재시도
      if (fallbackOnError) {
        console.log("⚠️ 기존 4단계 방식으로 Fallback");
        return await analyzeConversation4Stage(
          messages,
          stats,
          primaryRelationship,
          secondaryRelationships,
          userPurpose,
        );
      }

      throw error;
    }
  }

  // 기존 4단계 방식
  return await analyzeConversation4Stage(
    messages,
    stats,
    primaryRelationship,
    secondaryRelationships,
    userPurpose,
  );
}

// 기존 4단계 로직을 별도 함수로 분리
async function analyzeConversation4Stage(
  messages: Message[],
  stats: BasicStats,
  primaryRelationship: string,
  secondaryRelationships: string[],
  userPurpose?: string,
): Promise<ConversationAnalysis> {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const userName = participants[0] || "사용자";
  const partnerName = participants[1] || "상대방";

  let relationshipContext =
    secondaryRelationships.length > 0
      ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")} (부가적)`
      : primaryRelationship;
  
  if (userPurpose) {
    relationshipContext += `\n\n분석 목적: ${userPurpose}`;
  }

  console.log("\n======== 4단계 분석 파이프라인 시작 ========");
  console.log(`관계: ${relationshipContext}, 메시지: ${messages.length}개\n`);

  // 대표 샘플 추출
  const samples = getSamplesForAnalysis(messages);
  const formattedSamples = formatSamplesForAI(samples);

  console.log(`샘플 추출 완료:`);
  console.log(`  - 최근 대화: ${samples.recent.length}개`);
  console.log(`  - 깊은 대화: ${samples.longestExchanges.length}개`);
  console.log(`  - 감정적 순간: ${samples.emotional.length}개`);
  console.log(
    `  - 키워드 기반: ${samples.preferences.length + samples.appointments.length + samples.questions.length}개`,
  );
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
    messages: [
      {
        role: "user",
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
\`\`\``,
      },
    ],
  });

  const rawExtraction = parseJSON(extractionResponse);
  console.log("Step 1 완료 ✓");

  // ===== STEP 2: 코드 - 계산 & 가공 =====
  console.log("Step 2: 데이터 처리 및 계산 중...");

  const processedData = processConversationData(messages, rawExtraction);

  console.log("Step 2 완료 ✓");
  console.log(`  - 티키타카 지수: ${processedData.tikitakaScore}점`);
  console.log(
    `  - 메시지 비율: ${userName} ${(processedData.messageRatio[userName] * 100).toFixed(0)}% / ${partnerName} ${(processedData.messageRatio[partnerName] * 100).toFixed(0)}%`,
  );

  // ===== STEP 3: AI - 심층 분석 (대폭 개선) =====
  console.log("Step 3: 심층 분석 중...");

  const analysisResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 8000,
    system: `당신은 10년 경력의 관계 심리 전문가입니다. 
주어진 정량 데이터와 대화 샘플을 모두 활용하여 
두 사람의 관계를 깊이 있게 분석하세요.

단순한 표면적 분석이 아닌, 대화 속 숨겨진 패턴, 
말하지 않은 감정, 관계의 변화 흐름을 포착하세요.`,
    messages: [
      {
        role: "user",
        content: `${userName}님과 ${partnerName}님(${relationshipContext})의 대화 분석:

===== 1. 정량 데이터 =====
${JSON.stringify(processedData, null, 2)}

===== 2. 최근 대화 (최근 300개) =====
${samples.recent
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

===== 3. 가장 긴 대화 교환 (깊은 소통 순간) =====
${samples.longestExchanges
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

===== 4. 감정적 대화 =====
${samples.emotional
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

===== 5. 취향/선호 관련 대화 =====
${samples.preferences
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

===== 6. 질문-답변 패턴 =====
${samples.questions
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

**분석 요구사항:**
1. 표면적 통계를 넘어, 대화 속 진짜 의미를 찾으세요
2. 구체적인 대화 예시를 인용하며 분석하세요
3. 시간에 따른 변화나 패턴을 포착하세요
4. 말하지 않은 것(침묵, 회피)도 분석하세요
5. 두 사람만의 독특한 소통 방식을 발견하세요

다음 형식의 JSON으로 상세히 작성하세요:
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
\`\`\``,
      },
    ],
  });

  const deepAnalysis = parseJSON(analysisResponse);
  console.log("Step 3 완료 ✓");

  // ===== STEP 4: AI - 글쓰기 (더 많은 컨텍스트 제공) =====
  console.log("Step 4: 인사이트 생성 중...");

  const reportResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다.
분석 결과를 바탕으로 구체적이고 실용적인 조언을 제공하세요.

일반론이 아닌, 이 두 사람만을 위한 맞춤 조언을 해주세요.`,
    messages: [
      {
        role: "user",
        content: `${userName}님을 위한 리포트를 작성해주세요.

**정량 데이터:**
${JSON.stringify(processedData, null, 2)}

**심층 분석:**
${JSON.stringify(deepAnalysis, null, 2)}

**대표 대화 예시:**
${samples.recent
  .slice(0, 30)
  .map((m) => `${m.participant}: ${m.content}`)
  .join("\n")}

**요구사항:**
- 최소 6개의 인사이트 작성
- 각 인사이트는 구체적인 대화 예시 인용
- 실행 가능한 조언 포함
- 깊이 있고 통찰력 있는 내용

다음 형식의 JSON 배열로 작성하세요:
\`\`\`json
[
  {
    "title": "💬 티키타카 지수: ${processedData.tikitakaScore}점",
    "description": "구체적인 설명과 칭찬. 실제 대화 패턴을 예로 들기"
  },
  {
    "title": "🎭 ${partnerName}님의 대화 스타일",
    "description": "타입과 특징을 구체적으로 설명. 대화 샘플에서 예시 인용"
  },
  {
    "title": "📝 ${partnerName}님의 취향 노트",
    "description": "좋아하는 것/싫어하는 것을 대화 샘플 기반으로 구체적으로"
  },
  {
    "title": "⏰ 대화 시간대 분석",
    "description": "주로 언제 대화하는지, 그 시간의 의미"
  },
  {
    "title": "💡 관계 개선 포인트",
    "description": "구체적이고 실행 가능한 조언"
  },
  {
    "title": "💭 Tea의 종합 조언",
    "description": "현재 관계 상황 분석과 실용적 제안. 따뜻하고 구체적으로"
  }
]
\`\`\``,
      },
    ],
  });

  const insightsArray = parseJSON(reportResponse);
  const insights = Array.isArray(insightsArray)
    ? insightsArray.slice(0, 6)
    : [
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
          title: "⏰ 대화 시간대",
          description: "두 분의 대화 패턴에서 의미 있는 시간대를 발견했어요.",
        },
        {
          title: "💡 관계 개선 포인트",
          description: "더 나은 소통을 위한 구체적인 제안을 준비했어요.",
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
        processedData.sentimentRatio.negative),
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
    insights: insights.slice(0, 6),
    processedData,
    deepAnalysis,
  };
}
