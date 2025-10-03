// server/services/data-processor.ts
// Step 2: 정확한 수치 계산 및 데이터 가공

export interface Message {
  timestamp: string;
  participant: string;
  content: string;
}

export interface TimeSlot {
  hour: string;
  count: number;
}

export interface KeywordCount {
  word: string;
  count: number;
}

export interface DateEvent {
  date: string;
  content: string;
}

export interface AffectionStat {
  word: string;
  count: number;
}

export interface RawExtraction {
  preferences?: Array<{ type: string; content: string }>;
  importantDates?: DateEvent[];
  affectionKeywords?: { [key: string]: number };
  topKeywords?: KeywordCount[];
}

export interface ProcessedData {
  // 정확하게 계산된 기본 지표
  tikitakaScore: number; // 0-100
  messageRatio: { [key: string]: number };
  avgMessageLength: { [key: string]: number };
  totalMessages: number;
  
  // 시간 및 패턴 분석
  timeDistribution: TimeSlot[];
  emojiCount: { [key: string]: number };
  questionRatio: { [key: string]: number };
  conversationStarters: { [key: string]: number };
  
  // 감정 분석
  sentimentRatio: {
    positive: number;
    neutral: number;
    negative: number;
  };
  
  // AI가 찾은 정보를 정리
  preferences: {
    likes: string[];
    dislikes: string[];
  };
  importantDates: DateEvent[];
  affectionWords: {
    [key: string]: AffectionStat[];
  };
  topKeywords: KeywordCount[];
  
  // 응답 속도 분석
  avgResponseTime: {
    [key: string]: number; // 평균 응답 시간 (분)
  };
}

// 티키타카 지수 계산
function calculateTikitakaScore(
  messageRatio: { [key: string]: number },
  questionRatio: { [key: string]: number },
  emojiCount: { [key: string]: number },
  avgResponseTime: { [key: string]: number },
  participants: string[]
): number {
  const [user, partner] = participants;
  
  // 1. 대화 균형도 (40점) - 메시지 비율이 50:50에 가까울수록 높은 점수
  const balanceScore = Math.max(0, 40 - Math.abs(messageRatio[user] - messageRatio[partner]) * 80);
  
  // 2. 질문 참여도 (30점) - 양쪽 모두 질문을 적절히 사용하는지
  const avgQuestionRatio = (questionRatio[user] + questionRatio[partner]) / 2;
  const questionScore = Math.min(30, avgQuestionRatio * 150);
  
  // 3. 이모티콘 사용도 (15점) - 감정 표현 활발함
  const totalEmojis = emojiCount[user] + emojiCount[partner];
  const emojiScore = Math.min(15, totalEmojis / 10);
  
  // 4. 응답 속도 (15점) - 빠른 응답일수록 높은 점수 (30분 이내 = 만점)
  const avgTime = (avgResponseTime[user] + avgResponseTime[partner]) / 2;
  const responseScore = Math.max(0, 15 - (avgTime / 30) * 15);
  
  return Math.round(balanceScore + questionScore + emojiScore + responseScore);
}

// 메시지 비율 계산
function calculateMessageRatio(messages: Message[], user: string, partner: string) {
  const userCount = messages.filter((m) => m.participant === user).length;
  const partnerCount = messages.filter((m) => m.participant === partner).length;
  const total = userCount + partnerCount;
  
  return {
    [user]: total > 0 ? Number((userCount / total).toFixed(2)) : 0.5,
    [partner]: total > 0 ? Number((partnerCount / total).toFixed(2)) : 0.5,
  };
}

// 평균 메시지 길이 계산
function calculateAvgLength(messages: Message[], user: string, partner: string) {
  const userMsgs = messages.filter((m) => m.participant === user);
  const partnerMsgs = messages.filter((m) => m.participant === partner);

  const userAvg =
    userMsgs.length > 0
      ? Math.round(
          userMsgs.reduce((sum, m) => sum + m.content.length, 0) / userMsgs.length
        )
      : 0;
  const partnerAvg =
    partnerMsgs.length > 0
      ? Math.round(
          partnerMsgs.reduce((sum, m) => sum + m.content.length, 0) / partnerMsgs.length
        )
      : 0;

  return { [user]: userAvg, [partner]: partnerAvg };
}

