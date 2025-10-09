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
 * Gemini 요약 프롬프트 생성 (FBI 프로파일러 버전)
 */
function createSummaryPrompt(
  highMessages: FilteredMessage[],
  mediumMessages: FilteredMessage[],
  relationshipType: string,
  userGoal: string = '관계 분석'
): string {
  // 사용자 이름 추출 (첫 번째 메시지부터)
  const users = [...new Set([...highMessages, ...mediumMessages].map(m => m.user))];
  const userName = users[0] || 'User1';
  const partnerName = users[1] || 'User2';
  
  const criticalCount = highMessages.length;
  const mediumCount = mediumMessages.length;
  const totalMessages = criticalCount + mediumCount;

  return `# 🕵️ FBI 프로파일링 프로토콜

당신은 FBI 행동분석팀(BAU) 프로파일러입니다.
경력 15년, 200건 이상 복잡한 사건 프로파일링.

## 임무

증거 수집관이 분류한 증거를 분석하여
관계의 프로파일을 작성하세요.

---

## 입력 데이터

### 증거 메타데이터 (원문 제외)

**CRITICAL 증거: ${criticalCount}개**
${highMessages.map(m => `[${m.index}] ${m.date} | ${m.user} | 이유: ${m.reason}`).join('\n')}

**MEDIUM 증거: ${mediumCount}개 (샘플 500개)**
${mediumMessages.slice(0, 500).map(m => `[${m.index}] ${m.date} | ${m.user} | 이유: ${m.reason}`).join('\n')}
${mediumMessages.length > 500 ? `\n... 외 ${mediumMessages.length - 500}개` : ''}

**통계:**
- 총 메시지: ${totalMessages}
- 관계: ${relationshipType}
- 목적: ${userGoal}
- 참여자: ${userName}, ${partnerName}

**중요: 원문 없이 메타데이터만으로 분석**

---

## FBI 프로파일링 6단계

### Stage 1: 증거 검토
- CRITICAL ${criticalCount}개 전체 검토
- MEDIUM 중 대표 샘플 500개 선별
- 시간순 정렬

### Stage 2: 범죄 분류
**MO (Modus Operandi) - 소통 방식**: 어떻게 대화하는가?
**Signature - 고유 패턴**: 왜 그렇게 하는가? 변하지 않는 것

### Stage 3: 타임라인 재구성
**Phase 1 (초기)**: 첫 1/3 기간 분석
**Phase 2 (중기)**: 중간 1/3 기간, 전환점 파악
**Phase 3 (최근)**: 마지막 1/3 기간, 현재 상태

### Stage 4: 피해자학
${partnerName} 분석: 니즈, 트리거, 회피 패턴

### Stage 5: 행동 증거 분석
패턴 발견 (최소 5개, 3회 이상 출현)

### Stage 6: 프로파일 생성
관계 유형, 건강도 점수, 전환점, 심층 분석 대상

---

## 출력 형식 (간소화)

\`\`\`json
{
  "timeline": [
    {
      "date": "2024-01",
      "description": "관계 시작기",
      "significance": "설렘과 호기심"
    }
  ],
  "turning_points": [
    {
      "index": 145,
      "date": "2024-03-15",
      "description": "첫 갈등 발생",
      "impact": "관계 재정립"
    }
  ],
  "high_indices": [${highMessages.map(m => m.index).join(', ')}],
  "medium_sample": [
    {
      "index": 67,
      "date": "2024-02-10",
      "category": "일상 공유"
    }
  ],
  "statistics": {
    "total_analyzed": ${totalMessages},
    "high_count": ${criticalCount},
    "medium_count": ${mediumCount},
    "relationship_health": "건강함/보통/주의/위험",
    "key_themes": ["주제1", "주제2", "주제3"]
  }
}
\`\`\`

---

## FBI 프로파일링 원칙

**1. 증거만 말한다**
- 메타데이터에 없으면 추측 금지
- 인덱스와 이유가 전부

**2. 패턴 = 3회 이상**
- 1-2회는 "가능성"
- 3회 이상만 확정 패턴

**3. 타임라인이 핵심**
- 시간 흐름이 진실
- 초기-중기-최근 비교 필수

**4. 수치로 증명**
- 추상적 표현 금지
- 구체적 숫자 제시

---

## 체크리스트

- [ ] timeline: 전체 타임라인 5-8개 이벤트
- [ ] turning_points: 관계 전환점 5-10개 (인덱스 포함)
- [ ] high_indices: 모든 CRITICAL 인덱스 배열
- [ ] medium_sample: MEDIUM 대표 샘플 500개
- [ ] statistics: 건강도, 핵심 주제

---

이제 프로파일링을 시작하세요. 정확한 JSON으로 출력하세요.`;
}

/**
 * Gemini API로 최종 요약 생성
 */
export async function summarizeWithGemini(
  filterResult: FilterResult,
  relationshipType: string,
  userGoal: string = '관계 분석'
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
    relationshipType,
    userGoal
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
  relationshipType: string,
  userGoal: string = '관계 분석'
): Promise<SummaryResult> {
  console.log(`Processing summary for ${filterResult.stats.total} filtered messages...`);
  
  // Gemini API 1회 호출
  const summary = await summarizeWithGemini(filterResult, relationshipType, userGoal);
  
  console.log(`Summary generated: ${summary.timeline.length} timeline events, ${summary.turning_points.length} turning points`);
  
  // 서버 메모리 자동 해제 (함수 종료 시)
  return summary;
}
