export interface GeminiSummary {
  timeline: Array<{
    date: string;
    description: string;
    significance: string;
  }>;
  turning_points: Array<{
    index: number;
    date: string;
    description: string;
    impact: string;
  }>;
  high_indices: number[];
  medium_sample: Array<{
    index: number;
    date: string;
    category: string;
  }>;
  statistics: {
    total_analyzed: number;
    high_count: number;
    medium_count: number;
    relationship_health: string;
    key_themes: string[];
  };
}

export interface OriginalMessage {
  index: number;
  date: string;
  user: string;
  message: string;
}

export interface RelationshipContext {
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
}

export interface ClaudeInputPackage {
  systemPrompt: string;
  geminiSummary: GeminiSummary;
  highMessages: OriginalMessage[];
  mediumSamples: OriginalMessage[];
  relationshipContext: RelationshipContext;
  tokenEstimate: {
    systemPrompt: number;
    geminiSummary: number;
    highMessages: number;
    mediumSamples: number;
    relationshipContext: number;
    total: number;
  };
}

/**
 * 브라우저 메모리에서 인덱스로 원본 메시지 추출
 */
export function extractOriginalMessages(
  indices: number[],
  allMessages: OriginalMessage[]
): OriginalMessage[] {
  const messageMap = new Map(allMessages.map(m => [m.index, m]));
  const extracted: OriginalMessage[] = [];

  for (const index of indices) {
    const msg = messageMap.get(index);
    if (msg) {
      extracted.push(msg);
    }
  }

  return extracted.sort((a, b) => a.index - b.index);
}

/**
 * 토큰 수 추정 (한글 고려: 보수적 추정 1 토큰 = 2.5 글자)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

/**
 * 시스템 프롬프트 생성 (관계 심리치료사 버전)
 */