// 시간대별 분포 계산
function calculateTimeDistribution(messages: Message[]): TimeSlot[] {
  const distribution = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}시`,
    count: 0,
  }));

  messages.forEach((m) => {
    try {
      const hourMatch = m.timestamp.match(/(\d{1,2}):(\d{2})/);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1]);
        if (hour >= 0 && hour < 24) {
          distribution[hour].count++;
        }
      }
    } catch (e) {
      // 타임스탬프 파싱 실패 시 무시
    }
  });

  return distribution;
}

// 이모티콘 개수 계산
function calculateEmojiFrequency(messages: Message[], user: string, partner: string) {
  // 이모티콘 범위를 개별적으로 처리 (ES5 호환)
  const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;

  const userEmojis = messages
    .filter((m) => m.participant === user)
    .reduce(
      (count, m) => count + (m.content.match(emojiRegex) || []).length,
      0
    );

  const partnerEmojis = messages
    .filter((m) => m.participant === partner)
    .reduce(
      (count, m) => count + (m.content.match(emojiRegex) || []).length,
      0
    );

  return { [user]: userEmojis, [partner]: partnerEmojis };
}

// 질문 비율 계산
function calculateQuestionRatio(messages: Message[], user: string, partner: string) {
  const userMsgs = messages.filter((m) => m.participant === user);
  const partnerMsgs = messages.filter((m) => m.participant === partner);

  const userQuestions = userMsgs.filter(m => m.content.includes('?') || m.content.includes('？')).length;
  const partnerQuestions = partnerMsgs.filter(m => m.content.includes('?') || m.content.includes('？')).length;

  return {
    [user]: userMsgs.length > 0 ? Number((userQuestions / userMsgs.length).toFixed(2)) : 0,
    [partner]: partnerMsgs.length > 0 ? Number((partnerQuestions / partnerMsgs.length).toFixed(2)) : 0,
  };
}

// 대화 시작 횟수 계산 (첫 메시지 또는 1시간 이상 간격 후 첫 메시지)
function calculateConversationStarters(messages: Message[], user: string, partner: string) {
  let userStarts = 0;
  let partnerStarts = 0;
  let lastTimestamp: Date | null = null;

  messages.forEach((m, index) => {
    const currentTime = parseTimestamp(m.timestamp);
    
    if (!currentTime) return;
    
    // 첫 메시지이거나, 마지막 메시지로부터 1시간 이상 지났으면 대화 시작으로 간주
    if (index === 0 || (lastTimestamp && (currentTime.getTime() - lastTimestamp.getTime()) > 60 * 60 * 1000)) {
      if (m.participant === user) userStarts++;
      else if (m.participant === partner) partnerStarts++;
    }
    
    lastTimestamp = currentTime;
  });

  return {
    [user]: userStarts,
    [partner]: partnerStarts,
  };
}

// 응답 시간 계산
function calculateAvgResponseTime(messages: Message[], user: string, partner: string) {
  const responseTimes: { [key: string]: number[] } = {
    [user]: [],
    [partner]: [],
  };

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];

    // 참가자가 바뀌었을 때만 응답 시간 계산
    if (prev.participant !== curr.participant) {
      const prevTime = parseTimestamp(prev.timestamp);
      const currTime = parseTimestamp(curr.timestamp);

      if (prevTime && currTime) {
        const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1000 * 60);
        
        // 24시간 이내의 응답만 계산 (그 이상은 비정상적인 간격)
        if (diffMinutes <= 24 * 60) {
          responseTimes[curr.participant].push(diffMinutes);
        }
      }
    }
  }

  return {
    [user]: responseTimes[user].length > 0
      ? Math.round(responseTimes[user].reduce((a, b) => a + b, 0) / responseTimes[user].length)
      : 0,
    [partner]: responseTimes[partner].length > 0
      ? Math.round(responseTimes[partner].reduce((a, b) => a + b, 0) / responseTimes[partner].length)
      : 0,
  };
}

// 타임스탬프 파싱 헬퍼
function parseTimestamp(timestamp: string): Date | null {
  try {
    // "2024-01-15 14:30" 형식 파싱
    const match = timestamp.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 감정 비율 계산
function calculateSentimentRatio(messages: Message[]) {
  const positiveWords = [
    "좋", "행복", "감사", "사랑", "최고", "멋", "예쁘", "웃",
    "ㅎㅎ", "ㅋㅋ", "^^", "♥", "💕"
  ];
  const negativeWords = [
    "싫", "화", "짜증", "미워", "별로", "싫어", "속상", "슬프", "힘들"
  ];

  let positive = 0, negative = 0, neutral = 0;

  messages.forEach((m) => {
    const content = m.content.toLowerCase();
    const hasPositive = positiveWords.some((word) => content.includes(word));
    const hasNegative = negativeWords.some((word) => content.includes(word));

    if (hasPositive && !hasNegative) positive++;
    else if (hasNegative && !hasPositive) negative++;
    else neutral++;
  });

  const total = messages.length || 1;
  return {
    positive: Number((positive / total).toFixed(2)),
    neutral: Number((neutral / total).toFixed(2)),
    negative: Number((negative / total).toFixed(2)),
  };
}

// 키워드 빈도 계산 (AI가 추출한 키워드 + 자체 계산)
function calculateTopKeywords(messages: Message[], aiKeywords: KeywordCount[] = []): KeywordCount[] {
  const wordCount: { [key: string]: number } = {};
  
  // 불용어 리스트
  const stopWords = new Set([
    '그', '저', '이', '것', '수', '등', '들', '및', '또는', '그리고',
    '은', '는', '이', '가', '을', '를', '에', '의', '와', '과',
    '도', '만', '요', '네', '지', 'ㅋㅋ', 'ㅎㅎ', 'ㅠㅠ'
  ]);

  messages.forEach((m) => {
    // 한글 단어만 추출 (2글자 이상)
    const words = m.content.match(/[가-힣]{2,}/g) || [];
    words.forEach((word) => {
      if (!stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
  });

  // AI 키워드와 병합
  aiKeywords.forEach((kw) => {
    wordCount[kw.word] = (wordCount[kw.word] || 0) + kw.count;
  });

  // 상위 10개 추출
  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
}

// 애정 표현 통계 생성
function generateAffectionStats(
  messages: Message[],
  user: string,
  partner: string,
  aiAffectionKeywords: { [key: string]: number } = {}
): { [key: string]: AffectionStat[] } {
  const affectionWords = ['사랑', '좋아', '보고싶', '그리워', '행복', '소중'];
  
  const userStats: { [key: string]: number } = {};
  const partnerStats: { [key: string]: number } = {};

  messages.forEach((m) => {
    const content = m.content;
    const stats = m.participant === user ? userStats : partnerStats;
    
    affectionWords.forEach((word) => {
      if (content.includes(word)) {
        stats[word] = (stats[word] || 0) + 1;
      }
    });
  });

  return {
    [user]: Object.entries(userStats)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count),
    [partner]: Object.entries(partnerStats)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// 메인 처리 함수
export function processConversationData(
  messages: Message[],
  rawExtraction: RawExtraction
): ProcessedData {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const user = participants[0] || "사용자";
  const partner = participants[1] || "상대방";

  // 1. 기본 지표 계산
  const messageRatio = calculateMessageRatio(messages, user, partner);
  const avgMessageLength = calculateAvgLength(messages, user, partner);
  const timeDistribution = calculateTimeDistribution(messages);
  const emojiCount = calculateEmojiFrequency(messages, user, partner);
  const questionRatio = calculateQuestionRatio(messages, user, partner);
  const conversationStarters = calculateConversationStarters(messages, user, partner);
  const sentimentRatio = calculateSentimentRatio(messages);
  const avgResponseTime = calculateAvgResponseTime(messages, user, partner);

  // 2. 티키타카 지수 계산
  const tikitakaScore = calculateTikitakaScore(
    messageRatio,
    questionRatio,
    emojiCount,
    avgResponseTime,
    [user, partner]
  );

  // 3. AI 추출 정보 정리
  const preferences = {
    likes: (rawExtraction.preferences || [])
      .filter(p => p.type === 'like')
      .map(p => p.content),
    dislikes: (rawExtraction.preferences || [])
      .filter(p => p.type === 'dislike')
      .map(p => p.content),
  };

  const importantDates = rawExtraction.importantDates || [];

  const affectionWords = generateAffectionStats(
    messages,
    user,
    partner,
    rawExtraction.affectionKeywords
  );

  const topKeywords = calculateTopKeywords(
    messages,
    rawExtraction.topKeywords
  );

  return {
    tikitakaScore,
    messageRatio,
    avgMessageLength,
    totalMessages: messages.length,
    timeDistribution,
    emojiCount,
    questionRatio,
    conversationStarters,
    sentimentRatio,
    preferences,
    importantDates,
    affectionWords,
    topKeywords,
    avgResponseTime,
  };
}
