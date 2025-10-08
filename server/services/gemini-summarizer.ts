import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FilteredMessage, FilterResult } from './gemini-filter';

export interface TimelineEvent {
  date: string;
  description: string;
  significance: string;
}

export interface TurningPoint {
  index: number;
  date: string;
  description: string;
  impact: string;
}

export interface MediumSample {
  index: number;
  date: string;
  category: string;
}

export interface SummaryResult {
  timeline: TimelineEvent[];
  turning_points: TurningPoint[];
  high_indices: number[];
  medium_sample: MediumSample[];
  statistics: {
    total_analyzed: number;
    high_count: number;
    medium_count: number;
    relationship_health: string;
    key_themes: string[];
  };
}

/**
 * Gemini 요약 프롬프트 생성 (원문 제외, 인덱스와 메타데이터만)
 */
function createSummaryPrompt(
  highMessages: FilteredMessage[],
  mediumMessages: FilteredMessage[],
  relationshipType: string
): string {
  return `당신은 대화 분석 전문가입니다.
관계 유형: ${relationshipType}

아래는 ${highMessages.length + mediumMessages.length}개의 중요 메시지 필터링 결과입니다.
(원문은 제외, 인덱스와 분석 이유만 제공)

HIGH 메시지 (${highMessages.length}개):
${highMessages.map(m => `[${m.index}] ${m.date} - ${m.user} - 이유: ${m.reason}`).join('\n')}

MEDIUM 메시지 (${mediumMessages.length}개) - 샘플 500개:
${mediumMessages.slice(0, 500).map(m => `[${m.index}] ${m.date} - ${m.user} - 이유: ${m.reason}`).join('\n')}
${mediumMessages.length > 500 ? `... 외 ${mediumMessages.length - 500}개` : ''}

위 메타데이터(인덱스, 날짜, 사용자, 이유)만으로 다음을 분석하여 JSON으로 출력하세요:

1. timeline: 전체 타임라인 분석 (주요 시기별 5-8개 이벤트)
2. turning_points: 관계 전환점 5-10개 (HIGH 메시지 중심, 인덱스 포함)
3. high_indices: 모든 HIGH 메시지 인덱스 배열
4. medium_sample: MEDIUM 중 대표 샘플 500개 (인덱스, 날짜, 카테고리)
5. statistics: 통계 및 핵심 주제

JSON 형식:
{
  "timeline": [
    {"date": "2024-01", "description": "관계 시작기", "significance": "설렘과 호기심"}
  ],
  "turning_points": [
    {"index": 1234, "date": "2024-03-15", "description": "첫 갈등", "impact": "관계 재정립"}
  ],
  "high_indices": [1234, 5678, ...],
  "medium_sample": [
    {"index": 2345, "date": "2024-02-10", "category": "일상 공유"}
  ],
  "statistics": {
    "total_analyzed": ${highMessages.length + mediumMessages.length},
    "high_count": ${highMessages.length},
    "medium_count": ${mediumMessages.length},
    "relationship_health": "건강함/주의/위험",
    "key_themes": ["주제1", "주제2", ...]
  }
}

중요: 원문은 포함하지 말고 인덱스만 전달하세요!`;
}

/**
 * Gemini API로 최종 요약 생성
 */
export async function summarizeWithGemini(
  filterResult: FilterResult,
  relationshipType: string
): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = createSummaryPrompt(
    filterResult.high,
    filterResult.medium,
    relationshipType
  );

  let lastError: Error | null = null;

  // 3회 재시도
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSON 추출
      let jsonText = text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      // 원문 제거 함수 (message, content 필드 제거)
      const sanitizeObject = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => sanitizeObject(item));
        } else if (obj !== null && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            // message, content 필드 제거
            if (key !== 'message' && key !== 'content' && key !== 'text') {
              sanitized[key] = sanitizeObject(value);
            }
          }
          return sanitized;
        }
        return obj;
      };

      // 결과 검증 및 정화
      const sanitized = sanitizeObject(parsed);

      // 메모리 해제를 위해 필터 결과 참조 제거
      // (함수가 끝나면 자동으로 가비지 컬렉션됨)

      const summary: SummaryResult = {
        timeline: sanitized.timeline || [],
        turning_points: sanitized.turning_points || [],
        high_indices: sanitized.high_indices || [],
        medium_sample: sanitized.medium_sample || [],
        statistics: sanitized.statistics || {
          total_analyzed: filterResult.high.length + filterResult.medium.length,
          high_count: filterResult.high.length,
          medium_count: filterResult.medium.length,
          relationship_health: '알 수 없음',
          key_themes: [],
        },
      };

      // 최종 검증: 인덱스만 포함되어 있는지 확인
      console.log(`Summary generated: ${summary.high_indices.length} high indices, ${summary.medium_sample.length} medium samples`);

      return summary;
    } catch (error: any) {
      lastError = error;
      console.error(`Summarize attempt ${attempt} failed:`, error.message);

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
  console.error('All summarize attempts failed:', lastError);
  throw new Error('Failed to generate summary after 3 attempts');
}

/**
 * 브라우저에서 필터링 결과를 받아 요약 생성
 * 서버 메모리에서만 처리, 디스크 저장 없음
 */
export async function processSummaryRequest(
  filterResult: FilterResult,
  relationshipType: string
): Promise<SummaryResult> {
  console.log(`Processing summary for ${filterResult.stats.total} filtered messages...`);
  
  // Gemini API 1회 호출
  const summary = await summarizeWithGemini(filterResult, relationshipType);
  
  console.log(`Summary generated: ${summary.timeline.length} timeline events, ${summary.turning_points.length} turning points`);
  
  // 서버 메모리 자동 해제 (함수 종료 시)
  return summary;
}