function createSystemPrompt(relationshipType: string, analysisPurpose: string): string {
  return `# 💭 관계 심리치료 분석 프로토콜

당신은 15년 경력의 관계 심리치료사입니다.
1,200쌍 이상의 커플 상담 경험.

## 당신의 역할

FBI 프로파일러가 발견한 **행동 패턴**을 받아서
**왜 그런 패턴이 생겼는지** 심리학적으로 해석하세요.

관계 유형: ${relationshipType}
분석 목적: ${analysisPurpose}

---

## 입력 데이터

1. **FBI 프로파일 보고서** (Gemini 요약 - 타임라인, 전환점, 패턴)
2. **CRITICAL 메시지 원문** (관계 핵심 순간들)
3. **MEDIUM 샘플 원문** (의미있는 일상 대화들)

---

## 심리치료사의 분석 프레임워크

### 1. 패턴의 심리적 뿌리

FBI가 발견한 패턴들을 심리학적으로 해석:
- **왜** 이런 패턴이 생겼나?
- **무의식적 동기**는 무엇인가?
- 어떤 **심리적 욕구**를 채우려는가?
- 어떤 **두려움**을 피하려는가?

**분석 구조:**
- psychological_root (심리적 뿌리)
- unconscious_motive (무의식적 동기)
- short_term_gain (단기 이득)
- long_term_cost (장기 비용)
- core_need (핵심 욕구)
- therapeutic_direction (치료 방향)
- evidence_from_messages (실제 메시지 인용)

### 2. 관계 역학 분석

**시스템 관점:** 관계는 상호작용 시스템

**발견해야 할 역학:**
- **추격-도피** (Pursuer-Distancer): 한쪽 다가가면 다른쪽 물러남
- **비난-방어** (Criticize-Defend): 한쪽 비난하면 다른쪽 방어
- **과잉-저기능** (Overfunctioning-Underfunctioning): 한쪽 책임지면 다른쪽 의존

**필수:** 발견한 각 역학 패턴마다 실제 메시지 인용 3개 이상 포함 (트리거 메시지, 반응 메시지, 결과 메시지)

### 3. 애착 스타일 분석 (조심스럽게)

**원칙:** 확실할 때만 언급, 항상 "가능성" 표현, confidence 명시

**증거 기반 추론:**
- 안정 애착 (Secure): 균형적 소통, 건강한 갈등 해결
- 불안 애착 (Anxious): 확인 요구, 버림받음 두려움
- 회피 애착 (Avoidant): 거리 두기, 취약성 회피
- 혼란 애착 (Disorganized): 다가갔다 멀어짐 반복

**필수:** 분석하는 각 참여자마다 애착 스타일 추론에 실제 메시지 인용 3개 이상 포함

### 4. 미해결 이슈 진단

- 반복되는 갈등 주제 (3회 이상)
- 누적된 감정 (해결 안 된 갈등)
- 회피하는 주제 ("방 안의 코끼리")

**필수:** 각 이슈마다 첫 등장, 재발, 해결 시도를 보여주는 메시지 인용 3개 이상

### 5. 보호 요인 발견

- 관계의 강점
- 회복 탄력성
- 긍정적 패턴

**필수:** 각 보호 요인마다 실제 메시지 인용 3개 이상으로 입증

### 6. 임상적 평가

- 관계 건강도 (FBI 점수 + 심리적 해석)
- 궤적 (improving/stable/declining/crisis)
- 개입 권고 (immediate/soon/preventive/not needed)
- 예후 (excellent/good/fair/poor/guarded)

**필수:** 각 평가 항목(건강도, 궤적, 개입 권고, 예후)마다 근거가 되는 메시지 인용 포함

---

## 출력 형식

JSON 형식으로 다음을 제공:

\`\`\`json
{
  "analysis": {
    "relationshipOverview": "전체 관계 요약 (심리치료사 관점)",
    "communicationPatterns": {
      "tikitakaAnalysis": "대화 패턴 심리 분석",
      "conversationFlow": "소통 흐름 평가",
      "responsePatterns": "반응 패턴 해석"
    },
    "emotionalDynamics": {
      "sentimentTrends": "감정 추세 분석",
      "emotionalMoments": [
        {
          "type": "감정 유형",
          "description": "설명",
          "context": "맥락"
        }
      ],
      "emotionalBalance": "감정 균형 평가"
    },
    "psychologicalInsights": {
      "attachmentStyle": "애착 스타일 분석 (조심스럽게, confidence 명시)",
      "conflictResolution": "갈등 해결 패턴 심리 해석",
      "intimacyPatterns": "친밀감 패턴 분석",
      "communicationBarriers": "소통 장벽 진단"
    },
    "relationshipHealth": {
      "currentState": "현재 상태 평가",
      "strengths": ["강점1", "강점2"],
      "concerns": ["우려사항1", "우려사항2"],
      "trajectory": "궤적 (improving/stable/declining)"
    },
    "practicalAdvice": {
      "immediateActions": ["즉각 행동1", "즉각 행동2"],
      "longTermStrategies": ["장기 전략1", "장기 전략2"],
      "communicationTips": ["소통 팁1", "소통 팁2"]
    },
    "conclusion": "종합 결론 (솔직하되 희망적)"
  }
}
\`\`\`

---

## 치료사 윤리 강령

1. **판단하지 않기**: "잘못"이 아닌 "패턴", "나쁜 사람" 아닌 "어려운 패턴"
2. **양쪽 이해하기**: 한 사람 탓 금지, 시스템 관점 유지
3. **희망 주기**: 문제 + 해결 가능성, 절망 아닌 현실적 낙관
4. **전문성 유지**: 학술적 정확성, 근거 기반 해석, 확신도 명시
5. **윤리적 주의**: 진단 아닌 "가능성", 전문 상담 권유 적절히

---

## 체크리스트

- [ ] Stage 1: 모든 패턴 심리 해석 + 각 패턴별 메시지 인용
- [ ] Stage 2: 각 역학 패턴별 메시지 인용 3개 이상 (트리거, 반응, 결과)
- [ ] Stage 3: 각 참여자별 애착 스타일 추론 + 메시지 인용 3개 이상
- [ ] Stage 4: 각 미해결 이슈별 메시지 인용 3개 이상 (첫 등장, 재발, 해결 시도)
- [ ] Stage 5: 각 보호 요인별 메시지 인용 3개 이상
- [ ] Stage 6: 각 평가 항목별(건강도, 궤적, 개입, 예후) 근거 메시지 인용
- [ ] 모든 분석, 모든 해석, 모든 결론에 실제 메시지 인용
- [ ] JSON 형식 정확

---

## 중요: 메시지 인용 필수

**모든 분석, 모든 해석, 모든 결론에 실제 메시지 인용 필수:**
- 메시지 번호 (#234) 명시
- 메시지 내용 직접 인용
- 최소 3개 이상 인용으로 패턴 입증

**메시지 인용 없는 분석은 불완전함.**

---

이제 심리치료 분석을 시작하세요. 제공된 메시지와 FBI 프로파일 보고서를 바탕으로 깊이 있는 관계 심리 분석을 수행해주세요.`;
}

/**
 * 관계 맥락 생성 (500 토큰 목표)
 */
