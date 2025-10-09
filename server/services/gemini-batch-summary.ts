import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FilterResult, FilteredMessage } from './gemini-filter';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

export interface PatternGroup {
  pattern: string;
  count: number;
  key_indices: number[];
  tags: string[];
}

export interface TopEvent {
  index: number;
  type: string;
  brief: string;
}

export interface DominantTags {
  emotion: string[];
  behavior: string[];
  relationship: string[];
}

export interface BatchSummary {
  batch_id: number;
  period: string;
  message_range: string;
  critical_summary: {
    count: number;
    pattern_groups: PatternGroup[];
    top_events: TopEvent[];
    dominant_tags: DominantTags;
  };
  medium_summary: {
    count: number;
    themes: string[];
    representative_indices: number[];
  };
  batch_characteristics: string;
  token_count: number;
}

/**
 * Stage 2 프롬프트: FBI 배치 요약 프로토콜
 */
function createBatchSummaryPrompt(
  batchId: number,
  filterResult: FilterResult,
  messageRange: string,
  period: string
): string {
  const criticalEvidence = filterResult.high.map(m => ({
    index: m.index,
    timestamp: m.date,
    participant: m.user,
    content: `${m.message.substring(0, 50)}...`,
    reason: m.reason,
    importance: m.importance,
  }));

  const mediumEvidence = filterResult.medium.map(m => ({
    index: m.index,
    timestamp: m.date,
    participant: m.user,
    content: `${m.message.substring(0, 30)}...`,
    reason: m.reason,
    importance: m.importance,
  }));

  return `# Stage 1.5: FBI 배치 요약 프로토콜

당신의 역할: FBI 증거 정리 전문가
방대한 증거 더미를 핵심만 압축하여 상급 분석관에게 전달하는 것이 임무입니다.

## 임무 개요
한 배치(약 2,000개 메시지)에서 수집된 증거를 **최대 500 토큰 이내**로 압축 요약하세요.

목표:
- Stage 1에서 필터링된 CRITICAL/MEDIUM 증거의 핵심 패턴 추출
- 불필요한 세부사항 제거, 상위 분석에 필요한 정보만 전달
- 50개 배치 × 500 토큰 = 25,000 토큰으로 전체 요약 생성

---

## 입력 데이터

### 배치 정보
- **Batch ID**: ${batchId}
- **Period**: ${period}
- **Message Range**: ${messageRange}

### CRITICAL 증거 (${filterResult.stats.high}개)
${criticalEvidence.map(e => 
  `[${e.index}] ${e.timestamp} | ${e.participant} | 이유: ${e.reason}`
).join('\n')}

### MEDIUM 증거 (${filterResult.stats.medium}개)
${mediumEvidence.slice(0, 100).map(e => 
  `[${e.index}] ${e.timestamp} | ${e.participant} | 이유: ${e.reason}`
).join('\n')}

---

## 요약 원칙

### 1. CRITICAL 증거 요약 (최대 300 토큰)

**(1) 패턴 그룹화**
- 유사한 태그 조합을 가진 증거들을 묶어 패턴으로 정리
- 예: "갈등-해소" 패턴, "애정 표현 증가", "취약성 드러남"

**(2) 상위 이벤트 선정**
- 가장 중요한 3-5개 이벤트만 선택
- 인덱스, 타입, 간략한 설명 포함
- 선정 기준: 관계 전환점이 될 만한 사건

**(3) 태그 통계**
- 가장 많이 등장한 태그 상위 5개씩 정리
- 감정 태그 (ANGER, JOY, LOVE, FEAR, SADNESS...)
- 행동 태그 (SUPPORT, CONFLICT, AVOIDANCE...)
- 관계 태그 (RED_FLAG, GREEN_FLAG, MILESTONE...)

### 2. MEDIUM 증거 요약 (최대 150 토큰)

**(1) 주요 테마**
- 이 시기 대화의 주된 주제 2-3개만
- 예: "일상 공유", "미래 계획 논의", "취미 관련 대화"

**(2) 대표 인덱스**
- MEDIUM 증거 중 특징적인 것 5개만 인덱스 나열

### 3. 배치 특성 요약 (최대 50 토큰)
- 이 시기의 관계 특징을 2-3문장으로 요약

---

## 🚨 절대 규칙

1. **500 토큰 절대 초과 금지** - 500 토큰을 넘으면 Stage 2에서 토큰 폭발 발생
2. **원문 재현 금지** - 메시지 원문을 그대로 복사하지 마세요
3. **인덱스 정확성** - 언급하는 모든 인덱스는 실제 입력 데이터에 존재해야 함
4. **JSON 형식 준수** - 반드시 유효한 JSON 출력

---

## 출력 형식 (JSON)

\`\`\`json
{
  "batch_id": ${batchId},
  "period": "${period}",
  "message_range": "${messageRange}",
  
  "critical_summary": {
    "count": ${filterResult.stats.high},
    "pattern_groups": [
      {
        "pattern": "갈등 발생 및 해소",
        "count": 5,
        "key_indices": [145, 278, 389],
        "tags": ["CONFLICT", "ANGER", "RESOLUTION", "SUPPORT"]
      }
    ],
    "top_events": [
      {
        "index": 234,
        "type": "MILESTONE",
        "brief": "첫 '사랑해' 표현"
      }
    ],
    "dominant_tags": {
      "emotion": ["JOY", "LOVE", "ANGER", "SADNESS", "FEAR"],
      "behavior": ["SUPPORT", "CONFLICT", "VULNERABILITY"],
      "relationship": ["GREEN_FLAG", "MILESTONE", "RED_FLAG"]
    }
  },
  
  "medium_summary": {
    "count": ${filterResult.stats.medium},
    "themes": [
      "일상적인 안부 교환",
      "미래 계획 및 목표 공유"
    ],
    "representative_indices": [67, 123, 189]
  },
  
  "batch_characteristics": "관계 초기 형성기. 전반적으로 긍정적이고 활발한 교류가 이루어지나, 첫 갈등이 등장하며 관계의 시험대를 경험.",
  
  "token_count": 450
}
\`\`\`

이제 위 입력된 배치 증거를 받아 위 프로토콜에 따라 요약을 생성하세요.
**500 토큰 제한을 절대 지켜주세요.**`;
}

