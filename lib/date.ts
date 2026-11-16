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
