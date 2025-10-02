import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Upload as UploadIcon,
  FileText,
  X,
  ArrowLeft,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import JSZip from "jszip";
import { isMobile } from "@/lib/device";
import { MobileWarningDialog } from "@/components/mobile-warning-dialog";

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const mobile = isMobile();

  useEffect(() => {
    if (mobile && !localStorage.getItem('mobile-warning-closed')) {
      setShowMobileWarning(true);
    }
  }, [mobile]);

  const analyzeMutation = useMutation({
    mutationFn: async (fileContent: string) => {
      const res = await apiRequest("POST", "/api/analyze", {
        fileName: file!.name,
        fileSize: file!.size,
        fileContent,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/loading/${data.id}`);
    },
    onError: (error: Error) => {
      const description = mobile 
        ? `${error.message}\n\nPC에서 시도하면 더 쉽습니다`
        : error.message;
      
      toast({
        title: "분석 시작 실패",
        description,
        variant: "destructive",
        action: mobile ? (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast({
                  title: "✓ 링크가 복사되었습니다",
                  description: "PC에서 붙여넣기 하세요",
                });
              } catch (err) {
                // Silently fail
              }
            }}
          >
            PC로 링크 보내기
          </Button>
        ) : undefined,
      });
    },
  });

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const fileName = selectedFile.name.toLowerCase();
      const validExtensions = [".txt", ".csv", ".zip"];
      const isValidFile = validExtensions.some((ext) => fileName.endsWith(ext));

      if (!isValidFile) {
        toast({
          title: "잘못된 파일 형식",
          description: "txt, csv, zip 파일만 업로드할 수 있습니다.",
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

      // Find txt or csv files in the zip
      const textFiles = Object.keys(zipContent.files).filter(
        (name) =>
          (name.toLowerCase().endsWith(".txt") ||
            name.toLowerCase().endsWith(".csv")) &&
          !zipContent.files[name].dir,
      );

      if (textFiles.length === 0) {
        throw new Error("zip 파일 내에 txt 또는 csv 파일을 찾을 수 없습니다.");
      }

      // Use the first text file found
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
    // CSV format conversion: assume format is "Date,Time,Name,Message"
    // Convert to KakaoTalk txt format
    const lines = content.split("\n");
    const converted = lines
      .map((line) => {
        // Skip empty lines or header
        if (
          !line.trim() ||
          line.startsWith("Date,") ||
          line.startsWith("날짜,")
        ) {
          return "";
        }

        // Try to parse CSV line
        const parts = line.split(",");
        if (parts.length >= 4) {
          const [date, time, name, ...messageParts] = parts;
          const message = messageParts.join(",").trim();

          // Convert to KakaoTalk format: "2024. 1. 15. 오후 9:30, Name : Message"
          return `${date.trim()} ${time.trim()}, ${name.trim()} : ${message}`;
        }

        return line;
      })
      .filter((line) => line)
      .join("\n");

    return converted || content; // If conversion fails, return original
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      let content: string;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".zip")) {
        // Process zip file
        content = await processZipFile(file);
      } else if (fileName.endsWith(".csv")) {
        // Process csv file
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
        // Process txt file
        const reader = new FileReader();
        content = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("파일 읽기 실패"));
          reader.readAsText(file);
        });
      }

      analyzeMutation.mutate(content);
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

        {/* Upload Zone */}
        <div className="bg-card dark:bg-card rounded-2xl shadow-lg p-8 mb-8 fade-in-up">
          <div
            className={`rounded-xl p-12 text-center cursor-pointer transition-all border-2 border-dashed ${
              dragOver
                ? "border-primary bg-accent dark:bg-accent transform scale-[1.02]"
                : "border-border bg-transparent"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
            data-testid="dropzone-upload"
          >
            <div className="mb-6">
              <UploadIcon className="w-16 h-16 mx-auto text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              파일을 드래그하거나 클릭하여 업로드
            </h3>
            <p className="text-muted-foreground mb-4">
              지원 형식: .txt, .csv, .zip
            </p>
            <p className="text-sm text-muted-foreground">
              최대 파일 크기: 50MB
            </p>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".txt,.csv,.zip"
              onChange={handleFileInput}
              data-testid="input-file"
            />
          </div>

          {/* File Preview */}
          {file && (
            <div className="mt-6 p-4 bg-accent dark:bg-accent rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div>
                    <p
                      className="font-medium text-foreground"
                      data-testid="text-filename"
                    >
                      {file.name}
                    </p>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="text-filesize"
                    >
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  className="text-destructive hover:text-destructive/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  data-testid="button-remove-file"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* File Requirements */}
        <div className="bg-accent/50 dark:bg-accent/50 rounded-xl p-6 mb-8 fade-in-up">
          <h3 className="font-semibold text-foreground mb-3 flex items-center">
            <Info className="w-5 h-5 mr-2 text-primary" />
            {mobile ? "📱 모바일 업로드 가이드 (약 10분 소요)" : "카카오톡 대화 내보내기 방법"}
          </h3>
          
          {mobile ? (
            <>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-xs font-bold mt-0.5">
                    1
                  </div>
                  <p className="pt-0.5">카카오톡 채팅방에서 우측 상단 메뉴(≡) 클릭</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-xs font-bold mt-0.5">
                    2
                  </div>
                  <p className="pt-0.5">우측 상단 설정 → 대화 내보내기 → 내 이메일로 전송</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-xs font-bold mt-0.5">
                    3
                  </div>
                  <p className="pt-0.5">이메일 앱에서 ZIP 파일 다운로드</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-xs font-bold mt-0.5">
                    4
                  </div>
                  <p className="pt-0.5">브라우저로 돌아오기</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-primary-foreground text-xs font-bold mt-0.5">
                    5
                  </div>
                  <p className="pt-0.5">아래에서 ZIP 파일 업로드</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      toast({
                        title: "✓ 링크가 복사되었습니다",
                        description: "PC에서 붙여넣기 하세요",
                      });
                    } catch (err) {
                      toast({
                        title: "링크 복사 실패",
                        description: "수동으로 URL을 복사해주세요",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="w-full"
                >
                  🤔 어려우신가요? PC로 링크 받기
                </Button>
              </div>
            </>
          ) : (
            <>
              <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                <li>1. 카카오톡에서 분석할 채팅방을 엽니다</li>
                <li>2. 우측 상단 메뉴(≡)를 클릭합니다</li>
                <li>3. 우측 상단 설정을 클릭합니다</li>
                <li>4. '대화 내용 내보내기'를 선택합니다</li>
                <li>5. '텍스트 메시지만 보내기'를 선택합니다</li>
                <li>6. 저장된 txt, csv 또는 zip 파일을 업로드합니다</li>
              </ol>
              <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-foreground">
                  💡 <strong>Tip:</strong> zip 파일의 경우 자동으로 압축을 해제하여
                  대화 파일을 찾습니다.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in-up">
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            뒤로 가기
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleAnalyze}
            disabled={!file || analyzeMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-secondary border-2"
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? "업로드 중..." : "분석 시작하기"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
