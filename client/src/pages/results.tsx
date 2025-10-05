import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Home,
  Share2,
  Lightbulb,
  MessageCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalysisResult } from "@shared/schema";
import FeedbackPopup from "@/FeedbackPopup";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const analysisId = params?.id;

  const { data: analysis, isLoading } = useQuery<AnalysisResult>({
    queryKey: ["/api/analysis", analysisId],
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
          description: "친구에게 공유하고 피드백을 받아보세요",
        });
      } catch (err) {
        toast({
          title: "링크가 생성되었어요",
          description: shareUrl,
        });
      }
    },
    onError: () => {
      toast({
        title: "오류가 발생했어요",
        description: "다시 시도해주세요",
        variant: "destructive",
      });
    },
  });

  const handleShare = async () => {
    setIsSharing(true);
    await shareMutation.mutateAsync();
    setIsSharing(false);
  };

  useEffect(() => {
    if (feedbackSubmitted) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;

      if (scrollPercent >= 80 && !showFeedback) {
        setShowFeedback(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showFeedback, feedbackSubmitted]);

  const handleFeedbackSubmit = (data: any) => {
    console.log('Feedback submitted:', data);
    setFeedbackSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">분석 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            결과를 찾을 수 없어요
          </h2>
          <Button
            onClick={() => setLocation("/upload")}
            className="bg-primary text-primary-foreground hover:bg-secondary"
          >
            새로운 분석 시작하기
          </Button>
        </div>
      </div>
    );
  }

  const { stats, charts, insights } = analysis;
  const stage1Data = (analysis as any).processedData;
  const stage2Data = (analysis as any).deepAnalysis;

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
    "hsl(var(--accent))",
  ];

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-6 mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                소통 스타일 분석 결과
              </h1>
              <p className="text-muted-foreground">{analysis.fileName}</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-home"
              >
                <Home className="w-5 h-5 mr-2" />홈
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div
            className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
            data-testid="card-total-messages"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">총 메시지</span>
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <p
              className="text-3xl font-bold text-foreground"
              data-testid="text-total-messages"
            >
              {stats?.totalMessages.toLocaleString()}
            </p>
          </div>

          <div
            className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
            style={{ animationDelay: "0.05s" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">참여자</span>
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats?.participants}
            </p>
          </div>

          <div
            className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                평균 응답 시간
              </span>
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats?.avgResponseTime}
            </p>
          </div>

          <div
            className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">감정 점수</span>
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {stats?.sentimentScore}%
            </p>
          </div>
        </div>

        {/* Charts Section */}
        {charts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {charts.sentimentDistribution && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-primary" />
                  감정 분포
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={charts.sentimentDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {charts.sentimentDistribution.map(
                        (entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* AI Insights */}
        {insights && insights.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center fade-in-up">
              <Lightbulb className="w-6 h-6 mr-2 text-primary" />
              AI 인사이트
            </h2>

            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
                  data-testid={`insight-card-${index}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {insight.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage 1: 기본 통계 */}
        {stage1Data && (
          <div className="space-y-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center">
              <MessageCircle className="w-6 h-6 mr-2 text-primary" />
              대화 통계
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 키워드 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-primary" />
                  주요 키워드
                </h3>
                {stage1Data.basicStats?.topKeywords &&
                stage1Data.basicStats.topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {stage1Data.basicStats.topKeywords
                      .slice(0, 10)
                      .map((keyword: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          {keyword.word}
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    키워드 정보가 없습니다.
                  </p>
                )}
              </div>

              {/* 시간대별 활동 */}
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary" />
                  시간대별 활동
                </h3>
                {stage1Data.basicStats?.timeDistribution &&
                stage1Data.basicStats.timeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={stage1Data.basicStats.timeDistribution}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="hour"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    시간대별 활동 정보가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stage 2: 심층 분석 결과 */}
        {stage2Data && (
          <div className="space-y-8 mb-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center">
              <Sparkles className="w-6 h-6 mr-2 text-primary" />
              AI 심층 분석
            </h2>

            {/* 대화 스타일 */}
            {stage2Data.communicationStyle && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  🎭 대화 스타일
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(stage2Data.communicationStyle).map(
                    ([name, style]: [string, any]) => (
                      <div key={name} className="p-4 bg-accent/20 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">
                          {name}
                        </h4>
                        <p className="text-sm text-primary mb-2">
                          타입: {style.type}
                        </p>
                        <ul className="space-y-1">
                          {style.traits?.map((trait: string, idx: number) => (
                            <li
                              key={idx}
                              className="text-sm text-muted-foreground"
                            >
                              • {trait}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* 감정 표현 */}
            {stage2Data.emotionalExpression && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  💖 감정 표현 분석
                </h3>
                <div className="space-y-3">
                  {stage2Data.emotionalExpression.emojiDependency && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        이모지 사용 패턴
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(
                          stage2Data.emotionalExpression.emojiDependency,
                        ).map(([name, level]) => (
                          <div key={name}>
                            <span className="text-muted-foreground">
                              {name}:
                            </span>{" "}
                            <span className="text-primary">
                              {level === "high"
                                ? "높음 🔥"
                                : level === "medium"
                                  ? "보통 😊"
                                  : "낮음 😐"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {stage2Data.emotionalExpression.emotionalAsymmetry && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        감정 비대칭성
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {stage2Data.emotionalExpression.emotionalAsymmetry}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 관계 역학 */}
            {stage2Data.relationshipDynamics && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  ⚖️ 관계 역학
                </h3>
                <div className="space-y-3">
                  {stage2Data.relationshipDynamics.powerBalance && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        주도권 균형
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {stage2Data.relationshipDynamics.powerBalance}
                      </p>
                    </div>
                  )}
                  {stage2Data.relationshipDynamics.intimacyTrend && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        친밀도 추세
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {stage2Data.relationshipDynamics.intimacyTrend ===
                        "increasing"
                          ? "📈 증가 중"
                          : stage2Data.relationshipDynamics.intimacyTrend ===
                              "stable"
                            ? "📊 안정적"
                            : "📉 감소 중"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 특별한 패턴 */}
            {stage2Data.specialPatterns && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  ✨ 특별한 패턴
                </h3>
                <div className="space-y-3">
                  {stage2Data.specialPatterns.recurringTopics &&
                    stage2Data.specialPatterns.recurringTopics.length > 0 && (
                      <div className="p-4 bg-accent/20 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">
                          반복되는 주제
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {stage2Data.specialPatterns.recurringTopics.map(
                            (topic: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                              >
                                {topic}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                  {stage2Data.specialPatterns.happyMoments &&
                    stage2Data.specialPatterns.happyMoments.length > 0 && (
                      <div className="p-4 bg-accent/20 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">
                          행복한 순간들
                        </h4>
                        <div className="space-y-2">
                          {stage2Data.specialPatterns.happyMoments.map(
                            (moment: any, idx: number) => (
                              <div key={idx} className="text-sm">
                                <span className="text-primary">
                                  {moment.timestamp}:
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {moment.context}
                                </span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* 상대방 상태 */}
            {stage2Data.partnerStatus && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  👤 상대방 상태 분석
                </h3>
                <div className="space-y-3">
                  {stage2Data.partnerStatus.currentState && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        현재 상태
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {stage2Data.partnerStatus.currentState}
                      </p>
                    </div>
                  )}
                  {stage2Data.partnerStatus.suggestion && (
                    <div className="p-4 bg-accent/20 rounded-lg">
                      <h4 className="font-medium text-foreground mb-2">
                        Tea의 조언
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {stage2Data.partnerStatus.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Share Section */}
        <div
          className="bg-primary/10 rounded-2xl p-8 text-center fade-in-up mt-8"
          data-testid="section-share"
        >
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
            onClick={() => setLocation("/upload")}
            className="bg-primary text-primary-foreground hover:bg-secondary"
            size="lg"
            data-testid="button-new-analysis"
          >
            새로운 대화 분석하기
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation("/")}
            className="border-2"
            size="lg"
            data-testid="button-home-bottom"
          >
            <Home className="w-5 h-5 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>

      <FeedbackPopup
        isOpen={showFeedback && !feedbackSubmitted}
        onClose={() => setShowFeedback(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
}
