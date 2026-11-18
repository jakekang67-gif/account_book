"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AppMenu } from "@/components/AppMenu";
import { useAuth } from "@/components/AuthProvider";
import { BudgetEditor } from "@/components/BudgetEditor";
import { BudgetList } from "@/components/BudgetList";
import { CategoryEditor } from "@/components/CategoryEditor";
import { ChatCleanupMenu } from "@/components/ChatCleanupMenu";
import { ChatNoticeBanner } from "@/components/ChatNoticeBanner";
import { InstallHelp } from "@/components/InstallHelp";
import { SaveExpenseToDateDialog } from "@/components/SaveExpenseToDateDialog";
import { CategoryPieChart } from "@/components/CategoryPieChart";
import { LoginForm } from "@/components/LoginForm";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import {
  loadBudgetAlertPercent,
  playBudgetWarningSound,
  saveBudgetAlertPercent,
} from "@/lib/budgetAlert";
import {
  clearMonthlyBudget,
  loadMonthlyBudget,
  loadMonthlyBudgets,
  saveMonthlyBudget,
  type MonthlyBudget,
} from "@/lib/budgetStore";
import {
  DEFAULT_CATEGORY_TREE,
  type Category,
  type CategoryTree,
} from "@/lib/categories";
import {
  loadCategoryTree,
  type CategoryItemRow,
} from "@/lib/categoryStore";
import {
  clearChatDraft,
  loadChatDraft,
  saveChatDraft,
} from "@/lib/chatDraftStore";
import {
  detectChatIntent,
  isChatCleanupAllChoice,
  isChatCleanupSelectChoice,
} from "@/lib/chatIntent";
import { normalizeExpenseDescription } from "@/lib/expenseDescription";
import { koreaDateString, koreaToday } from "@/lib/date";
import {
  formatMonthLabel,
  listMonths,
  monthKeyFromDate,
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
  /** 저장된 지출과 연결되면 대화 수정 시 함께 갱신 */
  expenseId?: number | null;
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
  /** 지출을 말한 사용자 메시지 id */
  sourceMessageId?: string | null;
};

type PendingPhase = "confirm" | "await_category" | "await_chat_cleanup";

/** 금액 천단위 콤마 */
function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function formatSavedReply(expense: PendingExpense) {
  const [, m, d] = expense.date.split("-");
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  // 예: 11월 17일 담배_담배 13,500원을 저장했어요.
  return `${monthDay} ${expense.category}_${expense.subcategory} ${formatAmount(expense.amount)}원을 저장했어요.`;
}

function formatAskConfirmReply(expense: PendingExpense) {
  const [, m, d] = expense.date.split("-");
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  // 예: 11월 17일 담배 13500원 - "담배-담배"로 저장할까요?
  return `${monthDay} ${expense.description} ${expense.amount}원 - "${expense.category}-${expense.subcategory}"로 저장할까요?`;
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

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "안녕하세요. 지출을 말씀해 주세요!\n예를들면 “오늘 점심 12,000원”처럼 짧게!\n저장 전 분류 확인, 통계도 물어보실 수 있어요.",
};

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("aborted")
  );
}

