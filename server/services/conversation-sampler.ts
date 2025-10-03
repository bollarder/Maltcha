// server/services/conversation-sampler.ts
// AI가 분석할 대표적인 메시지 샘플을 추출하는 유틸리티

import emojiRegex from "emoji-regex";
import type { Message } from "./data-processor";

export interface MessageSamples {
  recent: Message[];
  longestExchanges: Message[];
  emotional: Message[];
  preferences: Message[];
  appointments: Message[];
  questions: Message[];
  random: Message[];
  byTimeOfDay: Message[];
}

export function getSamplesForAnalysis(messages: Message[]): MessageSamples {
  return {
    // 최근 대화 (가장 중요)
    recent: messages.slice(-300),
    
    // 가장 긴 대화 교환 (깊은 소통)
    longestExchanges: getLongestConversations(messages, 15),
    
    // 감정적 대화 (긍정 + 부정)
    emotional: getMostEmotionalMessages(messages, 20),
    
    // 키워드 기반 샘플
    preferences: getMessagesWithKeywords(messages, 
      ["좋아", "싫어", "사랑", "미워", "최고", "별로"], 5),
    appointments: getMessagesWithKeywords(messages,
      ["약속", "만나", "갈래", "시간", "언제", "어디"], 5),
    questions: getQuestions(messages, 15),
    
    // 랜덤 샘플 (편향 방지)
    random: getRandomSample(messages, 30),
    
    // 시간대별 샘플 (아침/점심/저녁/밤 각 5개)
    byTimeOfDay: getByTimeOfDay(messages, 5)
  };
}

function getLongestConversations(messages: Message[], count: number): Message[] {
  // 연속된 대화를 찾아서 가장 긴 순으로 정렬
  const conversations: Message[][] = [];
  let currentConv: Message[] = [];
  let lastTime: Date | null = null;
  
  for (const msg of messages) {
    const msgTime = new Date(msg.timestamp);
    const timeDiff = lastTime ? 
      (msgTime.getTime() - lastTime.getTime()) / 1000 / 60 : 0;
    
    if (timeDiff < 10) { // 10분 이내면 같은 대화
      currentConv.push(msg);
    } else {
      if (currentConv.length > 0) {
        conversations.push([...currentConv]);
      }
      currentConv = [msg];
    }
    lastTime = msgTime;
  }
  
  // 마지막 대화 추가
  if (currentConv.length > 0) {
    conversations.push(currentConv);
  }
  
  return conversations
    .sort((a, b) => b.length - a.length)
    .slice(0, count)
    .flat();
}

function getMostEmotionalMessages(messages: Message[], count: number): Message[] {
  // 이모티콘이 많거나, 감정 키워드가 있는 메시지
  const emotionalKeywords = [
    "사랑", "행복", "슬프", "화나", "보고싶", "그리워",
    "!!!", "ㅠㅠ", "ㅜㅜ", "ㅎㅎ", "ㅋㅋㅋ", "ㅋㅋ",
    "좋아", "싫어", "미안", "고마워", "감사", "축하"
  ];
  
  const regex = emojiRegex();
  
  const scored = messages.map(m => {
    let score = 0;
    
    // 감정 키워드 점수
    emotionalKeywords.forEach(k => {
      if (m.content.includes(k)) score += 2;
    });
    
    // 이모티콘 점수 (emoji-regex로 정확한 검출)
    const emojiMatches = m.content.match(regex) || [];
    score += Math.min(emojiMatches.length * 3, 15); // 최대 15점
    
    // 느낌표/물음표 점수
    score += (m.content.match(/[!?]/g) || []).length;
    
    return { message: m, score };
  });
  
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(item => item.message);
}

function getMessagesWithKeywords(
  messages: Message[], 
  keywords: string[], 
  perKeyword: number
): Message[] {
  const result: Message[] = [];
  
  for (const keyword of keywords) {
    const matching = messages.filter(m => 
      m.content.toLowerCase().includes(keyword.toLowerCase())
    );
    result.push(...matching.slice(-perKeyword));
  }
  
  // 중복 제거
  const unique = Array.from(new Map(
    result.map(m => [m.timestamp + m.content, m])
  ).values());
  
  return unique;
}

function getQuestions(messages: Message[], count: number): Message[] {
  const questions = messages.filter(m => 
    m.content.includes("?") || 
    m.content.includes("?") ||
    /\b(뭐|왜|어디|언제|누가|어떻게|무엇)\b/.test(m.content)
  );
  
  return questions.slice(-count);
}

function getRandomSample(messages: Message[], count: number): Message[] {
  if (messages.length <= count) return messages;
  
  const result: Message[] = [];
  const indices = new Set<number>();
  
  while (indices.size < count) {
    const randomIndex = Math.floor(Math.random() * messages.length);
    if (!indices.has(randomIndex)) {
      indices.add(randomIndex);
      result.push(messages[randomIndex]);
    }
  }
  
  return result.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function getByTimeOfDay(messages: Message[], perPeriod: number): Message[] {
  const periods = {
    morning: [] as Message[],   // 6-12시
    afternoon: [] as Message[],  // 12-18시
    evening: [] as Message[],    // 18-22시
    night: [] as Message[]       // 22-6시
  };
  
  for (const msg of messages) {
    const hour = new Date(msg.timestamp).getHours();
    
    if (hour >= 6 && hour < 12) {
      periods.morning.push(msg);
    } else if (hour >= 12 && hour < 18) {
      periods.afternoon.push(msg);
    } else if (hour >= 18 && hour < 22) {
      periods.evening.push(msg);
    } else {
      periods.night.push(msg);
    }
  }
  
  const result: Message[] = [];
  
  Object.values(periods).forEach(periodMessages => {
    result.push(...periodMessages.slice(-perPeriod));
  });
  
  return result;
}

// 샘플을 텍스트로 포맷팅
export function formatSamplesForAI(samples: MessageSamples): string {
  let formatted = "";
  
  if (samples.recent.length > 0) {
    formatted += "=== 최근 대화 (가장 중요) ===\n";
    formatted += samples.recent.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.longestExchanges.length > 0) {
    formatted += "=== 깊은 대화 교환 ===\n";
    formatted += samples.longestExchanges.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.emotional.length > 0) {
    formatted += "=== 감정적인 순간들 ===\n";
    formatted += samples.emotional.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.preferences.length > 0) {
    formatted += "=== 선호도 언급 ===\n";
    formatted += samples.preferences.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.appointments.length > 0) {
    formatted += "=== 약속/일정 ===\n";
    formatted += samples.appointments.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.questions.length > 0) {
    formatted += "=== 질문들 ===\n";
    formatted += samples.questions.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.byTimeOfDay.length > 0) {
    formatted += "=== 시간대별 샘플 ===\n";
    formatted += samples.byTimeOfDay.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  
  if (samples.random.length > 0) {
    formatted += "=== 랜덤 샘플 (편향 방지) ===\n";
    formatted += samples.random.map(m => 
      `${m.participant}: ${m.content}`
    ).join("\n");
  }
  
  return formatted;
}
