"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppMenu } from "@/components/AppMenu";
import { useAuth } from "@/components/AuthProvider";
import { CategoryEditor } from "@/components/CategoryEditor";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { LoginForm } from "@/components/LoginForm";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { ReceiptUploadButton } from "@/components/ReceiptUploadButton";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import {
  DEFAULT_CATEGORY_TREE,
  type Category,
  type CategoryTree,
} from "@/lib/categories";
import {
  loadCategoryTree,
  type CategoryItemRow,
} from "@/lib/categoryStore";
import { detectChatIntent } from "@/lib/chatIntent";
import { koreaToday } from "@/lib/date";
import {
  formatMonthLabel,
  listMonths,
  summarizeByCategory,
  summarizeByMonth,
} from "@/lib/reports";
import { supabase } from "@/lib/supabase";

type AppTab = "chat" | "monthly" | "category";

/** expenses 테이블 한 행 */
type Expense = {
  id: number;
  created_at: string;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  subcategory: string | null;
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type EditForm = {
  date: string;
  amount: string;
  description: string;
  category: Category;
  subcategory: string;
};

type PendingExpense = {
  date: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string;
};

type PendingPhase = "confirm" | "await_category";

/** 금액 천단위 콤마 */
function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatSavedReply(expense: PendingExpense) {
  const [, m, d] = expense.date.split("-");
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  return `${monthDay} ${expense.category}(${expense.subcategory}) ${expense.description} ${formatAmount(expense.amount)}원을 저장했어요!`;
}

function formatAskConfirmReply(expense: PendingExpense) {
  const [, m, d] = expense.date.split("-");
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  return `${monthDay} ${expense.description} ${formatAmount(expense.amount)}원 — "${expense.category}-${expense.subcategory}"로 저장할까요?`;
}

/** 승인 의도 (네/응/저장 등) */
function isAffirmative(text: string) {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  return /^(네|녜|예|응|어|ㅇㅇ|ㅇㅋ|ok|okay|yes|y|좋아|좋아요|그래|그래요|맞아|맞아요|저장|저장해|저장해주세요|저장해줘|저장할게요|그렇게|그렇게해|그렇게해주세요|그렇게해줘|진행|진행해|진행해줘)$/i.test(
    t,
  );
}

/** 거절 의도 */
function isNegative(text: string) {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  return /^(아니|아니요|아뇨|ㄴㄴ|no|n|싫어|싫어요|다른거|다르게|틀려|틀렸어|아니야|취소)$/i.test(
    t,
  );
}

/** "가족-가족식대" / "가족 가족식대" 형태를 트리에서 찾기 */
function parseCategoryFromText(
  text: string,
  tree: CategoryTree,
): { category: string; subcategory: string } | null {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return null;

  const byDash = raw.split(/[-–—~/]/).map((s) => s.trim()).filter(Boolean);
  if (byDash.length >= 2) {
    const pair = normalizeLoosePair(byDash[0], byDash.slice(1).join(" "), tree);
    if (pair) return pair;
  }

  const parts = raw.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const pair = normalizeLoosePair(parts[0], parts.slice(1).join(" "), tree);
    if (pair) return pair;
  }

  // 대분류만 말한 경우 → 첫 소분류
  for (const category of Object.keys(tree)) {
    if (category === raw || category.replace(/\s+/g, "") === raw.replace(/\s+/g, "")) {
      const subs = tree[category] ?? [];
      if (subs[0]) return { category, subcategory: subs[0] };
    }
  }

  return null;
}

