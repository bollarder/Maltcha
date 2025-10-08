import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Home,
  Share2,
  Lightbulb,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AnalysisResult } from "@shared/schema";
import FeedbackPopup from "@/FeedbackPopup";

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

  const { insights } = analysis;

  if (!insights || insights.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            분석이 아직 완료되지 않았어요
          </h2>
          <p className="text-muted-foreground mb-4">잠시 후 다시 확인해주세요</p>
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

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-6 mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                대화 분석 결과
              </h1>
              {analysis.userPurpose && (
                <p className="text-sm text-muted-foreground mt-2">
                  분석 목적: {analysis.userPurpose}
                </p>
              )}
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-home"
              >
                <Home className="w-5 h-5 mr-2" />홈
              </Button>
              <Button
                onClick={handleShare}
                disabled={isSharing}
                className="bg-primary text-primary-foreground hover:bg-secondary"
                data-testid="button-share"
              >
                <Share2 className="w-5 h-5 mr-2" />
                {isSharing ? "생성 중..." : "공유하기"}
              </Button>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center fade-in-up">
            <Lightbulb className="w-6 h-6 mr-2 text-primary" />
            AI 분석 인사이트
          </h2>

          <div className="space-y-4">
            {insights.map((insight, index) => (
              <div
                key={index}
                className="bg-card dark:bg-card rounded-xl shadow-lg p-6 fade-in-up"
                data-testid={`insight-card-${index}`}
                style={{ animationDelay: `${index * 0.05}s` }}
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
                    <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback Popup */}
        {showFeedback && !feedbackSubmitted && (
          <FeedbackPopup 
            isOpen={showFeedback}
            onClose={() => setShowFeedback(false)} 
            onSubmit={handleFeedbackSubmit}
          />
        )}
      </div>
    </div>
  );
}
