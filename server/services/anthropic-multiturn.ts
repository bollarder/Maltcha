// server/services/anthropic-multiturn.ts
// Multi-turn 대화 분석 - 완전한 프로덕션 구현

import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "./data-processor";
import { processConversationData } from "./data-processor";

const MODEL = "claude-sonnet-4-20250514";
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

// ========== 유틸리티 함수 ==========

function parseJSON(response: any): any {
  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "{}";

  try {
    // ```json ... ``` 코드 블록 추출
    const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }

    // 일반 JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error("No JSON found in response");
  } catch (error) {
    console.error("JSON 파싱 실패:", error);
    console.error("원본 텍스트 (처음 500자):", text.substring(0, 500));
    throw error;
  }
}

function formatMessages(messages: Message[]): string {
  return messages
    .map((m) => `[${m.timestamp}] ${m.participant}: ${m.content}`)
    .join("\n");
}

function getMessagesAround(
  messages: Message[],
  targetTimestamp: string,
  windowSize: number,
): Message[] {
  const targetIndex = messages.findIndex(
    (m) => m.timestamp === targetTimestamp,
  );
  if (targetIndex === -1) return [];

  const start = Math.max(0, targetIndex - Math.floor(windowSize / 2));
  const end = Math.min(
    messages.length,
    targetIndex + Math.ceil(windowSize / 2),
  );

  return messages.slice(start, end);
}

// ========== TURN 1: 전체 이해 ==========

async function turn1_understanding(
  messages: Message[],
  userName: string,
  partnerName: string,
  relationshipContext: string,
) {
  console.log("\n=== Turn 1: 전체 이해 ===");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 10000,
    temperature: 0.7,
    system: `당신은 15년 경력의 관계 심리 전문가입니다.

**전문 분야:**
- 의사소통 패턴 분석
- 관계 역학 진단
- 감정 코칭

**분석 원칙:**
1. 표면적 내용과 숨겨진 의미를 구분
2. 시간에 따른 변화 추적
3. 말하지 않은 것(침묵)도 중요한 데이터
4. 문화적 맥락 고려 (한국 대화 문화)

주어진 대화를 정독하고, 관계의 본질을 파악하세요.`,

    messages: [
      {
        role: "user",
        content: `# 대화 분석 의뢰

**참여자:** ${userName} ↔ ${partnerName}
**관계:** ${relationshipContext}
**총 메시지:** ${messages.length}개

## 전체 대화 내역

${formatMessages(messages)}

---

## 분석 요청사항

위 대화를 **처음부터 끝까지 정독**하고 다음을 분석하세요:

### 1. 전반적 관계 평가
- 이 관계는 건강한가?
- 전반적 분위기 (긍정적/중립적/부정적)
- 관계 건강도 점수 (1-10점)

### 2. 중요한 전환점 발견
- 관계에 영향을 준 주요 이벤트 3-5개
- 각 이벤트의 타임스탬프와 맥락
- 왜 중요한지 설명

### 3. 걱정되는 신호
- 반복되는 부정적 패턴
- 미해결 갈등의 징후
- 소통 단절의 신호

### 4. 긍정적 요소
- 관계의 강점
- 잘 작동하는 소통 방식
- 서로에 대한 배려 표현

### 5. 다음 분석 방향
- 더 깊이 살펴봐야 할 시기/주제
- 주목해야 할 대화 패턴
- 해결이 필요한 이슈

---

**응답 형식 (JSON):**

\`\`\`json
{
  "relationshipAssessment": {
    "overallTone": "긍정적/중립적/부정적",
    "healthScore": 1-10,
    "summary": "2-3문장으로 관계 요약"
  },
  "keyEvents": [
    {
      "timestamp": "2024-01-15 14:30",
      "participants": "${userName}/${partnerName}",
      "context": "무슨 일이 있었는지 2-3문장",
      "significance": "왜 중요한지",
      "emotionalImpact": "긍정/부정/중립"
    }
  ],
  "concerningPatterns": [
    {
      "pattern": "패턴 설명",
      "frequency": "자주/가끔/드물게",
      "examples": ["타임스탬프1", "타임스탬프2"]
    }
  ],
  "strengths": [
    {
      "strength": "강점 설명",
      "examples": ["타임스탬프1", "타임스탬프2"]
    }
  ],
  "deepDiveTopics": [
    {
      "topic": "주제",
      "reason": "왜 더 살펴봐야 하는지",
      "timeRange": "2024-01 ~ 2024-02"
    }
  ]
}
\`\`\`

**중요:** 
- 실제 대화 내용에 기반한 구체적 분석
- 추측이 아닌 관찰에 기반
- 타임스탬프 정확히 기록`,
      },
    ],
  });

  const result = parseJSON(response);

  console.log(
    `✓ 관계 건강도: ${result.relationshipAssessment?.healthScore}/10`,
  );
  console.log(`✓ 주요 이벤트: ${result.keyEvents?.length || 0}개`);
  console.log(`✓ 걱정 패턴: ${result.concerningPatterns?.length || 0}개`);

  return { response, analysis: result };
}

