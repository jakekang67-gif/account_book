import {
  categoryTreeToRows,
  DEFAULT_CATEGORY_TREE,
  DEFAULT_FIXED_INCOME_SUBS,
  FIXED_INCOME_CATEGORY,
  rowsToCategoryTree,
  type CategoryTree,
} from "@/lib/categories";
import { supabase } from "@/lib/supabase";

export type CategoryItemRow = {
  id: number;
  category: string;
  subcategory: string;
};

/** DB에서 카테고리 트리를 읽고, 비어 있으면 기본값을 심습니다. */
export async function loadCategoryTree(): Promise<{
  tree: CategoryTree;
  rows: CategoryItemRow[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("category_items")
    .select("id, category, subcategory")
    .order("category", { ascending: true })
    .order("subcategory", { ascending: true });

  if (error) {
    // 테이블이 아직 없으면 기본 트리로 동작
    return {
      tree: DEFAULT_CATEGORY_TREE,
      rows: [],
      error: error.message,
    };
  }

  const rows = (data as CategoryItemRow[]) ?? [];
  if (rows.length === 0) {
    const seeded = await seedDefaultCategories();
    if (seeded.error) {
      return {
        tree: DEFAULT_CATEGORY_TREE,
        rows: [],
        error: seeded.error,
      };
    }
    return loadCategoryTree();
  }

  // 예전 「수입 > 급여」는 정기 수입(고정 수입)과 겹치므로 한 번 정리
  const cleaned = await removeLegacyIncomeSalary(rows);
  if (cleaned.removed) {
    return loadCategoryTree();
  }

  // 삭제한 분류는 다시 넣지 않음 (최초 seed만 DEFAULT로 채움)
  return {
    tree: rowsToCategoryTree(rows),
    rows,
    error: null,
  };
}

/** 수입 대분류의 소분류 「급여」만 제거 (고정 수입 급여는 유지) */
async function removeLegacyIncomeSalary(rows: CategoryItemRow[]) {
  const legacy = rows.filter(
    (r) => r.category === "수입" && r.subcategory === "급여",
  );
  if (legacy.length === 0) return { removed: false };
  for (const row of legacy) {
    await supabase.from("category_items").delete().eq("id", row.id);
  }
  return { removed: true };
}

async function seedDefaultCategories() {
  const payload = categoryTreeToRows(DEFAULT_CATEGORY_TREE);
  const { error } = await supabase.from("category_items").insert(payload);
  return { error: error?.message ?? null };
}

/** 대분류 + 첫 소분류 추가 (대분류만 만들 때) */
export async function addCategory(category: string, subcategory = "기타") {
  const cat = category.trim();
  const sub = subcategory.trim() || "기타";
  if (!cat) return { error: "대분류 이름을 입력해 주세요." };

  const { error } = await supabase.from("category_items").insert({
    category: cat,
    subcategory: sub,
  });
  return { error: error?.message ?? null };
}

/** 기존 대분류에 소분류 추가 */
export async function addSubcategory(category: string, subcategory: string) {
  const cat = category.trim();
  const sub = subcategory.trim();
  if (!cat || !sub) return { error: "대분류와 소분류를 입력해 주세요." };

  const { error } = await supabase.from("category_items").insert({
    category: cat,
    subcategory: sub,
  });
  return { error: error?.message ?? null };
}

/** 소분류 한 줄 삭제 */
export async function deleteSubcategory(id: number) {
  const { error } = await supabase.from("category_items").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** 소분류 이름 수정 */
export async function renameSubcategory(id: number, subcategory: string) {
  const sub = subcategory.trim();
  if (!sub) return { error: "소분류 이름을 입력해 주세요." };
  const { error } = await supabase
    .from("category_items")
    .update({ subcategory: sub })
    .eq("id", id);
  return { error: error?.message ?? null };
}

/**
 * 고정 수입 대분류가 전혀 없을 때만 기본 소분류를 심습니다.
 * (사용자가 지운 뒤에는 다시 넣지 않음)
 */
export async function ensureFixedIncomeCategoryExists(
  rows: CategoryItemRow[],
): Promise<{ added: boolean; error: string | null }> {
  if (rows.some((r) => r.category === FIXED_INCOME_CATEGORY)) {
    return { added: false, error: null };
  }
  const payload = DEFAULT_FIXED_INCOME_SUBS.map((subcategory) => ({
    category: FIXED_INCOME_CATEGORY,
    subcategory,
  }));
  const { error } = await supabase.from("category_items").insert(payload);
  return { added: !error, error: error?.message ?? null };
}

/** 대분류 전체(하위 소분류 포함) 삭제 */
export async function deleteCategory(category: string) {
  const { error } = await supabase
    .from("category_items")
    .delete()
    .eq("category", category);
  return { error: error?.message ?? null };
}