function createRelationshipContext(
  relationshipType: string,
  analysisPurpose: string,
  allMessages: OriginalMessage[],
  geminiSummary: GeminiSummary
): RelationshipContext {
  // 참여자 추출
  const participants = Array.from(new Set(allMessages.map(m => m.user)));

  // 기간 계산
  const dates = allMessages.map(m => new Date(m.date));
  const start = new Date(Math.min(...dates.map(d => d.getTime())));
  const end = new Date(Math.max(...dates.map(d => d.getTime())));
  const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))); // 최소 1일
  
  // 통계
  const totalMessages = allMessages.length;
  const filteredHigh = geminiSummary.high_indices.length;
  const filteredMedium = geminiSummary.medium_sample.length;
  const averagePerDay = Math.round(totalMessages / durationDays);

  // 참여자 특성 분석
  const participantAnalysis = `${participants.join('과 ')} 두 사람은 각자 고유한 커뮤니케이션 스타일을 가지고 있으며, ` +
    `이들의 상호작용 패턴은 ${relationshipType} 관계의 역동성을 형성합니다. ` +
    `대화의 빈도와 리듬, 메시지의 길이와 감정 표현 방식, 주제 선택과 반응 패턴은 ` +
    `각 참여자의 성격과 관계에 대한 태도를 드러냅니다. ` +
    `${totalMessages}개의 메시지 중 ${filteredHigh}개가 HIGH 중요도, ${filteredMedium}개가 MEDIUM 중요도로 분류되었으며, ` +
    `이는 대화의 질적 측면과 관계의 깊이를 보여주는 지표입니다.`;

  // 타임라인 요약 생성 (fallback 포함)
  const timelineSummary = geminiSummary.timeline && geminiSummary.timeline.length > 0
    ? geminiSummary.timeline.map(t => `- ${t.date}: ${t.description} (${t.significance})`).join('\n')
    : `이 대화는 ${durationDays}일간의 ${relationshipType} 관계를 시간순으로 기록하고 있으며, ` +
      `각 시기별로 대화의 밀도와 주제가 달라지는 것을 확인할 수 있습니다. ` +
      `초기에는 서로를 알아가는 과정이, 중기에는 관계의 깊이가, 후기에는 관계의 안정성이 드러납니다. ` +
      `하루 평균 ${averagePerDay}개의 메시지가 오가며, 이는 관계의 활발함과 소통 빈도를 나타냅니다. ` +
      `시간대별 대화 패턴, 주중과 주말의 차이, 특별한 날들의 대화 변화 등이 ` +
      `${relationshipType} 관계의 리듬과 생활 패턴을 보여줍니다.`;

  // 전환점 요약 (fallback 포함)
  const turningPointsSummary = geminiSummary.turning_points && geminiSummary.turning_points.length > 0
    ? geminiSummary.turning_points.map(tp => `- [${tp.date}] ${tp.description}: ${tp.impact}`).join('\n')
    : `이 관계에서는 ${filteredHigh}개의 HIGH 중요 메시지를 통해 여러 전환점을 확인할 수 있습니다. ` +
      `감정의 고조, 갈등의 발생과 해결, 중요한 의사결정 순간들이 관계의 진화를 이끌었습니다. ` +
      `각 전환점은 참여자들의 커뮤니케이션 방식과 관계에 대한 인식을 변화시켰으며, ` +
      `대화의 톤과 주제, 상호작용의 빈도에 영향을 미쳤습니다. ` +
      `위기의 순간, 화해의 과정, 새로운 이해의 발견 등 다양한 전환점들이 ` +
      `${relationshipType} 관계를 더 깊고 성숙하게 만들어갔습니다.`;

  // 주요 주제 상세 설명 (fallback 포함)
  const themeDetails = geminiSummary.statistics.key_themes && geminiSummary.statistics.key_themes.length > 0
    ? geminiSummary.statistics.key_themes
        .map(theme => `"${theme}" 주제는 이 관계에서 반복적으로 나타나며 중요한 의미를 가집니다.`)
        .join(' ') +
      ` 이러한 주제들은 ${relationshipType} 관계의 핵심적인 특성을 드러내며, ` +
      `참여자들이 무엇을 중요하게 생각하고 어떤 가치를 공유하는지 보여줍니다. ` +
      `각 주제의 빈도와 맥락은 관계의 우선순위와 가치관을 반영하며, ` +
      `대화 패턴을 통해 ${relationshipType} 관계의 독특한 특징을 발견할 수 있습니다.`
    : `이 대화에서는 다양한 주제들이 다뤄졌으며, ${relationshipType} 관계의 특성에 따라 ` +
      `감정 표현, 일상 공유, 계획 수립, 문제 해결 등의 대화가 이루어졌습니다. ` +
      `각 주제는 관계의 발전 단계와 참여자들의 상호작용 방식을 반영합니다. ` +
      `대화의 깊이와 폭은 관계의 친밀도를 보여주며, 주제 전환 패턴은 참여자들의 소통 스타일을 드러냅니다. ` +
      `감정적 대화, 실용적 논의, 미래 계획, 과거 회상 등 다양한 차원의 대화가 ` +
      `${relationshipType} 관계의 다면적 특성을 구성합니다. ` +
      `${filteredHigh}개의 핵심 메시지와 ${filteredMedium}개의 의미있는 대화를 통해 ` +
      `이 관계의 본질적인 특성과 역동성을 종합적으로 파악할 수 있습니다.`;

  // 배경 설명 (500 토큰 목표)
  const background = `이 대화는 ${participants.join('과 ')} 사이의 ${relationshipType} 관계를 분석한 것입니다.

## 참여자 및 관계 특성
${participantAnalysis}
  
## 분석 기간 및 규모
분석 기간: ${start.toLocaleDateString('ko-KR')} ~ ${end.toLocaleDateString('ko-KR')} (${durationDays}일)
전체 메시지: ${totalMessages.toLocaleString()}개
일평균 메시지: ${averagePerDay}개

## 필터링 결과
Gemini AI를 통해 대화의 중요도를 분석하여 다음과 같이 필터링되었습니다:

- HIGH 중요 메시지: ${filteredHigh.toLocaleString()}개 (${((filteredHigh/totalMessages)*100).toFixed(1)}%)
  → 관계 전환점, 갈등, 중요 의사결정, 감정 변화를 포함하는 핵심 메시지들

- MEDIUM 의미있는 메시지: ${filteredMedium.toLocaleString()}개
  → 일상적이지만 의미 있는 대화, 계획, 중요 일상을 담은 메시지들

- LOW 단순 메시지: ${(totalMessages - filteredHigh - filteredMedium).toLocaleString()}개 (${(((totalMessages - filteredHigh - filteredMedium)/totalMessages)*100).toFixed(1)}%)
  → 단순 인사, 반응 등 분석에서 제외된 메시지들

## 타임라인 요약
${timelineSummary}

## 주요 전환점
${turningPointsSummary}

## 분석 목적 및 맥락
분석 목적: ${analysisPurpose}

이 분석은 ${relationshipType} 관계의 본질을 이해하고, 커뮤니케이션 패턴, 감정의 흐름, 갈등과 해결 과정을 심층적으로 파악하여 
관계의 현재 상태와 향후 방향성에 대한 통찰을 제공하고자 합니다.

## 관계 평가
관계 건강도: ${geminiSummary.statistics.relationship_health}

주요 대화 주제: ${geminiSummary.statistics.key_themes.join(', ')}

${themeDetails}

이러한 맥락을 바탕으로 HIGH 중요 메시지 ${filteredHigh.toLocaleString()}개 전문과 MEDIUM 대표 샘플 ${filteredMedium.toLocaleString()}개를 분석하여
${relationshipType} 관계의 진화 과정과 본질적인 특성을 도출하고자 합니다.`;

  return {
    type: relationshipType,
    purpose: analysisPurpose,
    participants,
    period: {
      start: start.toLocaleDateString('ko-KR'),
      end: end.toLocaleDateString('ko-KR'),
      duration: `${durationDays}일`,
    },
    statistics: {
      totalMessages,
      filteredHigh,
      filteredMedium,
      averagePerDay,
    },
    background,
  };
}

