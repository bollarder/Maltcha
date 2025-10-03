// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  analyses;
  constructor() {
    this.analyses = /* @__PURE__ */ new Map();
  }
  async createAnalysis(insertAnalysis) {
    const id = randomUUID();
    const analysis = {
      id,
      fileName: insertAnalysis.fileName,
      fileSize: insertAnalysis.fileSize,
      uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "processing",
      messages: []
    };
    this.analyses.set(id, analysis);
    return analysis;
  }
  async getAnalysis(id) {
    return this.analyses.get(id);
  }
  async updateAnalysis(id, data) {
    const existing = this.analyses.get(id);
    if (!existing) {
      throw new Error("Analysis not found");
    }
    const updated = { ...existing, ...data };
    this.analyses.set(id, updated);
    return updated;
  }
};
var storage = new MemStorage();

// server/services/kakao-parser.ts
function parseKakaoTalkFile(content) {
  const lines = content.split("\n");
  const messages = [];
  const participants = /* @__PURE__ */ new Set();
  const kakaoRegex1 = /^\[(.+?)\]\s\[(.+?)\]\s(.+)$/;
  const kakaoRegex2 = /^(\d{4}\.\s?\d{1,2}\.\s?\d{1,2}\.\s(?:오전|오후)\s\d{1,2}:\d{2}),\s(.+?)\s:\s(.+)$/;
  for (const line of lines) {
    if (!line.trim()) continue;
    let match = line.match(kakaoRegex1);
    if (match) {
      const [, participant, timestamp, content2] = match;
      participants.add(participant);
      messages.push({
        timestamp,
        participant,
        content: content2.trim()
      });
      continue;
    }
    match = line.match(kakaoRegex2);
    if (match) {
      const [, timestamp, participant, content2] = match;
      participants.add(participant);
      messages.push({
        timestamp,
        participant,
        content: content2.trim()
      });
    }
  }
  return {
    messages,
    participants
  };
}
function calculateStats(messages, participants) {
  const participantCount = participants.size;
  const totalMessages = messages.length;
  let totalTimeDiff = 0;
  let timeCount = 0;
  for (let i = 1; i < messages.length; i++) {
    const prev = parseKakaoDate(messages[i - 1].timestamp);
    const curr = parseKakaoDate(messages[i].timestamp);
    if (prev && curr) {
      totalTimeDiff += (curr.getTime() - prev.getTime()) / 1e3 / 60;
      timeCount++;
    }
  }
  const avgResponseMinutes = timeCount > 0 ? totalTimeDiff / timeCount : 0;
  const avgResponseTime = avgResponseMinutes < 1 ? `${Math.round(avgResponseMinutes * 60)}\uCD08` : avgResponseMinutes < 60 ? `${avgResponseMinutes.toFixed(1)}\uBD84` : `${(avgResponseMinutes / 60).toFixed(1)}\uC2DC\uAC04`;
  return {
    totalMessages,
    participants: participantCount,
    avgResponseTime,
    sentimentScore: 0
    // Will be calculated by AI
  };
}
function parseKakaoDate(timestamp) {
  try {
    const match = timestamp.match(/(\d{4})\.\s?(\d{1,2})\.\s?(\d{1,2})\.\s(오전|오후)\s(\d{1,2}):(\d{2})/);
    if (match) {
      const [, year, month, day, meridiem, hour, minute] = match;
      let hours = parseInt(hour);
      if (meridiem === "\uC624\uD6C4" && hours !== 12) hours += 12;
      if (meridiem === "\uC624\uC804" && hours === 12) hours = 0;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hours, parseInt(minute));
    }
    return null;
  } catch {
    return null;
  }
}
function generateChartData(messages, participants) {
  const dateMap = /* @__PURE__ */ new Map();
  messages.forEach((msg) => {
    const date = parseKakaoDate(msg.timestamp);
    if (date) {
      const dateStr = date.toISOString().split("T")[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
  });
  const messageFrequency = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  const participantMap = /* @__PURE__ */ new Map();
  messages.forEach((msg) => {
    participantMap.set(msg.participant, (participantMap.get(msg.participant) || 0) + 1);
  });
  const participantActivity = Array.from(participantMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const hourMap = /* @__PURE__ */ new Map();
  messages.forEach((msg) => {
    const date = parseKakaoDate(msg.timestamp);
    if (date) {
      const hour = date.getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    }
  });
  const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) || 0
  }));
  return {
    messageFrequency,
    participantActivity,
    hourlyActivity
  };
}

// server/services/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

