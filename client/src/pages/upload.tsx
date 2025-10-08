import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import JSZip from "jszip";
import Papa from "papaparse";
import { apiRequest } from "@/lib/queryClient";
import MobileWarningDialog from "@/components/mobile-warning-dialog";
import MobileGuideVideoDialog from "@/components/mobile-GuideVideoDialog";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [showMobileGuide, setShowMobileGuide] = useState(false);

  // 관계 유형 상태 관리 (단순화)
  const [selectedRelations, setSelectedRelations] = useState<string[]>(["친구"]);
  
  // 분석 목적 상태 관리
  const [userPurpose, setUserPurpose] = useState<string>("");

  // 관계 유형 정의
  const relationshipTypes = [
    { value: "친구", emoji: "👥", label: "친구" },
    { value: "연인", emoji: "💕", label: "연인" },
    { value: "가족", emoji: "👨‍👩‍👧‍👦", label: "가족" },
    { value: "동료", emoji: "💼", label: "동료" },
    { value: "선후배", emoji: "🎓", label: "선후배" },
    { value: "지인", emoji: "🤝", label: "지인" },
    { value: "온라인 친구", emoji: "💻", label: "온라인 친구" },
    { value: "기타", emoji: "⭐", label: "기타" },
  ];

  // 모바일 감지
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setShowMobileWarning(true);
    }
  }, []);

  // 관계 토글 함수
  const toggleRelation = (value: string) => {
    if (selectedRelations.includes(value)) {
      // 마지막 1개는 해제 불가
      if (selectedRelations.length === 1) {
        toast({
          title: "최소 1개 관계는 선택되어야 해요",
          duration: 3000,
        });
        return;
      }
      setSelectedRelations((prev) => prev.filter((r) => r !== value));
    } else {
      setSelectedRelations((prev) => [...prev, value]);
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

      if (selectedFile.size > 50 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "파일 크기는 50MB를 초과할 수 없습니다.",
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
      throw new Error(`zip 파일 처리 실패: ${error.message}`);
    }
  };

  // CSV를 카카오톡 TXT 형식으로 변환 (Papaparse 사용)
  const convertCsvToKakaoFormat = (csvContent: string): string => {
    const parsed = Papa.parse(csvContent, {
      header: false,
      skipEmptyLines: true,
      // RFC 4180 표준 준수: 따옴표, 개행, 쉼표 모두 올바르게 처리
    });

    if (parsed.errors.length > 0) {
      console.error("CSV 파싱 에러:", parsed.errors);
    }

    const converted: string[] = [];

    for (const row of parsed.data as string[][]) {
      if (!row || row.length < 3) continue;

      const firstCell = row[0]?.toLowerCase() || '';
      
      // 헤더 및 메타데이터 라인 건너뛰기
      if (firstCell.includes('date') || firstCell.includes('날짜') || 
          firstCell.includes('timestamp') || firstCell.includes('시간') ||
          firstCell.includes('sep=') || firstCell.includes('user') ||
          firstCell.includes('사용자')) {
        continue;
      }

      let timestamp: string;
      let user: string;
      let message: string;

      if (row.length === 3) {
        // Timestamp,User,Message
        [timestamp, user, message] = row;
      } else {
        // Date,Time,User,Message
        const [date, time, userName, ...msgParts] = row;
        timestamp = `${date} ${time}`;
        user = userName;
        message = msgParts.join(',');
      }

      // 카카오톡 형식으로 변환: "2024. 1. 15. 오후 2:30, 이름 : 메시지"
      if (user && message) {
        converted.push(`${timestamp}, ${user} : ${message}`);
      }
    }

    return converted.join('\n');
  };

  const handleAnalyze = async () => {
    if (!file) return;

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
      let content: string;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".zip")) {
        // ZIP 파일: 압축 해제 후 첫 번째 txt/csv 파일 추출
        const { content: extractedContent, fileName: extractedFileName } = await processZipFile(file);
        
        // 추출된 파일의 확장자로 CSV 판단 (가장 확실한 방법)
        if (extractedFileName.toLowerCase().endsWith('.csv')) {
          content = convertCsvToKakaoFormat(extractedContent);
        } else {
          content = extractedContent;
        }
      } else if (fileName.endsWith(".csv")) {
        // CSV 파일: 카카오톡 형식으로 변환
        const reader = new FileReader();
        const csvContent = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("파일 읽기 실패"));
          reader.readAsText(file);
        });
        content = convertCsvToKakaoFormat(csvContent);
      } else {
        // TXT 파일: 그대로 읽기
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("파일 읽기 실패"));
          reader.readAsText(file);
        });
      }

      // 첫 번째 관계를 주관계로, 나머지를 부관계로 전달
      analyzeMutation.mutate({
        content,
        primaryRelationship: selectedRelations[0],
        secondaryRelationships: selectedRelations.slice(1),
        userPurpose: userPurpose.trim() || undefined,
      });
    } catch (error: any) {
      toast({
        title: "파일 처리 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <MobileWarningDialog
        open={showMobileWarning}
        onOpenChange={setShowMobileWarning}
      />
      <MobileGuideVideoDialog
        open={showMobileGuide}
        onOpenChange={setShowMobileGuide}
      />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            대화 파일 업로드
          </h1>
          <p className="text-lg text-muted-foreground">
            Maltcha AI를 통해 대화를 깊게 분석해보세요
          </p>
        </div>

        {/* Relationship Type Selection */}
        {!file && (
          <>
            <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
              <label className="block text-sm font-medium text-foreground mb-2">
                대화 상대와의 관계를 선택해주세요
              </label>
              <p className="text-xs text-muted-foreground mb-4">
                여러 관계가 해당된다면 모두 선택하세요 (최소 1개 필수)
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {relationshipTypes.map((type) => {
                  const isSelected = selectedRelations.includes(type.value);
                  const isLastOne = selectedRelations.length === 1 && isSelected;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => toggleRelation(type.value)}
                      disabled={isLastOne}
                      aria-pressed={isSelected}
                      aria-label={`${type.label} ${isSelected ? "선택됨" : "선택 안 됨"}`}
                      className={`
                        relative p-4 rounded-xl border-2 transition-all duration-200 ease-in-out
                        flex flex-col items-center justify-center gap-2 min-h-[120px]
                        ${
                          isSelected
                            ? "border-[#A8D5BA] bg-[#E8F5E9]"
                            : "border-[#E0E0E0] bg-[#F9F9F9] hover:border-[#A8D5BA] hover:bg-[#F0F9F4]"
                        }
                        ${isLastOne ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
                      `}
                      data-testid={`relationship-${type.value}`}
                    >
                      {/* 아이콘 */}
                      <div className="absolute top-3 right-3">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-[#A8D5BA] flex items-center justify-center animate-scale-in">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <Circle className="w-6 h-6 text-[#BDC3C7]" />
                        )}
                      </div>

                      {/* 이모지 */}
                      <div className="text-4xl mb-1">{type.emoji}</div>

                      {/* 레이블 */}
                      <div
                        className={`text-sm text-foreground ${
                          isSelected ? "font-semibold" : "font-normal"
                        }`}
                      >
                        {type.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 선택된 관계 요약 */}
              {selectedRelations.length > 0 && (
                <div className="mt-4 p-3 bg-accent/20 rounded-lg">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">선택된 관계:</span>{" "}
                    {selectedRelations.join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Analysis Purpose Input */}
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
          </>
        )}

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
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  variant="outline"
                  size="sm"
                >
                  다른 파일 선택
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold text-foreground mb-2">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-sm text-muted-foreground">
                    txt, csv, zip 파일 지원 (최대 50MB)
                  </p>
                </div>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept=".txt,.csv,.zip"
              onChange={handleFileInput}
              className="hidden"
              data-testid="file-input"
            />
          </div>

          {file && (
            <div className="mt-6">
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full bg-primary text-primary-foreground hover:bg-secondary"
                size="lg"
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
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

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 fade-in-up">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-2">카카오톡 대화 내보내기 방법</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>카카오톡 대화방 입장</li>
                <li>우측 상단 메뉴 → 설정 → 대화 내보내기</li>
                <li>txt 또는 csv 형식으로 저장</li>
                <li>저장된 파일을 업로드</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
