// client/src/pages/upload.tsx
// 기존 import는 그대로 유지하고, 아래 부분만 수정/추가

import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle, Check, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { apiRequest } from "@/lib/queryClient";
import { MobileWarningDialog } from "@/components/mobile-warning-dialog";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // 관계 유형 상태 관리
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([
    "친구",
  ]);
  const [primaryRelationship, setPrimaryRelationship] =
    useState<string>("친구");

  // 관계 유형 정의 (확장 가능)
  const relationshipTypes = [
    { value: "연인", emoji: "💕", label: "연인", description: "애정 관계" },
    { value: "썸", emoji: "💘", label: "썸", description: "연인 이전 단계" },
    { value: "친구", emoji: "👥", label: "친구", description: "우정 관계" },
    { value: "지인", emoji: "🤝", label: "지인", description: "아는 사이" },
    {
      value: "업무",
      emoji: "💼",
      label: "업무 동료",
      description: "일적 관계",
    },
    {
      value: "파트너",
      emoji: "🤜🤛",
      label: "비즈니스 파트너",
      description: "협업 관계",
    },
    {
      value: "가족",
      emoji: "👨‍👩‍👧‍👦",
      label: "가족",
      description: "혈연/인척 관계",
    },
    {
      value: "멘토",
      emoji: "🎓",
      label: "멘토-멘티",
      description: "상하 관계",
    },
  ];

  // 모바일 감지
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      setShowMobileWarning(true);
    }
  }, []);

  // 관계 토글 함수
  const toggleRelationship = (value: string) => {
    if (selectedRelationships.includes(value)) {
      // 최소 1개는 선택되어야 함
      if (selectedRelationships.length === 1) {
        toast({
          title: "최소 1개 선택 필요",
          description: "관계 유형을 최소 1개는 선택해야 합니다.",
          variant: "destructive",
        });
        return;
      }

      setSelectedRelationships((prev) => prev.filter((r) => r !== value));

      // 주 관계가 제거되면 첫 번째 항목을 주 관계로
      if (primaryRelationship === value) {
        const remaining = selectedRelationships.filter((r) => r !== value);
        setPrimaryRelationship(remaining[0]);
      }
    } else {
      setSelectedRelationships((prev) => [...prev, value]);
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      primaryRelationship: string;
      secondaryRelationships: string[];
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

  const processZipFile = async (file: File): Promise<string> => {
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

      const fileContent = await zipContent.files[textFiles[0]].async("text");

      toast({
        title: "zip 파일 처리 완료",
        description: `${textFiles[0]} 파일을 추출했습니다.`,
      });

      return fileContent;
    } catch (error: any) {
      throw new Error(`zip 파일 처리 실패: ${error.message}`);
    }
  };

  const processCsvFile = (content: string): string => {
    const lines = content.split("\n");
    const converted = lines
      .map((line) => {
        if (
          !line.trim() ||
          line.startsWith("Date,") ||
          line.startsWith("날짜,")
        ) {
          return "";
        }

        const parts = line.split(",");
        if (parts.length >= 4) {
          const [date, time, name, ...messageParts] = parts;
          const message = messageParts.join(",").trim();
          return `${date.trim()} ${time.trim()}, ${name.trim()} : ${message}`;
        }

        return line;
      })
      .filter((line) => line)
      .join("\n");

    return converted || content;
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      let content: string;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".zip")) {
        content = await processZipFile(file);
      } else if (fileName.endsWith(".csv")) {
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            const csvContent = e.target?.result as string;
            resolve(processCsvFile(csvContent));
          };
          reader.onerror = () => reject(new Error("파일 읽기 실패"));
          reader.readAsText(file);
        });
      } else {
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("파일 읽기 실패"));
          reader.readAsText(file);
        });
      }

      // 다중 관계 정보 포함
      analyzeMutation.mutate({
        content,
        primaryRelationship,
        secondaryRelationships: selectedRelationships.filter(
          (r) => r !== primaryRelationship,
        ),
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
          <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
            <label className="block text-sm font-medium text-foreground mb-2">
              대화 상대와의 관계를 선택해주세요
            </label>
            <p className="text-xs text-muted-foreground mb-4">
              여러 관계가 해당된다면 모두 선택하세요. 주요 관계를 다시 클릭하면
              ⭐로 표시됩니다.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {relationshipTypes.map((type) => {
                const isSelected = selectedRelationships.includes(type.value);
                const isPrimary = primaryRelationship === type.value;

                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      if (isSelected && !isPrimary) {
                        setPrimaryRelationship(type.value);
                      } else if (isSelected && isPrimary) {
                        toggleRelationship(type.value);
                      } else {
                        toggleRelationship(type.value);
                        if (selectedRelationships.length === 0) {
                          setPrimaryRelationship(type.value);
                        }
                      }
                    }}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-md"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`relationship-${type.value}`}
                  >
                    {/* 주요 관계 표시 */}
                    {isPrimary && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xs">⭐</span>
                      </div>
                    )}

                    {/* 선택 표시 */}
                    {isSelected && !isPrimary && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <div className="text-3xl mb-2">{type.emoji}</div>
                    <div className="text-sm font-medium text-foreground">
                      {type.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {type.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 선택된 관계 요약 */}
            {selectedRelationships.length > 0 && (
              <div className="mt-4 p-3 bg-accent/20 rounded-lg">
                <p className="text-sm text-foreground">
                  <span className="font-medium">주요 관계:</span>{" "}
                  {primaryRelationship}
                  {selectedRelationships.length > 1 && (
                    <>
                      <span className="mx-2">+</span>
                      <span className="text-muted-foreground">
                        {selectedRelationships
                          .filter((r) => r !== primaryRelationship)
                          .join(", ")}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
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

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 fade-in-up">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-2">카카오톡 대화 내보내기 방법</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>카카오톡 대화방 입장</li>
                <li>우측 상단 메뉴 → 대화 내보내기</li>
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
