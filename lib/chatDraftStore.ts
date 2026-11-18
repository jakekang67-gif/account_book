/** 앱을 나갔다 와도 채팅·대기 상태를 이어가기 위한 로컬 초안 */

export type ChatDraftMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ChatDraftPendingExpense = {
  date: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string;
};

export type ChatDraft = {
  userId: string;
  messages: ChatDraftMessage[];
  pendingExpense: ChatDraftPendingExpense | null;
  pendingPhase: "confirm" | "await_category" | "await_chat_cleanup" | null;
  input: string;
  /** 나가기 직전 AI 응답 대기 중이었는지 */
  wasSending: boolean;
  /** 재전송용 마지막 사용자 문구 */
  lastUserText: string | null;
  updatedAt: number;
};

const KEY_PREFIX = "account_book_chat_draft_v1:";
const MAX_MESSAGES = 50;

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function loadChatDraft(userId: string): ChatDraft | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatDraft;
    if (!parsed || parsed.userId !== userId || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveChatDraft(
  userId: string,
  draft: Omit<ChatDraft, "userId" | "updatedAt">,
) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const payload: ChatDraft = {
      userId,
      messages: draft.messages.slice(-MAX_MESSAGES),
      pendingExpense: draft.pendingExpense,
      pendingPhase: draft.pendingPhase,
      input: draft.input.slice(0, 500),
      wasSending: draft.wasSending,
      lastUserText: draft.lastUserText,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // quota / private mode
  }
}

export function clearChatDraft(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
