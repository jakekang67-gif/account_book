import {
  categoryTreeToRows,
  DEFAULT_CATEGORY_TREE,
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

  // 기존 계정에도 필수 대·소분류가 없으면 보강
  const ensured = await ensureRequiredCategories(rows);
  if (ensured.added) {
    return loadCategoryTree();
  }

  return {
    tree: rowsToCategoryTree(rows),
    rows,
    error: null,
  };
}

/** 나중에 추가된 대·소분류를 기존 DB에도 맞춤 */
const REQUIRED_CATEGORY_SUBS: Record<string, string[]> = {
  수입: ["급여", "기타"],
  투자: ["주식", "증권", "적금", "기타"],
  대출: ["주택", "재테크", "기타"],
};

async function ensureRequiredCategories(rows: CategoryItemRow[]) {
  const existing = new Set(
    rows.map((r) => `${r.category}\0${r.subcategory}`),
  );
  const missing: Array<{ category: string; subcategory: string }> = [];
  for (const [category, subs] of Object.entries(REQUIRED_CATEGORY_SUBS)) {
    for (const subcategory of subs) {
      if (!existing.has(`${category}\0${subcategory}`)) {
        missing.push({ category, subcategory });
      }
    }
  }
  if (missing.length === 0) {
    return { added: false, error: null as string | null };
  }

  const { error } = await supabase.from("category_items").insert(missing);
  return { added: !error, error: error?.message ?? null };
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

/** 대분류 전체(하위 소분류 포함) 삭제 */
export async function deleteCategory(category: string) {
  const { error } = await supabase
    .from("category_items")
    .delete()
    .eq("category", category);
  return { error: error?.message ?? null };
}
