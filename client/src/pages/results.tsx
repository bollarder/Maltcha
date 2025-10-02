import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Home, Share2, Lightbulb, TrendingUp, MessageCircle, Heart, Calendar, AlertCircle, Sparkles, Clock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalysisResult } from "@shared/schema";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const analysisId = params?.id;

  const { data: analysis, isLoading } = useQuery<AnalysisResult>({
    queryKey: ['/api/analysis', analysisId],
    enabled: !!analysisId,
  });

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/share/${analysisId}`, {});
      return res.json();
    },
    onSuccess: async (data) => {
      const shareUrl = `${window.location.origin}${data.shareUrl}`;

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "✓ 링크가 복사되었어요!",
          description: "24시간 동안 유효합니다",
        });
      } catch (err) {
        toast({
          title: "링크가 생성되었습니다",
          description: shareUrl,
        });
      }
      setIsSharing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "공유 링크 생성 실패",
        description: error.message,
        variant: "destructive",
      });
      setIsSharing(false);
    },
  });

  const handleShare = () => {
    setIsSharing(true);
    shareMutation.mutate();
  };

  if (isLoading || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (analysis.status !== 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">분석이 아직 완료되지 않았습니다.</p>
          <Button 
            onClick={() => setLocation(`/loading/${analysisId}`)} 
            className="mt-4"
          >
            분석 화면으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const { stats, insights, stage1Data, stage2Data } = analysis;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Maltcha 인사이트</h1>
              <p className="text-muted-foreground">{analysis.fileName}</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Button variant="outline" onClick={() => setLocation('/')} data-testid="button-home">
                <Home className="w-5 h-5 mr-2" />
                홈
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-total-messages">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">총 메시지</span>
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="text-total-messages">{stats?.totalMessages.toLocaleString()}</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.05s' }} data-testid="card-participants">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">참여자</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="text-participants">{stats?.participants}</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.1s' }} data-testid="card-energy-score">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">소통 에너지 점수</span>
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="text-energy-score">{stats?.sentimentScore}점</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.15s' }} data-testid="card-sentiment-score">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">감정 점수</span>
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="text-sentiment-score">{stats?.sentimentScore}%</p>
          </div>
        </div>

        {/* Stage 1: 기억해야 할 정보 */}
        {stage1Data && (
          <div className="space-y-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center" data-testid="heading-stage1">
              <TrendingUp className="w-6 h-6 mr-2 text-primary" />
              기억해야 할 정보
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 취향 노트 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-preferences">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-primary" />
                  취향 노트
                </h3>
                {stage1Data.keyInfo?.preferences && stage1Data.keyInfo.preferences.length > 0 ? (
                  <div className="space-y-3">
                    {stage1Data.keyInfo.preferences.map((pref: any, idx: number) => (
                      <div key={idx} className="flex items-start space-x-3 p-3 bg-accent/20 rounded-lg" data-testid={`preference-${idx}`}>
                        <span className="text-xl flex-shrink-0">
                          {pref.type === 'like' ? '👍' : '👎'}
                        </span>
                        <p className="text-sm text-foreground">{pref.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">취향 정보가 없습니다.</p>
                )}
              </div>

              {/* 중요한 날들 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-important-dates">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-primary" />
                  중요한 날들
                </h3>
                {stage1Data.keyInfo?.importantDates && stage1Data.keyInfo.importantDates.length > 0 ? (
                  <div className="space-y-3">
                    {stage1Data.keyInfo.importantDates.map((date: any, idx: number) => (
                      <div key={idx} className="p-3 bg-accent/20 rounded-lg" data-testid={`important-date-${idx}`}>
                        <p className="text-sm font-medium text-primary mb-1">{date.date}</p>
                        <p className="text-sm text-foreground">{date.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">중요한 날짜 정보가 없습니다.</p>
                )}
              </div>

              {/* 주요 키워드 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-keywords">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2 text-primary" />
                  주요 키워드
                </h3>
                {stage1Data.basicStats?.topKeywords && stage1Data.basicStats.topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {stage1Data.basicStats.topKeywords.slice(0, 10).map((keyword: any, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm" data-testid={`keyword-${idx}`}>
                        {keyword.word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">키워드 정보가 없습니다.</p>
                )}
              </div>

              {/* 시간대별 활동 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-time-distribution">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary" />
                  시간대별 활동
                </h3>
                {stage1Data.basicStats?.timeDistribution && stage1Data.basicStats.timeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stage1Data.basicStats.timeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">시간대별 활동 정보가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: 심층 분석 결과 */}
        {stage2Data && (
          <div className="space-y-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center" data-testid="heading-stage2">
              <MessageCircle className="w-6 h-6 mr-2 text-primary" />
              심층 분석
            </h2>

            {/* 대화 스타일 */}
            {stage2Data.communicationStyle && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-communication-style">
                <h3 className="text-lg font-semibold text-foreground mb-4">🎭 대화 스타일</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(stage2Data.communicationStyle).map(([name, style]: [string, any]) => (
                    <div key={name} className="p-4 bg-accent/20 rounded-lg" data-testid={`comm-style-${name}`}>
                      <h4 className="font-medium text-foreground mb-2">{name}</h4>
                      <p className="text-sm text-primary mb-2">타입: {style.type}</p>
                      <ul className="space-y-1">
                        {style.traits?.map((trait: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">• {trait}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 언어 패턴 */}
            {stage2Data.languagePattern && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-language-pattern">
                <h3 className="text-lg font-semibold text-foreground mb-4">💬 언어 패턴 분석</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {stage2Data.languagePattern.apologyFrequency && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">사과 표현 빈도</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(stage2Data.languagePattern.apologyFrequency).map(([name, freq]) => (
                          <div key={name} className="flex justify-between">
                            <span className="text-muted-foreground">{name}:</span>
                            <span className="text-foreground font-medium">{String(freq)}회</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage2Data.languagePattern.gratitudeFrequency && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">감사 표현 빈도</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(stage2Data.languagePattern.gratitudeFrequency).map(([name, freq]) => (
                          <div key={name} className="flex justify-between">
                            <span className="text-muted-foreground">{name}:</span>
                            <span className="text-foreground font-medium">{String(freq)}회</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {stage2Data.languagePattern.indirectExpression && stage2Data.languagePattern.indirectExpression.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-3 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      🔍 숨은 의미 파악
                    </h4>
                    <div className="space-y-3">
                      {stage2Data.languagePattern.indirectExpression.map((expr: any, idx: number) => (
                        <div key={idx} className="p-4 bg-accent/30 rounded-lg border-l-4 border-primary" data-testid={`indirect-expr-${idx}`}>
                          <p className="text-sm font-medium text-foreground mb-1">{expr.speaker}: "{expr.example}"</p>
                          <p className="text-sm text-muted-foreground">→ 숨은 의미: {expr.meaning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 감정 표현 */}
            {stage2Data.emotionalExpression && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-emotional-expression">
                <h3 className="text-lg font-semibold text-foreground mb-4">😊 감정 표현 방식</h3>

                {stage2Data.emotionalExpression.emojiDependency && (
                  <div className="mb-4 p-4 bg-accent/20 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">이모티콘 의존도</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(stage2Data.emotionalExpression.emojiDependency).map(([name, level]) => (
                        <div key={name} className="flex justify-between">
                          <span className="text-muted-foreground">{name}:</span>
                          <span className="text-foreground font-medium">
                            {level === 'high' ? '높음 🔥' : level === 'medium' ? '보통 😊' : '낮음 😐'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stage2Data.emotionalExpression.emotionalAsymmetry && (
                  <div className="p-4 bg-accent/30 rounded-lg">
                    <h4 className="font-medium text-foreground mb-2">감정의 비대칭성</h4>
                    <p className="text-sm text-muted-foreground">{stage2Data.emotionalExpression.emotionalAsymmetry}</p>
                  </div>
                )}
              </div>
            )}

            {/* 관계 역학 */}
            {stage2Data.relationshipDynamics && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-relationship-dynamics">
                <h3 className="text-lg font-semibold text-foreground mb-4">⚖️ 관계 역학</h3>

                <div className="space-y-4">
                  {stage2Data.relationshipDynamics.powerBalance && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">주도권 분포</h4>
                      <p className="text-sm text-muted-foreground">{stage2Data.relationshipDynamics.powerBalance}</p>
                    </div>
                  )}

                  {stage2Data.relationshipDynamics.responsePattern && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">응답 패턴</h4>
                      <div className="space-y-1 text-sm">
                        {Object.entries(stage2Data.relationshipDynamics.responsePattern).map(([name, pattern]) => (
                          <div key={name}>
                            <span className="text-muted-foreground">{name}:</span> {String(pattern)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage2Data.relationshipDynamics.intimacyTrend && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">친밀도 변화 추이</h4>
                      <p className="text-sm text-foreground">
                        {stage2Data.relationshipDynamics.intimacyTrend === 'increasing' ? '📈 증가 중' :
                         stage2Data.relationshipDynamics.intimacyTrend === 'stable' ? '➡️ 안정적' : '📉 감소 중'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 특이 패턴 */}
            {stage2Data.specialPatterns && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid="card-special-patterns">
                <h3 className="text-lg font-semibold text-foreground mb-4">🔎 특이 패턴 발견</h3>

                <div className="space-y-6">
                  {stage2Data.specialPatterns.recurringTopics && stage2Data.specialPatterns.recurringTopics.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">반복되는 주제</h4>
                      <div className="flex flex-wrap gap-2">
                        {stage2Data.specialPatterns.recurringTopics.map((topic: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage2Data.specialPatterns.avoidedTopics && stage2Data.specialPatterns.avoidedTopics.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">회피하는 주제</h4>
                      <div className="flex flex-wrap gap-2">
                        {stage2Data.specialPatterns.avoidedTopics.map((topic: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-destructive/10 text-destructive rounded-full text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage2Data.specialPatterns.happyMoments && stage2Data.specialPatterns.happyMoments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-3">😄 가장 행복했던 순간들</h4>
                      <div className="space-y-2">
                        {stage2Data.specialPatterns.happyMoments.map((moment: any, idx: number) => (
                          <div key={idx} className="p-3 bg-green-500/10 rounded-lg border-l-4 border-green-500" data-testid={`happy-moment-${idx}`}>
                            <p className="text-xs text-muted-foreground mb-1">{moment.timestamp}</p>
                            <p className="text-sm text-foreground">{moment.context}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage2Data.specialPatterns.tenseMoments && stage2Data.specialPatterns.tenseMoments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-3">😰 긴장된 순간들</h4>
                      <div className="space-y-2">
                        {stage2Data.specialPatterns.tenseMoments.map((moment: any, idx: number) => (
                          <div key={idx} className="p-3 bg-yellow-500/10 rounded-lg border-l-4 border-yellow-500" data-testid={`tense-moment-${idx}`}>
                            <p className="text-xs text-muted-foreground mb-1">{moment.timestamp}</p>
                            <p className="text-sm text-foreground">{moment.context}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상대방 현재 상태 */}
            {stage2Data.partnerStatus && (
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl shadow-lg p-6 fade-in-up border-2 border-primary/20" data-testid="card-partner-status">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  💭 Tea의 상대방 상태 분석
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-foreground mb-2">현재 상대방의 상태</h4>
                    <p className="text-sm text-muted-foreground">{stage2Data.partnerStatus.currentState}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-2">💡 제안</h4>
                    <p className="text-sm text-muted-foreground">{stage2Data.partnerStatus.suggestion}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 3: Tea의 조언 */}
        {insights && insights.length > 0 && (
          <div className="space-y-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center" data-testid="heading-stage3">
              <Lightbulb className="w-6 h-6 mr-2 text-primary" />
              Tea의 Maltcha 인사이트
            </h2>
            
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" data-testid={`insight-card-${index}`}>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary-foreground">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">{insight.title}</h3>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Share Section */}
        <div className="bg-primary/10 rounded-2xl p-8 text-center fade-in-up mt-8" data-testid="section-share">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-foreground mb-3">
              📱 링크로 공유하기
            </h3>
            <p className="text-muted-foreground mb-6">
              친구에게 내 소통 스타일 보여주기
            </p>
            <Button
              onClick={handleShare}
              disabled={isSharing}
              className="bg-primary text-primary-foreground hover:bg-secondary transform hover:scale-105 transition-all shadow-lg hover:shadow-xl"
              size="lg"
              data-testid="button-share"
            >
              {isSharing ? (
                <>
                  <div className="w-5 h-5 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  생성 중...
                </>
              ) : (
                <>
                  <Share2 className="w-5 h-5 mr-2" />
                  공유 링크 생성
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 fade-in-up">
          <Button
            onClick={() => setLocation('/upload')}
            className="bg-primary text-primary-foreground hover:bg-secondary"
            size="lg"
            data-testid="button-new-analysis"
          >
            새로운 대화 분석하기
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
            className="border-2"
            size="lg"
            data-testid="button-home-bottom"
          >
            <Home className="w-5 h-5 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