/**
 * 배치별 요약 생성
 */
export async function summarizeBatch(
  batchId: number,
  filterResult: FilterResult,
  messageRange: string,
  period: string
): Promise<BatchSummary> {
  const prompt = createBatchSummaryPrompt(batchId, filterResult, messageRange, period);

  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const summary: BatchSummary = JSON.parse(jsonText);

      console.log(`  ✅ Batch ${batchId} 요약 완료 (토큰: ${summary.token_count || '?'})`);
      
      return summary;
    } catch (error: any) {
      lastError = error;
      console.error(`  Batch ${batchId} 요약 시도 ${attempt} 실패:`, error.message);

      if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.error(`  ❌ Batch ${batchId} 요약 최종 실패:`, lastError?.message);
  
  return {
    batch_id: batchId,
    period,
    message_range: messageRange,
    critical_summary: {
      count: filterResult.stats.high,
      pattern_groups: [],
      top_events: [],
      dominant_tags: {
        emotion: [],
        behavior: [],
        relationship: []
      }
    },
    medium_summary: {
      count: filterResult.stats.medium,
      themes: [],
      representative_indices: []
    },
    batch_characteristics: "요약 생성 실패",
    token_count: 0
  };
}

/**
 * 모든 배치 요약 생성
 */
export async function summarizeAllBatches(
  filterResults: FilterResult[],
  messages: any[]
): Promise<BatchSummary[]> {
  const summaries: BatchSummary[] = [];
  const BATCH_SIZE = 2000;

  console.log(`\n=== Stage 2: FBI 배치 요약 시작 (${filterResults.length}개 배치) ===`);

  for (let i = 0; i < filterResults.length; i++) {
    const batchId = i + 1;
    const startIdx = i * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE - 1, messages.length - 1);
    const messageRange = `${startIdx}-${endIdx}`;

    const batchMessages = messages.slice(startIdx, endIdx + 1);
    const firstDate = batchMessages[0]?.timestamp || '';
    const lastDate = batchMessages[batchMessages.length - 1]?.timestamp || '';
    const period = `${firstDate.split(' ')[0]} ~ ${lastDate.split(' ')[0]}`;

    console.log(`  배치 ${batchId}/${filterResults.length}: 메시지 ${messageRange}`);

    const summary = await summarizeBatch(
      batchId,
      filterResults[i],
      messageRange,
      period
    );

    summaries.push(summary);

    if (i < filterResults.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const totalTokens = summaries.reduce((sum, s) => sum + s.token_count, 0);
  console.log(`\n✅ Stage 2 완료: ${summaries.length}개 배치 요약 (총 ${totalTokens} 토큰)\n`);

  return summaries;
}
