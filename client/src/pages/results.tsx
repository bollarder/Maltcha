import { useRoute, useLocation } from "wouter";
import { Download, Plus, Lightbulb, ArrowLeft, Home, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalysisResult } from "@shared/schema";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState } from "react";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

export default function Results() {
  const [, params] = useRoute("/results/:id");
  const [, setLocation] = useLocation();
  const analysisId = params?.id;
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

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
            data-testid="button-back-to-loading"
          >
            분석 화면으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  const { stats, charts, insights } = analysis;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">분석 결과</h1>
              <p className="text-muted-foreground" data-testid="text-filename">{analysis.fileName}</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Button variant="outline" className="border-2" data-testid="button-export">
                <Download className="w-5 h-5 mr-2" />
                내보내기
              </Button>
              <Button 
                onClick={() => setLocation('/upload')}
                className="bg-primary text-primary-foreground hover:bg-secondary"
                data-testid="button-new-analysis"
              >
                <Plus className="w-5 h-5 mr-2" />
                새로운 분석
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">총 메시지</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="stat-total-messages">{stats?.totalMessages.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">전체 대화</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">참여자</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="stat-participants">{stats?.participants}</p>
            <p className="text-sm text-muted-foreground mt-1">활성 사용자</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">평균 응답 시간</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="stat-response-time">{stats?.avgResponseTime}</p>
            <p className="text-sm text-muted-foreground mt-1">메시지 간격</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">감정 점수</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground" data-testid="stat-sentiment">{stats?.sentimentScore}%</p>
            <p className="text-sm text-muted-foreground mt-1">긍정적</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Message Frequency Chart */}
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-semibold text-foreground mb-4">메시지 빈도</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={charts?.messageFrequency || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Participant Activity Chart */}
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.25s' }}>
            <h3 className="text-lg font-semibold text-foreground mb-4">참여자별 활동</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts?.participantActivity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Activity Chart */}
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.3s' }}>
            <h3 className="text-lg font-semibold text-foreground mb-4">시간대별 활동</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={charts?.hourlyActivity || []}>
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
          </div>

          {/* Sentiment Analysis Chart */}
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.35s' }}>
            <h3 className="text-lg font-semibold text-foreground mb-4">감정 분석</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={charts?.sentimentDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {(charts?.sentimentDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Insights */}
        <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up" style={{ animationDelay: '0.4s' }}>
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <Lightbulb className="w-5 h-5 mr-2 text-primary" />
            주요 인사이트
          </h3>
          
          <div className="space-y-4">
            {insights?.map((insight, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-accent/30 dark:bg-accent/30 rounded-lg">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-foreground">{index + 1}</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1" data-testid={`insight-title-${index}`}>{insight.title}</h4>
                  <p className="text-sm text-muted-foreground" data-testid={`insight-desc-${index}`}>{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share Section */}
        <div className="bg-primary/10 rounded-2xl p-8 text-center fade-in-up mt-8" style={{ animationDelay: '0.45s' }}>
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
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 fade-in-up" style={{ animationDelay: '0.45s' }}>
          <Button
            onClick={() => setLocation('/upload')}
            className="bg-primary text-primary-foreground hover:bg-secondary"
            size="lg"
            data-testid="button-new-conversation"
          >
            새로운 대화 분석하기
          </Button>
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
            className="border-2"
            size="lg"
            data-testid="button-home"
          >
            <Home className="w-5 h-5 mr-2" />
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
