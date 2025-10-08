export interface FilteredMessage {
  date: string;
  user: string;
  message: string;
  index: number;
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

export interface MergedResult {
  high: FilteredMessage[];
  medium: FilteredMessage[];
  all: FilteredMessage[];
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * 브라우저에서 배치 결과 자동 병합
 * - n개 배치 결과 병합
 * - 중복 제거 (인덱스 기준)
 * - 인덱스 기준 정렬
 * - HIGH/MEDIUM 분리 저장
 */
export function mergeBatchResults(results: FilterResult[]): MergedResult {
  // 중복 제거를 위한 통합 Map (인덱스 → 메시지)
  // HIGH 우선순위로 중복 제거
  const messageMap = new Map<number, FilteredMessage>();

  // 모든 배치 순회하며 병합
  for (const result of results) {
    // HIGH 메시지 병합 (중복 제거, 항상 우선)
    for (const msg of result.high) {
      messageMap.set(msg.index, msg); // HIGH는 무조건 덮어쓰기
    }

    // MEDIUM 메시지 병합 (HIGH가 없을 때만 추가)
    for (const msg of result.medium) {
      if (!messageMap.has(msg.index)) {
        messageMap.set(msg.index, msg);
      }
    }
  }

  // Map을 배열로 변환하고 인덱스 기준 정렬
  const allMessages = Array.from(messageMap.values()).sort((a, b) => a.index - b.index);

  // HIGH/MEDIUM 분리
  const high = allMessages.filter(msg => msg.importance === 'HIGH');
  const medium = allMessages.filter(msg => msg.importance === 'MEDIUM');

  // 병합 결과 통계 (n + m개)
  const stats = {
    total: allMessages.length,
    high: high.length,
    medium: medium.length,
    low: 0, // LOW 메시지는 브라우저에 저장 안함
  };

  // 검증: 중복 인덱스 확인
  const indices = allMessages.map(msg => msg.index);
  const uniqueIndices = new Set(indices);
  if (indices.length !== uniqueIndices.size) {
    console.error('Merged result validation failed: duplicate indices found');
  }

  // 검증: 분리된 배열 합 = 전체
  if (high.length + medium.length !== allMessages.length) {
    console.error('Merged result validation failed: high + medium !== all');
  }

  return {
    high,
    medium,
    all: allMessages,
    stats,
  };
}

/**
 * 병합 결과를 브라우저 메모리에 저장
 * (선택적으로 사용 - 컴포넌트 state나 context에 저장하는 것을 권장)
 */
export class ResultStore {
  private static instance: ResultStore | null = null;
  private mergedResult: MergedResult | null = null;

  private constructor() {}

  static getInstance(): ResultStore {
    if (!ResultStore.instance) {
      ResultStore.instance = new ResultStore();
    }
    return ResultStore.instance;
  }

  save(result: MergedResult): void {
    this.mergedResult = result;
  }

  get(): MergedResult | null {
    return this.mergedResult;
  }

  clear(): void {
    this.mergedResult = null;
  }

  getHighMessages(): FilteredMessage[] {
    return this.mergedResult?.high || [];
  }

  getMediumMessages(): FilteredMessage[] {
    return this.mergedResult?.medium || [];
  }

  getAllMessages(): FilteredMessage[] {
    return this.mergedResult?.all || [];
  }

  getStats() {
    return this.mergedResult?.stats || {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
  }
}

/**
 * 사용 예시:
 * 
 * // 배치 결과 병합
 * const merged = mergeBatchResults(batchResults);
 * 
 * // 브라우저 메모리에 저장
 * const store = ResultStore.getInstance();
 * store.save(merged);
 * 
 * // 나중에 사용
 * const highMessages = store.getHighMessages();
 * const stats = store.getStats();
 */
