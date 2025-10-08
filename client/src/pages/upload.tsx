import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Check, ChevronDown } from "lucide-react";
import JSZip from "jszip";
import Papa from "papaparse";
import { apiRequest } from "@/lib/queryClient";
import MobileWarningDialog from "@/components/mobile-warning-dialog";
import MobileGuideVideoDialog from "@/components/mobile-GuideVideoDialog";

// 관계 카테고리 데이터
const relationshipCategories = [
  {
    id: "family-lover",
    label: "가족 및 연인",
    emoji: "❤️",
    subcategories: [
      "배우자", "연인/파트너", "부모", "자녀", "형제자매", "기타 친족", "전 연인/전 배우자"
    ]
  },
  {
    id: "friend",
    label: "친구",
    emoji: "👥",
    subcategories: [
      "가장 친한 친구", "친한 친구", "그냥 친구/지인", "동창"
    ]
  },
  {
    id: "work-school",
    label: "직장 및 학업",
    emoji: "💼",
    subcategories: [
      "직장 상사/선배", "직장 동료", "직장 부하/후배", "거래처",
      "선생님/교수님", "학교 선배", "학교 동기", "학교 후배"
    ]
  },
  {
    id: "social",
    label: "사회적 관계",
    emoji: "🤝",
    subcategories: [
      "동호회 회원", "이웃", "종교 단체", "온라인 커뮤니티"
    ]
  },
  {
    id: "public",
    label: "공적 관계",
    emoji: "👔",
    subcategories: [
      "고객/손님", "서비스 제공자", "면접관", "처음 보는 사람"
    ]
  },
  {
    id: "other",
    label: "기타",
    emoji: "⭐",
    subcategories: ["직접 입력"]
  }
];

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  // 관계 선택 상태 (2단계 계층)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<string>("");
  const [customRelationship, setCustomRelationship] = useState<string>("");
  
  // 분석 목적 상태 관리
  const [userPurpose, setUserPurpose] = useState<string>("");

  // 모바일 감지
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setShowMobileWarning(true);
    }
  }, []);

  // 대분류 선택 핸들러
  const handleCategorySelect = (categoryId: string) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
      setSelectedRelationship("");
      setCustomRelationship("");
    }
  };

  // 소분류 선택 핸들러
  const handleSubcategorySelect = (subcategory: string) => {
    setSelectedRelationship(subcategory);
    if (subcategory !== "직접 입력") {
      setCustomRelationship("");
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      primaryRelationship: string;
      secondaryRelationships: string[];
      userPurpose?: string;
    }) => {
      const res = await apiRequest("POST", "/api/analyze", data);
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/loading/${data.analysisId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "분석 시작 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const fileName = selectedFile.name.toLowerCase();
      const validExtensions = [".txt", ".csv", ".zip"];
      const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

      if (!isValid) {
        toast({
          title: "지원하지 않는 파일 형식",
          description: "txt, csv, zip 파일만 업로드 가능합니다.",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "파일 크기는 20MB를 초과할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      setFile(selectedFile);
    },
    [toast],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect],
  );

  const processZipFile = async (file: File): Promise<{ content: string; fileName: string }> => {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      const textFiles = Object.keys(zipContent.files).filter(
        (name) =>
          (name.toLowerCase().endsWith(".txt") ||
            name.toLowerCase().endsWith(".csv")) &&
          !zipContent.files[name].dir,
      );

      if (textFiles.length === 0) {
        throw new Error("zip 파일 내에 txt 또는 csv 파일을 찾을 수 없습니다.");
      }

      const fileName = textFiles[0];
      const fileContent = await zipContent.files[fileName].async("text");

      toast({
        title: "zip 파일 처리 완료",
        description: `${fileName} 파일을 추출했습니다.`,
      });

      return { content: fileContent, fileName };
    } catch (error: any) {
      throw new Error(error.message || "zip 파일 처리 중 오류가 발생했습니다.");
    }
  };

  const processCsvFile = (content: string): string => {
    const parsed = Papa.parse(content, { header: false });
    const rows = parsed.data as string[][];

    const txtLines = rows
      .filter((row) => row.length >= 3)
      .map((row) => {
        const [date, name, ...messageParts] = row;
        const message = messageParts.join(",");
        return `${date}, ${name} : ${message}`;
      });

    return txtLines.join("\n");
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast({
        title: "파일을 선택해주세요",
        variant: "destructive",
      });
      return;
    }

    // 관계 선택 검증
    const finalRelationship = selectedRelationship === "직접 입력" 
      ? customRelationship.trim()
      : selectedRelationship;

    if (!finalRelationship) {
      toast({
        title: "관계를 선택해주세요",
        description: "대화 상대와의 관계를 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 분석 목적 필수 검증
    if (!userPurpose.trim()) {
      toast({
        title: "분석 목적을 입력해주세요",
        description: "더 나은 분석 결과를 위해 목적을 작성해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      let fileContent = "";
      let fileName = file.name;

      if (file.name.toLowerCase().endsWith(".zip")) {
        const result = await processZipFile(file);
        fileContent = result.content;
        fileName = result.fileName;
      } else {
        fileContent = await file.text();
      }

      if (fileName.toLowerCase().endsWith(".csv")) {
        fileContent = processCsvFile(fileContent);
      }

      analyzeMutation.mutate({
        content: fileContent,
        primaryRelationship: finalRelationship,
        secondaryRelationships: [],
        userPurpose,
      });
    } catch (error: any) {
      toast({
        title: "파일 처리 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <MobileWarningDialog
        open={showMobileWarning}
        onOpenChange={setShowMobileWarning}
      />

      <MobileGuideVideoDialog
        open={showMobileGuide}
        onOpenChange={setShowMobileGuide}
      />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            대화 파일 업로드
          </h1>
          <p className="text-muted-foreground">
            Maltcha AI를 통해 대화를 깊게 분석해보세요
          </p>
        </div>

        {/* Relationship Type Selection */}
        {!file && (
          <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
            <label className="block text-sm font-medium text-foreground mb-2">
              대화 상대와의 관계를 선택해주세요 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-4">
              대분류를 선택하고, 구체적인 관계를 고르세요
            </p>

            <div className="space-y-3">
              {relationshipCategories.map((category) => (
                <div key={category.id}>
                  {/* 대분류 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleCategorySelect(category.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200
                      flex items-center justify-between
                      ${selectedCategory === category.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent/5"
                      }`}
                    data-testid={`category-${category.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.emoji}</span>
                      <span className="font-medium text-foreground">{category.label}</span>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform duration-200 
                        ${selectedCategory === category.id ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* 소분류 옵션 (아코디언) */}
                  {selectedCategory === category.id && (
                    <div className="mt-2 p-4 bg-accent/10 rounded-lg space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {category.subcategories.map((subcategory) => (
                        <button
                          key={subcategory}
                          type="button"
                          onClick={() => handleSubcategorySelect(subcategory)}
                          className={`w-full p-3 rounded-lg text-left transition-all duration-150
                            ${selectedRelationship === subcategory
                              ? "bg-primary text-primary-foreground font-medium"
                              : "bg-background hover:bg-accent text-foreground"
                            }`}
                          data-testid={`subcategory-${subcategory}`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{subcategory}</span>
                            {selectedRelationship === subcategory && (
                              <Check className="w-4 h-4" />
                            )}
                          </div>
                        </button>
                      ))}

                      {/* 직접 입력 필드 */}
                      {selectedRelationship === "직접 입력" && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                          <input
                            type="text"
                            value={customRelationship}
                            onChange={(e) => setCustomRelationship(e.target.value)}
                            placeholder="관계를 입력하세요 (예: 사촌)"
                            className="w-full p-3 rounded-lg border-2 border-primary bg-background 
                              text-foreground placeholder:text-muted-foreground
                              focus:outline-none focus:ring-2 focus:ring-primary/20"
                            data-testid="input-custom-relationship"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 선택된 관계 표시 */}
            {selectedRelationship && (
              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-foreground">
                  <span className="font-medium">선택된 관계:</span>{" "}
                  {selectedRelationship === "직접 입력" 
                    ? customRelationship || "직접 입력 중..." 
                    : selectedRelationship}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Analysis Purpose Input - 항상 표시 */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
          <label htmlFor="purpose-input" className="block text-sm font-medium text-foreground mb-2">
            대화에서 무엇이 알고 싶나요? <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-4">
            분석 목적을 자유롭게 작성해주세요 (필수)
          </p>
          <textarea
            id="purpose-input"
            value={userPurpose}
            onChange={(e) => setUserPurpose(e.target.value)}
            placeholder="예: 우리 관계의 친밀도를 알고 싶어요 / 대화 패턴을 분석하고 싶어요"
            required
            className="w-full min-h-[120px] p-4 rounded-xl border-2 border-border 
                      bg-background text-foreground resize-none
                      focus:outline-none focus:border-primary
                      placeholder:text-muted-foreground
                      transition-colors"
            data-testid="input-purpose"
          />
          {userPurpose && (
            <div className="mt-3 p-3 bg-accent/20 rounded-lg">
              <p className="text-xs text-muted-foreground">
                💡 AI가 이 목적에 맞춰 대화를 분석합니다
              </p>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
          <div
            className={`rounded-xl p-12 text-center cursor-pointer transition-all border-2 border-dashed ${
              dragOver
                ? "border-primary bg-primary/5 scale-105"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById("file-input")?.click()}
            data-testid="upload-zone"
          >
            {file ? (
              <div className="space-y-4">
                <FileText className="w-16 h-16 mx-auto text-primary" />
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  variant="outline"
                  className="mt-4"
                  data-testid="button-remove-file"
                >
                  파일 제거
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    txt, csv, zip 파일 지원 (최대 50MB)
                  </p>
                </div>
              </div>
            )}
          </div>
          <input
            id="file-input"
            type="file"
            accept=".txt,.csv,.zip"
            onChange={handleFileInput}
            className="hidden"
            data-testid="input-file"
          />

          {file && (
            <div className="mt-6">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-secondary text-lg py-6"
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    분석 시작 중...
                  </>
                ) : (
                  "분석 시작하기"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Guide Button - Mobile Only */}
        <div className="mb-8 fade-in-up block md:hidden">
          <Button
            onClick={() => setShowMobileGuide(true)}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="button-mobile-guide"
          >
            📱 모바일 가이드 보기
          </Button>
        </div>
      </div>
    </div>
  );
}
