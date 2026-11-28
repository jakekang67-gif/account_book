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
  return (
    /(총\s*지출|지출\s*합계|지출\s*총액|총액|전체\s*지출|모두\s*얼마|다\s*합쳐)/.test(
      t,
    ) ||
    /(이번|저번|지난)\s*달\s*(총\s*)?(지출|합계|얼마)/.test(t) ||
    /^(이번달|저번달|지난달)?(의)?(총)?(지출|합계|얼마)(야|에요|예요|인가요|인가|지)?\??$/.test(
      compact,
    ) ||
    /^총지출/.test(compact) ||
    (/얼마(야|에요|예요|인가요)?\??$/.test(compact) &&
      /(이번달|저번달|지난달|총|합계|지출)/.test(compact))
  );
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** 질문에서 분류 핵심어만 남깁니다. */
export function statsQueryCore(text: string) {
  return norm(text)
    .replace(
      /(총\s*)?지출|정기|고정|얼마|얼마나|합계|알려줘|알려\s*줘|보여줘|보여\s*줘|이번\s*달|저번\s*달|지난\s*달|\?|？/g,
      "",
    )
    .replace(/(야|에요|예요|인가요|인가|지)$/g, "")
    .trim();
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
 * (확인 질문용 — 최종 해석은 resolveStatsCategory 를 쓰세요.)
 */
export function findStatsCandidates(
  text: string,
  tree: CategoryTree,
): StatsCandidate[] {
  const queryCore = statsQueryCore(text);
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

  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (queryCore.includes(norm(alias)) && category in tree) {
      add(category, null);
    }
  }

  for (const category of Object.keys(tree)) {
    if (category === "수입") continue;
    const c = norm(category);
    if (queryCore.includes(c) || c.includes(queryCore)) {
      add(category, null);
    }
  }

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

  return [...found.values()];
}

export type ResolvedStatsCategory =
  | {
      kind: "category";
      category: string;
      /** 소분류 질문이면 채움. 대분류만 물으면 null */
      subcategory: string | null;
    }
  | { kind: "ambiguous"; candidates: StatsCandidate[] }
  | { kind: "none" };

/**
 * 대분류만 물으면 대분류, 소분류(예: 가족식대)를 물으면 대·소분류를 함께 반환합니다.
 */
export function resolveStatsCategory(
  text: string,
  tree: CategoryTree,
): ResolvedStatsCategory {
  const queryCore = statsQueryCore(text);
  if (!queryCore || queryCore.length < 2) return { kind: "none" };

  // 1) 질문 핵심이 대분류명·동의어와 정확히 같으면 그 대분류
  //    예: "식대?" → 식대 (가족식대/기타식대로 갈리지 않음)
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (queryCore === norm(alias) && category in tree) {
      return { kind: "category", category, subcategory: null };
    }
  }
  for (const category of Object.keys(tree)) {
    if (category === "수입") continue;
    if (queryCore === norm(category)) {
      return { kind: "category", category, subcategory: null };
    }
  }

  type SubHit = { category: string; subcategory: string; score: number };

  // 2) 강한 소분류: 정확히 같거나 질문에 소분류 전체 포함
  //    예: "가족식대 지출?" / "가족 식대?" / "AI구독?"
  const strongSubs: SubHit[] = [];
  for (const [category, subs] of Object.entries(tree)) {
    if (category === "수입") continue;
    for (const sub of subs) {
      const s = norm(sub);
      if (!s) continue;
      let score = 0;
      if (queryCore === s) score = 100;
      else if (queryCore.includes(s)) score = 80 + s.length;
      // 대분류+소분류 조각: "가족"+"식대" → "가족식대"
      else if (
        queryCore.includes(norm(category)) &&
        s.includes(norm(category)) === false &&
        queryCore.replace(norm(category), "").length >= 2 &&
        s.includes(queryCore.replace(norm(category), ""))
      ) {
        score = 70 + s.length;
      } else continue;
      strongSubs.push({ category, subcategory: sub, score });
    }
  }
  if (strongSubs.length > 0) {
    strongSubs.sort((a, b) => b.score - a.score);
    const best = strongSubs[0];
    const top = strongSubs.filter((h) => h.score === best.score);
    const categories = [...new Set(top.map((h) => h.category))];
    if (categories.length === 1) {
      return {
        kind: "category",
        category: categories[0],
        subcategory: best.subcategory,
      };
    }
    return {
      kind: "ambiguous",
      candidates: top.map((h) => ({
        category: h.category,
        subcategory: h.subcategory,
        label: `${h.category}_${h.subcategory}`,
      })),
    };
  }

  // 3) 질문에 대분류명·동의어 포함
  const catHits = new Set<string>();
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (queryCore.includes(norm(alias)) && category in tree) {
      catHits.add(category);
    }
  }
  for (const category of Object.keys(tree)) {
    if (category === "수입") continue;
    const c = norm(category);
    if (queryCore.includes(c) || c.includes(queryCore)) {
      catHits.add(category);
    }
  }
  if (catHits.size === 1) {
    return {
      kind: "category",
      category: [...catHits][0],
      subcategory: null,
    };
  }
  if (catHits.size > 1) {
    return {
      kind: "ambiguous",
      candidates: [...catHits].map((category) => ({
        category,
        subcategory: null,
        label: category,
      })),
    };
  }

  // 4) 약한 소분류: 소분류가 질문 핵심을 포함
  const weakSubs: SubHit[] = [];
  for (const [category, subs] of Object.entries(tree)) {
    if (category === "수입") continue;
    for (const sub of subs) {
      const s = norm(sub);
      if (!s || !s.includes(queryCore)) continue;
      weakSubs.push({
        category,
        subcategory: sub,
        score: 40 + queryCore.length,
      });
    }
  }
  if (weakSubs.length > 0) {
    weakSubs.sort((a, b) => b.score - a.score);
    const best = weakSubs[0];
    const categories = [...new Set(weakSubs.map((h) => h.category))];
    if (categories.length === 1) {
      return {
        kind: "category",
        category: categories[0],
        subcategory: best.subcategory,
      };
    }
    return {
      kind: "ambiguous",
      candidates: weakSubs.map((h) => ({
        category: h.category,
        subcategory: h.subcategory,
        label: `${h.category}_${h.subcategory}`,
      })),
    };
  }

  return { kind: "none" };
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
