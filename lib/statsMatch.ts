import type { CategoryTree } from "@/lib/categories";
import { hasExpenseAmount } from "@/lib/chatIntent";

export type StatsCandidate = {
  category: string;
  subcategory: string | null;
  label: string;
};

/** 총지출·합계처럼 분류 확인 없이 바로 답할 질문 */
export function looksLikeTotalExpenseQuestion(text: string) {
  const t = text.trim();
  if (!t || hasExpenseAmount(t)) return false;
  const compact = t.replace(/\s+/g, "");

  // 특정 분류를 콕 집어 물은 경우는 총지출이 아님 (예: 담배 얼마, 주류 합계)
  // → 호출측에서 후보가 있어도, 아래 총지출 신호가 더 분명하면 총지출로 처리

  const hasTotalCue =
    /(총\s*지출|지출\s*합계|지출\s*총액|총액|전체\s*지출|모두\s*얼마|다\s*합쳐|총지출)/.test(
      t,
    ) ||
    /총지출|지출합계|지출총액|전체지출/.test(compact);

  const hasMonthTotalCue =
    /(이번|저번|지난)\s*달\s*(의\s*)?(총\s*)?(지출|합계|얼마)/.test(t) ||
    /(이번달|저번달|지난달)(의)?(총)?(지출|합계|얼마)/.test(compact);

  const isShortTotalAsk =
    /^(이번달|저번달|지난달)?(의)?(총)?(지출|합계|얼마)(이|가|은|는)?(야|에요|예요|인가요|인가|지|얼마|얼마야|알려줘|보여줘)?\??$/.test(
      compact,
    );

  return hasTotalCue || hasMonthTotalCue || isShortTotalAsk;
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** 질문 속 동의어 → 대분류 */
const CATEGORY_ALIASES: Record<string, string> = {
  술: "주류",
  술자리: "주류",
  주류구매: "주류",
  담배값: "담배",
  커피값: "음료",
  카페: "음료",
  교통: "교통비",
  택시비: "교통비",
  식비: "식대",
  밥: "식대",
  점심값: "식대",
  통신: "통신비",
  핸드폰: "통신비",
  여행비: "취미",
};

/**
 * 질문에서 대·소분류 후보를 찾습니다.
 * 정확히 하나면 확인용으로 돌려주고, 여러 개면 선택을 묻습니다.
 */
export function findStatsCandidates(
  text: string,
  tree: CategoryTree,
): StatsCandidate[] {
  const t = norm(text);
  const queryCore = t
    .replace(
      /(총\s*)?지출|얼마|얼마나|합계|알려줘|알려\s*줘|보여줘|보여\s*줘|이번\s*달|저번\s*달|지난\s*달|\?|？/g,
      "",
    )
    .trim();

  if (!queryCore) return [];

  const found = new Map<string, StatsCandidate>();

  function add(category: string, subcategory: string | null) {
    const key = `${category}\0${subcategory ?? ""}`;
    if (found.has(key)) return;
    found.set(key, {
      category,
      subcategory,
      label: subcategory ? `${category}_${subcategory}` : category,
    });
  }

  // 동의어 → 대분류
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (queryCore.includes(norm(alias)) && category in tree) {
      add(category, null);
    }
  }

  // 대분류 이름 포함
  for (const category of Object.keys(tree)) {
    if (category === "수입") continue;
    const c = norm(category);
    if (queryCore.includes(c) || c.includes(queryCore)) {
      add(category, null);
    }
  }

  // 소분류 이름 유사/부분 일치
  for (const [category, subs] of Object.entries(tree)) {
    if (category === "수입") continue;
    for (const sub of subs) {
      const s = norm(sub);
      if (!s) continue;
      if (
        queryCore.includes(s) ||
        s.includes(queryCore) ||
        (queryCore.length >= 2 && s.includes(queryCore))
      ) {
        add(category, sub);
      }
    }
  }

  // "여행"처럼 소분류에만 들어 있는 경우 대분류 단독 후보는 약하게 유지
  return [...found.values()];
}

export function formatStatsConfirmQuestion(candidates: StatsCandidate[]) {
  if (candidates.length === 0) {
    return "어떤 분류의 지출을 말씀하신 건가요? 예: “주류”, “담배”, “가족_가족여행”";
  }
  if (candidates.length === 1) {
    const c = candidates[0];
    return c.subcategory
      ? `「${c.category}_${c.subcategory}」가 맞나요?`
      : `「${c.category}」가 맞나요?`;
  }
  const labels = candidates.map((c) => c.label);
  if (labels.length === 2) {
    return `${labels[0]} 또는 ${labels[1]} 중 어느 것인가요?`;
  }
  return `다음 중 어느 것인가요?\n${labels.map((l) => `· ${l}`).join("\n")}`;
}

/** 사용자 답변에서 후보 하나 고르기 */
export function pickStatsCandidate(
  text: string,
  candidates: StatsCandidate[],
): StatsCandidate | null {
  const t = norm(text);
  if (!t) return null;

  // 네/맞아요 + 후보 1개
  if (
    candidates.length === 1 &&
    /^(네|예|응|어|ㅇㅇ|맞아|맞아요|맞습니다|그래|그래요|좋아|좋아요|ok|yes)$/i.test(
      t,
    )
  ) {
    return candidates[0];
  }

  const scored = candidates
    .map((c) => {
      const label = norm(c.label);
      const cat = norm(c.category);
      const sub = c.subcategory ? norm(c.subcategory) : "";
      let score = 0;
      if (t.includes(label) || label.includes(t)) score += 3;
      if (sub && (t.includes(sub) || sub.includes(t))) score += 2;
      if (t.includes(cat) || cat.includes(t)) score += 1;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  if (scored.length === 1 || scored[0].score > scored[1].score) {
    return scored[0].c;
  }
  return null;
}