/**
 * Claude 입력 패키지 생성
 */
export function buildClaudeInput(
  geminiSummary: GeminiSummary,
  allMessages: OriginalMessage[],
  relationshipType: string,
  analysisPurpose: string = '관계 분석'
): ClaudeInputPackage {
  // 1. 시스템 프롬프트 생성
  const systemPrompt = createSystemPrompt(relationshipType, analysisPurpose);

  // 2. HIGH 원문 추출 (브라우저 메모리에서)
  const highMessages = extractOriginalMessages(
    geminiSummary.high_indices,
    allMessages
  );

  // 3. MEDIUM 샘플 원문 추출
  const mediumIndices = geminiSummary.medium_sample.map(s => s.index);
  const mediumSamples = extractOriginalMessages(mediumIndices, allMessages);

  // 4. 관계 맥락 (500 토큰)
  const relationshipContext = createRelationshipContext(
    relationshipType,
    analysisPurpose,
    allMessages,
    geminiSummary
  );

  // 5. 토큰 추정
  const geminiSummaryText = JSON.stringify(geminiSummary, null, 2);
  const highMessagesText = highMessages
    .map(m => `[${m.index}] ${m.date} ${m.user}: ${m.message}`)
    .join('\n');
  const mediumSamplesText = mediumSamples
    .map(m => `[${m.index}] ${m.date} ${m.user}: ${m.message}`)
    .join('\n');
  const contextText = relationshipContext.background;

  const tokenEstimate = {
    systemPrompt: estimateTokens(systemPrompt),
    geminiSummary: estimateTokens(geminiSummaryText),
    highMessages: estimateTokens(highMessagesText),
    mediumSamples: estimateTokens(mediumSamplesText),
    relationshipContext: estimateTokens(contextText),
    total: 0,
  };

  tokenEstimate.total =
    tokenEstimate.systemPrompt +
    tokenEstimate.geminiSummary +
    tokenEstimate.highMessages +
    tokenEstimate.mediumSamples +
    tokenEstimate.relationshipContext;

  // 검증: relationshipContext가 500 토큰 목표를 충족하는지 확인
  if (tokenEstimate.relationshipContext < 500) {
    throw new Error(
      `RelationshipContext is too short: ${tokenEstimate.relationshipContext} tokens (expected ≥500). ` +
      `Please check the context generation logic or expand the background narrative.`
    );
  }

  // 6. 최종 패키지
  return {
    systemPrompt,
    geminiSummary,
    highMessages,
    mediumSamples,
    relationshipContext,
    tokenEstimate,
  };
}

