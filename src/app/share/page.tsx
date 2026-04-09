/**
 * PWA Web Share Target API 수신 라우트
 * manifest.json의 share_target.action과 일치
 */
import { Suspense } from "react";
import ShareContent from "./ShareContent";

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ShareContent />
    </Suspense>
  );
}