// ========== TURN 2: 심층 분석 ==========

async function turn2_deepDive(
  messages: Message[],
  userName: string,
  partnerName: string,
  turn1Data: any,
) {
  // Rate limit 방지: API 호출 사이 지연 (Multi-turn은 토큰 사용량이 많아 30초 필요)
  console.log("\n⏳ Rate limit 방지 대기 중 (30초)...");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  console.log("\n=== Turn 2: 심층 분석 ===");

  // Turn 1에서 발견한 주요 이벤트 주변 대화 추출
  const contextualSamples =
    turn1Data.analysis.keyEvents?.flatMap((event: any) =>
      getMessagesAround(messages, event.timestamp, 40),
    ) || [];

  // 관심 시기의 대화도 추출
  const deepDiveMessages =
    turn1Data.analysis.deepDiveTopics?.flatMap((topic: any) => {
      const relevantMsgs = messages.filter((m) => {
        return m.timestamp.startsWith(topic.timeRange?.split(" ~ ")[0] || "");
      });
      return relevantMsgs.slice(0, 50);
    }) || [];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 15000,
    temperature: 0.7,
    system: `이전 전체 분석을 바탕으로, 더 깊은 차원의 통찰을 제공하세요.

**분석 심화 원칙:**
1. 표면 vs 진짜 의미 구분
2. 무의식적 패턴 포착
3. 시간에 따른 변화 추적
4. 상호작용의 질적 평가

특히 **말하지 않은 것**, **감정 뒤의 감정**, **회피하는 주제**를 주목하세요.`,

    messages: [
      {
        role: "user",
        content: turn1Data.response.messages?.[0]?.content || "",
      },
      {
        role: "assistant",
        content: turn1Data.response.content[0].text,
      },
      {
        role: "user",
        content: `# 심층 분석 요청

이전 분석 결과:
${JSON.stringify(turn1Data.analysis, null, 2)}

이제 다음 대화들을 **세밀하게** 분석하세요:

## 1. 주요 이벤트 전후 대화
${formatMessages(contextualSamples.slice(0, 200))}

## 2. 관심 시기 대화
${formatMessages(deepDiveMessages.slice(0, 200))}

## 3. 최근 대화 (변화 감지)
${formatMessages(messages.slice(-100))}

---

## 심층 분석 항목

### A. 소통 스타일 분석

**${userName}님:**
- 유형: 경청형/주도형/균형형
- 특징: 구체적 3-5가지
- 실제 대화 예시 인용
- 강점과 개선점

**${partnerName}님:**
- 유형: 경청형/주도형/균형형
- 특징: 구체적 3-5가지
- 실제 대화 예시 인용
- 강점과 개선점

### B. 감정 표현 방식

- 이모티콘 의존도 (high/medium/low)
- 직접적 vs 간접적 표현
- 감정 솔직도
- 감정 표현의 비대칭 (한쪽이 더 많이 표현하는가?)

### C. 관계 역학

- **주도권:** 누가 대화를 리드? 건강한 균형?
- **친밀도 변화:** 시간이 지나며 어떻게 변했나?
  - 초기 (첫 1/3)
  - 중기 (중간 1/3)
  - 최근 (마지막 1/3)
- **갈등 대처:** 의견 차이 시 어떻게 해결?
- **경계 존중:** 서로의 공간을 존중하는가?

### D. 특별한 패턴

- **반복 주제:** 자주 나오는 대화 소재
- **행복한 순간:** 진짜 행복했던 대화 (인용 필수)
- **어색한 순간:** 소통이 막혔던 순간 (인용 필수)
- **회피 주제:** 말하지 않는 것
- **말투 변화:** 특정 시점부터 달라진 것

### E. ${partnerName}님 현재 상태

- **최근 감정 상태:** 행복/보통/힘듦/모호
- **${userName}님에 대한 감정:** 애정/관심/무관심/피곤
- **숨겨진 욕구:** 진짜 원하는 것
- **걱정거리:** 표현 안 한 고민

---

**응답 형식 (JSON):**

\`\`\`json
{
  "communicationStyle": {
    "${userName}": {
      "type": "경청형/주도형/균형형",
      "traits": ["특징1", "특징2", "특징3"],
      "examples": [
        {"quote": "실제 대화", "timestamp": "날짜", "analysis": "이게 왜 특징인지"}
      ],
      "strengths": ["강점1", "강점2"],
      "improvements": ["개선점1", "개선점2"]
    },
    "${partnerName}": {
      "type": "경청형/주도형/균형형",
      "traits": ["특징1", "특징2", "특징3"],
      "examples": [
        {"quote": "실제 대화", "timestamp": "날짜", "analysis": "이게 왜 특징인지"}
      ],
      "strengths": ["강점1", "강점2"],
      "improvements": ["개선점1", "개선점2"]
    }
  },
  "emotionalExpression": {
    "emojiDependency": {
      "${userName}": "high/medium/low",
      "${partnerName}": "high/medium/low"
    },
    "directness": {
      "${userName}": "매우 직접적/보통/간접적",
      "${partnerName}": "매우 직접적/보통/간접적"
    },
    "asymmetry": "한쪽이 감정을 더 많이 표현한다면 구체적 설명"
  },
  "relationshipDynamics": {
    "powerBalance": {
      "assessment": "균형적/한쪽 주도/불안정",
      "leader": "${userName}/${partnerName}/균형",
      "healthiness": "건강함/보통/문제있음"
    },
    "intimacyTrend": {
      "early": "초기 친밀도 (1-10)",
      "middle": "중기 친밀도 (1-10)",
      "recent": "최근 친밀도 (1-10)",
      "direction": "increasing/stable/decreasing",
      "analysis": "변화 이유 분석"
    },
    "conflictResolution": {
      "style": "직접 대화/회피/폭발/건강한 해결",
      "examples": [
        {"situation": "상황", "resolution": "어떻게 해결", "timestamp": "날짜"}
      ]
    }
  },
  "specialPatterns": {
    "recurringTopics": [
      {"topic": "주제", "frequency": "빈도", "tone": "긍정/중립/부정"}
    ],
    "happyMoments": [
      {
        "timestamp": "날짜",
        "quote": "실제 대화 인용",
        "why": "왜 행복한 순간인지",
        "emotionalSignals": ["웃음", "이모티콘 많음"]
      }
    ],
    "awkwardMoments": [
      {
        "timestamp": "날짜",
        "quote": "실제 대화",
        "why": "왜 어색했는지"
      }
    ],
    "avoidedTopics": ["회피하는 주제1", "주제2"],
    "speechChanges": [
      {
        "when": "시점",
        "change": "어떻게 달라졌는지",
        "possibleReason": "추정 이유"
      }
    ]
  },
  "partnerStatus": {
    "currentMood": "행복/보통/힘듦/혼란",
    "emotionTowardUser": "애정/관심/무관심/부담",
    "hiddenNeeds": "진짜 원하는 것 (추론)",
    "unexpressedConcerns": "말 안 한 고민들",
    "recentBehaviorChange": "최근 행동 변화 (있다면)"
  }
}
\`\`\`

**필수:**
- 모든 주장은 실제 대화 인용으로 뒷받침
- 타임스탬프 정확히 기록
- "~인 것 같다"보다 "~다. 왜냐하면 [대화 인용]"`,
      },
    ],
  });

  const result = parseJSON(response);

  console.log(`✓ 소통 스타일 분석 완료`);
  console.log(
    `✓ 친밀도 변화: ${result.relationshipDynamics?.intimacyTrend?.direction || "N/A"}`,
  );
  console.log(
    `✓ 행복한 순간: ${result.specialPatterns?.happyMoments?.length || 0}개`,
  );

  return { response, analysis: result };
}

