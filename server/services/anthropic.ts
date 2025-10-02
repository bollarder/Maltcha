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

// 전체 메시지에서 통계 계산 함수들
function calculateMessageRatio(messages: any[], user: string, partner: string) {
  const userCount = messages.filter((m) => m.participant === user).length;
  const partnerCount = messages.filter((m) => m.participant === partner).length;
  const total = userCount + partnerCount;
  return {
    [user]: total > 0 ? Number((userCount / total).toFixed(2)) : 0.5,
    [partner]: total > 0 ? Number((partnerCount / total).toFixed(2)) : 0.5,
  };
}

function calculateAvgLength(messages: any[], user: string, partner: string) {
  const userMsgs = messages.filter((m) => m.participant === user);
  const partnerMsgs = messages.filter((m) => m.participant === partner);

  const userAvg =
    userMsgs.length > 0
      ? Math.round(
          userMsgs.reduce((sum, m) => sum + m.content.length, 0) /
            userMsgs.length,
        )
      : 0;
  const partnerAvg =
    partnerMsgs.length > 0
      ? Math.round(
          partnerMsgs.reduce((sum, m) => sum + m.content.length, 0) /
            partnerMsgs.length,
        )
      : 0;

  return { [user]: userAvg, [partner]: partnerAvg };
}