function normalizeLoosePair(
  categoryRaw: string,
  subcategoryRaw: string,
  tree: CategoryTree,
): { category: string; subcategory: string } | null {
  const catKey = Object.keys(tree).find(
    (c) => c === categoryRaw || c.replace(/\s+/g, "") === categoryRaw.replace(/\s+/g, ""),
  );
  if (!catKey) return null;
  const subs = tree[catKey] ?? [];
  const sub =
    subs.find(
      (s) =>
        s === subcategoryRaw ||
        s.replace(/\s+/g, "") === subcategoryRaw.replace(/\s+/g, ""),
    ) ?? null;
  if (!sub) return null;
  return { category: catKey, subcategory: sub };
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCategoryLabel(item: Expense) {
  if (item.category && item.subcategory) {
    return `${item.category} · ${item.subcategory}`;
  }
  if (item.category) return item.category;
  return null;
}

function defaultEditForm(item: Expense, tree: CategoryTree): EditForm {
  const keys = Object.keys(tree);
  const fallback = keys.includes("기타") ? "기타" : keys[0] ?? "기타";
  const category =
    item.category && item.category in tree ? item.category : fallback;
  const subs = tree[category] ?? ["기타"];
  const subcategory =
    item.subcategory && subs.includes(item.subcategory)
      ? item.subcategory
      : subs[0];

  return {
    date: item.date,
    amount: String(item.amount),
    description: item.description,
    category,
    subcategory,
  };
}

const fieldClassName =
  "w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]";

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! 지출을 말해 주세요.\n예: “오늘 점심 12,000원”\n마이크·영수증 사진도 가능해요.\n저장 전 분류를 확인받고, 통계도 물어보실 수 있어요.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingExpense, setPendingExpense] = useState<PendingExpense | null>(
    null,
  );
  const [pendingPhase, setPendingPhase] = useState<PendingPhase | null>(null);
  const [tab, setTab] = useState<AppTab>("chat");
  const [reportMonth, setReportMonth] = useState("");
  const [categoryTree, setCategoryTree] =
    useState<CategoryTree>(DEFAULT_CATEGORY_TREE);
  const [categoryRows, setCategoryRows] = useState<CategoryItemRow[]>([]);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryOptions = useMemo(
    () => Object.keys(categoryTree),
    [categoryTree],
  );

  const editSubOptions = useMemo(() => {
    if (!editForm) return [] as readonly string[];
    return categoryTree[editForm.category] ?? [];
  }, [editForm, categoryTree]);

  const monthlyTotals = useMemo(
    () => summarizeByMonth(expenses),
    [expenses],
  );

  const availableMonths = useMemo(() => listMonths(expenses), [expenses]);

  const categoryTotals = useMemo(() => {
    if (!reportMonth) return [];
    return summarizeByCategory(expenses, reportMonth);
  }, [expenses, reportMonth]);

  const categoryMonthTotal = useMemo(
    () => categoryTotals.reduce((sum, row) => sum + row.total, 0),
    [categoryTotals],
  );

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setCategoryRows([]);
      setCategoryTree(DEFAULT_CATEGORY_TREE);
      setLoadingExpenses(false);
      setCategoryLoadError(null);
      return;
    }
    void loadExpenses();
    void refreshCategories();
  }, [user?.id]);

  useEffect(() => {
    // 환영 안내만 있을 때는 맨 위가 보이도록 (모바일에서 잘림 방지)
    const onlyWelcome =
      messages.length === 1 && messages[0]?.id === "welcome" && !sending;
    if (onlyWelcome) {
      chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // 데이터가 바뀌면 리포트용 월 기본값을 최신 월로 맞춤
  useEffect(() => {
    if (availableMonths.length === 0) {
      setReportMonth("");
      return;
    }
    if (!reportMonth || !availableMonths.includes(reportMonth)) {
      setReportMonth(availableMonths[0]);
    }
  }, [availableMonths, reportMonth]);

  async function refreshCategories() {
    const result = await loadCategoryTree();
    setCategoryTree(result.tree);
    setCategoryRows(result.rows);
    setCategoryLoadError(result.error);
  }

  async function loadExpenses() {
    setLoadingExpenses(true);
    setExpenseError(null);

    try {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, created_at, date, amount, description, category, subcategory",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setExpenseError(error.message);
        setExpenses([]);
      } else {
        setExpenses((data as Expense[]) ?? []);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "지출 내역을 불러오지 못했어요.";
      setExpenseError(message);
      setExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  }

  async function saveExpense(expense: {
    date: string;
    amount: number;
    description: string;
    category: string;
    subcategory: string;
  }) {
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date: expense.date,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        subcategory: expense.subcategory,
      })
      .select(
        "id, created_at, date, amount, description, category, subcategory",
      )
      .single();

    if (error) {
      setExpenseError(error.message);
      return false;
    }

    setExpenses((prev) => [data as Expense, ...prev]);
    setExpenseError(null);
    return true;
  }

  function toggleSelect(id: number) {
    // 수정 중이면 행 전환으로 폼을 닫지 않음
    if (editingId !== null) return;
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function startEdit(item: Expense) {
    setSelectedId(item.id);
    setEditingId(item.id);
    setEditForm(defaultEditForm(item, categoryTree));
    setExpenseError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  function updateEditCategory(category: Category) {
    const subs = categoryTree[category] ?? ["기타"];
    setEditForm((prev) =>
      prev
        ? {
            ...prev,
            category,
            subcategory: subs[0],
          }
        : prev,
    );
  }

  async function handleUpdate(id: number) {
    if (!editForm) return;

    const amount = Number(editForm.amount.replace(/,/g, ""));
    const description = editForm.description.trim();
    if (
      !editForm.date ||
      !description ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      setExpenseError("날짜, 금액, 내용을 확인해 주세요.");
      return;
    }

    setBusyId(id);
    setExpenseError(null);

    const { data, error } = await supabase
      .from("expenses")
      .update({
        date: editForm.date,
        amount: Math.round(amount),
        description,
        category: editForm.category,
        subcategory: editForm.subcategory,
      })
      .eq("id", id)
      .select(
        "id, created_at, date, amount, description, category, subcategory",
      )
      .single();

    setBusyId(null);

    if (error) {
      setExpenseError(error.message);
      return;
    }

    setExpenses((prev) =>
      prev.map((item) => (item.id === id ? (data as Expense) : item)),
    );
    cancelEdit();
  }

  async function handleDelete(item: Expense) {
    const label = `${item.description} ${formatAmount(item.amount)}원`;
    if (!window.confirm(`"${label}" 내역을 삭제할까요?`)) {
      return;
    }

    setBusyId(item.id);
    setExpenseError(null);

    const { error } = await supabase.from("expenses").delete().eq("id", item.id);

    setBusyId(null);

    if (error) {
      setExpenseError(error.message);
      return;
    }

    setExpenses((prev) => prev.filter((row) => row.id !== item.id));
    if (editingId === item.id) {
      cancelEdit();
    }
    if (selectedId === item.id) {
      setSelectedId(null);
    }
  }

  function pushAssistant(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        role: "assistant",
        content,
      },
    ]);
  }

  async function commitPending(expense: PendingExpense) {
    const saved = await saveExpense(expense);
    if (!saved) {
      pushAssistant(
        "내용은 파악했지만 저장에 실패했어요. Supabase에 category 컬럼이 추가됐는지 확인해 주세요.",
      );
      return;
    }
    setPendingExpense(null);
    setPendingPhase(null);
    pushAssistant(formatSavedReply(expense));
  }

  async function handleReceiptUpload(payload: {
    base64: string;
    mimeType: string;
  }) {
    if (sending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        role: "user",
        content: "영수증 사진을 올렸어요.",
      },
    ]);
    setSending(true);
    setChatError(null);
    setPendingExpense(null);
    setPendingPhase(null);

    try {
      const response = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: payload.base64,
          mimeType: payload.mimeType,
          categoryTree,
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        expense?: PendingExpense | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "영수증 인식에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      if (data.expense) {
        const next: PendingExpense = {
          date: data.expense.date,
          amount: data.expense.amount,
          description: data.expense.description,
          category: data.expense.category,
          subcategory: data.expense.subcategory,
        };
        setPendingExpense(next);
        setPendingPhase("confirm");
        pushAssistant(data.reply?.trim() || formatAskConfirmReply(next));
        return;
      }

      pushAssistant(
        data.reply?.trim() ||
          "영수증에서 금액을 찾지 못했어요. 직접 말해 주시거나 다시 올려 주세요.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "영수증 업로드에 실패했습니다.";
      setChatError(message);
      pushAssistant(message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleSend(event?: FormEvent, overrideText?: string) {
    event?.preventDefault();

    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);
    setChatError(null);

    try {
      // 저장 확인 중에도 통계 질문이면 대기 건을 취소하고 질문으로 처리
      const earlyIntent = detectChatIntent(text);
      if (
        earlyIntent === "stats" &&
        (pendingPhase === "confirm" || pendingPhase === "await_category")
      ) {
        setPendingExpense(null);
        setPendingPhase(null);
      }

      // 1) 저장 확인 단계
      if (
        pendingPhase === "confirm" &&
        pendingExpense &&
        earlyIntent !== "stats"
      ) {
        if (isAffirmative(text)) {
          await commitPending(pendingExpense);
          return;
        }
        if (isNegative(text)) {
          setPendingPhase("await_category");
          pushAssistant(
            "카테고리 분류 어떻게 할까요? 예: “가족-가족식대”, “식대-점심”",
          );
          return;
        }
        // 네/아니오가 아니면 대기 건을 취소하고 새 지출로 처리
        setPendingExpense(null);
        setPendingPhase(null);
      }

      // 2) 분류 다시 묻는 단계
      if (
        pendingPhase === "await_category" &&
        pendingExpense &&
        earlyIntent !== "stats"
      ) {
        const localPair = parseCategoryFromText(text, categoryTree);
        if (localPair) {
          const next: PendingExpense = {
            ...pendingExpense,
            category: localPair.category,
            subcategory: localPair.subcategory,
          };
          setPendingExpense(next);
          setPendingPhase("confirm");
          pushAssistant(formatAskConfirmReply(next));
          return;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: [],
            categoryTree,
            mode: "classify",
            pendingExpense: {
              date: pendingExpense.date,
              amount: pendingExpense.amount,
              description: pendingExpense.description,
            },
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          expense?: PendingExpense | null;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            data.error ?? "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }

        if (data.expense) {
          const next: PendingExpense = {
            date: data.expense.date,
            amount: data.expense.amount,
            description: data.expense.description,
            category: data.expense.category,
            subcategory: data.expense.subcategory,
          };
          setPendingExpense(next);
          setPendingPhase("confirm");
          pushAssistant(
            data.reply?.trim() || formatAskConfirmReply(next),
          );
          return;
        }

        pushAssistant(
          data.reply?.trim() ||
            "카테고리 분류 어떻게 할까요? 예: “가족-가족식대”",
        );
        return;
      }

      // 3) 통계 질문 vs 지출 입력
      const intent = detectChatIntent(text);
      const historyForApi = [...messages, userMessage]
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }));

      if (intent === "stats") {
        // 최신 지출을 Supabase에서 다시 가져와 Gemini에 전달
        const { data: rows, error: fetchError } = await supabase
          .from("expenses")
          .select("date, amount, description, category, subcategory")
          .order("date", { ascending: false });

        if (fetchError) {
          throw new Error(
            `지출 데이터를 불러오지 못했어요: ${fetchError.message}`,
          );
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: historyForApi.slice(-6, -1),
            mode: "stats",
            expenses: rows ?? [],
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            data.error ?? "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          );
        }

        pushAssistant(
          data.reply?.trim() ||
            "질문을 이해하지 못했어요. 예: “이번 달 총 지출이 얼마야?”",
        );
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyForApi.slice(0, -1),
          categoryTree,
          mode: "extract",
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        expense?: PendingExpense | null;
        action?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      if (data.expense) {
        const next: PendingExpense = {
          date: data.expense.date,
          amount: data.expense.amount,
          description: data.expense.description,
          category: data.expense.category,
          subcategory: data.expense.subcategory,
        };
        setPendingExpense(next);
        setPendingPhase("confirm");
        pushAssistant(data.reply?.trim() || formatAskConfirmReply(next));
        return;
      }

      pushAssistant(data.reply?.trim() || "네, 말씀해 주세요.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      setChatError(message);
      pushAssistant(message);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  const tabTitle =
    tab === "chat" ? "AI 가계부 챗봇" : tab === "monthly" ? "월별 지출" : "카테고리별 지출";

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-1 items-center justify-center bg-[#f5f5f7] text-[14px] text-[#86868b]">
        불러오는 중...
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f5f5f7]">
      <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col">
        {/* 상단 제목 + 메뉴 */}
        <header className="relative shrink-0 border-b border-black/5 bg-white px-5 py-4">
          <h1 className="text-center text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
            {tabTitle}
          </h1>
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AppMenu
              expenses={expenses}
              onOpenCategoryEditor={() => setCategoryEditorOpen(true)}
              accountEmail={user.email}
              onSignOut={() => void signOut()}
            />
          </div>
        </header>

        {categoryLoadError && (
          <p className="bg-[#fff4e5] px-4 py-2 text-center text-[12px] text-[#8a6116]">
            카테고리 DB 연결 확인: {categoryLoadError}
            {" · "}
            SQL로 category_items 테이블을 만들어 주세요.
          </p>
        )}

        {tab === "chat" && (
          <>
        {/* 저장된 지출 카드 */}
        <section className="shrink-0 border-b border-black/5 bg-[#f5f5f7] px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <p className="text-[13px] font-medium text-[#86868b]">지출 내역</p>
            <p className="font-mono text-[13px] tabular-nums text-[#1d1d1f]">
              합계 {formatAmount(total)}
              <span className="ml-0.5 text-[#86868b]">원</span>
            </p>
          </div>

          {expenseError && (
            <p className="mb-2 px-1 text-[13px] text-red-600">{expenseError}</p>
          )}

          {loadingExpenses ? (
            <p className="rounded-2xl bg-white px-4 py-5 text-center text-[14px] text-[#86868b]">
              불러오는 중...
            </p>
          ) : expenses.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-5 text-center text-[14px] text-[#86868b]">
              아직 저장된 내역이 없습니다.
            </p>
          ) : (
            <ul className="flex max-h-28 flex-col gap-2 overflow-y-auto pr-1 sm:max-h-40">
              {expenses.map((item) => {
                const categoryLabel = formatCategoryLabel(item);
                const isEditing = editingId === item.id && editForm;
                const isSelected = selectedId === item.id;
                const isBusy = busyId === item.id;

                return (
                  <li
                    key={item.id}
                    className={`rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                      isSelected && !isEditing ? "ring-1 ring-black/10" : ""
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <input
                          type="date"
                          value={editForm.date}
                          max={koreaToday()}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date: e.target.value })
                          }
                          className={fieldClassName}
                          disabled={isBusy}
                          lang="ko-KR"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm({ ...editForm, amount: e.target.value })
                          }
                          className={`${fieldClassName} font-mono`}
                          disabled={isBusy}
                          placeholder="금액"
                        />
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              description: e.target.value,
                            })
                          }
                          className={fieldClassName}
                          disabled={isBusy}
                          placeholder="내용"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) =>
                            updateEditCategory(e.target.value as Category)
                          }
                          className={fieldClassName}
                          disabled={isBusy}
                        >
                          {categoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editForm.subcategory}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              subcategory: e.target.value,
                            })
                          }
                          className={fieldClassName}
                          disabled={isBusy}
                        >
                          {editSubOptions.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => void handleUpdate(item.id)}
                            disabled={isBusy}
                            className="flex-1 rounded-xl bg-[#1d1d1f] px-3 py-2.5 text-[13px] font-medium text-white disabled:opacity-40"
                          >
                            {isBusy ? "저장 중..." : "저장"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={isBusy}
                            className="flex-1 rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f] disabled:opacity-40"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelect(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSelect(item.id);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-[#1d1d1f]">
                            {item.description}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[#86868b]">
                            {item.date}
                            {categoryLabel ? ` · ${categoryLabel}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="font-mono text-[15px] font-medium tabular-nums text-[#1d1d1f]">
                            {formatAmount(item.amount)}
                            <span className="ml-0.5 text-[12px] font-normal text-[#86868b]">
                              원
                            </span>
                          </p>
                          {isSelected && (
                            <div
                              className="flex gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                disabled={isBusy || busyId !== null}
                                className="rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#1d1d1f] disabled:opacity-40"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                disabled={isBusy || busyId !== null}
                                className="rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#b42318] disabled:opacity-40"
                              >
                                {isBusy ? "삭제 중..." : "삭제"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 대화 영역 */}
        <div
          ref={chatScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#FEE500] text-[#191919]"
                      : "rounded-bl-md bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {message.content}
                </div>
              </li>
            ))}

            {sending && (
              <li className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[14px] text-[#86868b] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  생각 중이에요. 잠시만 기다려 주세요...
                </div>
              </li>
            )}
          </ul>
          <div ref={messagesEndRef} />
        </div>

        {/* 하단 입력 */}
        <div className="shrink-0 border-t border-black/5 bg-white px-3 pt-3">
          {chatError && (
            <p className="mb-2 px-1 text-[12px] text-red-600">{chatError}</p>
          )}
          <form
            onSubmit={(e) => handleSend(e)}
            className="flex items-end gap-2 pb-2"
          >
            <ReceiptUploadButton
              disabled={sending}
              onError={(message) => setChatError(message)}
              onPick={(payload) => void handleReceiptUpload(payload)}
            />
            <VoiceMicButton
              disabled={sending}
              onError={(message) => setChatError(message)}
              onTranscript={(text) => {
                setChatError(null);
                setInput(text);
                void handleSend(undefined, text);
              }}
            />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="예: 택시 20000원"
              disabled={sending}
              className="min-h-11 flex-1 rounded-2xl bg-[#f5f5f7] px-4 py-2.5 text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:bg-[#ebebed] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="min-h-11 shrink-0 rounded-2xl bg-[#1d1d1f] px-4 py-2.5 text-[14px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
            >
              전송
            </button>
          </form>
        </div>
          </>
        )}

        {tab === "monthly" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loadingExpenses ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#86868b]">
                불러오는 중...
              </p>
            ) : monthlyTotals.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#86868b]">
                아직 집계할 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="px-1 text-[13px] font-medium text-[#86868b]">
                  월별 총 지출
                </p>
                <MonthlyBarChart data={monthlyTotals} />
                <ul className="space-y-2">
                  {monthlyTotals.map((row) => (
                    <li
                      key={row.month}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <p className="text-[15px] font-medium text-[#1d1d1f]">
                        {formatMonthLabel(row.month)}
                      </p>
                      <p className="font-mono text-[16px] font-medium tabular-nums text-[#1d1d1f]">
                        {formatAmount(row.total)}
                        <span className="ml-0.5 text-[12px] font-normal text-[#86868b]">
                          원
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "category" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loadingExpenses ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#86868b]">
                불러오는 중...
              </p>
            ) : availableMonths.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#86868b]">
                아직 집계할 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block px-1 text-[13px] text-[#86868b]">
                    조회 월
                  </span>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className={fieldClassName}
                  >
                    {availableMonths.map((month) => (
                      <option key={month} value={month}>
                        {formatMonthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-baseline justify-between px-1">
                  <p className="text-[13px] text-[#86868b]">이번 달 합계</p>
                  <p className="font-mono text-[15px] tabular-nums text-[#1d1d1f]">
                    {formatAmount(categoryMonthTotal)}
                    <span className="ml-0.5 text-[12px] text-[#86868b]">원</span>
                  </p>
                </div>

                {categoryTotals.length === 0 ? (
                  <p className="rounded-2xl bg-white px-4 py-8 text-center text-[14px] text-[#86868b]">
                    이 달 내역이 없습니다.
                  </p>
                ) : (
                  <>
                    <p className="px-1 text-[13px] font-medium text-[#86868b]">
                      카테고리 비율
                    </p>
                    <CategoryPieChart data={categoryTotals} />
                    <ul className="space-y-2">
                      {categoryTotals.map((row) => (
                        <li
                          key={row.category}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        >
                          <p className="text-[15px] font-medium text-[#1d1d1f]">
                            {row.category}
                          </p>
                          <p className="font-mono text-[16px] font-medium tabular-nums text-[#1d1d1f]">
                            {formatAmount(row.total)}
                            <span className="ml-0.5 text-[12px] font-normal text-[#86868b]">
                              원
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 하단 메뉴 */}
        <nav className="shrink-0 border-t border-black/5 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: "chat", label: "채팅" },
                { id: "monthly", label: "월별" },
                { id: "category", label: "분류" },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-xl px-2 py-2.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-transparent text-[#86868b]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <CategoryEditor
        open={categoryEditorOpen}
        rows={categoryRows}
        tree={categoryTree}
        onClose={() => setCategoryEditorOpen(false)}
        onChanged={refreshCategories}
      />
    </div>
  );
}
