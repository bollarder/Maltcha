import { Message } from "@shared/schema";

export interface ParsedConversation {
  messages: Message[];
  participants: Set<string>;
}

/**
 * 카카오톡 대화 파일 파싱
 * 
 * 지원 형식:
 * 1. [Name] [Time] Message
 * 2. 2024. 1. 15. 오후 9:30, Name : Message
 * 3. 2024-01-15 21:30, Name : Message (CSV 변환 형식, ISO 타임스탬프)
 * 
 * CSV 파일은 프론트엔드에서 이 형식으로 변환 후 전송됨
 */
export function parseKakaoTalkFile(content: string): ParsedConversation {
  const lines = content.split('\n');
  const messages: Message[] = [];
  const participants = new Set<string>();
  
  // KakaoTalk format: [Name] [Time] Message
  const kakaoRegex1 = /^\[(.+?)\]\s\[(.+?)\]\s(.+)$/;
  
  // KakaoTalk format: 2024. 1. 15. 오후 9:30, Name : Message
  const kakaoRegex2 = /^(\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.\s(?:오전|오후)\s\d{1,2}:\d{2}),\s(.+?)\s:\s(.+)$/;
  
  // CSV converted format: 2024-01-15 21:30, Name : Message (ISO timestamp)
  // Also supports: 2024. 1. 15. 21:30, Name : Message
  const csvRegex = /^(.+?),\s*(.+?)\s*:\s*(.+)$/;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    let match = line.match(kakaoRegex1);
    if (match) {
      const [, participant, timestamp, content] = match;
      participants.add(participant);
      messages.push({
        timestamp,
        participant,
        content: content.trim(),
      });
      continue;
    }
    
    match = line.match(kakaoRegex2);
    if (match) {
      const [, timestamp, participant, content] = match;
      participants.add(participant);
      messages.push({
        timestamp,
        participant,
        content: content.trim(),
      });
      continue;
    }
    
    // CSV format (fallback)
    match = line.match(csvRegex);
    if (match) {
      const [, timestamp, participant, content] = match;
      // 타임스탬프가 날짜 형식인지 확인 (간단한 체크)
      if (timestamp.match(/\d{4}/) && participant && content) {
        participants.add(participant);
        messages.push({
          timestamp: timestamp.trim(),
          participant: participant.trim(),
          content: content.trim(),
        });
      }
    }
  }
  
  return {
    messages,
    participants,
  };
}

export function calculateStats(messages: Message[], participants: Set<string>) {
  const participantCount = participants.size;
  const totalMessages = messages.length;
  
  // Calculate average response time (simplified - assumes sequential messages)
  let totalTimeDiff = 0;
  let timeCount = 0;
  
  for (let i = 1; i < messages.length; i++) {
    const prev = parseKakaoDate(messages[i - 1].timestamp);
    const curr = parseKakaoDate(messages[i].timestamp);
    if (prev && curr) {
      totalTimeDiff += (curr.getTime() - prev.getTime()) / 1000 / 60; // minutes
      timeCount++;
    }
  }
  
  const avgResponseMinutes = timeCount > 0 ? totalTimeDiff / timeCount : 0;
  const avgResponseTime = avgResponseMinutes < 1 
    ? `${Math.round(avgResponseMinutes * 60)}초`
    : avgResponseMinutes < 60
    ? `${avgResponseMinutes.toFixed(1)}분`
    : `${(avgResponseMinutes / 60).toFixed(1)}시간`;
  
  return {
    totalMessages,
    participants: participantCount,
    avgResponseTime,
    sentimentScore: 0, // Will be calculated by AI
  };
}

function parseKakaoDate(timestamp: string): Date | null {
  try {
    // Format 1: "2024. 1. 15. 오후 9:30" (Korean AM/PM)
    let match = timestamp.match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.\s(오전|오후)\s(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, meridiem, hour, minute] = match;
      let hours = parseInt(hour);
      if (meridiem === '오후' && hours !== 12) hours += 12;
      if (meridiem === '오전' && hours === 12) hours = 0;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, parseInt(minute));
    }
    
    // Format 2: "2024-01-15 21:30" (ISO-like, 24-hour)
    match = timestamp.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    
    // Format 3: "2024. 1. 15. 21:30" (Dotted format, 24-hour)
    match = timestamp.match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    
    // Format 4: Generic fallback - try to parse as Date string
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return null;
  } catch {
    return null;
  }
}

export function generateChartData(messages: Message[], participants: Set<string>) {
  // Message frequency by date
  const dateMap = new Map<string, number>();
  messages.forEach(msg => {
    const date = parseKakaoDate(msg.timestamp);
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
  });
  
  const messageFrequency = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // Participant activity
  const participantMap = new Map<string, number>();
  messages.forEach(msg => {
    participantMap.set(msg.participant, (participantMap.get(msg.participant) || 0) + 1);
  });
  
  const participantActivity = Array.from(participantMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  
  // Hourly activity
  const hourMap = new Map<number, number>();
  messages.forEach(msg => {
    const date = parseKakaoDate(msg.timestamp);
    if (date) {
      const hour = date.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }
  });
  
  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) || 0,
  }));
  
  return {
    messageFrequency,
    participantActivity,
    hourlyActivity,
  };
}
