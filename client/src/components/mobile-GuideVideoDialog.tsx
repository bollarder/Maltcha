// client/src/components/MobileGuideVideoDialog.tsx
// 새로 생성할 파일

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MobileGuideVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileGuideVideoDialog({
  open,
  onOpenChange,
}: MobileGuideVideoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="text-center text-xl text-gray-900">
            📱 모바일 업로드 가이드 (1분)
          </DialogTitle>
        </DialogHeader>

        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
          {/* YouTube 임베드 - 실제 영상 ID로 교체하세요 */}
          {/* 
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
            title="Maltcha 모바일 업로드 가이드"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
          */}

          {/* 영상이 아직 없다면 임시 콘텐츠 */}
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="text-6xl mb-4">🎬</div>
              <p className="text-gray-600 mb-4">가이드 영상 준비 중입니다</p>
              <div className="text-left bg-white p-4 rounded-lg shadow-sm">
                <h4 className="font-semibold mb-2 text-gray-900">
                  간단 가이드:
                </h4>
                <ol className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">1.</span>
                    <span>카카오톡 → 대화방 → 우측 상단 메뉴(≡)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">2.</span>
                    <span>설정(⚙️) → 대화 내보내기</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">3.</span>
                    <span>내 이메일로 전송 선택</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">4.</span>
                    <span>이메일 앱에서 ZIP 파일 다운로드</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">5.</span>
                    <span>여기로 돌아와서 파일 업로드!</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-600 mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="font-semibold mb-2 text-gray-900">📝 빠른 요약:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>카카오톡 → 대화방 → 메뉴(≡) → 설정</li>
            <li>대화 내보내기 → 내 이메일로 전송</li>
            <li>이메일에서 ZIP 파일 다운로드</li>
            <li>브라우저 돌아와서 파일 업로드</li>
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
