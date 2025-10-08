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
 * 필터링 프롬프트 생성
 */
export function createFilterPrompt(
  batch: Message[],
  relationshipType: string,
  analysisPurpose: string
): string {
  return `당신은 대화 분석 전문가입니다.
관계 유형: ${relationshipType}
분석 목적: ${analysisPurpose}
아래 ${batch.length}개 메시지에서 중요도를 판단하세요:

HIGH: 관계 전환점, 갈등, 중요 의사결정, 감정 변화
MEDIUM: 의미있는 대화, 계획, 중요 일상
LOW: 단순 인사, 반응 (ㅋㅋ, ㅇㅇ 등 - 개수만 세고 저장 안함)

JSON 형식으로 출력:
{
  "high": [
    {"index": 0, "date": "...", "user": "...", "message": "...", "reason": "관계 갈등 폭발"}
  ],
  "medium": [...],
  "stats": {"total": ${batch.length}, "high": 0, "medium": 0, "low": 0}
}

메시지:
${batch.map(m => `${m.index}. [${m.date}] ${m.user}: ${m.message}`).join('\n')}`;
}

/**
 * 단일 배치 필터링
 */
export async function filterBatch(
  batch: Message[],
  relationshipType: string,
  analysisPurpose: string
): Promise<FilterResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = createFilterPrompt(batch, relationshipType, analysisPurpose);

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

      // FilteredMessage 형식으로 변환 (importance 필드 추가)
      const high: FilteredMessage[] = (parsed.high || []).map((item: any) => ({
        ...item,
        importance: 'HIGH' as const,
      }));

      const medium: FilteredMessage[] = (parsed.medium || []).map((item: any) => ({
        ...item,
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

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    if (onProgress) {
      onProgress(i + 1, batches.length);
    }

    const result = await filterBatch(batch, relationshipType, analysisPurpose);
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
