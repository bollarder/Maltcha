import { useState } from "react";
import { X, Check } from "lucide-react";

interface FeedbackData {
  satisfaction: 1 | 2 | 3 | 4 | 5;
  willingness: "free" | "under_1k" | "1-3k" | "3-5k" | "over_5k";
  nps: 0 | 1 | 2 | 3 | 4;
  earlyBirdEmail?: string;
  feedback?: string;
  timestamp: number;
  completionTime: number;
}

interface FeedbackPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: FeedbackData) => void;
}

export default function FeedbackPopup({
  isOpen,
  onClose,
  onSubmit,
}: FeedbackPopupProps) {
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [willingness, setWillingness] = useState<string>("");
  const [nps, setNps] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [startTime] = useState(Date.now());

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (satisfaction === null || !willingness || nps === null) {
      alert("필수 질문에 모두 답해주세요!");
      return;
    }

    const data: FeedbackData = {
      satisfaction: satisfaction as 1 | 2 | 3 | 4 | 5,
      willingness: willingness as any,
      nps: nps as 0 | 1 | 2 | 3 | 4,
      earlyBirdEmail: email || undefined,
      feedback: feedbackText || undefined,
      timestamp: Date.now(),
      completionTime: Math.round((Date.now() - startTime) / 1000),
    };

    onSubmit?.(data);
    setIsSubmitted(true);

    setTimeout(() => {
      onClose();
    }, 3000);
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center animate-in fade-in zoom-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 피드백 감사합니다!
          </h3>
          <p className="text-gray-600 mb-4">
            소중한 의견이 더 나은 Maltcha를 만듭니다
          </p>
          {email && (
            <p className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
              990원 혜택 안내를 3일 내 보내드릴게요!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#F5F5DC] rounded-2xl p-6 max-w-lg w-full my-8 relative animate-in fade-in zoom-in">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-6 h-6" />
        </button>

        {/* 헤더 */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            💬 소중한 의견을 들려주세요
          </h2>
          <p className="text-sm text-gray-600">
            3가지 질문만 답하시면
            <br />
            베타 테스터 특별 혜택을 받으실 수 있어요 (30초 소요)
          </p>
        </div>

        {/* Q1. 만족도 */}
        <div className="mb-6 pb-6 border-b-2 border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Q1. 분석 결과가 도움 되셨나요?
          </h3>
          <div className="flex justify-between gap-2">
            {[
              { value: 5, emoji: "😊", label: "매우\n유용" },
              { value: 4, emoji: "🙂", label: "유용" },
              { value: 3, emoji: "😐", label: "보통" },
              { value: 2, emoji: "😕", label: "별로" },
              { value: 1, emoji: "😞", label: "전혀" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setSatisfaction(item.value)}
                className={`flex-1 p-3 rounded-xl transition-all ${
                  satisfaction === item.value
                    ? "bg-[#A8D5BA] scale-110 shadow-lg"
                    : "bg-white hover:bg-gray-50 hover:scale-105"
                }`}
              >
                <div className="text-3xl mb-1">{item.emoji}</div>
                <div className="text-xs text-gray-700 whitespace-pre-line leading-tight">
                  {item.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Q2. 결제 의향 */}
        <div className="mb-6 pb-6 border-b-2 border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Q2. 이 분석을 매월 무제한으로 이용할 수 있다면,
            <br />월 얼마까지 낼 수 있나요?
          </h3>
          <div className="space-y-2">
            {[
              { value: "free", label: "무료만 사용 (0원)" },
              { value: "under_1k", label: "1,000원 미만" },
              { value: "1-3k", label: "1,000-3,000원 ⭐ 추천" },
              { value: "3-5k", label: "3,000-5,000원" },
              { value: "over_5k", label: "5,000원 이상" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setWillingness(item.value)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  willingness === item.value
                    ? "bg-[#A8D5BA] shadow-md scale-105"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      willingness === item.value
                        ? "border-white bg-white"
                        : "border-gray-300"
                    }`}
                  >
                    {willingness === item.value && (
                      <div className="w-3 h-3 bg-[#2C3E50] rounded-full" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 bg-white/50 p-2 rounded">
            💡 정식 출시 예정가: Premium 2,900원 / Plus 4,900원
          </p>
        </div>

        {/* Q3. NPS */}
        <div className="mb-6 pb-6 border-b-2 border-gray-200">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Q3. 친구에게 추천하고 싶으신가요?
          </h3>
          <div className="space-y-2">
            {[
              { value: 4, label: "매우 추천 (10점)" },
              { value: 3, label: "추천함 (8-9점)" },
              { value: 2, label: "보통 (7점)" },
              { value: 1, label: "글쎄 (4-6점)" },
              { value: 0, label: "비추천 (0-3점)" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setNps(item.value)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  nps === item.value
                    ? "bg-[#A8D5BA] shadow-md scale-105"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center">
                  <div
                    className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center ${
                      nps === item.value
                        ? "border-white bg-white"
                        : "border-gray-300"
                    }`}
                  >
                    {nps === item.value && (
                      <div className="w-3 h-3 bg-[#2C3E50] rounded-full" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {item.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 베타 테스터 특전 */}
        <div className="mb-6 pb-6 border-b-2 border-gray-200 bg-gradient-to-r from-[#A8D5BA]/20 to-[#A8D5BA]/10 rounded-xl p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center">
            🎁 베타 테스터 특전
          </h3>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            정식 출시 시 Plus(4,900원)를
            <br />
            <span className="text-[#A8D5BA] font-bold text-lg">
              990원/월에 평생 이용!
            </span>
            <br />
            <span className="text-xs text-gray-600">
              (80% 할인, 선착순 100명)
            </span>
          </p>

          {!showEmailInput ? (
            <button
              onClick={() => setShowEmailInput(true)}
              className="w-full bg-[#A8D5BA] text-white py-3 rounded-lg font-semibold hover:bg-[#8ba888] transition"
            >
              혜택 받기
            </button>
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력해주세요"
              className="w-full px-4 py-3 rounded-lg border-2 border-[#A8D5BA] focus:outline-none focus:ring-2 focus:ring-[#A8D5BA]"
            />
          )}
        </div>

        {/* 자유 의견 */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            💭 한 줄 의견 (선택)
          </h3>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="개선했으면 하는 점이나 좋았던 점을 자유롭게 남겨주세요"
            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#A8D5BA] resize-none h-20"
          />
        </div>

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={satisfaction === null || !willingness || nps === null}
          className="w-full bg-[#A8D5BA] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#8ba888] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          제출하기
        </button>

        <p className="text-xs text-center text-gray-500 mt-3">
          ⏰ 30초만 투자하시면 특별한 혜택을 드려요!
        </p>
      </div>
    </div>
  );
}
