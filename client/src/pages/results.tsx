import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Home,
  Share2,
  Lightbulb,
  TrendingUp,
  Users,
  Heart,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Activity,
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
    // 피드백 팝업 임시 비활성화
    // if (feedbackSubmitted) return;

    // const handleScroll = () => {
    //   const scrollTop = window.scrollY;
    //   const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    //   const scrollPercent = (scrollTop / docHeight) * 100;

    //   if (scrollPercent >= 80 && !showFeedback) {
    //     setShowFeedback(true);
    //   }
    // };

    // window.addEventListener('scroll', handleScroll);
    // return () => window.removeEventListener('scroll', handleScroll);
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

  const { insights, deepAnalysis, stage2Data } = analysis;

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

  // Multi-turn 분석 결과 (turn1, turn2)
  const turn1 = deepAnalysis?.turn1;
  const turn2 = deepAnalysis?.turn2;
  
  // 4단계 분석 결과 (stage2Data 또는 deepAnalysis가 직접 stage2 형식인 경우)
  const stage2 = stage2Data || (deepAnalysis && !deepAnalysis.turn1 ? deepAnalysis : null);

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

        {/* Turn 1: 전체 관계 분석 */}
        {turn1 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center fade-in-up">
              <Users className="w-6 h-6 mr-2 text-primary" />
              전체 관계 분석
            </h2>

            {/* 관계 평가 */}
            {turn1.relationshipAssessment && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-primary" />
                  관계 건강도
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl font-bold text-primary">
                      {turn1.relationshipAssessment.healthScore}/10
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-muted-foreground mb-1">전반적 분위기</div>
                      <div className="text-foreground font-medium">
                        {turn1.relationshipAssessment.overallTone}
                      </div>
                    </div>
                  </div>
                  <p className="text-foreground leading-relaxed">
                    {turn1.relationshipAssessment.summary}
                  </p>
                </div>
              </div>
            )}

            {/* 주요 이벤트 */}
            {turn1.keyEvents && turn1.keyEvents.length > 0 && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  중요한 전환점
                </h3>
                <div className="space-y-4">
                  {turn1.keyEvents.map((event: any, index: number) => (
                    <div key={index} className="border-l-4 border-primary pl-4">
                      <div className="text-sm text-muted-foreground mb-1">
                        {event.timestamp} • {event.participants}
                      </div>
                      <p className="text-foreground mb-2">{event.context}</p>
                      <div className="text-sm text-muted-foreground">
                        💡 {event.significance}
                      </div>
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          event.emotionalImpact === '긍정' ? 'bg-green-100 text-green-800' :
                          event.emotionalImpact === '부정' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.emotionalImpact}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 강점 */}
            {turn1.strengths && turn1.strengths.length > 0 && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  관계의 강점
                </h3>
                <div className="space-y-3">
                  {turn1.strengths.map((strength: any, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-600 text-sm">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground">{strength.strength}</p>
                        {strength.examples && strength.examples.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            예시: {strength.examples.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 걱정되는 패턴 */}
            {turn1.concerningPatterns && turn1.concerningPatterns.length > 0 && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2 text-amber-600" />
                  주의가 필요한 부분
                </h3>
                <div className="space-y-3">
                  {turn1.concerningPatterns.map((pattern: any, index: number) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-amber-600 text-sm">!</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground">{pattern.pattern}</p>
                        <div className="text-xs text-muted-foreground mt-1">
                          빈도: {pattern.frequency}
                        </div>
                        {pattern.examples && pattern.examples.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            예시: {pattern.examples.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Turn 2: 심층 분석 */}
        {turn2 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center fade-in-up">
              <MessageSquare className="w-6 h-6 mr-2 text-primary" />
              심층 소통 분석
            </h2>

            {/* 소통 스타일 */}
            {turn2.communicationStyle && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">소통 스타일</h3>
                <div className="space-y-6">
                  {Object.entries(turn2.communicationStyle).map(([person, style]: [string, any]) => (
                    <div key={person} className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold text-foreground mb-2">{person}</h4>
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-muted-foreground">유형: </span>
                          <span className="text-foreground font-medium">{style.type}</span>
                        </div>
                        {style.traits && style.traits.length > 0 && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">특징:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {style.traits.map((trait: string, idx: number) => (
                                <li key={idx} className="text-foreground text-sm">{trait}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {style.strengths && style.strengths.length > 0 && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">강점:</div>
                            <div className="flex flex-wrap gap-2">
                              {style.strengths.map((strength: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                                  {strength}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {style.improvements && style.improvements.length > 0 && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">개선 포인트:</div>
                            <div className="flex flex-wrap gap-2">
                              {style.improvements.map((improvement: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                                  {improvement}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 감정 표현 방식 */}
            {turn2.emotionalExpression && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-pink-600" />
                  감정 표현 방식
                </h3>
                <div className="space-y-3">
                  {turn2.emotionalExpression.emojiDependency && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">이모티콘 사용도</div>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(turn2.emotionalExpression.emojiDependency).map(([person, level]: [string, any]) => (
                          <div key={person} className="flex items-center gap-2">
                            <span className="text-foreground font-medium">{person}:</span>
                            <span className="text-muted-foreground">{level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn2.emotionalExpression.directness && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">표현 직접성</div>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(turn2.emotionalExpression.directness).map(([person, level]: [string, any]) => (
                          <div key={person} className="flex items-center gap-2">
                            <span className="text-foreground font-medium">{person}:</span>
                            <span className="text-muted-foreground">{level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn2.emotionalExpression.asymmetry && (
                    <div className="p-3 bg-accent/20 rounded-lg">
                      <p className="text-sm text-foreground">{turn2.emotionalExpression.asymmetry}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 관계 역학 */}
            {turn2.relationshipDynamics && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">관계 역학</h3>
                <div className="space-y-4">
                  {turn2.relationshipDynamics.powerBalance && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">주도권 균형</div>
                      <div className="space-y-1">
                        <p className="text-sm text-foreground">
                          평가: {turn2.relationshipDynamics.powerBalance.assessment}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          리더: {turn2.relationshipDynamics.powerBalance.leader}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          건강성: {turn2.relationshipDynamics.powerBalance.healthiness}
                        </p>
                      </div>
                    </div>
                  )}
                  {turn2.relationshipDynamics.intimacyTrend && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">친밀도 변화</div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">초기</div>
                          <div className="text-lg font-bold text-foreground">
                            {turn2.relationshipDynamics.intimacyTrend.early}
                          </div>
                        </div>
                        <div className="text-muted-foreground">→</div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">중기</div>
                          <div className="text-lg font-bold text-foreground">
                            {turn2.relationshipDynamics.intimacyTrend.middle}
                          </div>
                        </div>
                        <div className="text-muted-foreground">→</div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground">최근</div>
                          <div className="text-lg font-bold text-foreground">
                            {turn2.relationshipDynamics.intimacyTrend.recent}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        추세: {turn2.relationshipDynamics.intimacyTrend.direction}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 특별한 패턴 */}
            {turn2.specialPatterns && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">발견된 특별한 패턴</h3>
                <div className="space-y-4">
                  {turn2.specialPatterns.repeatingTopics && turn2.specialPatterns.repeatingTopics.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">반복 주제</div>
                      <div className="flex flex-wrap gap-2">
                        {turn2.specialPatterns.repeatingTopics.map((topic: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn2.specialPatterns.happyMoments && turn2.specialPatterns.happyMoments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">😊 행복한 순간들</div>
                      <div className="space-y-2">
                        {turn2.specialPatterns.happyMoments.map((moment: any, idx: number) => (
                          <div key={idx} className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <div className="text-xs text-muted-foreground mb-1">{moment.timestamp}</div>
                            <p className="text-sm text-foreground italic">"{moment.quote}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn2.specialPatterns.awkwardMoments && turn2.specialPatterns.awkwardMoments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">😅 어색한 순간들</div>
                      <div className="space-y-2">
                        {turn2.specialPatterns.awkwardMoments.map((moment: any, idx: number) => (
                          <div key={idx} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                            <div className="text-xs text-muted-foreground mb-1">{moment.timestamp}</div>
                            <p className="text-sm text-foreground italic">"{moment.quote}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {turn2.specialPatterns.avoidedTopics && turn2.specialPatterns.avoidedTopics.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">🤐 회피하는 주제</div>
                      <ul className="list-disc list-inside space-y-1">
                        {turn2.specialPatterns.avoidedTopics.map((topic: string, idx: number) => (
                          <li key={idx} className="text-sm text-muted-foreground">{topic}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상대방 현재 상태 */}
            {turn2.partnerStatus && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">상대방 현재 상태 분석</h3>
                <div className="space-y-3">
                  {turn2.partnerStatus.emotionalState && (
                    <div>
                      <span className="text-sm text-muted-foreground">감정 상태: </span>
                      <span className="text-foreground font-medium">{turn2.partnerStatus.emotionalState}</span>
                    </div>
                  )}
                  {turn2.partnerStatus.feelings && (
                    <div>
                      <span className="text-sm text-muted-foreground">당신에 대한 감정: </span>
                      <span className="text-foreground font-medium">{turn2.partnerStatus.feelings}</span>
                    </div>
                  )}
                  {turn2.partnerStatus.hiddenNeeds && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">숨겨진 욕구</div>
                      <p className="text-foreground">{turn2.partnerStatus.hiddenNeeds}</p>
                    </div>
                  )}
                  {turn2.partnerStatus.concerns && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">걱정거리</div>
                      <p className="text-foreground">{turn2.partnerStatus.concerns}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 2 분석 (4단계 방식) - turn2가 없을 때만 표시 */}
        {!turn2 && stage2 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center fade-in-up">
              <MessageSquare className="w-6 h-6 mr-2 text-primary" />
              심층 분석 결과
            </h2>

            {/* 소통 스타일 */}
            {stage2.communicationStyle && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">소통 스타일</h3>
                <div className="space-y-6">
                  {Object.entries(stage2.communicationStyle).map(([person, style]: [string, any]) => (
                    <div key={person} className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold text-foreground mb-2">{person}</h4>
                      <div className="space-y-2">
                        {style.type && (
                          <div>
                            <span className="text-sm text-muted-foreground">유형: </span>
                            <span className="text-foreground font-medium">{style.type}</span>
                          </div>
                        )}
                        {style.traits && style.traits.length > 0 && (
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">특징:</div>
                            <ul className="list-disc list-inside space-y-1">
                              {style.traits.map((trait: string, idx: number) => (
                                <li key={idx} className="text-foreground text-sm">{trait}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 감정 표현 */}
            {stage2.emotionalExpression && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-pink-600" />
                  감정 표현 방식
                </h3>
                <div className="space-y-3">
                  {Object.entries(stage2.emotionalExpression).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-foreground mb-1">{key}</div>
                      <p className="text-foreground">{JSON.stringify(value, null, 2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 관계 역학 */}
            {stage2.relationshipDynamics && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">관계 역학</h3>
                <div className="space-y-3">
                  {Object.entries(stage2.relationshipDynamics).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-foreground mb-1">{key}</div>
                      <p className="text-foreground">{JSON.stringify(value, null, 2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 특별한 패턴 */}
            {stage2.specialPatterns && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">특별한 패턴</h3>
                <div className="space-y-3">
                  {Object.entries(stage2.specialPatterns).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-foreground mb-1">{key}</div>
                      <p className="text-foreground whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 상대방 상태 */}
            {stage2.partnerStatus && (
              <div className="bg-card dark:bg-card rounded-xl shadow-lg p-6 mb-4 fade-in-up">
                <h3 className="text-lg font-semibold text-foreground mb-4">상대방 현재 상태</h3>
                <div className="space-y-3">
                  {Object.entries(stage2.partnerStatus).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <div className="text-sm font-medium text-foreground mb-1">{key}</div>
                      <p className="text-foreground whitespace-pre-wrap">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
