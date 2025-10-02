import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

export interface ConversationAnalysis {
  sentimentScore: number;
  sentimentDistribution: { name: string; value: number }[];
  insights: { title: string; description: string }[];
  stage1Data?: {
    basicStats: any;
    keyInfo: any;
  };
  stage2Data?: {
    communicationStyle: any;
    languagePattern: any;
    emotionalExpression: any;
    relationshipDynamics: any;
    specialPatterns: any;
    partnerStatus: any;
  };
}

export async function analyzeConversation(
  messages: { timestamp: string; participant: string; content: string }[],
  stats: { totalMessages: number; participants: number },
): Promise<ConversationAnalysis> {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const user_name = participants[0] || "사용자";
  const partner_name = participants[1] || "상대방";

  // Stage 1: 핵심 통계 추출 (간결화)
  const stage1Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 대화 데이터 분석 전문가입니다. 주어진 대화에서 핵심 통계와 중요한 정보만 추출하세요.`,
    messages: [
      {
        role: "user",
        content: `다음 대화를 분석해 JSON으로 응답해줘.

참여자: ${user_name}, ${partner_name}
총 메시지: ${stats.totalMessages}

대화 샘플 (최근 200개):
${messages
  .slice(-200)
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

**필수 출력 형식 (JSON만 출력):**
\`\`\`json
{
  "basicStats": {
    "messageRatio": {"${user_name}": 0.52, "${partner_name}": 0.48},
    "avgMessageLength": {"${user_name}": 45, "${partner_name}": 38},
    "emojiFrequency": {"${user_name}": 12, "${partner_name}": 8},
    "sentimentRatio": {"positive": 0.6, "neutral": 0.3, "negative": 0.1},
    "timeDistribution": [
      {"hour": "00-06", "count": 5},
      {"hour": "06-12", "count": 20},
      {"hour": "12-18", "count": 35},
      {"hour": "18-24", "count": 40}
    ]
  },
  "keyInfo": {
    "preferences": [
      {"type": "like", "content": "민트초코 좋아함"},
      {"type": "dislike", "content": "공포영화 싫어함"}
    ],
    "importantDates": [
      {"date": "2024-03-15", "content": "저녁 약속"}
    ],
    "affectionKeywords": {"${user_name}": 5, "${partner_name}": 8}
  }
}
\`\`\``,
      },
    ],
  });

  const stage1Text =
    stage1Response.content[0].type === "text"
      ? stage1Response.content[0].text
      : "{}";

  let stage1Data;
  try {
    // JSON 코드 블록 제거
    const cleanText = stage1Text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    stage1Data = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
  } catch (e) {
    console.error("Stage 1 파싱 실패:", e);
    stage1Data = {
      basicStats: {
        sentimentRatio: { positive: 0.6, neutral: 0.3, negative: 0.1 },
      },
      keyInfo: {},
    };
  }

  // Stage 2: 관계 심층 분석 (핵심만)
  const stage2Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 관계 심리 분석가입니다. 대화 패턴에서 숨겨진 의미를 파악하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}과 ${partner_name}의 대화를 분석해 JSON으로 응답해줘.

통계:
${JSON.stringify(stage1Data.basicStats, null, 2)}

최근 대화 (100개):
${messages
  .slice(-100)
  .map((m) => `${m.participant}: ${m.content}`)
  .join("\n")}

**필수 출력 형식 (JSON만 출력):**
\`\`\`json
{
  "communicationStyle": {
    "${user_name}": {"type": "경청형", "traits": ["공감 표현 많음", "질문 자주 함"]},
    "${partner_name}": {"type": "주도형", "traits": ["직설적", "답변 중심"]}
  },
  "emotionalExpression": {
    "emojiDependency": {"${user_name}": "high", "${partner_name}": "medium"},
    "emotionalAsymmetry": "한쪽이 감정 표현을 더 많이 함"
  },
  "relationshipDynamics": {
    "powerBalance": "균형적",
    "intimacyTrend": "increasing"
  },
  "specialPatterns": {
    "recurringTopics": ["일상", "계획"],
    "happyMoments": [{"timestamp": "2024-01-15", "context": "여행 이야기"}]
  },
  "partnerStatus": {
    "currentState": "최근 메시지가 짧아짐 - 바쁜 상태로 추정",
    "suggestion": "간단한 응원 메시지가 좋을 듯"
  }
}
\`\`\``,
      },
    ],
  });

  const stage2Text =
    stage2Response.content[0].type === "text"
      ? stage2Response.content[0].text
      : "{}";

  let stage2Data;
  try {
    const cleanText = stage2Text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    stage2Data = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
  } catch (e) {
    console.error("Stage 2 파싱 실패:", e);
    stage2Data = {};
  }

  // Stage 3: 실용적 인사이트 (4개로 제한)
  const stage3Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 2500,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다. 따뜻하고 구체적인 조언을 제공하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}님을 위한 인사이트 4개를 만들어줘.

