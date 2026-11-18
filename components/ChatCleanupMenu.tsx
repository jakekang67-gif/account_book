"use client";

type ChatCleanupMenuProps = {
  open: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onStartSelect: () => void;
};

/** 채팅만 지우기 (지출 내역은 유지) */
export function ChatCleanupMenu({
  open,
  onClose,
  onClearAll,
  onStartSelect,
}: ChatCleanupMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-cleanup-title"
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="chat-cleanup-title"
          className="text-[17px] font-semibold text-[#1d1d1f]"
        >
          채팅 삭제
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#86868b]">
          대화 내용만 지웁니다. 이미 저장된 지출 금액·내역은 그대로 둡니다.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              onStartSelect();
              onClose();
            }}
            className="w-full rounded-2xl bg-[#f5f5f7] py-3 text-[14px] font-medium text-[#1d1d1f]"
          >
            선택해서 삭제
          </button>
          <button
            type="button"
            onClick={() => {
              onClearAll();
              onClose();
            }}
            className="w-full rounded-2xl bg-[#1d1d1f] py-3 text-[14px] font-medium text-white"
          >
            채팅 전체 삭제
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-[13px] text-[#86868b]"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