function formatChatSendError(error: unknown) {
  if (isTransientNetworkError(error)) {
    return "네트워크가 잠시 끊겼어요. 같은 내용을 다시 보내 주세요.";
  }
  if (error instanceof Error && error.message.trim()) {
    // 영어 Failed to fetch 등은 위에서 걸러짐. 서버 한글 메시지는 그대로.
    if (/^[A-Za-z0-9 _\-.:'"[\]]+$/.test(error.message)) {
      return "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    }
    return error.message;
  }
  return "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

function normalizeChatText(text: string) {
  return text.trim().replace(/\s+/g, "");
}

function scrubDraftMessages(messages: ChatMessage[]) {
  const cleaned = messages.filter((m) => {
    if (m.content === "Failed to fetch") return false;
    if (m.content.includes("다시 보내는 중이에요")) return false;
    if (m.content.includes("네트워크가 잠시 끊겼어요")) return false;
    return true;
  });

  // 연속된 같은 사용자 말은 하나만 남김
  const deduped: ChatMessage[] = [];
  for (const m of cleaned) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.role === "user" &&
      m.role === "user" &&
      normalizeChatText(prev.content) === normalizeChatText(m.content)
    ) {
      continue;
    }
    deduped.push(m);
  }
  return deduped;
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingTick, setSendingTick] = useState(0);
  const [sendingStartedAt, setSendingStartedAt] = useState<number | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingExpense, setPendingExpense] = useState<PendingExpense | null>(
    null,
  );
  const [pendingPhase, setPendingPhase] = useState<PendingPhase | null>(null);
  const [resumeSendText, setResumeSendText] = useState<string | null>(null);
  const chatDraftReadyRef = useRef(false);
  const skipNextUserAppendRef = useRef(false);
  const pageLeavingRef = useRef(false);
  const sendingRef = useRef(false);
  const lastSendTextRef = useRef<string | null>(null);
  /** 앱을 나가며 요청이 끊긴 경우, 초안의 wasSending을 유지 */
  const preserveSendingDraftRef = useRef(false);
  const [tab, setTab] = useState<AppTab>("chat");
  const [reportMonth, setReportMonth] = useState("");
  const [categoryTree, setCategoryTree] =
    useState<CategoryTree>(DEFAULT_CATEGORY_TREE);
  const [categoryRows, setCategoryRows] = useState<CategoryItemRow[]>([]);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [chatCleanupOpen, setChatCleanupOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [chatNoticeShowRequestId, setChatNoticeShowRequestId] = useState(0);
  /** 앱 열 때 환영 안내를 잠깐만 표시 */
  const [showWelcomeTip, setShowWelcomeTip] = useState(true);
  const [welcomeTipEpoch, setWelcomeTipEpoch] = useState(0);
  const [chatSelectMode, setChatSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
  /** 길게 눌러 단일 삭제·수정 대상 */
  const [contextMessageId, setContextMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [saveToDateItem, setSaveToDateItem] = useState<Expense | null>(null);
  const [saveToDateValue, setSaveToDateValue] = useState("");
  const [saveToDateBusy, setSaveToDateBusy] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const leftToBackgroundRef = useRef(false);
  const [budgetListOpen, setBudgetListOpen] = useState(false);
  const [budgetEditorOpen, setBudgetEditorOpen] = useState(false);
  const [editingBudgetMonth, setEditingBudgetMonth] = useState("");
  const [editingBudgetAmount, setEditingBudgetAmount] = useState<number | null>(
    null,
  );
  const [monthBudget, setMonthBudget] = useState<number | null>(null);
  const [budgetRows, setBudgetRows] = useState<MonthlyBudget[]>([]);
  const [budgetListLoading, setBudgetListLoading] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetAlertPercent, setBudgetAlertPercent] = useState(80);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const budgetAlertReadyRef = useRef(false);
  const budgetWasOverRef = useRef(false);

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

  // 빌드 사전 렌더에서 new Date()를 쓰지 않도록, 마운트 후에만 오늘/이번 달 설정
  const [currentMonth, setCurrentMonth] = useState("");
  const [todayMax, setTodayMax] = useState("");

  const thisMonthSpent = useMemo(
    () =>
      currentMonth
        ? expenses
            .filter((item) => monthKeyFromDate(item.date) === currentMonth)
            .reduce((sum, item) => sum + item.amount, 0)
        : 0,
    [expenses, currentMonth],
  );

  useEffect(() => {
    const today = koreaToday();
    setTodayMax(today);
    setCurrentMonth(today.slice(0, 7));
    setBudgetAlertPercent(loadBudgetAlertPercent());
  }, []);

  // 환영 안내: 앱을 열 때(또는 다시 돌아올 때) 약 4초만 표시
  useEffect(() => {
    if (!user?.id) return;
    setShowWelcomeTip(true);
    const timer = window.setTimeout(() => {
      setShowWelcomeTip(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [user?.id, welcomeTipEpoch]);

  // 앱을 백그라운드로 내릴 때: 진행 중 요청을 실패 문구로 남기지 않고 초안에 보존
  useEffect(() => {
    function flushLeavingDraft() {
      pageLeavingRef.current = true;
      leftToBackgroundRef.current = true;
      if (!user?.id || !sendingRef.current) return;
      const lastUser = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      preserveSendingDraftRef.current = true;
      saveChatDraft(user.id, {
        messages: scrubDraftMessages(messages),
        pendingExpense,
        pendingPhase,
        input,
        wasSending: true,
        lastUserText: lastSendTextRef.current ?? lastUser?.content ?? null,
      });
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        pageLeavingRef.current = false;
        if (leftToBackgroundRef.current) {
          leftToBackgroundRef.current = false;
          setWelcomeTipEpoch((n) => n + 1);
        }
      } else {
        flushLeavingDraft();
      }
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", flushLeavingDraft);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", flushLeavingDraft);
    };
  }, [user?.id, messages, pendingExpense, pendingPhase, input]);

  useEffect(() => {
    if (!user) {
      setExpenses([]);
      setCategoryRows([]);
      setCategoryTree(DEFAULT_CATEGORY_TREE);
      setLoadingExpenses(false);
      setCategoryLoadError(null);
      setMonthBudget(null);
      setBudgetRows([]);
      setBudgetError(null);
      budgetAlertReadyRef.current = false;
      budgetWasOverRef.current = false;
      chatDraftReadyRef.current = false;
      setMessages([WELCOME_MESSAGE]);
      setPendingExpense(null);
      setPendingPhase(null);
      setInput("");
      setSending(false);
      setResumeSendText(null);
      return;
    }

    const previousUserId = user.id;
    void loadExpenses();
    void refreshCategories();

    // 로그인 사용자별 채팅 초안 복구
    chatDraftReadyRef.current = false;
    const draft = loadChatDraft(previousUserId);
    if (draft && draft.messages.length > 0) {
      // 환영 문구는 최신 문구로 맞춤, 끊김 오류 문구는 제거
      const restored = scrubDraftMessages(
        (draft.messages as ChatMessage[]).map((m) =>
          m.id === "welcome" ? { ...m, content: WELCOME_MESSAGE.content } : m,
        ),
      );
      setMessages(restored.length > 0 ? restored : [WELCOME_MESSAGE]);
      setPendingExpense(draft.pendingExpense);
      setPendingPhase(draft.pendingPhase);
      setInput(draft.input || "");
      const last = restored[restored.length - 1];
      const resumeText =
        draft.lastUserText?.trim() ||
        (last?.role === "user" ? last.content.trim() : "");
      // 생각 중 끊김: wasSending 이거나, 마지막이 사용자 말만 남은 경우 재시도
      if (
        resumeText &&
        (draft.wasSending || last?.role === "user")
      ) {
        skipNextUserAppendRef.current = true;
        setResumeSendText(resumeText);
      }
    } else {
      setMessages([WELCOME_MESSAGE]);
      setPendingExpense(null);
      setPendingPhase(null);
      setInput("");
    }
    chatDraftReadyRef.current = true;
  }, [user?.id]);

  // 채팅·대기 상태를 로컬에 저장 (앱을 나가도 유지)
  useEffect(() => {
    if (!user?.id || !chatDraftReadyRef.current) return;
    // 복구 직후 재전송 예약 중이면 wasSending을 덮어쓰지 않음
    if (resumeSendText) return;
    if (preserveSendingDraftRef.current) return;
    const lastUser = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    saveChatDraft(user.id, {
      messages: scrubDraftMessages(messages),
      pendingExpense,
      pendingPhase,
      input,
      wasSending: sending,
      lastUserText: sending
        ? (lastSendTextRef.current ?? lastUser?.content ?? null)
        : null,
    });
  }, [
    user?.id,
    messages,
    pendingExpense,
    pendingPhase,
    input,
    sending,
    resumeSendText,
  ]);

  useEffect(() => {
    if (!user || !currentMonth) return;
    budgetAlertReadyRef.current = false;
    budgetWasOverRef.current = false;
    void refreshBudget();
  }, [user?.id, currentMonth]);

  // 이번 달 지출이 경고 기준 %에 처음 도달하면 경고음
  useEffect(() => {
    if (!currentMonth || monthBudget == null || monthBudget <= 0) return;
    if (loadingExpenses) return;

    const percent = (thisMonthSpent / monthBudget) * 100;
    const over = percent >= budgetAlertPercent;

    if (!budgetAlertReadyRef.current) {
      budgetWasOverRef.current = over;
      budgetAlertReadyRef.current = true;
      return;
    }

    if (over && !budgetWasOverRef.current) {
      playBudgetWarningSound();
    }
    budgetWasOverRef.current = over;
  }, [
    thisMonthSpent,
    monthBudget,
    currentMonth,
    budgetAlertPercent,
    loadingExpenses,
  ]);

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

  async function refreshBudget() {
    const result = await loadMonthlyBudget(currentMonth);
    if (result.error) {
      setBudgetError(result.error);
      setMonthBudget(null);
      return;
    }
    setBudgetError(null);
    setMonthBudget(result.budget?.amount ?? null);
  }

  async function refreshBudgetList() {
    setBudgetListLoading(true);
    const result = await loadMonthlyBudgets();
    setBudgetListLoading(false);
    if (result.error) {
      setBudgetError(result.error);
      setBudgetRows([]);
      return;
    }
    setBudgetError(null);
    setBudgetRows(result.budgets);
  }

  function openBudgetEditor(month: string, amount: number | null) {
    if (!month) return;
    setEditingBudgetMonth(month);
    setEditingBudgetAmount(amount);
    setBudgetEditorOpen(true);
  }

  async function openBudgetList() {
    setBudgetListOpen(true);
    await refreshBudgetList();
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
        const rows = ((data as Expense[]) ?? []).map((row) => {
          const nextDesc = normalizeExpenseDescription(
            row.description,
            row.category,
            row.subcategory,
          );
          return nextDesc === row.description
            ? row
            : { ...row, description: nextDesc };
        });
        setExpenses(rows);

        // 예: "담배 구매" → "담배" 로 DB도 맞춰 둠
        const toFix = rows.filter((row, i) => {
          const raw = (data as Expense[])[i];
          return raw && raw.description !== row.description;
        });
        if (toFix.length > 0) {
          void Promise.all(
            toFix.map((row) =>
              supabase
                .from("expenses")
                .update({ description: row.description })
                .eq("id", row.id),
            ),
          );
        }
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
  }): Promise<Expense | null> {
    const description = normalizeExpenseDescription(
      expense.description,
      expense.category,
      expense.subcategory,
    );
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date: expense.date,
        amount: expense.amount,
        description,
        category: expense.category,
        subcategory: expense.subcategory,
      })
      .select(
        "id, created_at, date, amount, description, category, subcategory",
      )
      .single();

    if (error) {
      setExpenseError(error.message);
      return null;
    }

    const row = data as Expense;
    setExpenses((prev) => [row, ...prev]);
    setExpenseError(null);
    return row;
  }

  async function updateExpenseRecord(
    id: number,
    expense: {
      date: string;
      amount: number;
      description: string;
      category: string;
      subcategory: string;
    },
  ): Promise<Expense | null> {
    const description = normalizeExpenseDescription(
      expense.description,
      expense.category,
      expense.subcategory,
    );
    const { data, error } = await supabase
      .from("expenses")
      .update({
        date: expense.date,
        amount: expense.amount,
        description,
        category: expense.category,
        subcategory: expense.subcategory,
      })
      .eq("id", id)
      .select(
        "id, created_at, date, amount, description, category, subcategory",
      )
      .single();

    if (error) {
      setExpenseError(error.message);
      return null;
    }

    const row = data as Expense;
    setExpenses((prev) =>
      prev.map((item) => (item.id === id ? row : item)),
    );
    setExpenseError(null);
    return row;
  }

  function findExpenseIdNearMessage(messageId: string): number | null {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx < 0) return null;
    const self = messages[idx];
    if (self.expenseId) return self.expenseId;
    for (let i = idx - 1; i >= 0 && i >= idx - 6; i--) {
      if (messages[i].expenseId) return messages[i].expenseId ?? null;
    }
    for (let i = idx + 1; i < messages.length && i <= idx + 6; i++) {
      if (messages[i].expenseId) return messages[i].expenseId ?? null;
    }
    return null;
  }

  function matchExpenseFromParsed(parsed: PendingExpense): Expense | null {
    const candidates = expenses.filter(
      (e) =>
        e.date === parsed.date &&
        e.amount === parsed.amount &&
        e.description === parsed.description,
    );
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      return [...candidates].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0];
    }
    const loose = expenses.filter(
      (e) => e.amount === parsed.amount && e.description === parsed.description,
    );
    if (loose.length === 1) return loose[0];
    return null;
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
    const description = normalizeExpenseDescription(
      editForm.description.trim(),
      editForm.category,
      editForm.subcategory,
    );
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

  function clearAllChat(options?: {
    skipConfirm?: boolean;
    notice?: string;
  }) {
    if (!options?.skipConfirm) {
      if (
        !window.confirm(
          "채팅 대화를 모두 삭제할까요?\n저장된 지출 내역은 그대로 둡니다.",
        )
      ) {
        return;
      }
    }
    const nextMessages: ChatMessage[] = options?.notice
      ? [
          WELCOME_MESSAGE,
          {
            id: createMessageId(),
            role: "assistant",
            content: options.notice,
          },
        ]
      : [WELCOME_MESSAGE];
    setMessages(nextMessages);
    setPendingExpense(null);
    setPendingPhase(null);
    setChatError(null);
    setResumeSendText(null);
    setChatSelectMode(false);
    setSelectedChatIds([]);
    setContextMessageId(null);
    setEditingMessageId(null);
    setEditDraft("");
    setWelcomeTipEpoch((n) => n + 1);
    skipNextUserAppendRef.current = false;
    preserveSendingDraftRef.current = false;
    if (user?.id) {
      clearChatDraft(user.id);
      saveChatDraft(user.id, {
        messages: nextMessages,
        pendingExpense: null,
        pendingPhase: null,
        input: "",
        wasSending: false,
        lastUserText: null,
      });
    }
  }

  function startChatSelectCleanup(fromChat = false) {
    setPendingExpense(null);
    setPendingPhase(null);
    setTab("chat");
    setChatSelectMode(true);
    setSelectedChatIds([]);
    setContextMessageId(null);
    setEditingMessageId(null);
    setEditDraft("");
    if (fromChat) {
      pushAssistant(
        "지울 대화를 탭으로 고른 뒤 아래 「선택 삭제」를 눌러 주세요. 지출 내역은 그대로 둡니다.",
      );
    }
  }

  function deleteSelectedChat() {
    if (selectedChatIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 대화 ${selectedChatIds.length}개를 삭제할까요?\n저장된 지출 내역은 그대로 둡니다.`,
      )
    ) {
      return;
    }
    const remove = new Set(selectedChatIds);
    setMessages((prev) => {
      const next = prev.filter(
        (m) => m.id === "welcome" || !remove.has(m.id),
      );
      return next.length > 0 ? next : [WELCOME_MESSAGE];
    });
    setSelectedChatIds([]);
    setChatSelectMode(false);
  }

  function toggleChatSelect(id: string) {
    if (id === "welcome") return;
    setSelectedChatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }

  function startLongPress(id: string, clientX: number, clientY: number) {
    if (chatSelectMode || editingMessageId || id === "welcome" || sending) {
      return;
    }
    clearLongPressTimer();
    longPressStartRef.current = { x: clientX, y: clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      setContextMessageId(id);
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
    }, 480);
  }

  function onLongPressMove(clientX: number, clientY: number) {
    const start = longPressStartRef.current;
    if (!start || longPressTimerRef.current == null) return;
    const dx = Math.abs(clientX - start.x);
    const dy = Math.abs(clientY - start.y);
    if (dx > 10 || dy > 10) clearLongPressTimer();
  }

  function deleteOneChat(id: string) {
    if (id === "welcome") return;
    if (
      !window.confirm(
        "이 대화를 삭제할까요?\n저장된 지출 내역은 그대로 둡니다.",
      )
    ) {
      return;
    }
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      return next.length > 0 ? next : [WELCOME_MESSAGE];
    });
    setContextMessageId(null);
    if (editingMessageId === id) {
      setEditingMessageId(null);
      setEditDraft("");
    }
    setSelectedChatIds((prev) => prev.filter((x) => x !== id));
  }

  function beginEditChat(id: string, content: string) {
    if (id === "welcome") return;
    setContextMessageId(null);
    setEditingMessageId(id);
    setEditDraft(content);
  }

  async function copyTextToClipboard(text: string) {
    const value = text.trim();
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function copyChatMessage(id: string, content: string) {
    const ok = await copyTextToClipboard(content);
    if (!ok) {
      window.alert("복사에 실패했어요. 다시 시도해 주세요.");
      return;
    }
    setCopiedMessageId(id);
    window.setTimeout(() => {
      setCopiedMessageId((prev) => (prev === id ? null : prev));
      setContextMessageId((prev) => (prev === id ? null : prev));
    }, 900);
  }

  function openSaveToDate(item: Expense) {
    setSaveToDateItem(item);
    // 기본값: 원본과 다른 날짜를 고르기 쉽게 오늘(같으면 어제)
    const today = koreaToday();
    setSaveToDateValue(item.date === today ? koreaDateString(-1) : today);
    setSaveToDateBusy(false);
  }

  async function confirmSaveToDate() {
    if (!saveToDateItem || !saveToDateValue) return;
    if (saveToDateValue === saveToDateItem.date) {
      window.alert("원래 날짜와 같습니다. 다른 날짜를 골라 주세요.");
      return;
    }

    setSaveToDateBusy(true);
    setExpenseError(null);
    const saved = await saveExpense({
      date: saveToDateValue,
      amount: saveToDateItem.amount,
      description: saveToDateItem.description,
      category: saveToDateItem.category ?? "기타",
      subcategory: saveToDateItem.subcategory ?? "기타",
    });
    setSaveToDateBusy(false);

    if (!saved) {
      window.alert("다른 날짜로 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setSaveToDateItem(null);
    setSelectedId(null);
    pushAssistant(
      formatSavedReply({
        date: saved.date,
        amount: saved.amount,
        description: saved.description,
        category: saved.category ?? "기타",
        subcategory: saved.subcategory ?? "기타",
      }),
    );
  }

  function cancelEditChat() {
    setEditingMessageId(null);
    setEditDraft("");
  }

  async function saveEditChat() {
    if (!editingMessageId) return;
    const next = editDraft.trim();
    if (!next) {
      window.alert("내용을 입력해 주세요.");
      return;
    }

    const target = messages.find((m) => m.id === editingMessageId);
    if (!target) return;

    const previousContent = target.content;
    setSending(true);
    sendingRef.current = true;
    setChatError(null);

    try {
      // 새 문구로 지출 재추출
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: next,
          history: [],
          categoryTree,
          mode: "extract",
        }),
      });
      const data = (await response.json()) as {
        reply?: string;
        expense?: PendingExpense | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          data.error ?? "수정 내용을 파악하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }

      let expenseId =
        target.expenseId ?? findExpenseIdNearMessage(editingMessageId);

      // 연결 id가 없으면, 수정 전 문구로 기존 지출을 찾아 봄
      if (!expenseId && previousContent.trim()) {
        const oldRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: previousContent,
            history: [],
            categoryTree,
            mode: "extract",
          }),
        });
        const oldData = (await oldRes.json()) as {
          expense?: PendingExpense | null;
        };
        if (oldRes.ok && oldData.expense) {
          const matched = matchExpenseFromParsed(oldData.expense);
          if (matched) expenseId = matched.id;
        }
      }

      if (!data.expense) {
        // 지출로 해석되지 않으면 대화만 수정
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessageId ? { ...m, content: next } : m,
          ),
        );
        window.alert(
          "대화 문구는 저장했어요. 지출로 인식되지 않아 내역은 바꾸지 않았습니다.",
        );
        setEditingMessageId(null);
        setEditDraft("");
        return;
      }

      const parsed: PendingExpense = {
        date: data.expense.date,
        amount: data.expense.amount,
        description: data.expense.description,
        category: data.expense.category,
        subcategory: data.expense.subcategory,
      };

      let saved: Expense | null = null;
      if (expenseId) {
        saved = await updateExpenseRecord(expenseId, parsed);
        if (!saved) {
          throw new Error("지출 내역 수정에 실패했어요.");
        }
      } else {
        // 연결을 못 찾으면 새 지출로 저장할지 확인
        const ok = window.confirm(
          "이 대화에 연결된 지출을 찾지 못했어요.\n새 지출로 저장할까요?",
        );
        if (!ok) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === editingMessageId ? { ...m, content: next } : m,
            ),
          );
          setEditingMessageId(null);
          setEditDraft("");
          return;
        }
        saved = await saveExpense(parsed);
        if (!saved) {
          throw new Error("지출 저장에 실패했어요.");
        }
      }

      const linkedId = saved.id;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === editingMessageId) {
            return { ...m, content: next, expenseId: linkedId };
          }
          // 같은 지출에 묶인 저장 완료 안내 문구는 새 내용으로 맞춤
          if (
            m.expenseId === linkedId &&
            m.role === "assistant" &&
            m.content.includes("저장했어요")
          ) {
            return {
              ...m,
              content: formatSavedReply(parsed),
              expenseId: linkedId,
            };
          }
          if (m.expenseId === linkedId) {
            return { ...m, expenseId: linkedId };
          }
          return m;
        }),
      );
      setEditingMessageId(null);
      setEditDraft("");
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : "수정에 실패했어요. 잠시 후 다시 시도해 주세요.";
      setChatError(message);
      window.alert(message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  // 길게 누르기 메뉴: 다른 곳 탭하면 닫기 (수정 중이면 유지)
  useEffect(() => {
    if (!contextMessageId) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-chat-context]")) return;
      setContextMessageId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [contextMessageId]);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, []);

  async function commitPending(expense: PendingExpense) {
    const saved = await saveExpense(expense);
    if (!saved) {
      pushAssistant(
        "내용은 파악했지만 저장에 실패했어요. Supabase에 category 컬럼이 추가됐는지 확인해 주세요.",
      );
      return;
    }
    const sourceId = expense.sourceMessageId ?? null;
    setPendingExpense(null);
    setPendingPhase(null);
    setMessages((prev) => {
      const linked = sourceId
        ? prev.map((m) =>
            m.id === sourceId ? { ...m, expenseId: saved.id } : m,
          )
        : prev;
      return [
        ...linked,
        {
          id: createMessageId(),
          role: "assistant",
          content: formatSavedReply(expense),
          expenseId: saved.id,
        },
      ];
    });
  }

  async function handleSend(event?: FormEvent, overrideText?: string) {
    event?.preventDefault();

    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const alreadyAppended = skipNextUserAppendRef.current;
    skipNextUserAppendRef.current = false;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
    };

    // 복구·중복 전송이면 같은 사용자 말을 다시 붙이지 않음
    const lastMsg = messages[messages.length - 1];
    const sameAsLastUser =
      lastMsg?.role === "user" &&
      normalizeChatText(lastMsg.content) === normalizeChatText(text);
    const skipAppend = alreadyAppended || sameAsLastUser;

    const messagesWithUser = skipAppend
      ? messages
      : [...messages, userMessage];
    if (!skipAppend) {
      setMessages((prev) => {
        const prevLast = prev[prev.length - 1];
        if (
          prevLast?.role === "user" &&
          normalizeChatText(prevLast.content) === normalizeChatText(text)
        ) {
          return prev;
        }
        return [...prev, userMessage];
      });
    }
    // 지출을 말한 말풍선 — 저장 후 expenseId 연결용
    const sourceMessageId =
      skipAppend && lastMsg?.role === "user" ? lastMsg.id : userMessage.id;
    setInput("");
    setSending(true);
    sendingRef.current = true;
    lastSendTextRef.current = text;
    setChatError(null);

    try {
      // 저장 확인 중에도 통계·채팅삭제면 대기 건을 취소하고 해당 의도로 처리
      const earlyIntent = detectChatIntent(text);
      if (
        (earlyIntent === "stats" || earlyIntent === "chat_cleanup") &&
        (pendingPhase === "confirm" || pendingPhase === "await_category")
      ) {
        setPendingExpense(null);
        setPendingPhase(null);
      }

      // 0) 채팅 삭제 방식 고르는 단계
      if (pendingPhase === "await_chat_cleanup") {
        if (isChatCleanupAllChoice(text)) {
          clearAllChat({
            skipConfirm: true,
            notice:
              "대화만 모두 지웠어요. 저장된 지출 금액·내역은 그대로예요.",
          });
          return;
        }
        if (isChatCleanupSelectChoice(text)) {
          startChatSelectCleanup(true);
          return;
        }
        if (isNegative(text)) {
          setPendingPhase(null);
          pushAssistant("알겠어요. 채팅은 그대로 둘게요.");
          return;
        }
        pushAssistant(
          "「전부」라고 하시면 대화를 모두 지우고, 「선택」이라고 하시면 고를 수 있어요. (지출 내역은 유지됩니다)",
        );
        return;
      }

      // 1) 저장 확인 단계
      if (
        pendingPhase === "confirm" &&
        pendingExpense &&
        earlyIntent !== "stats" &&
        earlyIntent !== "chat_cleanup"
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
        earlyIntent !== "stats" &&
        earlyIntent !== "chat_cleanup"
      ) {
        const localPair = parseCategoryFromText(text, categoryTree);
        if (localPair) {
          const next: PendingExpense = {
            ...pendingExpense,
            category: localPair.category,
            subcategory: localPair.subcategory,
            sourceMessageId:
              pendingExpense.sourceMessageId ?? sourceMessageId,
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
            sourceMessageId:
              pendingExpense.sourceMessageId ?? sourceMessageId,
          };
          setPendingExpense(next);
          setPendingPhase("confirm");
          pushAssistant(formatAskConfirmReply(next));
          return;
        }

        pushAssistant(
          data.reply?.trim() ||
            "카테고리 분류 어떻게 할까요? 예: “가족-가족식대”",
        );
        return;
      }

      // 3) 채팅 삭제 / 통계 / 지출 입력
      const intent = detectChatIntent(text);
      const historyForApi = messagesWithUser
        .filter((m) => m.id !== "welcome")
        .map(({ role, content }) => ({ role, content }));

      if (intent === "chat_cleanup") {
        setPendingExpense(null);
        setPendingPhase("await_chat_cleanup");
        setChatSelectMode(false);
        setSelectedChatIds([]);
        pushAssistant(
          "대화를 지울까요? 「전부」 또는 「선택」이라고 말씀해 주세요. 저장된 지출은 그대로 둡니다.",
        );
        return;
      }

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
          sourceMessageId,
        };
        setPendingExpense(next);
        setPendingPhase("confirm");
        pushAssistant(formatAskConfirmReply(next));
        return;
      }

      pushAssistant(data.reply?.trim() || "네, 말씀해 주세요.");
    } catch (error) {
      // 앱을 나가며 요청이 끊긴 경우: Failed to fetch를 채팅에 남기지 않음
      if (pageLeavingRef.current || document.visibilityState === "hidden") {
        preserveSendingDraftRef.current = true;
        if (user?.id) {
          saveChatDraft(user.id, {
            messages: scrubDraftMessages(messagesWithUser),
            pendingExpense,
            pendingPhase,
            input: "",
            wasSending: true,
            lastUserText: text,
          });
        }
        return;
      }

      const message = formatChatSendError(error);
      setChatError(message);
      pushAssistant(message);
    } finally {
      sendingRef.current = false;
      setSending(false);
      if (!pageLeavingRef.current) {
        preserveSendingDraftRef.current = false;
      }
      inputRef.current?.focus();
    }
  }

  // 앱을 나갔다 왔을 때, 짧게 기다린 뒤 중단됐던 요청 재전송 (안내 문구 없음)
  useEffect(() => {
    if (!resumeSendText || !user?.id) return;
    if (sending) return;

    const text = resumeSendText;
    let cancelled = false;

    async function resume() {
      for (let i = 0; i < 3; i++) {
        if (cancelled) return;
        if (
          document.visibilityState === "visible" &&
          typeof navigator !== "undefined" &&
          navigator.onLine !== false
        ) {
          break;
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;

      setResumeSendText(null);
      preserveSendingDraftRef.current = false;
      skipNextUserAppendRef.current = true;
      void handleSend(undefined, text);
    }

    void resume();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 복구 시 1회 재전송
  }, [resumeSendText, user?.id]);

  // 생각 중 안내: 시간이 길면 문구 변경
  useEffect(() => {
    if (!sending) {
      setSendingStartedAt(null);
      setSendingTick(0);
      return;
    }
    setSendingStartedAt(Date.now());
    setSendingTick(0);
    const id = window.setInterval(() => {
      setSendingTick((n) => n + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sending]);

  const sendingElapsedSec = sendingStartedAt
    ? Math.max(
        sendingTick,
        Math.floor((Date.now() - sendingStartedAt) / 1000),
      )
    : 0;
  const sendingStatusText =
    sendingElapsedSec >= 8
      ? "서버가 바빠서 다른 경로로 시도 중이에요. 조금만 더 기다려 주세요..."
      : "생각 중이에요. 보통 몇 초면 답해요...";

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  const tabTitle =
    tab === "chat" ? "나의 AI 챗가계부" : tab === "monthly" ? "월별 지출" : "카테고리별 지출";

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
    <div className="flex min-h-0 flex-1 flex-col bg-[#f5f5f7]">
      {/* PWA/모바일: 화면 높이를 고정해 하단 전송·탭이 잘리지 않게 함 */}
      <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-md flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
        {/* 상단 제목 + 메뉴 */}
        <header className="relative shrink-0 border-b border-black/5 bg-white px-5 py-3 sm:py-4">
          <h1 className="text-center text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
            {tabTitle}
          </h1>
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <AppMenu
              expenses={expenses}
              onOpenCategoryEditor={() => setCategoryEditorOpen(true)}
              onOpenBudgetList={() => void openBudgetList()}
              onOpenInstallHelp={() => setInstallHelpOpen(true)}
              onOpenChatCleanup={() => setChatCleanupOpen(true)}
              onOpenChatNotice={() => {
                setTab("chat");
                setChatSelectMode(false);
                setChatNoticeShowRequestId((n) => n + 1);
              }}
              onOpenChange={setAppMenuOpen}
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

        {budgetError && (
          <p className="bg-[#fff4e5] px-4 py-2 text-center text-[12px] text-[#8a6116]">
            예산 DB 연결 확인: {budgetError}
            {" · "}
            SQL로 monthly_budgets 테이블을 만들어 주세요.
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
                          max={todayMax || undefined}
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
                                onClick={() => openSaveToDate(item)}
                                disabled={isBusy || busyId !== null}
                                className="rounded-lg bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#5856d6] disabled:opacity-40"
                              >
                                다른 날짜
                              </button>
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
          <ChatNoticeBanner
            active={!chatSelectMode}
            showRequestId={chatNoticeShowRequestId}
          />
          {chatSelectMode && (
            <p className="mb-3 text-center text-[12px] text-[#86868b]">
              지울 대화를 선택한 뒤 아래 「선택 삭제」를 누르세요. (안내 문구는
              유지됩니다)
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {messages.map((message) => {
              if (message.id === "welcome" && !showWelcomeTip) {
                return null;
              }
              const selectable =
                chatSelectMode && message.id !== "welcome";
              const selected = selectedChatIds.includes(message.id);
              const showActions =
                !chatSelectMode &&
                !editingMessageId &&
                contextMessageId === message.id &&
                message.id !== "welcome";
              const isEditing =
                !chatSelectMode && editingMessageId === message.id;
              const bubbleClass = `whitespace-pre-wrap break-words rounded-2xl px-3.5 py-1 text-left text-[15px] leading-relaxed transition-shadow select-none ${
                message.id === "welcome"
                  ? "w-full max-w-full border border-black/5 bg-[#fff8e8] text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-opacity duration-500"
                  : "max-w-[85%]"
              } ${
                message.id === "welcome"
                  ? ""
                  : message.role === "user"
                    ? "rounded-br-md bg-[#FEE500] text-[#191919]"
                    : "rounded-bl-md bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              } ${selectable ? "cursor-pointer" : ""} ${
                selected || showActions || isEditing
                  ? "ring-2 ring-[#1d1d1f] ring-offset-2 ring-offset-[#f5f5f7]"
                  : ""
              }`;

              return (
                <li
                  key={message.id}
                  data-chat-context={
                    showActions || isEditing ? "1" : undefined
                  }
                  className={`flex flex-col gap-1.5 ${
                    message.role === "user" ? "items-end" : "items-start"
                  } ${
                    message.id === "welcome"
                      ? "transition-opacity duration-500"
                      : ""
                  }`}
                >
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => toggleChatSelect(message.id)}
                      className={bubbleClass}
                    >
                      <span className="mb-1 block text-[11px] text-[#86868b]">
                        {selected ? "선택됨" : "탭하여 선택"}
                      </span>
                      {message.content}
                    </button>
                  ) : isEditing ? (
                    <div
                      className={`w-full max-w-[85%] rounded-2xl px-3 py-2.5 ${
                        message.role === "user"
                          ? "rounded-br-md bg-[#FEE500]"
                          : "rounded-bl-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      } ring-2 ring-[#1d1d1f] ring-offset-2 ring-offset-[#f5f5f7]`}
                    >
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full resize-y rounded-xl bg-white/80 px-2.5 py-2 text-[15px] leading-relaxed text-[#1d1d1f] outline-none"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditChat}
                          className="rounded-full bg-black/5 px-3.5 py-1.5 text-[13px] font-medium text-[#1d1d1f]"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void saveEditChat()}
                          className="rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                        >
                          {sending ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      role="presentation"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        startLongPress(message.id, e.clientX, e.clientY);
                      }}
                      onPointerMove={(e) =>
                        onLongPressMove(e.clientX, e.clientY)
                      }
                      onPointerUp={clearLongPressTimer}
                      onPointerCancel={clearLongPressTimer}
                      onContextMenu={(e) => {
                        if (
                          message.id === "welcome" ||
                          sending ||
                          editingMessageId
                        ) {
                          return;
                        }
                        e.preventDefault();
                        clearLongPressTimer();
                        setContextMessageId(message.id);
                      }}
                      className={bubbleClass}
                    >
                      <span
                        className={
                          message.id === "welcome"
                            ? "text-[13px] leading-relaxed text-[#6e6e73]"
                            : undefined
                        }
                      >
                        {message.content}
                      </span>
                    </div>
                  )}
                  {showActions && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void copyChatMessage(message.id, message.content)
                        }
                        className="rounded-full bg-[#5856d6] px-3.5 py-1.5 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                      >
                        {copiedMessageId === message.id ? "복사됨" : "복사"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          beginEditChat(message.id, message.content)
                        }
                        className="rounded-full bg-[#1d1d1f] px-3.5 py-1.5 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOneChat(message.id)}
                        className="rounded-full bg-[#ff3b30] px-3.5 py-1.5 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </li>
              );
            })}

            {sending && !chatSelectMode && (
              <li className="flex justify-start">
                <div className="w-full max-w-full rounded-2xl rounded-bl-md bg-white px-3.5 py-1 text-[14px] text-[#86868b] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  {sendingStatusText}
                </div>
              </li>
            )}
          </ul>
          <div ref={messagesEndRef} />
        </div>

        {/* 하단 입력 — 좁은 화면에서도 전송이 한 줄에 보이도록 */}
        <div className="shrink-0 border-t border-black/5 bg-white px-2 pt-2 sm:px-3 sm:pt-3">
          {chatSelectMode ? (
            <div className="flex gap-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  setChatSelectMode(false);
                  setSelectedChatIds([]);
                }}
                className="flex-1 rounded-2xl bg-[#f5f5f7] py-2.5 text-[14px] font-medium text-[#1d1d1f]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={selectedChatIds.length === 0}
                onClick={deleteSelectedChat}
                className="flex-1 rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white disabled:opacity-35"
              >
                선택 삭제
                {selectedChatIds.length > 0
                  ? ` (${selectedChatIds.length})`
                  : ""}
              </button>
            </div>
          ) : (
            <>
              {chatError && (
                <p className="mb-2 px-1 text-[12px] text-red-600">
                  {chatError}
                </p>
              )}
              <form
                onSubmit={(e) => handleSend(e)}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-1.5 pb-2"
              >
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
                  className="min-h-11 min-w-0 w-full rounded-2xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:bg-[#ebebed] disabled:opacity-60 sm:px-4"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="min-h-11 shrink-0 rounded-2xl bg-[#1d1d1f] px-3 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35 sm:px-4 sm:text-[14px]"
                >
                  전송
                </button>
              </form>
            </>
          )}
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
                {!appMenuOpen && <MonthlyBarChart data={monthlyTotals} />}
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
                    {!appMenuOpen && (
                      <CategoryPieChart data={categoryTotals} />
                    )}
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

      <InstallHelp
        open={installHelpOpen}
        onClose={() => setInstallHelpOpen(false)}
      />

      <SaveExpenseToDateDialog
        open={saveToDateItem !== null}
        description={saveToDateItem?.description ?? ""}
        amountLabel={
          saveToDateItem
            ? `${formatAmount(saveToDateItem.amount)}원`
            : ""
        }
        dateValue={saveToDateValue}
        busy={saveToDateBusy}
        onDateChange={setSaveToDateValue}
        onClose={() => {
          if (!saveToDateBusy) setSaveToDateItem(null);
        }}
        onSave={() => void confirmSaveToDate()}
      />

      <ChatCleanupMenu
        open={chatCleanupOpen}
        onClose={() => setChatCleanupOpen(false)}
        onClearAll={() => clearAllChat()}
        onStartSelect={() => startChatSelectCleanup(false)}
      />

      <BudgetList
        open={budgetListOpen}
        rows={budgetRows}
        currentMonth={currentMonth}
        alertPercent={budgetAlertPercent}
        loading={budgetListLoading}
        error={budgetError}
        onClose={() => setBudgetListOpen(false)}
        onSelect={(month, amount) => {
          setBudgetListOpen(false);
          openBudgetEditor(month, amount);
        }}
        onAddCurrent={() => {
          setBudgetListOpen(false);
          openBudgetEditor(currentMonth, monthBudget);
        }}
        onAlertPercentChange={(percent) => {
          const next = saveBudgetAlertPercent(percent);
          setBudgetAlertPercent(next);
          // 기준을 바꾸면, 이미 넘긴 상태여도 다시 아래에서 올라올 때만 울리도록 초기화
          budgetAlertReadyRef.current = false;
        }}
      />

      <BudgetEditor
        open={budgetEditorOpen}
        month={editingBudgetMonth}
        currentAmount={editingBudgetAmount}
        onClose={() => setBudgetEditorOpen(false)}
        onSave={async (amount) => {
          const month = editingBudgetMonth;
          if (!month) return "월 정보가 없습니다.";
          const result = await saveMonthlyBudget(month, amount);
          if (result.error) return result.error;
          setEditingBudgetAmount(result.budget?.amount ?? amount);
          if (month === currentMonth) {
            setMonthBudget(result.budget?.amount ?? amount);
          }
          setBudgetError(null);
          void refreshBudgetList();
          return null;
        }}
        onClear={async () => {
          const month = editingBudgetMonth;
          if (!month) return "월 정보가 없습니다.";
          const result = await clearMonthlyBudget(month);
          if (result.error) return result.error;
          setEditingBudgetAmount(null);
          if (month === currentMonth) {
            setMonthBudget(null);
          }
          setBudgetError(null);
          void refreshBudgetList();
          return null;
        }}
      />
    </div>
  );
}