// ========== TURN 3: 사용자 맞춤 보고서 ==========

async function turn3_report(
  messages: Message[],
  userName: string,
  partnerName: string,
  basicStats: any,
  turn1Data: any,
  turn2Data: any,
) {
  // Rate limit 방지: API 호출 사이 지연 (Multi-turn은 토큰 사용량이 많아 30초 필요)
  console.log("\n⏳ Rate limit 방지 대기 중 (30초)...");
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  console.log("\n=== Turn 3: 최종 보고서 생성 ===");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 12000,
    temperature: 0.8,
    system: `당신은 Maltcha의 AI 비서 'Tea'입니다.

**Tea의 정체성:**
- 따뜻하고 공감적인 친구
- 직설적이되 상처주지 않는 조언자
- 실용적이고 구체적인 해결사

**작성 원칙:**
1. **NO 일반론:** "소통이 중요해요" (X) → "이렇게 말해보세요: '...'" (O)
2. **실제 인용:** 추상적 설명 대신 대화 예시
3. **실행 가능:** 오늘 당장 할 수 있는 조언
4. **균형:** 칭찬 + 솔직한 지적 + 희망
5. **맞춤형:** ${userName}님만을 위한, 이 관계만의 조언

${userName}님이 이 보고서를 읽고 "아, 이 AI가 우리 대화를 진짜 이해하네"라고 느껴야 합니다.`,

    messages: [
      {
        role: "user",
        content: turn1Data.response.messages?.[0]?.content || "",
      },
      {
        role: "assistant",
        content: turn1Data.response.content[0].text,
      },
      {
        role: "user",
        content: turn2Data.response.messages?.[2]?.content || "",
      },
      {
        role: "assistant",
        content: turn2Data.response.content[0].text,
      },
      {
        role: "user",
        content: `# ${userName}님을 위한 최종 보고서 작성

## 분석 데이터 요약

### 기본 통계
${JSON.stringify(basicStats, null, 2)}

### Turn 1: 전체 이해
${JSON.stringify(turn1Data.analysis, null, 2)}

### Turn 2: 심층 분석
${JSON.stringify(turn2Data.analysis, null, 2)}

### 최근 대화 (보고서 작성 참고)
${formatMessages(messages.slice(-30))}

---

## 보고서 작성 요청

다음 **6개 인사이트**를 작성하세요:

### 1. 💬 티키타카 지수: ${basicStats.tikitakaScore}점

**포함 내용:**
- 점수에 대한 따뜻한 해석
- ${userName}님과 ${partnerName}님의 대화 스타일이 잘 맞는 부분
- 실제 대화 패턴 예시 (구체적으로!)
- 진심 어린 칭찬

**톤:** 따뜻하고 격려적
**최소 길이:** 250자

---

### 2. 🎭 ${partnerName}님의 진짜 소통 스타일

**포함 내용:**
- ${partnerName}님의 소통 유형 (경청형/주도형/균형형)
- 표면적 말투 vs 진짜 속마음
- ${userName}님이 오해할 수 있는 부분 (중요!)
- 실제 대화 인용하며 설명

**예시 구조:**
"${partnerName}님은 겉으로는 [X]하게 말하지만, 실제로는 [Y]한 마음이에요.
예를 들어 [날짜]에 '${partnerName}: ...'라고 했을 때,
이건 [진짜 의미] 뜻이었어요. ${userName}님은 이걸 [오해 가능]하게 받아들일 수 있는데..."

**톤:** 통찰력 있고 구체적
**최소 길이:** 300자

---

### 3. 📝 ${partnerName}님의 취향 노트

**포함 내용:**
- **좋아하는 것:** 대화에서 실제 언급된 것만 (추측 금지)
- **싫어하는 것:** 대화에서 실제 언급된 것만
- **지뢰밟지 않는 법:** 구체적 상황별 팁
- **기쁘게 하는 법:** 실전 전략

**형식:**
✅ 좋아하는 것
  - [것1]: "[날짜] ${partnerName}: ..." 이렇게 말했어요
  - [것2]: ...

❌ 싫어하는 것
  - [것1]: ...

💡 꿀팁
  - 상황1: 이렇게 말하면 좋아요: "..."
  - 상황2: ...

**톤:** 실용적이고 메모 같은 느낌
**최소 길이:** 350자

---

### 4. ⏰ 의미 있는 대화 시간

**포함 내용:**
- 언제 가장 깊은 대화가 이뤄졌는지
- 그 시간대에 나눈 대화 내용
- 이 시간대가 특별한 이유
- 활용 전략

**구체적 예시:**
"두 분은 주로 [시간대]에 진짜 속마음을 나눠요.
[날짜 시간]에는 이런 대화가 있었죠:
'${userName}: ...'
'${partnerName}: ...'

이 시간대가 특별한 이유는..."

**톤:** 발견의 기쁨
**최소 길이:** 250자

---

### 5. ⚠️ 조심해야 할 3가지

**포함 내용:**
- 관계에 해로울 수 있는 패턴 3가지
- 각 패턴의 구체적 예시 (대화 인용)
- 왜 위험한지
- 구체적 대안 ("이렇게 말해보세요:")

**형식:**
1️⃣ [패턴1]
문제: [실제 대화 인용]
위험: ...
대안: "${userName}님, 다음엔 이렇게 말해보는 건 어때요: '...'"

2️⃣ [패턴2]
...

**톤:** 솔직하되 희망적
**최소 길이:** 400자

---

### 6. 💡 Tea의 종합 조언

**포함 내용:**
- 현재 관계 상태 종합 진단
- ${partnerName}님이 지금 진짜 필요한 것
- ${userName}님이 오늘부터 할 수 있는 3가지
- 관계의 미래 전망 (희망적으로)

**구조:**
📊 현재 상태: ...

💭 ${partnerName}님의 마음: ...

🎯 오늘부터 실천:
  1. [구체적 행동1]: "이렇게 말해보세요: '...'"
  2. [구체적 행동2]: ...
  3. [구체적 행동3]: ...

🌱 Tea의 마지막 한마디: ...

**톤:** 따뜻한 조언자, 희망적
**최소 길이:** 450자

---

**최종 형식 (JSON 배열):**

\`\`\`json
[
  {
    "title": "💬 티키타카 지수: 85점",
    "description": "250자 이상의 따뜻하고 구체적인 내용..."
  },
  {
    "title": "🎭 ${partnerName}님의 진짜 소통 스타일",
    "description": "300자 이상, 실제 대화 인용 포함..."
  },
  {
    "title": "📝 ${partnerName}님의 취향 노트",
    "description": "350자 이상, 구체적 팁 포함..."
  },
  {
    "title": "⏰ 의미 있는 대화 시간",
    "description": "250자 이상..."
  },
  {
    "title": "⚠️ 조심해야 할 3가지",
    "description": "400자 이상, 대안 포함..."
  },
  {
    "title": "💡 Tea의 종합 조언",
    "description": "450자 이상, 실천 가능한 3가지 포함..."
  }
]
\`\`\`

**체크리스트:**
- [ ] 모든 인사이트에 실제 대화 인용
- [ ] 일반론 제거, 맞춤형 조언만
- [ ] 구체적 실행 방법 ("이렇게 말해보세요: '...'")
- [ ] 따뜻하되 솔직
- [ ] 최소 글자 수 준수`,
      },
    ],
  });

  const insights = parseJSON(response);

  if (!Array.isArray(insights) || insights.length < 6) {
    throw new Error(`인사이트 생성 실패: ${insights.length}개만 생성됨`);
  }

  console.log(`✓ 인사이트 ${insights.length}개 생성 완료`);
  insights.forEach((insight, i) => {
    console.log(
      `  ${i + 1}. ${insight.title} (${insight.description?.length || 0}자)`,
    );
  });

  return insights;
}

