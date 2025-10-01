import { useRoute, useLocation } from "wouter";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { AnalysisResult } from "@shared/schema";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

interface SharedResultData {
  id: string;
  analysisId: string;
  analysisData: AnalysisResult;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
}

export default function SharedResult() {
  const [, params] = useRoute("/result/:shareId");
  const [, setLocation] = useLocation();
  const shareId = params?.shareId;

  const { data, isLoading, error } = useQuery<SharedResultData>({
    queryKey: ['/api/share', shareId],
    enabled: !!shareId,
  });

  useEffect(() => {
    const ogImageUrl = `${window.location.origin}/og-image.jpg`;
    
    const metaTags = [
      { property: 'og:image', content: ogImageUrl },
      { property: 'og:url', content: window.location.href },
      { name: 'twitter:image', content: ogImageUrl },
    ];

    metaTags.forEach(({ property, name, content }) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector);
      
      if (meta) {
        meta.setAttribute('content', content);
      } else {
        meta = document.createElement('meta');
        if (property) meta.setAttribute('property', property);
        if (name) meta.setAttribute('name', name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
      }
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const errorMessage = (error as any)?.message || "링크를 찾을 수 없습니다";
    const statusCode = errorMessage.split(':')[0];
    const isExpired = statusCode === '410';
    const isNotFound = statusCode === '404';
    
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">Maltcha</span>
            </div>
          </div>
          
          <div className="bg-card dark:bg-card rounded-2xl p-12 shadow-lg">
            <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {isExpired ? "이 결과는 만료되었습니다" : isNotFound ? "링크를 찾을 수 없습니다" : "오류가 발생했습니다"}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isExpired 
                ? "공유 링크는 24시간 동안만 유효합니다. 새로운 분석을 시작해보세요." 
                : isNotFound
                ? "유효하지 않은 공유 링크입니다."
                : "문제가 발생했습니다. 다시 시도해주세요."}
            </p>
            
            <Button
              onClick={() => setLocation('/upload')}
              className="bg-primary text-primary-foreground hover:bg-secondary"
              size="lg"
              data-testid="button-try-analysis"
            >
              나도 분석해보기
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const analysis = data.analysisData;
  const { stats, charts, insights } = analysis;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">Maltcha</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">소통 스타일 분석 결과</h1>
          <p className="text-muted-foreground">AI가 분석한 대화 패턴과 인사이트를 확인해보세요</p>
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
            <p className="text-3xl font-bold text-foreground">{stats?.totalMessages.toLocaleString()}</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">참여자</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats?.participants}</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">평균 응답 시간</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats?.avgResponseTime}</p>
          </div>

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">감정 점수</span>
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats?.sentimentScore}%</p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
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

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
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

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
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

          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up">
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
        {insights && insights.length > 0 && (
          <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-8 fade-in-up">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              주요 인사이트
            </h3>
            
            <div className="space-y-4">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3 p-4 bg-accent/30 dark:bg-accent/30 rounded-lg">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary-foreground">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground mb-1">{insight.title}</h4>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Section */}
        <div className="text-center py-12 bg-primary/10 rounded-2xl fade-in-up">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            나도 대화 분석해보기
          </h3>
          <p className="text-muted-foreground mb-6">
            내 소통 스타일을 AI로 분석하고 인사이트를 얻어보세요
          </p>
          <Button
            onClick={() => setLocation('/upload')}
            className="bg-primary text-primary-foreground hover:bg-secondary"
            size="lg"
          >
            무료로 시작하기
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
