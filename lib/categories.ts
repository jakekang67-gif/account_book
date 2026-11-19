/**
 * 가계부 대분류 → 소분류 목록
 * DB에 값이 없을 때 기본값으로 사용합니다.
 */

export type CategoryTree = Record<string, string[]>;

export const DEFAULT_CATEGORY_TREE: CategoryTree = {
  수입: ["급여", "기타"],
  투자: ["주식", "증권", "적금", "기타"],
  대출: ["주택", "재테크", "기타"],
  식대: ["아침", "점심", "저녁", "야식", "회식", "기타식대"],
  차량유지: [
    "주유",
    "엔진오일",
    "정비·수리",
    "자동차보험",
    "자동차세",
    "주차",
    "세차",
    "차량용품",
    "기타차량",
  ],
  생활비: ["식자재", "생필품", "마트·장보기", "세탁·청소", "기타생활"],
  주류: ["술자리", "주류구매", "기타주류"],
  교통비: ["택시", "대중교통", "대리", "주차비(외출)", "기타교통"],
  음료: ["커피", "카페", "차", "음료수", "기타음료"],
  자기관리: ["의류", "미용", "화장품", "세탁·수선", "기타자기관리"],
  건강: ["병원", "약", "건강검진", "개인보험료", "기타건강"],
  경조사: ["결혼", "장례", "지인선물", "기타경조사"],
  가족: ["가족식대", "가족여행", "가족선물", "용돈", "기타가족"],
  취미: ["운동", "헬스", "개인여행", "공연·관람", "기타취미"],
  반려동물: ["사료", "간식", "병원", "용품", "미용", "기타반려동물"],
  담배: ["담배", "기타담배"],
  통신비: ["핸드폰요금", "인터넷", "AI구독", "기타통신·구독"],
  선교: ["헌금", "후원", "기타선교"],
  모임회비: ["정기회비", "임시회비", "기타모임"],
  "가구/가전/IT": [
    "가구",
    "가전",
    "노트북",
    "핸드폰",
    "스마트워치",
    "주변기기",
    "기타IT",
  ],
  "주거/공과금": [
    "월세",
    "대출이자",
    "관리비",
    "전기",
    "가스",
    "수도",
    "주민세·세금",
    "기타주거",
  ],
  자기계발: ["도서", "강의", "자격증", "학원", "기타자기계발"],
  기타: ["수수료", "택배비", "소액기타", "미분류"],
};

/** @deprecated DEFAULT_CATEGORY_TREE 사용 권장 */
export const CATEGORY_TREE = DEFAULT_CATEGORY_TREE;

export type Category = string;

/** 프롬프트용 카테고리 텍스트 */
export function formatCategoryTreeForPrompt(tree: CategoryTree = DEFAULT_CATEGORY_TREE) {
  return Object.entries(tree)
    .map(([category, subs]) => `- ${category}: ${subs.join(", ")}`)
    .join("\n");
}

/** 대·소분류가 허용 목록에 있는지 검사 */
export function normalizeCategoryPair(
  categoryRaw: unknown,
  subcategoryRaw: unknown,
  tree: CategoryTree = DEFAULT_CATEGORY_TREE,
): { category: string; subcategory: string } | null {
  const category = String(categoryRaw ?? "").trim();
  const subcategory = String(subcategoryRaw ?? "").trim();

  if (!category || !(category in tree)) {
    return null;
  }

  const allowed = tree[category] ?? [];
  if (!allowed.includes(subcategory)) {
    return null;
  }

  return { category, subcategory };
}

/** DB 행 목록을 트리로 변환 */
export function rowsToCategoryTree(
  rows: Array<{ category: string; subcategory: string }>,
): CategoryTree {
  const tree: CategoryTree = {};
  for (const row of rows) {
    const category = row.category.trim();
    const subcategory = row.subcategory.trim();
    if (!category || !subcategory) continue;
    if (!tree[category]) tree[category] = [];
    if (!tree[category].includes(subcategory)) {
      tree[category].push(subcategory);
    }
  }
  return tree;
}

/** 트리를 DB insert용 행으로 변환 */
export function categoryTreeToRows(tree: CategoryTree) {
  const rows: Array<{ category: string; subcategory: string }> = [];
  for (const [category, subs] of Object.entries(tree)) {
    for (const subcategory of subs) {
      rows.push({ category, subcategory });
    }
  }
  return rows;
}