// server/services/data-processor.ts
function calculateTikitakaScore(messageRatio, questionRatio, emojiCount, avgResponseTime, participants) {
  const [user, partner] = participants;
  const balanceScore = Math.max(0, 40 - Math.abs(messageRatio[user] - messageRatio[partner]) * 80);
  const avgQuestionRatio = (questionRatio[user] + questionRatio[partner]) / 2;
  const questionScore = Math.min(30, avgQuestionRatio * 150);
  const totalEmojis = emojiCount[user] + emojiCount[partner];
  const emojiScore = Math.min(15, totalEmojis / 10);
  const avgTime = (avgResponseTime[user] + avgResponseTime[partner]) / 2;
  const responseScore = Math.max(0, 15 - avgTime / 30 * 15);
  return Math.round(balanceScore + questionScore + emojiScore + responseScore);
}
function calculateMessageRatio(messages, user, partner) {
  const userCount = messages.filter((m) => m.participant === user).length;
  const partnerCount = messages.filter((m) => m.participant === partner).length;
  const total = userCount + partnerCount;
  return {
    [user]: total > 0 ? Number((userCount / total).toFixed(2)) : 0.5,
    [partner]: total > 0 ? Number((partnerCount / total).toFixed(2)) : 0.5
  };
}
function calculateAvgLength(messages, user, partner) {
  const userMsgs = messages.filter((m) => m.participant === user);
  const partnerMsgs = messages.filter((m) => m.participant === partner);
  const userAvg = userMsgs.length > 0 ? Math.round(
    userMsgs.reduce((sum, m) => sum + m.content.length, 0) / userMsgs.length
  ) : 0;
  const partnerAvg = partnerMsgs.length > 0 ? Math.round(
    partnerMsgs.reduce((sum, m) => sum + m.content.length, 0) / partnerMsgs.length
  ) : 0;
  return { [user]: userAvg, [partner]: partnerAvg };
}
function calculateTimeDistribution(messages) {
  const distribution = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, "0")}\uC2DC`,
    count: 0
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
    }
  });
  return distribution;
}
function calculateEmojiFrequency(messages, user, partner) {
  const emojiRegex2 = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  const userEmojis = messages.filter((m) => m.participant === user).reduce(
    (count, m) => count + (m.content.match(emojiRegex2) || []).length,
    0
  );
  const partnerEmojis = messages.filter((m) => m.participant === partner).reduce(
    (count, m) => count + (m.content.match(emojiRegex2) || []).length,
    0
  );
  return { [user]: userEmojis, [partner]: partnerEmojis };
}
function calculateQuestionRatio(messages, user, partner) {
  const userMsgs = messages.filter((m) => m.participant === user);
  const partnerMsgs = messages.filter((m) => m.participant === partner);
  const userQuestions = userMsgs.filter((m) => m.content.includes("?") || m.content.includes("\uFF1F")).length;
  const partnerQuestions = partnerMsgs.filter((m) => m.content.includes("?") || m.content.includes("\uFF1F")).length;
  return {
    [user]: userMsgs.length > 0 ? Number((userQuestions / userMsgs.length).toFixed(2)) : 0,
    [partner]: partnerMsgs.length > 0 ? Number((partnerQuestions / partnerMsgs.length).toFixed(2)) : 0
  };
}
function calculateConversationStarters(messages, user, partner) {
  let userStarts = 0;
  let partnerStarts = 0;
  let lastTimestamp = null;
  messages.forEach((m, index) => {
    const currentTime = parseTimestamp(m.timestamp);
    if (!currentTime) return;
    if (index === 0 || lastTimestamp && currentTime.getTime() - lastTimestamp.getTime() > 60 * 60 * 1e3) {
      if (m.participant === user) userStarts++;
      else if (m.participant === partner) partnerStarts++;
    }
    lastTimestamp = currentTime;
  });
  return {
    [user]: userStarts,
    [partner]: partnerStarts
  };
}
function calculateAvgResponseTime(messages, user, partner) {
  const responseTimes = {
    [user]: [],
    [partner]: []
  };
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    if (prev.participant !== curr.participant) {
      const prevTime = parseTimestamp(prev.timestamp);
      const currTime = parseTimestamp(curr.timestamp);
      if (prevTime && currTime) {
        const diffMinutes = (currTime.getTime() - prevTime.getTime()) / (1e3 * 60);
        if (diffMinutes <= 24 * 60) {
          responseTimes[curr.participant].push(diffMinutes);
        }
      }
    }
  }
  return {
    [user]: responseTimes[user].length > 0 ? Math.round(responseTimes[user].reduce((a, b) => a + b, 0) / responseTimes[user].length) : 0,
    [partner]: responseTimes[partner].length > 0 ? Math.round(responseTimes[partner].reduce((a, b) => a + b, 0) / responseTimes[partner].length) : 0
  };
}
function parseTimestamp(timestamp) {
  try {
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
function calculateSentimentRatio(messages) {
  const positiveWords = [
    "\uC88B",
    "\uD589\uBCF5",
    "\uAC10\uC0AC",
    "\uC0AC\uB791",
    "\uCD5C\uACE0",
    "\uBA4B",
    "\uC608\uC058",
    "\uC6C3",
    "\u314E\u314E",
    "\u314B\u314B",
    "^^",
    "\u2665",
    "\u{1F495}"
  ];
  const negativeWords = [
    "\uC2EB",
    "\uD654",
    "\uC9DC\uC99D",
    "\uBBF8\uC6CC",
    "\uBCC4\uB85C",
    "\uC2EB\uC5B4",
    "\uC18D\uC0C1",
    "\uC2AC\uD504",
    "\uD798\uB4E4"
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
    negative: Number((negative / total).toFixed(2))
  };
}
function calculateTopKeywords(messages, aiKeywords = []) {
  const wordCount = {};
  const stopWords = /* @__PURE__ */ new Set([
    "\uADF8",
    "\uC800",
    "\uC774",
    "\uAC83",
    "\uC218",
    "\uB4F1",
    "\uB4E4",
    "\uBC0F",
    "\uB610\uB294",
    "\uADF8\uB9AC\uACE0",
    "\uC740",
    "\uB294",
    "\uC774",
    "\uAC00",
    "\uC744",
    "\uB97C",
    "\uC5D0",
    "\uC758",
    "\uC640",
    "\uACFC",
    "\uB3C4",
    "\uB9CC",
    "\uC694",
    "\uB124",
    "\uC9C0",
    "\u314B\u314B",
    "\u314E\u314E",
    "\u3160\u3160"
  ]);
  messages.forEach((m) => {
    const words = m.content.match(/[가-힣]{2,}/g) || [];
    words.forEach((word) => {
      if (!stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
  });
  aiKeywords.forEach((kw) => {
    wordCount[kw.word] = (wordCount[kw.word] || 0) + kw.count;
  });
  return Object.entries(wordCount).sort(([, a], [, b]) => b - a).slice(0, 10).map(([word, count]) => ({ word, count }));
}
function generateAffectionStats(messages, user, partner, aiAffectionKeywords = {}) {
  const affectionWords = ["\uC0AC\uB791", "\uC88B\uC544", "\uBCF4\uACE0\uC2F6", "\uADF8\uB9AC\uC6CC", "\uD589\uBCF5", "\uC18C\uC911"];
  const userStats = {};
  const partnerStats = {};
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
    [user]: Object.entries(userStats).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count),
    [partner]: Object.entries(partnerStats).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count)
  };
}
function processConversationData(messages, rawExtraction) {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const user = participants[0] || "\uC0AC\uC6A9\uC790";
  const partner = participants[1] || "\uC0C1\uB300\uBC29";
  const messageRatio = calculateMessageRatio(messages, user, partner);
  const avgMessageLength = calculateAvgLength(messages, user, partner);
  const timeDistribution = calculateTimeDistribution(messages);
  const emojiCount = calculateEmojiFrequency(messages, user, partner);
  const questionRatio = calculateQuestionRatio(messages, user, partner);
  const conversationStarters = calculateConversationStarters(messages, user, partner);
  const sentimentRatio = calculateSentimentRatio(messages);
  const avgResponseTime = calculateAvgResponseTime(messages, user, partner);
  const tikitakaScore = calculateTikitakaScore(
    messageRatio,
    questionRatio,
    emojiCount,
    avgResponseTime,
    [user, partner]
  );
  const preferences = {
    likes: (rawExtraction.preferences || []).filter((p) => p.type === "like").map((p) => p.content),
    dislikes: (rawExtraction.preferences || []).filter((p) => p.type === "dislike").map((p) => p.content)
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
    avgResponseTime
  };
}

// server/services/conversation-sampler.ts
import emojiRegex from "emoji-regex";
function getSamplesForAnalysis(messages) {
  return {
    // 최근 대화 (가장 중요)
    recent: messages.slice(-300),
    // 가장 긴 대화 교환 (깊은 소통)
    longestExchanges: getLongestConversations(messages, 15),
    // 감정적 대화 (긍정 + 부정)
    emotional: getMostEmotionalMessages(messages, 20),
    // 키워드 기반 샘플
    preferences: getMessagesWithKeywords(
      messages,
      ["\uC88B\uC544", "\uC2EB\uC5B4", "\uC0AC\uB791", "\uBBF8\uC6CC", "\uCD5C\uACE0", "\uBCC4\uB85C"],
      5
    ),
    appointments: getMessagesWithKeywords(
      messages,
      ["\uC57D\uC18D", "\uB9CC\uB098", "\uAC08\uB798", "\uC2DC\uAC04", "\uC5B8\uC81C", "\uC5B4\uB514"],
      5
    ),
    questions: getQuestions(messages, 15),
    // 랜덤 샘플 (편향 방지)
    random: getRandomSample(messages, 30),
    // 시간대별 샘플 (아침/점심/저녁/밤 각 5개)
    byTimeOfDay: getByTimeOfDay(messages, 5)
  };
}
function getLongestConversations(messages, count) {
  const conversations = [];
  let currentConv = [];
  let lastTime = null;
  for (const msg of messages) {
    const msgTime = new Date(msg.timestamp);
    const timeDiff = lastTime ? (msgTime.getTime() - lastTime.getTime()) / 1e3 / 60 : 0;
    if (timeDiff < 10) {
      currentConv.push(msg);
    } else {
      if (currentConv.length > 0) {
        conversations.push([...currentConv]);
      }
      currentConv = [msg];
    }
    lastTime = msgTime;
  }
  if (currentConv.length > 0) {
    conversations.push(currentConv);
  }
  return conversations.sort((a, b) => b.length - a.length).slice(0, count).flat();
}
function getMostEmotionalMessages(messages, count) {
  const emotionalKeywords = [
    "\uC0AC\uB791",
    "\uD589\uBCF5",
    "\uC2AC\uD504",
    "\uD654\uB098",
    "\uBCF4\uACE0\uC2F6",
    "\uADF8\uB9AC\uC6CC",
    "!!!",
    "\u3160\u3160",
    "\u315C\u315C",
    "\u314E\u314E",
    "\u314B\u314B\u314B",
    "\u314B\u314B",
    "\uC88B\uC544",
    "\uC2EB\uC5B4",
    "\uBBF8\uC548",
    "\uACE0\uB9C8\uC6CC",
    "\uAC10\uC0AC",
    "\uCD95\uD558"
  ];
  const regex = emojiRegex();
  const scored = messages.map((m) => {
    let score = 0;
    emotionalKeywords.forEach((k) => {
      if (m.content.includes(k)) score += 2;
    });
    const emojiMatches = m.content.match(regex) || [];
    score += Math.min(emojiMatches.length * 3, 15);
    score += (m.content.match(/[!?]/g) || []).length;
    return { message: m, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, count).map((item) => item.message);
}
function getMessagesWithKeywords(messages, keywords, perKeyword) {
  const result = [];
  for (const keyword of keywords) {
    const matching = messages.filter(
      (m) => m.content.toLowerCase().includes(keyword.toLowerCase())
    );
    result.push(...matching.slice(-perKeyword));
  }
  const unique = Array.from(new Map(
    result.map((m) => [m.timestamp + m.content, m])
  ).values());
  return unique;
}
function getQuestions(messages, count) {
  const questions = messages.filter(
    (m) => m.content.includes("?") || m.content.includes("?") || /\b(뭐|왜|어디|언제|누가|어떻게|무엇)\b/.test(m.content)
  );
  return questions.slice(-count);
}
function getRandomSample(messages, count) {
  if (messages.length <= count) return messages;
  const result = [];
  const indices = /* @__PURE__ */ new Set();
  while (indices.size < count) {
    const randomIndex = Math.floor(Math.random() * messages.length);
    if (!indices.has(randomIndex)) {
      indices.add(randomIndex);
      result.push(messages[randomIndex]);
    }
  }
  return result.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
function getByTimeOfDay(messages, perPeriod) {
  const periods = {
    morning: [],
    // 6-12시
    afternoon: [],
    // 12-18시
    evening: [],
    // 18-22시
    night: []
    // 22-6시
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
  const result = [];
  Object.values(periods).forEach((periodMessages) => {
    result.push(...periodMessages.slice(-perPeriod));
  });
  return result;
}
function formatSamplesForAI(samples) {
  let formatted = "";
  if (samples.recent.length > 0) {
    formatted += "=== \uCD5C\uADFC \uB300\uD654 (\uAC00\uC7A5 \uC911\uC694) ===\n";
    formatted += samples.recent.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.longestExchanges.length > 0) {
    formatted += "=== \uAE4A\uC740 \uB300\uD654 \uAD50\uD658 ===\n";
    formatted += samples.longestExchanges.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.emotional.length > 0) {
    formatted += "=== \uAC10\uC815\uC801\uC778 \uC21C\uAC04\uB4E4 ===\n";
    formatted += samples.emotional.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.preferences.length > 0) {
    formatted += "=== \uC120\uD638\uB3C4 \uC5B8\uAE09 ===\n";
    formatted += samples.preferences.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.appointments.length > 0) {
    formatted += "=== \uC57D\uC18D/\uC77C\uC815 ===\n";
    formatted += samples.appointments.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.questions.length > 0) {
    formatted += "=== \uC9C8\uBB38\uB4E4 ===\n";
    formatted += samples.questions.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.byTimeOfDay.length > 0) {
    formatted += "=== \uC2DC\uAC04\uB300\uBCC4 \uC0D8\uD50C ===\n";
    formatted += samples.byTimeOfDay.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
    formatted += "\n\n";
  }
  if (samples.random.length > 0) {
    formatted += "=== \uB79C\uB364 \uC0D8\uD50C (\uD3B8\uD5A5 \uBC29\uC9C0) ===\n";
    formatted += samples.random.map(
      (m) => `${m.participant}: ${m.content}`
    ).join("\n");
  }
  return formatted;
}

// server/services/anthropic.ts
var DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";
var anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ""
});
function parseJSON(response) {
  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    console.error("JSON \uD30C\uC2F1 \uC2E4\uD328");
    return {};
  }
}
async function analyzeConversation(messages, stats, primaryRelationship = "\uCE5C\uAD6C", secondaryRelationships = []) {
  const participants = Array.from(new Set(messages.map((m) => m.participant)));
  const userName = participants[0] || "\uC0AC\uC6A9\uC790";
  const partnerName = participants[1] || "\uC0C1\uB300\uBC29";
  const relationshipContext = secondaryRelationships.length > 0 ? `${primaryRelationship} (\uC8FC\uC694) + ${secondaryRelationships.join(", ")} (\uBD80\uAC00\uC801)` : primaryRelationship;
  console.log("\n======== 4\uB2E8\uACC4 \uBD84\uC11D \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 ========");
  console.log(`\uAD00\uACC4: ${relationshipContext}, \uBA54\uC2DC\uC9C0: ${messages.length}\uAC1C
