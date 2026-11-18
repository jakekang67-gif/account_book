"use client";

import { useEffect, useState } from "react";
import {
  clearDismissedNoticeId,
  loadDismissedNoticeId,
  saveDismissedNoticeId,
  type ChatNoticePayload,
} from "@/lib/chatNotice";

type ChatNoticeBannerProps = {
  /** false면 숨김 (예: 선택 삭제 모드) */
  active?: boolean;
  /**
   * 값이 바뀔 때마다 공지를 다시 불러와 강제로 표시합니다.
   * 메뉴 「안내 다시 보기」에서 증가시킵니다.
   */
  showRequestId?: number;
};

/** 채팅 상단 — 모델·업데이트 안내 */
export function ChatNoticeBanner({
  active = true,
  showRequestId = 0,
}: ChatNoticeBannerProps) {
  const [notice, setNotice] = useState<ChatNoticePayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function load(forceShow: boolean) {
      setLoading(true);
      try {
        const res = await fetch("/api/notice", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ChatNoticePayload;
        if (cancelled || !data?.id || !data?.message) return;

        setNotice(data);

        if (forceShow) {
          clearDismissedNoticeId();
          setVisible(true);
          return;
        }

        const dismissed = loadDismissedNoticeId();
        setVisible(dismissed !== data.id);
      } catch {
        // 네트워크 오류 시 공지 생략
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(showRequestId > 0);
    return () => {
      cancelled = true;
    };
  }, [active, showRequestId]);

  if (!active) return null;
  if (!visible || !notice) {
    if (loading && showRequestId > 0) {
      return (
        <p className="mb-3 text-center text-[12px] text-[#86868b]">
          안내를 불러오는 중...
        </p>
      );
    }
    return null;
  }

  return (
    <div className="mb-3 rounded-2xl border border-black/5 bg-[#fff8e8] px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#1d1d1f]">
          {notice.title}
        </p>
        <button
          type="button"
          aria-label="공지 닫기"
          onClick={() => {
            saveDismissedNoticeId(notice.id);
            setVisible(false);
          }}
          className="shrink-0 rounded-lg px-2 py-0.5 text-[12px] text-[#86868b] hover:bg-black/5"
        >
          닫기
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-[#6e6e73]">
        {notice.message}
      </p>
    </div>
  );
}
