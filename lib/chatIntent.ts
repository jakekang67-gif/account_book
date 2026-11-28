/**
 * 챗봇 메시지 의도: 지출 입력 vs 통계/조회 vs 채팅 삭제
 */

export type ChatIntent = "expense" | "stats" | "chat_cleanup" | "recurring_stats";

/** 고정(정기) 지출 조회 — 「고정」「정기」 모두 인식 */
export function looksLikeRecurringStats(text: string) {
  const t = text.trim();
  if (!t || hasExpenseAmount(t)) return false;
  return /정기\s*지출|정기지출|고정\s*지출|고정지출/.test(t);
}

/** 금액이 포함되어 있으면 지출 입력으로 봅니다. */
export function hasExpenseAmount(text: string) {
  const t = text.trim();
  if (!t) return false;

  // 12,000원 / 12000원 / 1.5만원 / 2만 원 / 10만
  if (
    /\d{1,3}(?:,\d{3})+\s*원/.test(t) ||
    /\d+\s*원/.test(t) ||
    /\d+(?:\.\d+)?\s*만\s*원?/.test(t) ||
    /\d+\s*천\s*원?/.test(t)
  ) {
    return true;
  }

  return false;
}

/** 통계·조회 질문 신호 */
export function looksLikeStatsQuestion(text: string) {
  const t = text.trim();
  if (!t) return false;

  // 물음표만으로도 질문이지만, 지출 확인("저장할까요?")과 겹치지 않게 키워드 위주
  const questionCue =
    /(얼마|얼마나|뭐|무엇|어떻게|어디|언제|몇|어느|총\s*지출|합계|가장\s*많이|제일\s*많이|많이\s*쓴|지난주|이번\s*달|저번\s*달|지난\s*달|어제|오늘\s*뭐|뭐\s*샀|뭐\s*샀더라|알려\s*줘|알려줘|보여\s*줘|보여줘|분석|통계|비교|평균|순위)/.test(
      t,
    );

  const endsWithQuestion = /[?？]$/.test(t) || /까요\s*[?？]?$/.test(t);

  return questionCue || (endsWithQuestion && !hasExpenseAmount(t));
}

/**
 * 채팅(대화)만 지우겠다는 요청.
 * 지출·내역 삭제는 제외합니다.
 */
export function looksLikeChatCleanupRequest(text: string) {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t || hasExpenseAmount(t)) return false;

  // "지출 내역 삭제" 등은 채팅 삭제가 아님
  if (
    /(지출|내역).*(삭제|지워|제거|없애)/.test(t) &&
    !/(채팅|대화|메시지|말풍선)/.test(t)
  ) {
    return false;
  }

  return (
    /(채팅|대화|메시지|말풍선).{0,12}(내용|기록|히스토리)? .{0,6}(삭제|지워|비워|클리어|없애|정리)/.test(
      t,
    ) ||
    /(채팅|대화|메시지|말풍선).{0,8}(삭제|지워|비워|클리어|없애|정리)/.test(t) ||
    /(삭제|지워|비워|클리어|없애).{0,8}(채팅|대화|메시지|말풍선)/.test(t) ||
    /^(채팅|대화)\s*(전체\s*)?(삭제|지워|클리어)/.test(t)
  );
}

/** 「전부」로 전체 채팅 삭제 */
export function isChatCleanupAllChoice(text: string) {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return false;
  if (
    /^(전부|전체|다|모두|올|all|전체삭제|전부삭제|다지워|다삭제|전부지워|전체지워|다잊어)$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /^(전부|전체|모두|다).{0,6}(삭제|지워|클리어)/.test(t);
}

/** 「선택」으로 부분 삭제 모드 */
export function isChatCleanupSelectChoice(text: string) {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return false;
  if (/^(선택|골라|일부|부분|select)$/i.test(t)) return true;
  return /^(선택|일부|골라|부분).{0,6}(삭제|지워)/.test(t);
}

/**
 * 금액이 있으면 지출, 채팅 삭제·통계 단서가 있으면 해당 의도.
 * 둘 다면 금액(지출) 우선.
 */
export function detectChatIntent(text: string): ChatIntent {
  if (hasExpenseAmount(text)) return "expense";
  if (looksLikeChatCleanupRequest(text)) return "chat_cleanup";
  if (looksLikeRecurringStats(text)) return "recurring_stats";
  if (looksLikeStatsQuestion(text)) return "stats";
  return "expense";
}