`);
  const samples = getSamplesForAnalysis(messages);
  const formattedSamples = formatSamplesForAI(samples);
  console.log(`\uC0D8\uD50C \uCD94\uCD9C \uC644\uB8CC:`);
  console.log(`  - \uCD5C\uADFC \uB300\uD654: ${samples.recent.length}\uAC1C`);
  console.log(`  - \uAE4A\uC740 \uB300\uD654: ${samples.longestExchanges.length}\uAC1C`);
  console.log(`  - \uAC10\uC815\uC801 \uC21C\uAC04: ${samples.emotional.length}\uAC1C`);
  console.log(`  - \uD0A4\uC6CC\uB4DC \uAE30\uBC18: ${samples.preferences.length + samples.appointments.length + samples.questions.length}\uAC1C`);
  console.log(`  - \uC2DC\uAC04\uB300\uBCC4: ${samples.byTimeOfDay.length}\uAC1C`);
  console.log(`  - \uB79C\uB364: ${samples.random.length}\uAC1C
`);
  console.log("Step 1: AI \uC815\uBCF4 \uCD94\uCD9C \uC911...");
  const extractionResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 4e3,
    system: `\uB2F9\uC2E0\uC740 \uC815\uBCF4 \uCD94\uCD9C \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uB300\uD654\uC5D0\uC11C \uB2E4\uC74C \uC815\uBCF4\uB9CC \uCC3E\uC544\uC11C \uB098\uC5F4\uD558\uC138\uC694:
