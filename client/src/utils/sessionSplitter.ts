export interface Message {
  date: string;
  user: string;
  message: string;
}

export interface Batch {
  batchId: number;
  messages: Message[];
  count: number;
}

/**
 * 메시지 배열을 세션 기반으로 스마트 분할
 * @param messages 메시지 배열
 * @param targetSize 목표 배치 크기 (기본값: 2000)
 * @returns 분할된 배치 배열
 */
export function splitBySession(messages: Message[], targetSize = 2000): Batch[] {
  const batches: Batch[] = [];
  let currentBatch: Message[] = [];
  let batchId = 1;
  const maxSize = 2200; // 최대 배치 크기

  for (let i = 0; i < messages.length; i++) {
    const currentMsg = messages[i];

    currentBatch.push(currentMsg);

    // 다음 메시지 확인
    const nextMsg = messages[i + 1];
    
    // 배치 완료 조건 체크
    let shouldFinalizeBatch = false;

    if (!nextMsg) {
      // 마지막 메시지면 배치 완료
      shouldFinalizeBatch = true;
    } else {
      const gapToNext = calculateGapMinutes(currentMsg, nextMsg);
      const isNextSessionEnd = isSessionEnd(currentMsg, nextMsg, gapToNext);

      if (isNextSessionEnd) {
        // 세션이 끝나면 무조건 배치 완료
        shouldFinalizeBatch = true;
      } else if (currentBatch.length >= maxSize) {
        // 2200 초과 방지를 위한 강제 분할
        shouldFinalizeBatch = true;
      } else if (currentBatch.length >= targetSize) {
        // targetSize 도달 후 세션이 끝나지 않았으면 다음 세션 끝을 기다림
        // 단, 2200 미만일 때만 계속 추가
        shouldFinalizeBatch = false;
      }
    }

    if (shouldFinalizeBatch) {
      batches.push({
        batchId: batchId++,
        messages: [...currentBatch],
        count: currentBatch.length,
      });
      currentBatch = [];
    }
  }

  // 남은 메시지 처리 (위 로직에서 처리되지만 안전장치)
  if (currentBatch.length > 0) {
    batches.push({
      batchId: batchId,
      messages: currentBatch,
      count: currentBatch.length,
    });
  }

  return batches;
}

/**
 * 세션 종료 여부 판단
 * @param prevMsg 이전 메시지
 * @param currentMsg 현재 메시지
 * @param gapMinutes 시간 간격 (분)
 * @returns 세션 종료 여부
 */
export function isSessionEnd(
  prevMsg: Message,
  currentMsg: Message,
  gapMinutes: number
): boolean {
  // 30분 이하: 같은 세션
  if (gapMinutes <= 30) {
    return false;
  }

  // 6시간 이상: 다른 세션
  if (gapMinutes >= 360) {
    return true;
  }

  // 종결 메시지 + 30분 이상: 다른 세션
  if (hasClosingMessage(prevMsg.message) && gapMinutes >= 30) {
    return true;
  }

  // 30분~6시간 사이: 시간대와 간격으로 판단
  const prevDate = new Date(prevMsg.date);
  const currentDate = new Date(currentMsg.date);
  const prevPeriod = getTimePeriod(prevDate.getHours());
  const currentPeriod = getTimePeriod(currentDate.getHours());

  // 같은 시간대 + 2시간 이내: 같은 세션
  if (prevPeriod === currentPeriod && gapMinutes <= 120) {
    return false;
  }

  // 그 외: 다른 세션
  return true;
}

/**
 * 시간대 구분
 * @param hour 시간 (0-23)
 * @returns 시간대 문자열
 */
export function getTimePeriod(hour: number): string {
  if (hour >= 6 && hour < 11) return '아침';
  if (hour >= 11 && hour < 14) return '점심';
  if (hour >= 14 && hour < 18) return '오후';
  if (hour >= 18 && hour < 23) return '저녁';
  return '밤'; // 23-6
}

/**
 * 종결 메시지 패턴 확인
 * @param msg 메시지 내용
 * @returns 종결 메시지 여부
 */
export function hasClosingMessage(msg: string): boolean {
  const patterns = [
    /잘\s*자/,
    /고마워?/,
    /ㅇㅋ/,
    /나중에/,
    /바이/,
    /ㄱㅅ/,
    /알았어/,
    /바빠/,
    /가야?돼?/,
  ];

  return patterns.some(pattern => pattern.test(msg));
}

/**
 * 두 메시지 간 시간 차이 계산 (분 단위)
 * @param prevMsg 이전 메시지
 * @param currentMsg 현재 메시지
 * @returns 시간 차이 (분)
 */
export function calculateGapMinutes(prevMsg: Message, currentMsg: Message): number {
  const prevDate = new Date(prevMsg.date);
  const currentDate = new Date(currentMsg.date);

  const diffMs = currentDate.getTime() - prevDate.getTime();
  const diffMinutes = Math.abs(diffMs / (1000 * 60));

  return diffMinutes;
}
