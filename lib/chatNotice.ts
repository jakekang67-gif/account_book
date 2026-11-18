/** 채팅 상단 공지 (닫기 상태 로컬 저장) */

export type ChatNoticePayload = {
  /** 내용이 바뀌면 id도 바꿔서 다시 보이게 */
  id: string;
  title: string;
  message: string;
  models: string[];
};

const DISMISS_KEY = "account_book_chat_notice_dismissed_v1";

export function loadDismissedNoticeId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function saveDismissedNoticeId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, id);
  } catch {
    // ignore
  }
}