1. \uC0C1\uB300\uBC29\uC774 \uBA85\uC2DC\uC801\uC73C\uB85C "\uC88B\uC544\uD55C\uB2E4"\uACE0 \uB9D0\uD55C \uAC83\uB4E4
2. \uC0C1\uB300\uBC29\uC774 \uBA85\uC2DC\uC801\uC73C\uB85C "\uC2EB\uC5B4\uD55C\uB2E4"\uACE0 \uB9D0\uD55C \uAC83\uB4E4  
3. \uB0A0\uC9DC\uAC00 \uC5B8\uAE09\uB41C \uC57D\uC18D\uC774\uB098 \uC774\uBCA4\uD2B8
4. "\uC0AC\uB791\uD574", "\uBCF4\uACE0\uC2F6\uC5B4", "\uACE0\uB9C8\uC6CC" \uB4F1 \uC560\uC815 \uD45C\uD604 \uBB38\uC7A5\uB4E4

**\uC911\uC694: \uD574\uC11D\uD558\uC9C0 \uB9D0\uACE0, \uCC3E\uC740 \uB0B4\uC6A9\uB9CC JSON\uC73C\uB85C \uCD9C\uB825\uD558\uC138\uC694.**`,
    messages: [{
      role: "user",
      content: `${userName}\uACFC ${partnerName}\uC758 \uB300\uD654 \uC0D8\uD50C (\uCD1D ${messages.length}\uAC1C \uC911 \uB300\uD45C \uC0D8\uD50C):

