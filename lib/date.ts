/**
 * 한국(Asia/Seoul) 기준 날짜 유틸
 * UTC(toISOString) 대신 이 함수들을 사용합니다.
 */

/** 한국 시간 기준 YYYY-MM-DD */
export function koreaDateString(offsetDays = 0) {
  const now = new Date();
  // Asia/Seoul의 연·월·일을 직접 읽어 UTC 날짜 오차를 피합니다.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  // 자정 기준 Date로 만든 뒤 offsetDays 적용
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);

  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 한국 오늘 날짜 (date input max 등에 사용) */
export function koreaToday() {
  return koreaDateString(0);
}

/** 한국 시간 기준 시(0–23) */
export function koreaHour() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

/** 정기 지출·수입을 내역에 반영하기 시작하는 한국 시각 (시) */
export const RECURRING_REFLECT_HOUR = 10;

/**
 * 정기 항목 반영 기준일 (YYYY-MM-DD).
 * 당일 오전 RECURRING_REFLECT_HOUR 시 전이면 어제, 이후면 오늘.
 */
export function koreaRecurringReflectDate(hour = koreaHour()) {
  if (hour < RECURRING_REFLECT_HOUR) return koreaDateString(-1);
  return koreaToday();
}

/** description이 정기 자동반영 건인지 ([정기#id] 접두) */
export function isRecurringExpenseDescription(description: string) {
  return /^\[정기#\d+\]/.test(description.trim());
}