function calculateTimeDistribution(messages: any[]) {
  const distribution = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}시`,
    count: 0,
  }));

  messages.forEach((m) => {
    try {
      const hourMatch = m.timestamp.match(/(\d{1,2}):(\d{2})/);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1]);
        if (hour >= 0 && hour < 24) {
          distribution[hour].count++;
        }
      }
    } catch (e) {
      // 타임스탬프 파싱 실패 시 무시
    }
  });

  return distribution;
}

function calculateEmojiFrequency(
  messages: any[],
  user: string,
  partner: string,
) {
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  const userEmojis = messages
    .filter((m) => m.participant === user)
    .reduce(
      (count, m) => count + (m.content.match(emojiRegex) || []).length,
      0,
    );

  const partnerEmojis = messages
    .filter((m) => m.participant === partner)
    .reduce(
      (count, m) => count + (m.content.match(emojiRegex) || []).length,
      0,
    );

  return { [user]: userEmojis, [partner]: partnerEmojis };
}

function calculateSentimentRatio(messages: any[]) {
  const positiveWords = [
    "좋",
    "행복",
    "감사",
    "사랑",
    "최고",
    "멋",
    "예쁘",
    "웃",
    "ㅎㅎ",
    "ㅋㅋ",
    "^^",
    "♥",
    "💕",
  ];
  const negativeWords = [
    "싫",
    "화",
    "짜증",
    "미워",
    "별로",
    "싫어",
    "속상",
    "슬프",
    "힘들",
  ];

  let positive = 0,
    negative = 0,
    neutral = 0;

  messages.forEach((m) => {
    const content = m.content.toLowerCase();
    const hasPositive = positiveWords.some((word) => content.includes(word));
    const hasNegative = negativeWords.some((word) => content.includes(word));

    if (hasPositive && !hasNegative) positive++;
    else if (hasNegative && !hasPositive) negative++;
    else neutral++;
  });

  const total = messages.length || 1;
  return {
    positive: Number((positive / total).toFixed(2)),
    neutral: Number((neutral / total).toFixed(2)),
    negative: Number((negative / total).toFixed(2)),
  };
}

// 관계별 분석 포인트 동적 생성
function getAnalysisPoints(primary: string, secondary: string[]) {
  const points: string[] = [];
  const allRelationships = [primary, ...secondary];

  // 연인/썸: 애정 표현, 감정 비대칭
  if (allRelationships.some((r) => ["연인", "썸"].includes(r))) {
    points.push(
      "- 애정 표현 패턴: '사랑해', '보고싶어', '좋아해' 등의 빈도와 진정성 분석",
    );
    points.push("- 감정 비대칭: 한쪽이 더 적극적으로 감정을 표현하는지 분석");
    if (primary === "썸") {
      points.push("- 썸 특화: 탐색적 질문, 조심스러운 표현, 관심 확인 패턴");
    }
  }

  // 업무/파트너: 효율성, 의사결정
  if (allRelationships.some((r) => ["업무", "파트너"].includes(r))) {
    points.push("- 업무 효율: 결정 속도, 커뮤니케이션 병목, 회의록 패턴");
    points.push("- 역할 분담: 누가 주도하고 누가 실행하는지, 책임 분배");
    points.push("- 업무 시간 패턴: 근무 시간 vs 퇴근 후 메시지 비율");
  }

  // 가족: 예의, 배려
  if (allRelationships.includes("가족")) {
    points.push("- 존댓말/반말 사용 패턴과 격식 수준");
    points.push("- 세대 간 소통 방식 차이 (있다면)");
    points.push("- 일상 공유 빈도와 가족적 유대감");
  }

  // 멘토: 조언, 피드백
  if (allRelationships.includes("멘토")) {
    points.push("- 조언/피드백 빈도와 수용도");
    points.push("- 상하 관계의 편안함 정도와 존중 표현");
    points.push("- 멘티의 성장 흔적이 대화에 나타나는지");
  }

  // 친구: 편안함, 공유
  if (allRelationships.includes("친구")) {
    points.push("- 농담과 장난의 빈도 (편안함 지표)");
    points.push("- 일상 공유와 공감 패턴");
  }

  // 지인: 거리감
  if (allRelationships.includes("지인")) {
    points.push("- 격식과 거리감 유지 정도");
    points.push("- 친밀도 발전 가능성");
  }

  // 기본 분석 (모든 관계)
  points.push("- 대화 스타일: 경청형 vs 주도형, 질문 빈도");
  points.push("- 친밀도 변화: 시간에 따른 관계 발전 추이");
  points.push("- 응답 패턴: 답장 속도와 메시지 길이 변화");

  // 복합 관계 특별 분석
  if (secondary.length > 0) {
    points.push(
      `- 복합 관계 특성: ${primary}과 ${secondary.join(", ")}의 균형과 전환 패턴`,
    );
  }

  return points.join("\n");
}

export async function analyzeConversation(
  messages: { timestamp: string; participant: string; content: string }[],
  stats: { totalMessages: number; participants: number },
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = [],
): Promise<ConversationAnalysis> {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const user_name = participants[0] || "사용자";
  const partner_name = participants[1] || "상대방";

  // 관계 유형 컨텍스트 생성
  const relationshipContext =
    secondaryRelationships.length > 0
      ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")} (부가적)`
      : primaryRelationship;

  console.log(
    `분석 시작: ${relationshipContext} 관계, 총 ${messages.length}개 메시지`,
  );

  // 전체 메시지에서 정확한 통계 계산
  const fullStats = {
    totalMessages: messages.length,
    messageRatio: calculateMessageRatio(messages, user_name, partner_name),
    avgMessageLength: calculateAvgLength(messages, user_name, partner_name),
    timeDistribution: calculateTimeDistribution(messages),
    emojiFrequency: calculateEmojiFrequency(messages, user_name, partner_name),
    sentimentRatio: calculateSentimentRatio(messages),
  };

  console.log("전체 통계 계산 완료:", fullStats);

  // 관계별 분석 포인트 생성
  const analysisPoints = getAnalysisPoints(
    primaryRelationship,
    secondaryRelationships,
  );

  // Stage 1: 핵심 정보 추출 (샘플 사용)
  const stage1Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 대화 분석 전문가입니다. 주어진 통���와 대화 샘플에서 관계에 중요한 정보를 추출하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}과 ${partner_name}의 대화를 분석해 JSON으로 응답해줘.

**관계 유형: ${relationshipContext}**

