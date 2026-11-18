"use client";

import { useEffect } from "react";

/** 서비스 워커 등록 (PWA/안드로이드 TWA 설치 품질) */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패는 무시 (사설망·구형 브라우저)
    });
  }, []);

  return null;
}
