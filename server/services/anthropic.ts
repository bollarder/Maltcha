// server/services/anthropic.ts
// 4단계 파이프라인: AI 추출 → 코드 계산 → AI 분석 → AI 글쓰기

import Anthropic from "@anthropic-ai/sdk";
import {
  processConversationData,
  type Message,
  type ProcessedData,
  type RawExtraction,
} from "./data-processor";

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

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

// JSON 파싱 유틸리티
function robustJsonParse(
  text: string,
  type: "object" | "array" = "object"
): any {
  const attempts: Array<() => any> = [];

  attempts.push(() => {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  });

  attempts.push(() => {
    const pattern = type === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match = text.match(pattern);
    if (!match) throw new Error("No JSON found");
    return JSON.parse(match[0]);
  });

  attempts.push(() => {
    const startChar = type === "array" ? "[" : "{";
    const endChar = type === "array" ? "]" : "}";
    const startIdx = text.indexOf(startChar);
    const endIdx = text.lastIndexOf(endChar);
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
      throw new Error("Invalid JSON structure");
    }
    return JSON.parse(text.substring(startIdx, endIdx + 1));
  });

  for (let i = 0; i < attempts.length; i++) {
    try {
      const result = attempts[i]();
      if (result) {
        if (i > 0) console.log(`JSON 파싱 성공: 시도 ${i + 1}번째 방법 사용`);
        return result;
      }
    } catch (e) {
      if (i === attempts.length - 1) {
        console.error(`모든 JSON 파싱 시도 실패:`, e);
      }
    }
  }

  return null;
}

// 관계별 분석 포인트 생성
function getAnalysisPoints(primary: string, secondary: string[]) {
  const points: string[] = [];
  const allRelationships = [primary, ...secondary];

  if (allRelationships.some((r) => ["연인", "썸"].includes(r))) {
    points.push("- 애정 표현 패턴과 진정성");
    points.push("- 감정 비대칭 분석");
    if (primary === "썸") {
      points.push("- 썸 특화: 탐색적 질문, 조심스러운 표현");
    }
  }

  if (allRelationships.some((r) => ["업무", "파트너"].includes(r))) {
    points.push("- 업무 효율과 의사결정 패턴");
    points.push("- 역할 분담과 책임 분배");
  }

  if (allRelationships.includes("가족")) {
    points.push("- 존댓말/반말 패턴");
    points.push("- 세대 간 소통 방식");
  }

  if (allRelationships.includes("멘토")) {
    points.push("- 조언/피드백 수용도");
    points.push("- 상하 관계의 편안함");
  }

  if (allRelationships.includes("친구")) {
    points.push("- 농담과 장난의 빈도");
    points.push("- 일상 공유와 공감");
  }

  points.push("- 대화 스타일과 친밀도 변화");
  points.push("- 응답 패턴과 메시지 균형");

  if (secondary.length > 0) {
    points.push(`- 복합 관계: ${primary}과 ${secondary.join(", ")}의 균형`);
  }

  return points.join("\n");
}

// 메인 분석 함수
export async function analyzeConversation(
  messages: { timestamp: string; participant: string; content: string }[],
  stats: { totalMessages: number; participants: number },
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = []
): Promise<ConversationAnalysis> {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const user_name = participants[0] || "사용자";
  const partner_name = participants[1] || "상대방";

  const relationshipContext =
    secondaryRelationships.length > 0
      ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")} (부가적)`
      : primaryRelationship;

  console.log(
    `\n======== 4단계 분석 파이프라인 시작 ========`
  );
  console.log(`관계: ${relationshipContext}, 메시지: ${messages.length}개\n`);

  // ========================================
  // STEP 1: AI - 정보 추출만 (텍스트 마이닝)
  // ========================================
  console.log("Step 1: AI 정보 추출 중...");

  const step1Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 2500,
    system: `당신은 대화 분석 전문가입니다. 대화 샘플에서 선호도, 중요 날짜, 키워드만 추출하세요. 계산이나 분석은 하지 마세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}과 ${partner_name}의 대화에서 정보를 추출해 JSON으로 응답해줘.

**대화 샘플 (최근 200개 + 랜덤 50개):**
${messages
  .slice(-200)
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

${
  messages.length > 200
    ? `\n---과거 샘플---\n${Array.from(
        { length: Math.min(50, messages.length - 200) },
        () => messages[Math.floor(Math.random() * (messages.length - 200))]
      )
        .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
        .join("\n")}`
    : ""
}

**추출할 정보 (JSON만):**
\`\`\`json
{
  "preferences": [
    {"type": "like", "content": "좋아한다고 언급한 것"},
    {"type": "dislike", "content": "싫어한다고 언급한 것"}
  ],
  "importantDates": [
    {"date": "YYYY-MM-DD", "content": "약속/기념일"}
  ],
  "topKeywords": [
    {"word": "자주 나온 단어", "count": 추정 빈도}
  ]
}
\`\`\`

**주의:** 계산이나 분석 없이 추출만 하세요.`,
      },
    ],
  });

  const step1Text =
    step1Response.content[0].type === "text"
      ? step1Response.content[0].text
      : "{}";

  let rawExtraction: RawExtraction = {};
  try {
    rawExtraction = robustJsonParse(step1Text, "object") || {};
  } catch (e) {
    console.error("Step 1 파싱 실패:", e);
  }

  console.log("Step 1 완료 ✓");

  // ========================================
  // STEP 2: 코드 - 정확한 계산 및 가공
  // ========================================
  console.log("Step 2: 데이터 처리 및 계산 중...");

  const processedData = processConversationData(
    messages as Message[],
    rawExtraction
  );

  console.log("Step 2 완료 ✓");
  console.log(`  - 티키타카 지수: ${processedData.tikitakaScore}점`);
  console.log(`  - 메시지 비율: ${user_name} ${(processedData.messageRatio[user_name] * 100).toFixed(0)}% / ${partner_name} ${(processedData.messageRatio[partner_name] * 100).toFixed(0)}%`);

  // ========================================
  // STEP 3: AI - 심층 분석만 (심리학적 해석)
  // ========================================
  console.log("Step 3: 심층 분석 중...");

  const analysisPoints = getAnalysisPoints(
    primaryRelationship,
    secondaryRelationships
  );

  const step3Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 관계 심리 분석가입니다. 주어진 데이터와 대화 패턴에서 심리학적 해석만 제공하세요. 글쓰기는 하지 마세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}과 ${partner_name}의 관계(${relationshipContext})를 분석해 JSON으로 응답해줘.