${formattedSamples}

\uB2E4\uC74C \uD615\uC2DD\uC758 JSON\uC73C\uB85C \uC751\uB2F5\uD558\uC138\uC694:
\`\`\`json
{
  "preferences": [
    {"type": "like", "content": "\uC88B\uC544\uD55C\uB2E4\uACE0 \uC5B8\uAE09\uD55C \uAC83"},
    {"type": "dislike", "content": "\uC2EB\uC5B4\uD55C\uB2E4\uACE0 \uC5B8\uAE09\uD55C \uAC83"}
  ],
  "importantDates": [
    {"date": "YYYY-MM-DD", "content": "\uC57D\uC18D/\uC774\uBCA4\uD2B8"}
  ],
  "topKeywords": [
    {"word": "\uC790\uC8FC \uB098\uC628 \uB2E8\uC5B4", "count": \uCD94\uC815 \uBE48\uB3C4}
  ]
}
\`\`\``
    }]
  });
  const rawExtraction = parseJSON(extractionResponse);
  console.log("Step 1 \uC644\uB8CC \u2713");
  console.log("Step 2: \uB370\uC774\uD130 \uCC98\uB9AC \uBC0F \uACC4\uC0B0 \uC911...");
  const processedData = processConversationData(messages, rawExtraction);
  console.log("Step 2 \uC644\uB8CC \u2713");
  console.log(`  - \uD2F0\uD0A4\uD0C0\uCE74 \uC9C0\uC218: ${processedData.tikitakaScore}\uC810`);
  console.log(`  - \uBA54\uC2DC\uC9C0 \uBE44\uC728: ${userName} ${(processedData.messageRatio[userName] * 100).toFixed(0)}% / ${partnerName} ${(processedData.messageRatio[partnerName] * 100).toFixed(0)}%`);
  console.log("Step 3: \uC2EC\uCE35 \uBD84\uC11D \uC911...");
  const analysisResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 8e3,
    system: `\uB2F9\uC2E0\uC740 10\uB144 \uACBD\uB825\uC758 \uAD00\uACC4 \uC2EC\uB9AC \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. 
\uC8FC\uC5B4\uC9C4 \uC815\uB7C9 \uB370\uC774\uD130\uC640 \uB300\uD654 \uC0D8\uD50C\uC744 \uBAA8\uB450 \uD65C\uC6A9\uD558\uC5EC 
\uB450 \uC0AC\uB78C\uC758 \uAD00\uACC4\uB97C \uAE4A\uC774 \uC788\uAC8C \uBD84\uC11D\uD558\uC138\uC694.

\uB2E8\uC21C\uD55C \uD45C\uBA74\uC801 \uBD84\uC11D\uC774 \uC544\uB2CC, \uB300\uD654 \uC18D \uC228\uACA8\uC9C4 \uD328\uD134, 
\uB9D0\uD558\uC9C0 \uC54A\uC740 \uAC10\uC815, \uAD00\uACC4\uC758 \uBCC0\uD654 \uD750\uB984\uC744 \uD3EC\uCC29\uD558\uC138\uC694.`,
    messages: [{
      role: "user",
      content: `${userName}\uB2D8\uACFC ${partnerName}\uB2D8(${relationshipContext})\uC758 \uB300\uD654 \uBD84\uC11D:

===== 1. \uC815\uB7C9 \uB370\uC774\uD130 =====
${JSON.stringify(processedData, null, 2)}

===== 2. \uCD5C\uADFC \uB300\uD654 (\uCD5C\uADFC 300\uAC1C) =====
${samples.recent.map(
        (m) => `[${m.timestamp}] ${m.participant}: ${m.content}`
      ).join("\n")}

===== 3. \uAC00\uC7A5 \uAE34 \uB300\uD654 \uAD50\uD658 (\uAE4A\uC740 \uC18C\uD1B5 \uC21C\uAC04) =====
${samples.longestExchanges.map(
        (m) => `[${m.timestamp}] ${m.participant}: ${m.content}`
      ).join("\n")}

===== 4. \uAC10\uC815\uC801 \uB300\uD654 =====
${samples.emotional.map(
        (m) => `[${m.timestamp}] ${m.participant}: ${m.content}`
      ).join("\n")}

===== 5. \uCDE8\uD5A5/\uC120\uD638 \uAD00\uB828 \uB300\uD654 =====
${samples.preferences.map(
        (m) => `[${m.timestamp}] ${m.participant}: ${m.content}`
      ).join("\n")}

===== 6. \uC9C8\uBB38-\uB2F5\uBCC0 \uD328\uD134 =====
${samples.questions.map(
        (m) => `[${m.timestamp}] ${m.participant}: ${m.content}`
      ).join("\n")}

**\uBD84\uC11D \uC694\uAD6C\uC0AC\uD56D:**
1. \uD45C\uBA74\uC801 \uD1B5\uACC4\uB97C \uB118\uC5B4, \uB300\uD654 \uC18D \uC9C4\uC9DC \uC758\uBBF8\uB97C \uCC3E\uC73C\uC138\uC694
2. \uAD6C\uCCB4\uC801\uC778 \uB300\uD654 \uC608\uC2DC\uB97C \uC778\uC6A9\uD558\uBA70 \uBD84\uC11D\uD558\uC138\uC694
3. \uC2DC\uAC04\uC5D0 \uB530\uB978 \uBCC0\uD654\uB098 \uD328\uD134\uC744 \uD3EC\uCC29\uD558\uC138\uC694
4. \uB9D0\uD558\uC9C0 \uC54A\uC740 \uAC83(\uCE68\uBB35, \uD68C\uD53C)\uB3C4 \uBD84\uC11D\uD558\uC138\uC694
5. \uB450 \uC0AC\uB78C\uB9CC\uC758 \uB3C5\uD2B9\uD55C \uC18C\uD1B5 \uBC29\uC2DD\uC744 \uBC1C\uACAC\uD558\uC138\uC694

\uB2E4\uC74C \uD615\uC2DD\uC758 JSON\uC73C\uB85C \uC0C1\uC138\uD788 \uC791\uC131\uD558\uC138\uC694:
\`\`\`json
{
  "communicationStyle": {
    "${userName}": {"type": "\uACBD\uCCAD\uD615/\uC8FC\uB3C4\uD615", "traits": ["\uD2B9\uC9D51", "\uD2B9\uC9D52"]},
    "${partnerName}": {"type": "\uACBD\uCCAD\uD615/\uC8FC\uB3C4\uD615", "traits": ["\uD2B9\uC9D51", "\uD2B9\uC9D52"]}
  },
  "emotionalExpression": {
    "emojiDependency": {"${userName}": "high/medium/low", "${partnerName}": "high/medium/low"},
    "emotionalAsymmetry": "\uD55C \uBB38\uC7A5 \uBD84\uC11D"
  },
  "relationshipDynamics": {
    "powerBalance": "\uADE0\uD615\uC801/\uD55C\uCABD \uC8FC\uB3C4",
    "intimacyTrend": "increasing/stable/decreasing"
  },
  "specialPatterns": {
    "recurringTopics": ["\uC8FC\uC81C1", "\uC8FC\uC81C2"],
    "happyMoments": [{"timestamp": "\uB0A0\uC9DC", "context": "\uB9E5\uB77D"}]
  },
  "partnerStatus": {
    "currentState": "\uCD5C\uADFC \uC0C1\uB300\uBC29 \uC0C1\uD0DC \uCD94\uB860",
    "suggestion": "\uC870\uC5B8"
  }
}
\`\`\``
    }]
  });
  const deepAnalysis = parseJSON(analysisResponse);
  console.log("Step 3 \uC644\uB8CC \u2713");
  console.log("Step 4: \uC778\uC0AC\uC774\uD2B8 \uC0DD\uC131 \uC911...");
  const reportResponse = await anthropic.messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 3e3,
    system: `\uB2F9\uC2E0\uC740 Maltcha\uC758 AI \uBE44\uC11C 'Tea'\uC785\uB2C8\uB2E4.
\uBD84\uC11D \uACB0\uACFC\uB97C \uBC14\uD0D5\uC73C\uB85C \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC870\uC5B8\uC744 \uC81C\uACF5\uD558\uC138\uC694.

\uC77C\uBC18\uB860\uC774 \uC544\uB2CC, \uC774 \uB450 \uC0AC\uB78C\uB9CC\uC744 \uC704\uD55C \uB9DE\uCDA4 \uC870\uC5B8\uC744 \uD574\uC8FC\uC138\uC694.`,
    messages: [{
      role: "user",
      content: `${userName}\uB2D8\uC744 \uC704\uD55C \uB9AC\uD3EC\uD2B8\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694.

**\uC815\uB7C9 \uB370\uC774\uD130:**
${JSON.stringify(processedData, null, 2)}

**\uC2EC\uCE35 \uBD84\uC11D:**
${JSON.stringify(deepAnalysis, null, 2)}

**\uB300\uD45C \uB300\uD654 \uC608\uC2DC:**
${samples.recent.slice(0, 30).map(
        (m) => `${m.participant}: ${m.content}`
      ).join("\n")}

**\uC694\uAD6C\uC0AC\uD56D:**
- \uCD5C\uC18C 6\uAC1C\uC758 \uC778\uC0AC\uC774\uD2B8 \uC791\uC131
- \uAC01 \uC778\uC0AC\uC774\uD2B8\uB294 \uAD6C\uCCB4\uC801\uC778 \uB300\uD654 \uC608\uC2DC \uC778\uC6A9
- \uC2E4\uD589 \uAC00\uB2A5\uD55C \uC870\uC5B8 \uD3EC\uD568
- \uAE4A\uC774 \uC788\uACE0 \uD1B5\uCC30\uB825 \uC788\uB294 \uB0B4\uC6A9

\uB2E4\uC74C \uD615\uC2DD\uC758 JSON \uBC30\uC5F4\uB85C \uC791\uC131\uD558\uC138\uC694:
\`\`\`json
[
  {
    "title": "\u{1F4AC} \uD2F0\uD0A4\uD0C0\uCE74 \uC9C0\uC218: ${processedData.tikitakaScore}\uC810",
    "description": "\uAD6C\uCCB4\uC801\uC778 \uC124\uBA85\uACFC \uCE6D\uCC2C. \uC2E4\uC81C \uB300\uD654 \uD328\uD134\uC744 \uC608\uB85C \uB4E4\uAE30"
  },
  {
    "title": "\u{1F3AD} ${partnerName}\uB2D8\uC758 \uB300\uD654 \uC2A4\uD0C0\uC77C",
    "description": "\uD0C0\uC785\uACFC \uD2B9\uC9D5\uC744 \uAD6C\uCCB4\uC801\uC73C\uB85C \uC124\uBA85. \uB300\uD654 \uC0D8\uD50C\uC5D0\uC11C \uC608\uC2DC \uC778\uC6A9"
  },
  {
    "title": "\u{1F4DD} ${partnerName}\uB2D8\uC758 \uCDE8\uD5A5 \uB178\uD2B8",
    "description": "\uC88B\uC544\uD558\uB294 \uAC83/\uC2EB\uC5B4\uD558\uB294 \uAC83\uC744 \uB300\uD654 \uC0D8\uD50C \uAE30\uBC18\uC73C\uB85C \uAD6C\uCCB4\uC801\uC73C\uB85C"
  },
  {
    "title": "\u23F0 \uB300\uD654 \uC2DC\uAC04\uB300 \uBD84\uC11D",
    "description": "\uC8FC\uB85C \uC5B8\uC81C \uB300\uD654\uD558\uB294\uC9C0, \uADF8 \uC2DC\uAC04\uC758 \uC758\uBBF8"
  },
  {
    "title": "\u{1F4A1} \uAD00\uACC4 \uAC1C\uC120 \uD3EC\uC778\uD2B8",
    "description": "\uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uD589 \uAC00\uB2A5\uD55C \uC870\uC5B8"
  },
  {
    "title": "\u{1F4AD} Tea\uC758 \uC885\uD569 \uC870\uC5B8",
    "description": "\uD604\uC7AC \uAD00\uACC4 \uC0C1\uD669 \uBD84\uC11D\uACFC \uC2E4\uC6A9\uC801 \uC81C\uC548. \uB530\uB73B\uD558\uACE0 \uAD6C\uCCB4\uC801\uC73C\uB85C"
  }
]
\`\`\``
    }]
  });
  const insightsArray = parseJSON(reportResponse);
  const insights = Array.isArray(insightsArray) ? insightsArray.slice(0, 6) : [
    {
      title: `\u{1F4AC} \uD2F0\uD0A4\uD0C0\uCE74 \uC9C0\uC218: ${processedData.tikitakaScore}\uC810`,
      description: `${userName}\uB2D8\uACFC ${partnerName}\uB2D8\uC758 ${processedData.totalMessages}\uAC1C \uBA54\uC2DC\uC9C0\uB97C \uBD84\uC11D\uD588\uC5B4\uC694!`
    },
    {
      title: "\u{1F3AD} \uB300\uD654 \uC2A4\uD0C0\uC77C",
      description: "\uC11C\uB85C \uB2E4\uB978 \uC2A4\uD0C0\uC77C\uC774\uC9C0\uB9CC \uC798 \uC5B4\uC6B8\uB824\uC694."
    },
    {
      title: "\u{1F4DD} \uD2B9\uBCC4\uD55C \uC21C\uAC04\uB4E4",
      description: "\uB300\uD654 \uC18D\uC5D0\uC11C \uC9C4\uC2EC\uC73C\uB85C \uC18C\uD1B5\uD588\uB358 \uC21C\uAC04\uB4E4\uC774 \uC788\uC5B4\uC694."
    },
    {
      title: "\u23F0 \uB300\uD654 \uC2DC\uAC04\uB300",
      description: "\uB450 \uBD84\uC758 \uB300\uD654 \uD328\uD134\uC5D0\uC11C \uC758\uBBF8 \uC788\uB294 \uC2DC\uAC04\uB300\uB97C \uBC1C\uACAC\uD588\uC5B4\uC694."
    },
    {
      title: "\u{1F4A1} \uAD00\uACC4 \uAC1C\uC120 \uD3EC\uC778\uD2B8",
      description: "\uB354 \uB098\uC740 \uC18C\uD1B5\uC744 \uC704\uD55C \uAD6C\uCCB4\uC801\uC778 \uC81C\uC548\uC744 \uC900\uBE44\uD588\uC5B4\uC694."
    },
    {
      title: "\u{1F4AD} Tea\uC758 \uC870\uC5B8",
      description: `${relationshipContext} \uAD00\uACC4\uC5D0\uC11C \uC9C0\uAE08\uCC98\uB7FC \uACC4\uC18D \uC18C\uD1B5\uD558\uBA74 \uB354 \uAE4A\uC740 \uAD00\uACC4\uAC00 \uB420 \uAC70\uC608\uC694.`
    }
  ];
  console.log("Step 4 \uC644\uB8CC \u2713");
  console.log("======== \uBD84\uC11D \uC644\uB8CC ========\n");
  const sentimentScore = Math.round(
    (processedData.sentimentRatio.positive * 100 + processedData.sentimentRatio.neutral * 50) / (processedData.sentimentRatio.positive + processedData.sentimentRatio.neutral + processedData.sentimentRatio.negative)
  );
  const sentimentDistribution = [
    {
      name: "\uAE0D\uC815\uC801",
      value: Math.round(processedData.sentimentRatio.positive * 100)
    },
    {
      name: "\uC911\uB9BD\uC801",
      value: Math.round(processedData.sentimentRatio.neutral * 100)
    },
    {
      name: "\uBD80\uC815\uC801",
      value: Math.round(processedData.sentimentRatio.negative * 100)
    }
  ];
  return {
    sentimentScore,
    sentimentDistribution,
    insights: insights.slice(0, 4),
    processedData,
    deepAnalysis
  };
}

