import { Link } from "wouter";
import { BarChart3, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import matchaImage from "@assets/sung-shin-RJPRzSPEE-c-unsplash_1759319361113.jpg";
import maltchaIcon from "@assets/Maltcha Icon_1759388201617.jpg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img
                src={maltchaIcon}
                alt="Maltcha"
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-xl font-bold text-foreground">Maltcha</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                기능
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                사용 방법
              </a>
              <Link href="/upload">
                <Button className="bg-primary text-primary-foreground hover:bg-secondary text-sm">
                  시작하기
                </Button>
              </Link>
            </div>
            <button
              className="md:hidden text-foreground"
              data-testid="button-mobile-menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 25px 25px, hsl(var(--primary)) 2%, transparent 0%), radial-gradient(circle at 75px 75px, hsl(var(--primary)) 2%, transparent 0%)",
              backgroundSize: "100px 100px",
            }}
          ></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 relative">
          <div className="text-center fade-in-up">
            <div className="inline-flex items-center px-4 py-2 bg-accent rounded-full text-sm font-medium text-accent-foreground mb-8">
              <TrendingUp className="w-4 h-4 mr-2" />
              AI 기반 대화 분석
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              소중한 사람과의 대화를
              <br />
              <span className="text-primary">깊이 있게 분석</span>하세요
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Maltcha AI를 통해 대화 내역을 분석해서
              <br className="hidden md:block" />
              소중한 사람과 티키타카가 잘 되도록 합니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/upload">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-secondary transform hover:scale-105 transition-all shadow-lg hover:shadow-xl"
                  data-testid="button-start"
                >
                  무료로 시작하기
                  <svg
                    className="inline-block w-5 h-5 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-16 md:mt-24">
            <img
              src={matchaImage}
              alt="Matcha tea ceremony - peaceful conversation analysis"
              className="rounded-2xl shadow-2xl w-full"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              주요 기능
            </h2>
            <p className="text-lg text-muted-foreground">
              Maltcha AI로 대화의 숨겨진 인사이트를 발견하세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card dark:bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-accent dark:bg-accent rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-primary dark:text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground dark:text-foreground mb-3">
                의미 있는 데이터 분석
              </h3>
              <p className="text-muted-foreground dark:text-muted-foreground">
                관계 관리에 필요한 데이터를 뽑아서 정리해요.
              </p>
            </div>

            <div className="bg-card dark:bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-accent dark:bg-accent rounded-xl flex items-center justify-center mb-6">
                <svg
                  className="w-6 h-6 text-primary dark:text-primary"
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
              <h3 className="text-xl font-semibold text-foreground dark:text-foreground mb-3">
                상황 맥락적 심층 분석
              </h3>
              <p className="text-muted-foreground dark:text-muted-foreground">
                대화의 맥락과 분위기를 분석해서 관계를 진단해요.
              </p>
            </div>

            <div className="bg-card dark:bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-12 h-12 bg-accent dark:bg-accent rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-primary dark:text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground dark:text-foreground mb-3">
                실생활 대화 비서
              </h3>
              <p className="text-muted-foreground dark:text-muted-foreground">
                난감한 상황을 피해 더 나은 관계를 맺도록 도와요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              사용 방법
            </h2>
            <p className="text-lg text-muted-foreground">
              3단계로 간편하게 대화를 분석하세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-foreground">
                  1
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                파일 업로드
              </h3>
              <p className="text-muted-foreground">
                대화 내보내기로 생성된 txt 파일을 업로드하세요.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-foreground">
                  2
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Maltcha AI 분석
              </h3>
              <p className="text-muted-foreground">
                3단계 프롬프팅으로 대화를 깊이 분석합니다.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-foreground">
                  3
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                결과 확인
              </h3>
              <p className="text-muted-foreground">
                시각화된 차트와 인사이트로 대화 패턴을 확인하세요.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            대화는 서버에 저장되지 않아요
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            안전하게 기기에서 대화를 분석하세요.
          </p>
          <Link href="/upload">
            <Button
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-secondary transform hover:scale-105 transition-all shadow-lg hover:shadow-xl"
              data-testid="button-cta-start"
            >
              무료로 시작하기
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card dark:bg-card border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Maltcha. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
