/**
 * 지출 내용(description) 통일.
 * 예: "담배 구매" → "담배", "커피 구입" → "커피"
 */

// "요금"은 내용의 일부로 두는 경우가 많아 제거하지 않습니다. (예: 핸드폰 요금)
const TRAILING_NOISE = /\s*(구매|구입|결제|비용)$/u;

export function normalizeExpenseDescription(
  description: string,
  category?: string | null,
  subcategory?: string | null,
): string {
  let d = description.trim().replace(/\s+/g, " ");
  if (!d) return d;

  // 끝의 "구매/구입/결제…" 제거
  const stripped = d.replace(TRAILING_NOISE, "").trim();
  if (stripped) {
    d = stripped;
  }

  const sub = subcategory?.trim() ?? "";
  const cat = category?.trim() ?? "";

  // 소분류·대분류와 같거나 "소분류 …" 형태면 짧은 이름으로 통일
  if (sub && (d === sub || d.startsWith(`${sub} `))) {
    return sub;
  }
  if (cat && (d === cat || d.startsWith(`${cat} `))) {
    return cat;
  }

  return d;
}
