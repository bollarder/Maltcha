import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Message {
  date: string;
  user: string;
  message: string;
  index: number;
}

export interface FilteredMessage extends Message {
  importance: 'HIGH' | 'MEDIUM';
  reason: string;
}

export interface FilterResult {
  high: FilteredMessage[];
  medium: FilteredMessage[];
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * 필터링 프롬프트 생성 (FBI 증거 수집관 버전)
 */
export function createFilterPrompt(
  batch: Message[],
  relationshipType: string,
  analysisPurpose: string,
  batchNumber: number = 1,
  totalBatches: number = 1
): string {
  const startIndex = batch.length > 0 ? batch[0].index : 0;
  const endIndex = batch.length > 0 ? batch[batch.length - 1].index : 0;
  
  return `# 🔍 FBI 증거 수집 프로토콜

당신은 FBI 범죄 현장 조사관(CSI)입니다.
경력 12년, 5,000건 이상의 현장 증거 수집 경험.

## 임무

대화 = 범죄 현장
메시지 = 증거
목표: 관계 분석에 필요한 증거를 등급별로 분류

---

## 배치 정보

- 배치: ${batchNumber}/${totalBatches}
- 범위: #${startIndex} ~ #${endIndex}
- 개수: ${batch.length}개
- 관계: ${relationshipType}
- 목적: ${analysisPurpose}

---

## 증거 분류 기준

### 🔴 CRITICAL (결정적 증거)

"이것 없이는 관계 분석 불가"

**1. 관계 전환점**
- 호칭 변화 ("너" ↔ "OOO씨")
- 관계 정의 ("우리 사귀는 거야?")
- 고백/거절 ("사랑해", "미안해")

**2. 갈등/해소**
- 갈등 발생 ("진짜 화났어")
- 갈등 고조 ("너무해")
- 화해 시도 ("미안해")

**3. 감정 폭발**
- 분노 ("열받아")
- 슬픔 ("너무 속상해")
- 기쁨 ("너무 행복해!")

**4. 취약성 노출**
- 비밀 공유 ("아무한테도 안 말했는데")
- 고민 ("사실 나 요즘...")
- 도움 요청 ("도와줄 수 있어?")

**5. 경계선**
- 경계 설정 ("이건 좀 아닌 것 같아")
- 거절 ("미안, 그건 못해")
- 압박 ("왜 안 해줘?")

---

### 🟡 MEDIUM (관련 증거)

"맥락과 패턴 이해에 필요"

**1. 의미있는 일상**
- 하루 공유 ("오늘 이런 일 있었어")
- 감정 공유 ("기분 좋아")

**2. 미래 계획**
- 약속 ("다음 주에 볼까?")
- 여행 ("여름에 어디 갈까?")

**3. 관심사**
- 취향 ("나 이거 좋아해")
- 의견 ("너는 어떻게 생각해?")

**4. 배려/지지**
- 챙기기 ("밥 먹었어?")
- 응원 ("할 수 있어!")
- 감사 ("고마워")

**5. 농담/장난**
- 티키타카
- 놀리기
- 밈 교환

---

### ⚪ LOW (배경 소음)

"개수만 카운트, 저장 안 함"

**1. 형식적 인사**
- "좋은 아침", "안녕", "잘자"

**2. 단순 반응**
- "ㅋㅋ", "ㅎㅎ", "ㅇㅇ"
- 이모티콘/스티커만

**3. 중복 루틴**
- 매일 같은 인사
- "뭐해?", "먹었어?"

---

## 출력 형식

\`\`\`json
{
  "critical": [
    {
      "index": 145,
      "date": "2024-03-15 14:30",
      "user": "userA",
      "message": "전체 메시지 원문",
      "reason": "갈등 표출 - 감정 폭발, 관계 직접 영향"
    }
  ],
  "medium": [
    {
      "index": 67,
      "date": "2024-03-10 09:15",
      "user": "userB",
      "message": "전체 메시지 원문",
      "reason": "미래 계획 - 함께하는 시간"
    }
  ],
  "stats": {
    "total": ${batch.length},
    "high": 0,
    "medium": 0,
    "low": 0
  }
}
\`\`\`

---

## FBI 원칙

**1. 증거를 놓치지 마라**
- 애매하면 MEDIUM으로
- 중요할 것 같으면 올려서 분류
- "덜 중요한 것 포함" > "중요한 것 놓침"

**2. 오염된 증거는 쓸모없다**
- 명확한 기준으로만
- 이유는 구체적으로 (30자+)

**3. 증거 연쇄 보관**
- 인덱스 정확히
- 타임스탬프 정확히
- 원문 전체 포함

**4. 맥락이 핵심**
- 전후 메시지 고려
- 대화 흐름 속에서 판단

---

## 특별 지시

1. **원문 보존**: 전체 메시지 포함, 이모티콘·특수문자 포함
2. **한국어 특성**: "ㅋㅋ"는 진짜 웃음 vs 어색함 구분, "..."는 말줄임 vs 불편함, 반말/존댓말은 관계 변화 신호

---

메시지:
${batch.map(m => `${m.index}. [${m.date}] ${m.user}: ${m.message}`).join('\n')}

이제 배치 #${batchNumber} 메시지를 분류하세요. 정확한 JSON으로 출력하세요.`;
}

/**
 * 단일 배치 필터링
 */
export async function filterBatch(
  batch: Message[],
  relationshipType: string,
  analysisPurpose: string,
  batchNumber: number = 1,
  totalBatches: number = 1
): Promise<FilterResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = createFilterPrompt(batch, relationshipType, analysisPurpose, batchNumber, totalBatches);