분석 결과:
통계: ${JSON.stringify(stage1Data.basicStats, null, 2)}
관계: ${JSON.stringify(stage2Data, null, 2)}

**필수 출력 형식 (JSON 배열만 출력):**
\`\`\`json
[
  {
    "title": "💬 소통 에너지: 85점",
    "description": "두 분의 대화는 매우 활발해요! 특히 저녁 시간대에 가장 많은 이야기를 나누시네요."
  },
  {
    "title": "🎭 ${partner_name}님은 '따뜻한 응원자' 타입",
    "description": "공감과 격려를 자주 표현하는 스타일이에요. '힘내', '괜찮아' 같은 말을 자주 사용하시네요."
  },
  {
    "title": "📝 ${partner_name}님의 취향 노트",
    "description": "${partner_name}님은 '민트초코를 좋아한다'고 했고, '공포영화는 못 본다'고 했어요. 다음 만남에 참고하세요!"
  },
  {
    "title": "💭 Tea의 조언",
    "description": "최근 ${partner_name}님의 답장이 짧아진 걸 보니 바쁜 시기인 것 같아요. 지금은 간단한 응원이 더 힘이 될 거예요."
  }
]
\`\`\`

**규칙:**
- 반드시 4개의 인사이트만 출력
- 구체적인 예시 포함
- 따뜻하고 친근한 톤 유지`,
      },
    ],
  });

  const stage3Text =
    stage3Response.content[0].type === "text"
      ? stage3Response.content[0].text
      : "[]";

  let insights;
  try {
    const cleanText = stage3Text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    insights = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
    if (!Array.isArray(insights)) {
      insights = [];
    }
  } catch (e) {
    console.error("Stage 3 파싱 실패:", e);
    insights = [
      {
        title: "소통 에너지 분석 완료",
        description: `${user_name}님과 ${partner_name}님의 대화를 분석했어요.`,
      },
      {
        title: "대화 스타일",
        description: "서로 다른 스타일이지만 균형이 잘 맞아요.",
      },
      {
        title: "행복한 순간",
        description: "대화 속에서 진심으로 웃었던 순간들이 있어요.",
      },
      {
        title: "Tea의 조언",
        description: "지금처럼 계속 소통하면 더 깊은 관계가 될 거예요.",
      },
    ];
  }

  const sentimentScore = stage1Data.basicStats?.sentimentRatio
    ? Math.round(
        (stage1Data.basicStats.sentimentRatio.positive * 100 +
          stage1Data.basicStats.sentimentRatio.neutral * 50) /
          (stage1Data.basicStats.sentimentRatio.positive +
            stage1Data.basicStats.sentimentRatio.neutral +
            stage1Data.basicStats.sentimentRatio.negative),
      )
    : 75;

  const sentimentDistribution = stage1Data.basicStats?.sentimentRatio
    ? [
        {
          name: "긍정적",
          value: Math.round(
            stage1Data.basicStats.sentimentRatio.positive * 100,
          ),
        },
        {
          name: "중립적",
          value: Math.round(stage1Data.basicStats.sentimentRatio.neutral * 100),
        },
        {
          name: "부정적",
          value: Math.round(
            stage1Data.basicStats.sentimentRatio.negative * 100,
          ),
        },
      ]
    : [
        { name: "긍정적", value: 60 },
        { name: "중립적", value: 30 },
        { name: "부정적", value: 10 },
      ];

  return {
    sentimentScore,
    sentimentDistribution,
    insights: insights.slice(0, 4),
    stage1Data,
    stage2Data,
  };
}