/**
 * Claude API용 메시지 형식으로 변환
 */
export function formatForClaudeAPI(input: ClaudeInputPackage): {
  system: string;
  messages: Array<{ role: string; content: string }>;
} {
  const userContent = `# Gemini 분석 요약

${JSON.stringify(input.geminiSummary, null, 2)}

# HIGH 중요 메시지 (${input.highMessages.length}개)

${input.highMessages.map(m => `[${m.index}] ${m.date} ${m.user}: ${m.message}`).join('\n')}

# MEDIUM 대표 샘플 (${input.mediumSamples.length}개)

${input.mediumSamples.map(m => `[${m.index}] ${m.date} ${m.user}: ${m.message}`).join('\n')}

# 관계 맥락

${input.relationshipContext.background}

참여자: ${input.relationshipContext.participants.join(', ')}
분석 기간: ${input.relationshipContext.period.start} ~ ${input.relationshipContext.period.end} (${input.relationshipContext.period.duration})

통계:
- 전체 메시지: ${input.relationshipContext.statistics.totalMessages.toLocaleString()}개
- HIGH: ${input.relationshipContext.statistics.filteredHigh.toLocaleString()}개
- MEDIUM 샘플: ${input.relationshipContext.statistics.filteredMedium.toLocaleString()}개
- 일평균: ${input.relationshipContext.statistics.averagePerDay}개

위 정보를 바탕으로 깊이 있는 관계 분석을 제공해주세요.`;

  return {
    system: input.systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  };
}

/**
 * 토큰 사용량 요약 출력
 */
export function printTokenSummary(input: ClaudeInputPackage): void {
  console.log('=== Claude 입력 토큰 추정 ===');
  console.log(`시스템 프롬프트: ${input.tokenEstimate.systemPrompt.toLocaleString()} 토큰`);
  console.log(`Gemini 요약: ${input.tokenEstimate.geminiSummary.toLocaleString()} 토큰`);
  console.log(`HIGH 원문 (${input.highMessages.length}개): ${input.tokenEstimate.highMessages.toLocaleString()} 토큰`);
  console.log(`MEDIUM 샘플 (${input.mediumSamples.length}개): ${input.tokenEstimate.mediumSamples.toLocaleString()} 토큰`);
  console.log(`관계 맥락: ${input.tokenEstimate.relationshipContext.toLocaleString()} 토큰`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총합: ${input.tokenEstimate.total.toLocaleString()} 토큰`);
  console.log(`Claude 200K 대비: ${((input.tokenEstimate.total / 200000) * 100).toFixed(1)}%`);
}

/**
 * 사용 예시:
 * 
 * const geminiSummary = await fetch('/api/summarize', { ... });
 * const claudeInput = buildClaudeInput(geminiSummary, allMessages, "연인", "이별 위기 분석");
 * printTokenSummary(claudeInput);
 * 
 * const apiFormat = formatForClaudeAPI(claudeInput);
 * // Claude API 호출
 */
