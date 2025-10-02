// client/src/components/MobileWarningDialog.tsx
// 전체 파일 교체

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MobileWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileWarningDialog({
  open,
  onOpenChange,
}: MobileWarningDialogProps) {
  const handleContinueOnMobile = () => {
    localStorage.setItem("mobile-warning-closed", "true");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <span className="text-2xl font-bold text-gray-900">☕ Maltcha</span>
          </div>
          <DialogTitle className="text-center text-2xl text-gray-900">
            📱 모바일이신가요?
          </DialogTitle>
          <DialogDescription className="text-center pt-2 text-gray-600">
            모바일도 가능하지만, PC에서 하면 훨씬 빠르고 편해요!
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 my-4">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <div className="text-4xl mb-2">💻</div>
              <div className="text-2xl font-bold text-green-600 mb-1">2분</div>
              <div className="text-sm text-gray-600">간편 업로드</div>
            </div>
            <div>
              <div className="text-4xl mb-2">📱</div>
              <div className="text-2xl font-bold text-orange-600 mb-1">
                10분+
              </div>
              <div className="text-sm text-gray-600">복잡한 과정</div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleContinueOnMobile}
          className="w-full text-white hover:opacity-90"
          style={{ backgroundColor: "#8ba888" }}
        >
          그래도 모바일로 할래요
        </Button>

        <p className="text-xs text-center text-gray-400 mt-2">
          💡 가능하면 PC로 다시 접속하는 걸 추천드려요
        </p>
      </DialogContent>
    </Dialog>
  );
}
