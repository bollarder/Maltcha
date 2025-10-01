import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { RefreshCw, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AnalysisResult } from "@shared/schema";

const TIPS = [
  "대화 분석 결과는 참여자 수, 메시지 양, 대화 기간에 따라 달라질 수 있습니다.",
  "AI는 대화의 맥락과 감정을 종합적으로 분석하여 인사이트를 제공합니다.",
  "시간대별 분석을 통해 대화가 가장 활발한 시간을 확인할 수 있습니다.",
  "참여자별 활동도를 비교하여 대화 참여 패턴을 파악할 수 있습니다.",
];

export default function Loading() {
  const [, params] = useRoute("/loading/:id");
  const [, setLocation] = useLocation();
  const [currentTip, setCurrentTip] = useState(0);
  const analysisId = params?.id;

  const { data: analysis } = useQuery<AnalysisResult>({
    queryKey: ['/api/analysis', analysisId],
    enabled: !!analysisId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === 'completed' || data?.status === 'failed' ? false : 2000;
    },
  });

  useEffect(() => {
    if (analysis?.status === 'completed') {
      setTimeout(() => {
        setLocation(`/results/${analysisId}`);
      }, 1000);
    }
  }, [analysis?.status, analysisId, setLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const getProgress = () => {
    if (!analysis) return { stage: '대화 파싱 중...', percentage: 0 };
    
    if (analysis.status === 'processing') {
      if (!analysis.messages || analysis.messages.length === 0) {
        return { stage: '1단계: 대화 파싱', percentage: 33 };
      }
      if (!analysis.insights) {
        return { stage: '2단계: 감정 및 패턴 분석', percentage: 66 };
      }
      return { stage: '3단계: 인사이트 생성', percentage: 90 };
    }
    
    if (analysis.status === 'completed') {
      return { stage: '분석 완료!', percentage: 100 };
    }
    
    return { stage: '대화 파싱 중...', percentage: 0 };
  };

  const progress = getProgress();
  const stages = [
    { name: '대화 내용 파싱', completed: progress.percentage >= 33 },
    { name: '감정 및 패턴 분석', completed: progress.percentage >= 66 },
    { name: '인사이트 생성', completed: progress.percentage >= 90 },
  ];

  if (analysis?.status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">분석 실패</h2>
          <p className="text-muted-foreground mb-6">{analysis.error || '알 수 없는 오류가 발생했습니다.'}</p>
          <button
            onClick={() => setLocation('/upload')}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-secondary transition-colors"
            data-testid="button-retry"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-2xl w-full">
        {/* Loading Animation */}
        <div className="text-center mb-12 fade-in-up">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-primary rounded-full opacity-20 animate-ping"></div>
            <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-primary-foreground animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">대화 분석 중...</h2>
          <p className="text-muted-foreground">잠시만 기다려주세요. AI가 대화를 분석하고 있습니다.</p>
        </div>

        {/* Progress Bar */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span data-testid="text-stage">{progress.stage}</span>
              <span data-testid="text-percentage">{progress.percentage}%</span>
            </div>
            <div className="w-full bg-muted dark:bg-muted rounded-full h-3 overflow-hidden">
              <div 
                className="progress-bar-fill bg-primary h-full rounded-full transition-all duration-300" 
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>

          {/* Analysis Stages */}
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  stage.completed 
                    ? 'bg-primary' 
                    : 'border-2 border-border'
                }`}>
                  {stage.completed && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
                <span className={stage.completed ? 'text-foreground' : 'text-muted-foreground'}>
                  {stage.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips Card */}
        <div className="bg-accent/50 dark:bg-accent/50 rounded-xl p-6 fade-in-up tip-rotate">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">💡 분석 팁</h4>
              <p className="text-sm text-muted-foreground" data-testid="text-tip">
                {TIPS[currentTip]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
