/** 앱을 나갔다 와도 채팅·대기 상태를 이어가기 위한 로컬 초안 */

export type ChatDraftMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** 저장된 지출과 연결된 경우 */
  expenseId?: number | null;
};

export type ChatDraftPendingExpense = {
  date: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string;
  sourceMessageId?: string | null;
};

export type ChatDraft = {
  userId: string;
  messages: ChatDraftMessage[];
  pendingExpense: ChatDraftPendingExpense | null;
  pendingPhase:
    | "confirm"
    | "await_category"
    | "await_chat_cleanup"
    | "await_stats_confirm"
    | null;
  input: string;
  /** 나가기 직전 AI 응답 대기 중이었는지 */
  wasSending: boolean;
  /** 재전송용 마지막 사용자 문구 */
  lastUserText: string | null;
  updatedAt: number;
};

const KEY_PREFIX = "account_book_chat_draft_v1:";
/** 안전 상한 (날짜 필터 후) */
const MAX_MESSAGES = 400;
/** 당일 기준 약 1개월 */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function messageTimestamp(id: string): number {
  if (id === "welcome") return Date.now();
  const n = Number(String(id).split("-")[0]);
  return Number.isFinite(n) ? n : 0;
}

/** 최근 1개월 이내 메시지만 유지 (welcome 제외하고 비면 welcome만) */
export function filterMessagesWithinRetention<T extends { id: string }>(
  messages: T[],
): T[] {
  const cutoff = Date.now() - RETENTION_MS;
  const kept = messages.filter((m) => {
    if (m.id === "welcome") return true;
    const ts = messageTimestamp(m.id);
    return ts === 0 || ts >= cutoff;
  });
  return kept.slice(-MAX_MESSAGES);
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
    return {
      ...parsed,
      messages: filterMessagesWithinRetention(parsed.messages),
    };
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
      messages: filterMessagesWithinRetention(draft.messages),
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