  let lastError: Error | null = null;
  
  // 3회 재시도
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSON 추출 (```json ``` 제거)
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // FilteredMessage 형식으로 변환 (critical → high 매핑)
      const criticalArray = parsed.critical || parsed.high || [];
      const mediumArray = parsed.medium || [];
      
      const high: FilteredMessage[] = criticalArray.map((item: any) => ({
        index: item.index,
        date: item.date,
        user: item.user,
        message: item.message,
        reason: item.reason || item.classification_reason || '',
        importance: 'HIGH' as const,
      }));

      const medium: FilteredMessage[] = mediumArray.map((item: any) => ({
        index: item.index,
        date: item.date,
        user: item.user,
        message: item.message,
        reason: item.reason || item.classification_reason || '',
        importance: 'MEDIUM' as const,
      }));

      // stats가 없거나 부정확하면 배열 길이로 재계산
      const highCount = high.length;
      const mediumCount = medium.length;
      const lowCount = batch.length - highCount - mediumCount;

      return {
        high,
        medium,
        stats: {
          total: batch.length,
          high: highCount,
          medium: mediumCount,
          low: lowCount,
        },
      };
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error.message);

      // Rate Limit 에러면 5초 대기
      if (error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('429')) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        // 일반 에러면 1초 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // 모든 재시도 실패
  console.error('All retry attempts failed:', lastError);
  return {
    high: [],
    medium: [],
    stats: {
      total: batch.length,
      high: 0,
      medium: 0,
      low: batch.length,
    },
  };
}

/**
 * 모든 배치 순차 처리
 */
export async function processBatches(
  batches: Message[][],
  relationshipType: string,
  analysisPurpose: string,
  onProgress?: (current: number, total: number) => void
): Promise<FilterResult[]> {
  const results: FilterResult[] = [];
  const totalBatches = batches.length;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNumber = i + 1;
    
    if (onProgress) {
      onProgress(batchNumber, totalBatches);
    }

    const result = await filterBatch(batch, relationshipType, analysisPurpose, batchNumber, totalBatches);
    results.push(result);

    // Rate Limit 방지를 위한 대기 (마지막 배치 제외)
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * 모든 배치 결과 병합
 */
export function mergeFilterResults(results: FilterResult[]): FilterResult {
  const merged: FilterResult = {
    high: [],
    medium: [],
    stats: {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  // 중복 제거를 위한 Set
  const highIndexes = new Set<number>();
  const mediumIndexes = new Set<number>();

  for (const result of results) {
    // HIGH 메시지 병합 (중복 제거)
    for (const msg of result.high) {
      if (!highIndexes.has(msg.index)) {
        highIndexes.add(msg.index);
        merged.high.push(msg);
      }
    }

    // MEDIUM 메시지 병합 (중복 제거)
    for (const msg of result.medium) {
      if (!mediumIndexes.has(msg.index)) {
        mediumIndexes.add(msg.index);
        merged.medium.push(msg);
      }
    }

    // total 합산
    merged.stats.total += result.stats.total;
  }

  // 중복 제거된 배열 길이로 통계 재계산
  merged.stats.high = merged.high.length;
  merged.stats.medium = merged.medium.length;
  merged.stats.low = merged.stats.total - merged.stats.high - merged.stats.medium;

  return merged;
}
