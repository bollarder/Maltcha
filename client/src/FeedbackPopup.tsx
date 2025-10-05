import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FeedbackPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export default function FeedbackPopup({ isOpen, onClose, onSubmit }: FeedbackPopupProps) {
  // 상태 관리
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [willingness, setWillingness] = useState<string | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [channel, setChannel] = useState<string | null>(null);

  // 조건부 질문 표시 상태
  const [showDissatisfaction, setShowDissatisfaction] = useState(false);
  const [showFreeReasons, setShowFreeReasons] = useState(false);

  // 상세 답변
  const [dissatisfactionReasons, setDissatisfactionReasons] = useState<string[]>([]);
  const [freeReasons, setFreeReasons] = useState<string[]>([]);
  const [openFeedback, setOpenFeedback] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  // 만족도 변경 시
  useEffect(() => {
    if (satisfaction !== null && satisfaction <= 2) {
      setShowDissatisfaction(true);
    } else {
      setShowDissatisfaction(false);
      setDissatisfactionReasons([]);
    }
  }, [satisfaction]);

  // 가격 의향 변경 시
  useEffect(() => {
    if (willingness === "free") {
      setShowFreeReasons(true);
    } else {
      setShowFreeReasons(false);
      setFreeReasons([]);
    }
  }, [willingness]);

  // 체크박스 토글
  const toggleCheckbox = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    if (array.includes(value)) {
      setArray(array.filter((item: string) => item !== value));
    } else {
      setArray([...array, value]);
    }
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const feedbackData = {
      satisfaction,
      willingness,
      nps,
      channel,
      dissatisfactionReasons: showDissatisfaction
        ? dissatisfactionReasons
        : null,
      freeReasons: showFreeReasons ? freeReasons : null,
      openFeedback: openFeedback || null,
      email: email || null,
      timestamp: Date.now(),
    };

    // onSubmit 콜백 호출
    if (onSubmit) {
      onSubmit(feedbackData);
    }

    alert("🎉 피드백 감사합니다!");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="feedback-container">
      <form onSubmit={handleSubmit} className="feedback-form">
        {/* 헤더 */}
        <div className="feedback-header">
          <h2>💬 소중한 의견을 들려주세요</h2>
          <p className="subtitle">
            4가지 질문만 답하시면
            <br />
            베타 테스터 특별 혜택을 받으실 수 있어요 (30초 소요)
          </p>
        </div>

        {/* Q1: 만족도 */}
        <div className="question-section">
          <label className="question-label">
            Q1. 분석 결과가 도움 되셨나요?
          </label>

          <div className="emoji-buttons">
            {[
              { value: 5, emoji: "😊", label: "매우\n유용" },
              { value: 4, emoji: "🙂", label: "유용" },
              { value: 3, emoji: "😐", label: "보통" },
              { value: 2, emoji: "😕", label: "별로" },
              { value: 1, emoji: "😞", label: "전혀" },
            ].map(({ value, emoji, label }) => (
              <button
                key={value}
                type="button"
                className={`emoji-btn ${satisfaction === value ? "selected" : ""}`}
                onClick={() => setSatisfaction(value)}
              >
                <span className="emoji">{emoji}</span>
                <span className="label">{label}</span>
              </button>
            ))}
          </div>

          {/* 조건부: 불만족 이유 */}
          <AnimatePresence>
            {showDissatisfaction && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="conditional-section"
              >
                <p className="conditional-label">
                  😔 어떤 점이 아쉬웠나요? (복수 선택)
                </p>

                {[
                  "분석이 부정확했어요",
                  "새로운 인사이트가 부족해요",
                  "내용이 너무 뻔했어요",
                  "표현이 차갑게 느껴졌어요",
                  "사용이 불편했어요",
                  "기타",
                ].map((reason, idx) => (
                  <motion.label
                    key={idx}
                    className="checkbox-item"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <input
                      type="checkbox"
                      checked={dissatisfactionReasons.includes(reason)}
                      onChange={() =>
                        toggleCheckbox(
                          dissatisfactionReasons,
                          setDissatisfactionReasons,
                          reason,
                        )
                      }
                    />
                    {reason}
                  </motion.label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Q2: 가격 의향 */}
        <div className="question-section">
          <label className="question-label">
            Q2. 이 분석을 매월 무제한으로 이용할 수 있다면,
            <br />월 얼마까지 낼 수 있나요?
          </label>

          <div className="radio-group">
            {[
              { value: "free", label: "무료만 사용 (0원)" },
              { value: "under_1k", label: "1,000원 미만" },
              { value: "1-3k", label: "1,000-3,000원 ⭐ 추천" },
              { value: "3-5k", label: "3,000-5,000원" },
              { value: "over_5k", label: "5,000원 이상" },
            ].map(({ value, label }) => (
              <label key={value} className="radio-item">
                <input
                  type="radio"
                  name="willingness"
                  value={value}
                  checked={willingness === value}
                  onChange={(e) => setWillingness(e.target.value)}
                />
                {label}
              </label>
            ))}
          </div>

          <p className="pricing-hint">
            💡 정식 출시 예정가: Premium 2,900원 / Plus 4,900원
          </p>

          {/* 조건부: 무료 이유 */}
          <AnimatePresence>
            {showFreeReasons && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="conditional-section"
              >
                <p className="conditional-label">
                  🤔 무료를 선호하시는 이유는? (복수 선택)
                </p>

                {[
                  "분석이 기대에 못 미쳤어요",
                  "한 번 체험이면 충분해요",
                  "정기 구독이 부담돼요",
                  "가격 대비 가치가 부족해요",
                  "신뢰가 아직 부족해요",
                  "기타",
                ].map((reason, idx) => (
                  <motion.label
                    key={idx}
                    className="checkbox-item"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <input
                      type="checkbox"
                      checked={freeReasons.includes(reason)}
                      onChange={() =>
                        toggleCheckbox(freeReasons, setFreeReasons, reason)
                      }
                    />
                    {reason}
                  </motion.label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Q3: NPS */}
        <div className="question-section">
          <label className="question-label">
            Q3. 친구에게 추천하고 싶으신가요?
          </label>

          <div className="nps-buttons">
            {[
              { value: 4, label: "매우 추천 (10점)" },
              { value: 3, label: "추천함 (8-9점)" },
              { value: 2, label: "보통 (7점)" },
              { value: 1, label: "글쎄 (4-6점)" },
              { value: 0, label: "비추천 (0-3점)" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`nps-btn ${nps === value ? "selected" : ""}`}
                onClick={() => setNps(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Q4: 유입 채널 */}
        <div className="question-section">
          <label className="question-label">
            Q4. 어떤 채널에서 Maltcha를 알게 되셨나요?
          </label>

          <div className="radio-group">
            {[
              "친구 추천",
              "SNS (인스타/페북/X)",
              "커뮤니티 (에브리타임/오픈챗)",
              "검색",
              "기타",
            ].map((ch) => (
              <label key={ch} className="radio-item">
                <input
                  type="radio"
                  name="channel"
                  value={ch}
                  checked={channel === ch}
                  onChange={(e) => setChannel(e.target.value)}
                />
                {ch}
              </label>
            ))}
          </div>
        </div>

        {/* 자유 의견 */}
        <div className="question-section">
          <label className="question-label">💭 한 줄 의견 (선택)</label>
          <textarea
            className="feedback-textarea"
            placeholder="칭찬/아쉬운 점 자유롭게 남겨주세요"
            value={openFeedback}
            onChange={(e) => setOpenFeedback(e.target.value)}
            rows={3}
          />
        </div>

        {/* 얼리버드 */}
        <div className="earlybird-section">
          <div className="earlybird-box">
            <h3>🎁 베타 테스터 특전</h3>
            <p>
              정식 출시 시 Plus(4,900원)를
              <br />
              <strong>990원/월에 평생 이용!</strong>
              <br />
              (80% 할인, 선착순 100명)
            </p>
            <input
              type="email"
              className="email-input"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="submit-btn"
          disabled={!satisfaction || !willingness || !nps || !channel}
        >
          제출하기
        </button>
      </form>
    </div>
  );
}