**이미 계산된 정확한 통계 (전체 ${messages.length}개 메시지 기반):**
- 총 메시지: ${fullStats.totalMessages}
- 메시지 비율: ${user_name} ${(fullStats.messageRatio[user_name] * 100).toFixed(0)}%, ${partner_name} ${(fullStats.messageRatio[partner_name] * 100).toFixed(0)}%
- 평균 메시지 길이: ${user_name} ${fullStats.avgMessageLength[user_name]}자, ${partner_name} ${fullStats.avgMessageLength[partner_name]}자
- 이모티콘 사용: ${user_name} ${fullStats.emojiFrequency[user_name]}개, ${partner_name} ${fullStats.emojiFrequency[partner_name]}개
- 감정 비율: 긍정 ${(fullStats.sentimentRatio.positive * 100).toFixed(0)}%, 중립 ${(fullStats.sentimentRatio.neutral * 100).toFixed(0)}%, 부정 ${(fullStats.sentimentRatio.negative * 100).toFixed(0)}%

**대화 샘플 (최근 200개 + 과거 랜덤 50개):**
${messages
  .slice(-200)
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}

${
  messages.length > 200
    ? `
---과거 샘플---
${Array.from({ length: Math.min(50, messages.length - 200) }, () => {
  const idx = Math.floor(Math.random() * (messages.length - 200));
  return messages[idx];
})
  .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
  .join("\n")}
`
    : ""
}

