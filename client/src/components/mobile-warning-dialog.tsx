// client/src/components/MobileWarningDialog.tsx
// 전체 교체

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface MobileWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileWarningDialog({
  open,
  onOpenChange,
}: MobileWarningDialogProps) {
  const { toast } = useToast();

  const handleCopyLink = async () => {
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
  };

  const handleContinueOnMobile = () => {
    localStorage.setItem("mobile-warning-closed", "true");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 하얀 배경 적용 */}
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-gray-900">☕ Maltcha</span>
          </div>
          <DialogTitle className="text-center text-2xl text-gray-900">
            📱 모바일이신가요?
          </DialogTitle>
          <DialogDescription className="text-center pt-2 text-gray-600">
            죄송하지만 메신저의 제약으로 모바일 분석에 시간이 더 걸립니다
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-50 rounded-lg p-4 my-4">
          <h4 className="font-semibold text-gray-900 mb-3">
            💻 PC에서 이용하시면:
          </h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              2분 만에 완료
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span>
              간편한 파일 업로드
            </li>
            <li className="flex items-center">
              <span className="mr-2">✓</span>큰 화면으로 결과 확인
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleCopyLink}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            📧 PC로 링크 보내기
          </Button>
          <Button
            onClick={handleContinueOnMobile}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            그래도 모바일로 할래요 (10분+ 소요)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
