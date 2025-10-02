import { useState, useCallback } from "react";
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

export default function Upload() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
      toast({
        title: "분석 시작 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (!selectedFile.name.endsWith(".txt")) {
        toast({
          title: "잘못된 파일 형식",
          description: "txt 파일만 업로드할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "파일 크기 초과",
          description: "파일 크기는 10MB를 초과할 수 없습니다.",
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

  const handleAnalyze = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      analyzeMutation.mutate(content);
    };
    reader.readAsText(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 fade-in-up">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            대화 파일 업로드
          </h1>
          <p className="text-lg text-muted-foreground">
            카카오톡 대화 내보내기 txt 파일을 업로드하세요
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
              지원 형식: .txt (대화 내보내기 파일)
            </p>
            <p className="text-sm text-muted-foreground">
              최대 파일 크기: 10MB
            </p>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".txt"
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
            카카오톡 대화 내보내기 방법
          </h3>
          <ol className="space-y-2 text-sm text-muted-foreground ml-7">
            <li>1. 카카오톡에서 분석할 채팅방을 엽니다</li>
            <li>2. 우측 상단 메뉴(≡)를 클릭합니다</li>
            <li>3. 우측 상단 설정을 클릭합니다</li>
            <li>4. '대화 내용 내보내기'를 선택합니다</li>
            <li>5. '텍스트 메시지만 보내기'를 선택합니다</li>
            <li>6. 저장된 txt 파일을 업로드합니다</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in-up">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setLocation("/")}
            className="border-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            뒤로 가기
          </Button>
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={!file || analyzeMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-secondary"
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
