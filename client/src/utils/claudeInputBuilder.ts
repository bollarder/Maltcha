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
 * 시스템 프롬프트 생성
 */
function createSystemPrompt(relationshipType: string, analysisPurpose: string): string {
  return `당신은 대화 분석 전문가입니다.

관계 유형: ${relationshipType}
분석 목적: ${analysisPurpose}

아래 제공된 정보를 바탕으로 깊이 있는 관계 분석을 수행하세요:

1. Gemini 요약: 전체 타임라인과 주요 전환점
2. HIGH 메시지 전문: 관계의 핵심 순간들
3. MEDIUM 샘플: 일상적이지만 의미 있는 대화들

분석 시 고려사항:
- 관계의 진화 과정
- 커뮤니케이션 패턴
- 감정의 변화
- 갈등과 해결 과정
- 관계의 건강도

최종 인사이트를 제공해주세요.`;
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