// server/routes.ts
import { nanoid } from "nanoid";
function registerRoutes(app2) {
  app2.post("/api/analyze", async (req, res) => {
    try {
      const {
        content,
        primaryRelationship = "\uCE5C\uAD6C",
        secondaryRelationships = []
      } = req.body;
      if (!content) {
        return res.status(400).json({ message: "No content provided" });
      }
      const analysis = await storage.createAnalysis({
        fileName: "conversation.txt",
        fileSize: content.length
      });
      res.json({ analysisId: analysis.id });
      processAnalysis(
        analysis.id,
        content,
        primaryRelationship,
        secondaryRelationships
      ).catch((error) => {
        console.error("Analysis error:", error);
        storage.updateAnalysis(analysis.id, {
          status: "failed",
          error: error.message
        });
      });
    } catch (error) {
      console.error("API error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  app2.get("/api/analysis/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}
async function processAnalysis(analysisId, fileContent, primaryRelationship = "\uCE5C\uAD6C", secondaryRelationships = []) {
  const parsed = parseKakaoTalkFile(fileContent);
  const stats = calculateStats(parsed.messages, parsed.participants);
  const chartData = generateChartData(parsed.messages, parsed.participants);
  await storage.updateAnalysis(analysisId, {
    messages: parsed.messages,
    stats,
    charts: {
      ...chartData,
      sentimentDistribution: []
    }
  });
  const aiAnalysis = await analyzeConversation(
    parsed.messages,
    stats,
    primaryRelationship,
    secondaryRelationships
  );
  await storage.updateAnalysis(analysisId, {
    status: "completed",
    stats: {
      ...stats,
      sentimentScore: aiAnalysis.sentimentScore
    },
    charts: {
      ...chartData,
      sentimentDistribution: aiAnalysis.sentimentDistribution
    },
    insights: aiAnalysis.insights,
    stage1Data: aiAnalysis.stage1Data,
    stage2Data: aiAnalysis.stage2Data
  });
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid as nanoid2 } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid2()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(
  express2.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express2.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
