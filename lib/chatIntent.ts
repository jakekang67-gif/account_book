/**
 * 챗봇 메시지 의도: 지출 입력 vs 통계/조회 질문
 */

export type ChatIntent = "expense" | "stats";

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
 * 금액이 있으면 지출, 의문 단서가 있으면 질문.
 * 둘 다면 금액(지출) 우선.
 */
export function detectChatIntent(text: string): ChatIntent {
  if (hasExpenseAmount(text)) return "expense";
  if (looksLikeStatsQuestion(text)) return "stats";
  return "expense";
}
