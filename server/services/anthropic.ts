import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey:
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY_ENV_VAR ||
    "",
});

export interface ConversationAnalysis {
  sentimentScore: number;
  sentimentDistribution: { name: string; value: number }[];
  insights: { title: string; description: string }[];
  // Stage 1 데이터 추가
  stage1Data?: {
    basicStats: any;
    keyInfo: any;
  };
  // Stage 2 데이터 추가
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
  const relationship_type = "친구";

  // Stage 1: 의미 있는 데이터 추출
  const stage1Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4096,
    system: `당신은 고도로 훈련된 데이터 분석가이자 정보 추출 전문가입니다. 주어진 카카오톡 대화 텍스트와 관계 유형을 바탕으로, 관계의 역학을 파악할 수 있는 핵심 정량 지표와, 나중에 반드시 기억해야 할 중요한 정보를 구조화된 형태로 추출하세요.`,
    messages: [
      {
        role: "user",
        content: `다음 대화 데이터와 정보(관계 유형: ${relationship_type})를 바탕으로 아래 지표들을 추출해줘. 각 지표는 비교 분석이 가능하도록 ${partner_name}과 ${user_name}의 데이터를 명확히 구분해줘.

총 메시지 수: ${stats.totalMessages}
참여자: ${user_name}, ${partner_name}

대화 샘플 (최근 150개):
${messages
  .slice(-150)
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

**[추출할 지표]**
1. 총 메시지 수
2. 발신자별 메시지 비율 (${user_name} vs ${partner_name})
3. 평균 메시지 길이
4. 시간대별 활동 분포 (새벽/아침/낮/저녁/밤)
5. 이모티콘 사용 빈도
6. 질문 vs 답변 비율
7. 대화 시작 비율
8. 주제 키워드 (빈도순 상위 20개)
9. 긍정/부정/중립 메시지 비율

**[핵심 정보 추출]**
1. 선호도/불호도: ${partner_name}가 좋아하거나 싫어한다고 명시적으로 언급한 내용
2. 중요 약속/기념일: 날짜가 언급된 약속이나 기념일
3. 애정/친밀도 표현: "사랑해", "보고싶다", "고마워" 등 친밀감을 나타내는 단어 사용 빈도 (${user_name} vs ${partner_name})

반드시 JSON 형식으로 응답해줘. 예시:
{
  "basicStats": {
    "totalMessages": number,
    "messageRatio": {"${user_name}": number, "${partner_name}": number},
    "avgMessageLength": {"${user_name}": number, "${partner_name}": number},
    "timeDistribution": {"dawn": number, "morning": number, "afternoon": number, "evening": number, "night": number},
    "emojiFrequency": {"${user_name}": number, "${partner_name}": number},
    "questionAnswerRatio": {"${user_name}": number, "${partner_name}": number},
    "conversationStartRatio": {"${user_name}": number, "${partner_name}": number},
    "topKeywords": [{"word": string, "count": number}],
    "sentimentRatio": {"positive": number, "neutral": number, "negative": number}
  },
  "keyInfo": {
    "preferences": [{"type": "like" | "dislike", "content": string}],
    "importantDates": [{"date": string, "content": string}],
    "affectionExpression": {"${user_name}": number, "${partner_name}": number}
  }
}`,
      },
    ],
  });

  const stage1Text =
    stage1Response.content[0].type === "text"
      ? stage1Response.content[0].text
      : "{}";
  let stage1Data;
  try {
    const jsonMatch = stage1Text.match(/\{[\s\S]*\}/);
    stage1Data = JSON.parse(jsonMatch ? jsonMatch[0] : stage1Text);
  } catch {
    stage1Data = { basicStats: {}, keyInfo: {} };
  }

  // Stage 2: 상황 맥락적 심층 분석
  const stage2Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4096,
    system: `당신은 관계 심리학, 사회 언어학, 비즈니스 커뮤니케이션을 모두 전공한 세계 최고의 온톨로지 분석가입니다. 당신의 임무는 주어진 데이터와 관계 유형에 따라 페르소나를 바꾸어 대화의 숨겨진 맥락과 의도를 읽어내는 것입니다. 분석은 날카롭지만, 단정짓지 않으며, 구체적인 대화 예시를 반드시 근거로 제시하세요.`,
    messages: [
      {
        role: "user",
        content: `다음 대화, 통계, 그리고 관계 유형(${relationship_type}) 정보를 바탕으로 ${user_name}과 ${partner_name}의 관계를 심층 분석해줘.

통계 데이터:
${JSON.stringify(stage1Data, null, 2)}

대화 샘플 (최근 150개):
${messages
  .slice(-150)
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

**[분석 프레임워크]**
1. 대화 스타일 (경청형 vs 주도형, 공감 표현 빈도, 갈등 회피 vs 직면 성향)
2. 언어 패턴 (사과/감사 표현 빈도, 완곡 표현 vs 직설적 표현, 자기 검열 신호)
3. 감정 표현 (이모티콘 의존도, 감정 단어 다양성, 진짜 vs 사회적 감정 구분)
4. 관계 역학 (주도권 분포, 응답 패턴, 친밀도 변화 추이)
5. 특이 패턴 (반복되는 주제, 회피하는 주제, 행복/불편 신호)

**[관계 유형별 심층 분석 - ${relationship_type} 모드]**
- 숨은 의미 파악: 완곡한 표현이나 간접적인 요청의 패턴 분석
- 감정의 비대칭성: 감정 표현의 차이 포착
- 상대방 상황 추론: 메시지 길이, 단어 선택, 응답 시간을 바탕으로 현재 상대방의 상태 추측

반드시 JSON 형식으로 응답해줘. 예시:
{
  "communicationStyle": {
    "${user_name}": {"type": string, "traits": [string]},
    "${partner_name}": {"type": string, "traits": [string]}
  },
  "languagePattern": {
    "apologyFrequency": {"${user_name}": number, "${partner_name}": number},
    "gratitudeFrequency": {"${user_name}": number, "${partner_name}": number},
    "indirectExpression": [{"speaker": string, "example": string, "meaning": string}]
  },
  "emotionalExpression": {
    "emojiDependency": {"${user_name}": "high" | "medium" | "low", "${partner_name}": "high" | "medium" | "low"},
    "emotionalAsymmetry": string
  },
  "relationshipDynamics": {
    "powerBalance": string,
    "responsePattern": {"${user_name}": string, "${partner_name}": string},
    "intimacyTrend": "increasing" | "stable" | "decreasing"
  },
  "specialPatterns": {
    "recurringTopics": [string],
    "avoidedTopics": [string],
    "happyMoments": [{"timestamp": string, "context": string}],
    "tenseMoments": [{"timestamp": string, "context": string}]
  },
  "partnerStatus": {
    "currentState": string,
    "suggestion": string
  }
}`,
      },
    ],
  });

  const stage2Text =
    stage2Response.content[0].type === "text"
      ? stage2Response.content[0].text
      : "{}";
  let stage2Data;
  try {
    const jsonMatch = stage2Text.match(/\{[\s\S]*\}/);
    stage2Data = JSON.parse(jsonMatch ? jsonMatch[0] : stage2Text);
  } catch {
    stage2Data = {};
  }

  // Stage 3: 실행 가능한 비서 리포트
  const stage3Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4096,
    system: `당신은 Maltcha의 AI 소통 비서 'Tea(티)'입니다. 복잡한 분석 결과를 바탕으로, 사용자가 더 나은 관계를 맺고 난감한 상황을 피할 수 있도록, 똑똑하지만 따뜻하고 친근한 리포트를 작성하세요. 칭찬을 먼저 하고, 조심스럽게 제안하며, 사용자가 유료 결제를 할 가치가 있다고 느끼게 만드세요. 모든 응답은 한국어로 작성하세요.`,
    messages: [
      {
        role: "user",
        content: `아래 분석 결과를 바탕으로, ${user_name}님만을 위한 '마음결 노트'를 ${relationship_type}에 맞춰 작성해줘.

Stage 1 데이터:
${JSON.stringify(stage1Data, null, 2)}

Stage 2 분석:
${JSON.stringify(stage2Data, null, 2)}

**[리포트 섹션]**
1. 소통 에너지 (0-100점 + 설명)
2. 대화 스타일 (타입 + 특징, 예: "OOO님은 '안정적인 정원사' 같은 분이군요.")
3. 소통 리듬 (시간 패턴과 가장 빛났던 순간)
4. 감정 표현 방식
5. 가장 행복했던 순간 (구체적 예시)
6. 관계를 더 깊게 하려면 (3가지 구체적 제안)

**[고도화 섹션]**
7. 잊지 말아요, ${partner_name}님의 취향 노트 (선호도/불호도 정리)
8. Tea의 작은 속삭임 (현재 상대방 상태 추론 + 조언)
9. 아웃트로: "Maltcha Plus로 두 분의 관계를 더 깊고 향긋하게..."

반드시 JSON 배열 형식으로 4개의 인사이트를 작성해줘. 각 인사이트는 title과 description을 포함해야 해.
예시:
[
  {
    "title": "소통 에너지: 85점 ⚡",
    "description": "두 분의 소통은 정말 활발해요! 특히 저녁 시간대에 가장 많은 대화를 나누시네요. 서로에게 관심이 많다는 증거예요."
  },
  {
    "title": "${partner_name}님은 '따뜻한 응원자' 타입",
    "description": "상대방은 공감과 격려를 자주 표현하는 스타일이에요. '힘내', '괜찮아' 같은 표현을 ${user_name}님보다 2배 더 많이 사용하셨어요."
  },
  {
    "title": "잊지 말아요, ${partner_name}님의 취향 노트 📝",
    "description": "최근 대화에서 ${partner_name}님은 '민트초코를 좋아한다'고 했고, '공포영화를 무서워한다'고 했어요. 다음 번 만남 때 참고하면 센스 만점!"
  },
  {
    "title": "Tea의 속삭임 💭",
    "description": "최근 ${partner_name}님의 답장이 짧고 빨라진 걸 보니, 바쁜 시기를 보내고 계신 것 같아요. 지금은 가벼운 안부보다 따뜻한 응원 한마디가 더 큰 힘이 될 거예요."
  }
]`,
      },
    ],
  });

  const stage3Text =
    stage3Response.content[0].type === "text"
      ? stage3Response.content[0].text
      : "[]";
  let insights;
  try {
    const jsonMatch = stage3Text.match(/\[[\s\S]*\]/);
    insights = JSON.parse(jsonMatch ? jsonMatch[0] : stage3Text);
    if (!Array.isArray(insights)) {
      insights = [];
    }
  } catch {
    insights = [
      {
        title: "소통 에너지 분석 완료",
        description: `${user_name}님과 ${partner_name}님의 대화를 분석했어요. 두 분의 관계는 특별해 보여요!`,
      },
      {
        title: "대화 스타일",
        description:
          "서로 다른 소통 스타일이지만, 그 차이가 오히려 균형을 만들고 있어요.",
      },
      {
        title: "가장 행복했던 순간",
        description:
          "대화 속에서 서로에게 진심으로 웃었던 순간들이 발견됐어요.",
      },
      {
        title: "Tea의 조언",
        description:
          "지금처럼 계속 소통하신다면, 더욱 깊은 관계로 발전할 수 있을 거예요.",
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
    stage1Data, // Stage 1 데이터 반환
    stage2Data, // Stage 2 데이터 반환
  };
}