// ========== 메인 함수 ==========

export async function analyzeConversationMultiTurn(
  messages: Message[],
  stats: any,
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = [],
): Promise<any> {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const userName = participants[0] || "사용자";
  const partnerName = participants[1] || "상대방";
  const relationshipContext =
    secondaryRelationships.length > 0
      ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")}`
      : primaryRelationship;

  console.log("\n======== Multi-Turn 분석 시작 ========");
  console.log(`참여자: ${userName} ↔ ${partnerName}`);
  console.log(`관계: ${relationshipContext}`);
  console.log(`메시지: ${messages.length}개`);

  // Step 0: 기본 통계 계산 (코드로)
  const basicStats = processConversationData(messages, {});

  // Step 1: 전체 이해
  const turn1 = await turn1_understanding(
    messages,
    userName,
    partnerName,
    relationshipContext,
  );

  // Step 2: 심층 분석
  const turn2 = await turn2_deepDive(messages, userName, partnerName, turn1);

  // Step 3: 최종 보고서
  const insights = await turn3_report(
    messages,
    userName,
    partnerName,
    basicStats,
    turn1,
    turn2,
  );

  console.log("\n======== 분석 완료 ========\n");

  // 최종 결과 반환
  return {
    sentimentScore: basicStats.tikitakaScore,
    sentimentDistribution: [
      {
        name: "긍정적",
        value: Math.round(basicStats.sentimentRatio.positive * 100),
      },
      {
        name: "중립적",
        value: Math.round(basicStats.sentimentRatio.neutral * 100),
      },
      {
        name: "부정적",
        value: Math.round(basicStats.sentimentRatio.negative * 100),
      },
    ],
    insights: insights.slice(0, 6),
    processedData: basicStats,
    deepAnalysis: {
      turn1: turn1.analysis,
      turn2: turn2.analysis,
    },
  };
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 2000,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === maxRetries - 1;

      if (isLastAttempt) {
        console.error(`최종 실패 (${maxRetries}번 시도):`, error.message);
        throw error;
      }

      const waitTime = retryDelay * (i + 1);
      console.warn(`재시도 ${i + 1}/${maxRetries} (${waitTime}ms 후)...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  throw new Error("Unexpected error in retry logic");
}

// ========== 타임아웃 래퍼 ==========

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = "작업 시간 초과",
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs),
    ),
  ]);
}

// ========== 에러 핸들링이 강화된 메인 함수 ==========

export async function analyzeConversationMultiTurnSafe(
  messages: Message[],
  stats: any,
  primaryRelationship: string = "친구",
  secondaryRelationships: string[] = [],
  userPurpose?: string,
): Promise<any> {
  try {
    // 각 Turn마다 타임아웃과 재시도 적용
    const participants = Array.from(
      new Set(messages.map((m) => m.participant)),
    );
    const userName = participants[0] || "사용자";
    const partnerName = participants[1] || "상대방";
    let relationshipContext =
      secondaryRelationships.length > 0
        ? `${primaryRelationship} (주요) + ${secondaryRelationships.join(", ")}`
        : primaryRelationship;
    
    if (userPurpose) {
      relationshipContext += `\n\n분석 목적: ${userPurpose}`;
    }

    console.log("\n======== Multi-Turn 분석 시작 (Safe Mode) ========");
    console.log(`참여자: ${userName} ↔ ${partnerName}`);
    console.log(`관계: ${relationshipContext}`);
    console.log(`메시지: ${messages.length}개`);

    // Step 0: 기본 통계
    const basicStats = processConversationData(messages, {});

    // Step 1: 전체 이해 (타임아웃 90초, 재시도 3회)
    const turn1 = await callWithRetry(
      () =>
        withTimeout(
          turn1_understanding(
            messages,
            userName,
            partnerName,
            relationshipContext,
          ),
          90000,
          "Turn 1 분석 시간 초과 (90초)",
        ),
      3,
    );

    // Step 2: 심층 분석 (타임아웃 120초, 재시도 3회)
    const turn2 = await callWithRetry(
      () =>
        withTimeout(
          turn2_deepDive(messages, userName, partnerName, turn1),
          120000,
          "Turn 2 분석 시간 초과 (120초)",
        ),
      3,
    );

    // Step 3: 최종 보고서 (타임아웃 90초, 재시도 3회)
    const insights = await callWithRetry(
      () =>
        withTimeout(
          turn3_report(
            messages,
            userName,
            partnerName,
            basicStats,
            turn1,
            turn2,
          ),
          90000,
          "Turn 3 보고서 생성 시간 초과 (90초)",
        ),
      3,
    );

    console.log("\n======== 분석 완료 ========\n");

    return {
      sentimentScore: basicStats.tikitakaScore,
      sentimentDistribution: [
        {
          name: "긍정적",
          value: Math.round(basicStats.sentimentRatio.positive * 100),
        },
        {
          name: "중립적",
          value: Math.round(basicStats.sentimentRatio.neutral * 100),
        },
        {
          name: "부정적",
          value: Math.round(basicStats.sentimentRatio.negative * 100),
        },
      ],
      insights: insights.slice(0, 6),
      processedData: basicStats,
      deepAnalysis: {
        turn1: turn1.analysis,
        turn2: turn2.analysis,
      },
    };
  } catch (error: any) {
    console.error("\n======== Multi-Turn 분석 실패 ========");
    console.error("에러:", error.message);
    console.error("스택:", error.stack);

    // 사용자 친화적 에러 메시지
    throw new Error(
      "대화 분석 중 문제가 발생했습니다. " +
        "잠시 후 다시 시도해주세요. " +
        `(오류 코드: MT-${error.message.substring(0, 10).replace(/\s/g, "-")})`,
    );
  }
}