**추출할 정보 (JSON만 출력):**
\`\`\`json
{
  "keyInfo": {
    "preferences": [
      {"type": "like", "content": "구체적으로 좋아한다고 언급한 것"},
      {"type": "dislike", "content": "구체적으로 싫어한다고 언급한 것"}
    ],
    "importantDates": [
      {"date": "YYYY-MM-DD", "content": "약속이나 기념일 내용"}
    ],
    "affectionKeywords": {
      "${user_name}": 5,
      "${partner_name}": 8
    },
    "topKeywords": [
      {"word": "단어", "count": 10}
    ]
  }
}
\`\`\`

위 통계는 이미 정확하게 계산되었으니, 대화 샘플에서 **선호도, 중요 날짜, 주요 키워드**만 추출해줘.`,
      },
    ],
  });

  const stage1Text =
    stage1Response.content[0].type === "text"
      ? stage1Response.content[0].text
      : "{}";

  let stage1KeyInfo;
  try {
    const cleanText = stage1Text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "");
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
    stage1KeyInfo = parsed.keyInfo || {};
  } catch (e) {
    console.error("Stage 1 파싱 실패:", e);
    stage1KeyInfo = {
      preferences: [],
      importantDates: [],
      affectionKeywords: { [user_name]: 0, [partner_name]: 0 },
      topKeywords: [],
    };
  }

  // Stage 1 데이터 = 전체 통계 + AI 추출 정보
  const stage1Data = {
    basicStats: {
      ...fullStats,
      topKeywords: stage1KeyInfo.topKeywords || [],
    },
    keyInfo: stage1KeyInfo,
  };

  console.log("Stage 1 완료");

  // Stage 2: 관계 심층 분석
  const stage2Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3000,
    system: `당신은 관계 심리 분석가입니다. 주어진 관계 유형(${relationshipContext})에 맞춰 대화 패턴에서 숨겨진 의미를 파악하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}과 ${partner_name}의 관계(${relationshipContext})를 분석해 JSON으로 응답해줘.

**통계 요약:**
- ${user_name}: 메시지 ${(fullStats.messageRatio[user_name] * 100).toFixed(0)}%, 평균 ${fullStats.avgMessageLength[user_name]}자, 이모티콘 ${fullStats.emojiFrequency[user_name]}개
- ${partner_name}: 메시지 ${(fullStats.messageRatio[partner_name] * 100).toFixed(0)}%, 평균 ${fullStats.avgMessageLength[partner_name]}자, 이모티콘 ${fullStats.emojiFrequency[partner_name]}개

**관계별 분석 포인트:**
${analysisPoints}

**최근 대화 (100개):**
${messages
  .slice(-100)
  .map((m) => `${m.participant}: ${m.content}`)
  .join("\n")}

**필수 출력 (JSON만):**
\`\`\`json
{
  "communicationStyle": {
    "${user_name}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]},
    "${partner_name}": {"type": "경청형/주도형", "traits": ["특징1", "특징2"]}
  },
  "emotionalExpression": {
    "emojiDependency": {"${user_name}": "high/medium/low", "${partner_name}": "high/medium/low"},
    "emotionalAsymmetry": "한 문장 설명"
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
    stage2Data = {
      communicationStyle: {},
      emotionalExpression: {},
      relationshipDynamics: {},
      specialPatterns: {},
      partnerStatus: {},
    };
  }

  console.log("Stage 2 완료");

  // Stage 3: 실용적 인사이트
  const stage3Response = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 2500,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다. ${relationshipContext} 관계에 맞춰 따뜻하고 구체적인 조언을 4개의 인사이트로 제공하세요.`,
    messages: [
      {
        role: "user",
        content: `${user_name}님을 위한 인사이트 4개를 만들어줘.

**관계 유형: ${relationshipContext}**

**분석 결과:**
- 총 ${fullStats.totalMessages}개 메시지
- ${user_name} ${(fullStats.messageRatio[user_name] * 100).toFixed(0)}% vs ${partner_name} ${(fullStats.messageRatio[partner_name] * 100).toFixed(0)}%
- 긍정 메시지 ${(fullStats.sentimentRatio.positive * 100).toFixed(0)}%
- 관계 스타일: ${JSON.stringify(stage2Data.communicationStyle)}
- 특이 패턴: ${JSON.stringify(stage2Data.specialPatterns)}
- 상대방 상태: ${stage2Data.partnerStatus?.currentState || "정보 없음"}
- 선호도: ${JSON.stringify(stage1KeyInfo.preferences)}

**필수 출력 (JSON 배열만):**
\`\`\`json
[
  {
    "title": "💬 소통 에너지: XX점",
    "description": "구체적인 설명과 칭찬"
  },
  {
    "title": "🎭 ${partner_name}님의 대화 스타일",
    "description": "타입과 특징 설명"
  },
  {
    "title": "📝 ${partner_name}님의 취향 노트",
    "description": "좋아하는 것/싫어하는 것 구체적으로"
  },
  {
    "title": "💭 Tea의 조언",
    "description": "현재 상황 분석과 실용적 제안"
  }
]
\`\`\`

**규칙:**
- 정확히 4개만 출력
- ${relationshipContext} 관계에 맞는 톤과 내용
- 구체적인 수치와 예시 포함
- 따뜻하고 친근한 톤`,
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
        title: "💬 소통 에너지 분석 완료",
        description: `${user_name}님과 ${partner_name}님의 ${fullStats.totalMessages}개 메시지를 분석했어요!`,
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

  console.log("Stage 3 완료");

  const sentimentScore = Math.round(
    (fullStats.sentimentRatio.positive * 100 +
      fullStats.sentimentRatio.neutral * 50) /
      (fullStats.sentimentRatio.positive +
        fullStats.sentimentRatio.neutral +
        fullStats.sentimentRatio.negative),
  );

  const sentimentDistribution = [
    {
      name: "긍정적",
      value: Math.round(fullStats.sentimentRatio.positive * 100),
    },
    {
      name: "중립적",
      value: Math.round(fullStats.sentimentRatio.neutral * 100),
    },
    {
      name: "부정적",
      value: Math.round(fullStats.sentimentRatio.negative * 100),
    },
  ];

  return {
    sentimentScore,
    sentimentDistribution,
    insights: insights.slice(0, 4),
    stage1Data,
    stage2Data,
  };
}
