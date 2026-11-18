"use client";

import { useEffect, useState } from "react";
import {
  loadDismissedNoticeId,
  saveDismissedNoticeId,
  type ChatNoticePayload,
} from "@/lib/chatNotice";

type ChatNoticeBannerProps = {
  /** false면 숨김 (예: 채팅 탭이 아닐 때) */
  active?: boolean;
};

/** 채팅 상단에서 확인하는 앱 공지 */
export function ChatNoticeBanner({ active = true }: ChatNoticeBannerProps) {
  const [notice, setNotice] = useState<ChatNoticePayload | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/notice", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ChatNoticePayload;
        if (cancelled || !data?.id || !data?.message) return;

        const dismissed = loadDismissedNoticeId();
        if (dismissed === data.id) {
          setNotice(data);
          setVisible(false);
          return;
        }
        setNotice(data);
        setVisible(true);
      } catch {
        // 네트워크 오류 시 공지 생략
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active || !visible || !notice) return null;

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