**계산된 데이터:**
- 티키타카 지수: ${processedData.tikitakaScore}점
- 메시지 비율: ${user_name} ${(processedData.messageRatio[user_name] * 100).toFixed(0)}%, ${partner_name} ${(processedData.messageRatio[partner_name] * 100).toFixed(0)}%
- 평균 메시지 길이: ${user_name} ${processedData.avgMessageLength[user_name]}자, ${partner_name} ${processedData.avgMessageLength[partner_name]}자
- 이모티콘: ${user_name} ${processedData.emojiCount[user_name]}개, ${partner_name} ${processedData.emojiCount[partner_name]}개
- 질문 비율: ${user_name} ${(processedData.questionRatio[user_name] * 100).toFixed(0)}%, ${partner_name} ${(processedData.questionRatio[partner_name] * 100).toFixed(0)}%
- 평균 응답 시간: ${user_name} ${processedData.avgResponseTime[user_name]}분, ${partner_name} ${processedData.avgResponseTime[partner_name]}분

**관계별 분석 포인트:**
${analysisPoints}

**최근 대화 (100개):**
${messages
  .slice(-100)
  .map((m) => `${m.participant}: ${m.content}`)
  .join("\n")}

**필수 출력 (JSON만, 분석만):**
\`\`\`json
{
  "communicationStyle": {
    "${user_name}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]},
    "${partner_name}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]}
  },
  "emotionalExpression": {
    "emojiDependency": {"${user_name}": "high/medium/low", "${partner_name}": "high/medium/low"},
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
\`\`\`

**주의:** 분석만 하고 사용자 친화적 글은 쓰지 마세요.`,
      },
    ],
  });

  const step3Text =
    step3Response.content[0].type === "text"
      ? step3Response.content[0].text
      : "{}";

  let deepAnalysis;
  try {
    deepAnalysis = robustJsonParse(step3Text, "object") || {};
  } catch (e) {
    console.error("Step 3 파싱 실패:", e);
    deepAnalysis = {
      communicationStyle: {},
      emotionalExpression: {},
      relationshipDynamics: {},
      specialPatterns: {},
      partnerStatus: {},
    };
  }

  console.log("Step 3 완료 ✓");

  // ========================================
  // STEP 4: AI - 글쓰기만 (사용자 리포트)
  // ========================================
  console.log("Step 4: 인사이트 생성 중...");

  const step4Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 2500,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다. ${relationshipContext} 관계에 맞춰 따뜻하고 구체적인 인사이트 4개를 작성하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}님을 위한 인사이트 4개를 만들어줘.

**관계: ${relationshipContext}**

**계산된 지표:**
- 티키타카 지수: ${processedData.tikitakaScore}점
- 총 메시지: ${processedData.totalMessages}개
- 메시지 비율: ${user_name} ${(processedData.messageRatio[user_name] * 100).toFixed(0)}% vs ${partner_name} ${(processedData.messageRatio[partner_name] * 100).toFixed(0)}%
- 긍정 메시지: ${(processedData.sentimentRatio.positive * 100).toFixed(0)}%
- 선호도: 좋아함 ${processedData.preferences.likes.length}개, 싫어함 ${processedData.preferences.dislikes.length}개

**심층 분석:**
${JSON.stringify(deepAnalysis, null, 2)}

**필수 출력 (JSON 배열만):**
\`\`\`json
[
  {
    "title": "💬 티키타카 지수: ${processedData.tikitakaScore}점",
    "description": "구체적인 설명과 칭찬 (3-4문장)"
  },
  {
    "title": "🎭 ${partner_name}님의 대화 스타일",
    "description": "타입과 특징 설명 (3-4문장)"
  },
  {
    "title": "📝 ${partner_name}님의 취향 노트",
    "description": "좋아하는 것/싫어하는 것 구체적으로 (3-4문장)"
  },
  {
    "title": "💭 Tea의 조언",
    "description": "현재 상황 분석과 실용적 제안 (3-4문장)"
  }
]
\`\`\`

**규칙:**
- 정확히 4개만
- ${relationshipContext} 관계 톤
- 구체적 수치와 예시
- 따뜻하고 친근한 톤`,
      },
    ],
  });

  const step4Text =
    step4Response.content[0].type === "text"
      ? step4Response.content[0].text
      : "[]";

  let insights;
  try {
    const parsed = robustJsonParse(step4Text, "array");
    if (Array.isArray(parsed) && parsed.length > 0) {
      insights = parsed;
    } else {
      throw new Error("Invalid array");
    }
  } catch (e) {
    console.error("Step 4 파싱 실패:", e);
    insights = [
      {
        title: `💬 티키타카 지수: ${processedData.tikitakaScore}점`,
        description: `${user_name}님과 ${partner_name}님의 ${processedData.totalMessages}개 메시지를 분석했어요!`,
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
  }

  console.log("Step 4 완료 ✓");
  console.log(`======== 분석 완료 ========\n`);

  // ========================================
  // 최종 결과 조합
  // ========================================
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
