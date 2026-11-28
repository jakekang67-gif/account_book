import {
  isRecurringExpenseDescription,
  koreaDateString,
  koreaHour,
  koreaRecurringReflectDate,
  koreaToday,
  RECURRING_REFLECT_HOUR,
} from "@/lib/date";
import { formatMonthLabel } from "@/lib/reports";
import {
  dueMonthsForRecurring,
  recurringDateForMonth,
  sumRecurringExpenseTemplates,
  summarizeTaggedRecurringExpenses,
  type RecurringExpense,
} from "@/lib/recurringStore";

const STORAGE_PREFIX = "account_book_recurring_remind_v1:";
/** 알림·대화창 안내를 띄우기 시작하는 한국 시간 (시) — 내역 반영과 동일 */
export const RECURRING_REMIND_HOUR = RECURRING_REFLECT_HOUR;

export type RecurringReminderKind = "eve" | "day";

export type RecurringReminder = {
  kind: RecurringReminderKind;
  row: RecurringExpense;
  dueDate: string;
  message: string;
};

function storageKey(
  userId: string,
  kind: RecurringReminderKind,
  dueDate: string,
  recurringId: number,
) {
  return `${STORAGE_PREFIX}${userId}:${kind}:${dueDate}:${recurringId}`;
}

export function wasRecurringReminderShown(
  userId: string,
  kind: RecurringReminderKind,
  dueDate: string,
  recurringId: number,
) {
  if (typeof window === "undefined") return true;
  try {
    return (
      window.localStorage.getItem(
        storageKey(userId, kind, dueDate, recurringId),
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function markRecurringReminderShown(
  userId: string,
  kind: RecurringReminderKind,
  dueDate: string,
  recurringId: number,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(userId, kind, dueDate, recurringId),
      "1",
    );
  } catch {
    // ignore
  }
}

/** 대화/알림용 금액 (예: 10만원, 9,500원) */
export function formatRecurringSpeechAmount(amount: number) {
  const n = Math.round(amount);
  if (n >= 10_000 && n % 10_000 === 0) {
    return `${new Intl.NumberFormat("ko-KR").format(n / 10_000)}만원`;
  }
  return `${new Intl.NumberFormat("ko-KR").format(n)}원`;
}

function dayLabel(date: string) {
  return String(Number(date.slice(8, 10)) || 1);
}

/** 해당 날짜에 정기 지출이 도래하는지 */
export function isRecurringDueOnDate(row: RecurringExpense, date: string) {
  const monthKey = date.slice(0, 7);
  const months = dueMonthsForRecurring(
    row.start_date,
    row.interval_months,
    null,
    monthKey,
  );
  if (!months.includes(monthKey)) return false;
  return recurringDateForMonth(row.start_date, monthKey) === date;
}

function isFixedIncomeRow(row: RecurringExpense) {
  return row.category === "고정 수입";
}

function formatWon(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n);
}

type MonthProgress = {
  planned: number;
  completed: number;
  remaining: number;
};

/** 채팅 통계와 동일: 합계(메뉴)=템플릿 합, 완료=10시 기준 반영분 */
export function computeRecurringMonthProgress(
  templates: RecurringExpense[],
  expenses: Array<{
    date: string;
    amount: number;
    category: string | null;
    subcategory?: string | null;
    description: string;
  }>,
  options?: {
    monthKey?: string;
    today?: string;
    reflectDate?: string;
    income?: boolean;
  },
): MonthProgress {
  const today = options?.today ?? koreaToday();
  const monthKey = options?.monthKey ?? today.slice(0, 7);
  const reflect = options?.reflectDate ?? koreaRecurringReflectDate();
  const income = options?.income === true;

  const planned = income
    ? templates
        .filter((r) => r.active !== false && isFixedIncomeRow(r))
        .reduce((sum, r) => sum + r.amount, 0)
    : sumRecurringExpenseTemplates(templates).total;

  const visible = expenses.filter((item) => {
    if (item.date > today) return false;
    if (
      isRecurringExpenseDescription(item.description) &&
      item.date > reflect
    ) {
      return false;
    }
    return true;
  });

  const completed = summarizeTaggedRecurringExpenses(
    visible,
    monthKey,
    income ? "income" : "expense",
  ).total;

  return {
    planned,
    completed,
    remaining: Math.max(0, planned - completed),
  };
}

function formatProgressBlock(
  monthKey: string,
  income: boolean,
  progress: MonthProgress,
) {
  const kindLabel = income ? "고정 수입" : "고정 지출";
  const doneLabel = income ? "수입 완료" : "지출 완료";
  const remLabel = income ? "수입 잔액" : "지출 잔액";
  return [
    `${formatMonthLabel(monthKey)} ${kindLabel}`,
    `- 합계 금액 : ${formatWon(progress.planned)}원`,
    `- ${doneLabel} : ${formatWon(progress.completed)}원`,
    `- ${remLabel} : ${formatWon(progress.remaining)}원`,
  ].join("\n");
}

export function buildEveReminderMessage(
  row: RecurringExpense,
  dueDate: string,
  progress: MonthProgress,
) {
  const day = dayLabel(dueDate);
  const income = isFixedIncomeRow(row);
  const kindLabel = income ? "고정 수입" : "고정 지출";
  const head = `내일(${day}일) ${row.description} ${formatRecurringSpeechAmount(row.amount)} ${kindLabel}`;
  return `${head}\n\n${formatProgressBlock(dueDate.slice(0, 7), income, progress)}`;
}

export function buildDayReminderMessage(
  row: RecurringExpense,
  dueDate: string,
  progress: MonthProgress,
) {
  const day = dayLabel(dueDate);
  const income = isFixedIncomeRow(row);
  const kindLabel = income ? "고정 수입" : "고정 지출";
  const head = `오늘(${day}일) ${row.description} ${formatRecurringSpeechAmount(row.amount)} ${kindLabel}`;
  return `${head}\n\n${formatProgressBlock(dueDate.slice(0, 7), income, progress)}`;
}

/**
 * 한국 시간 기준 오전 10시 이후라면, 전날/당일 안내 목록을 만듭니다.
 * (앱이 닫혀 있어도 10시 이후 다시 열면 놓친 안내를 보여 줍니다.)
 */
export function collectRecurringReminders(
  rows: RecurringExpense[],
  options?: {
    today?: string;
    hour?: number;
    reflectDate?: string;
    expenses?: Array<{
      date: string;
      amount: number;
      category: string | null;
      subcategory?: string | null;
      description: string;
    }>;
  },
): RecurringReminder[] {
  const today = options?.today ?? koreaToday();
  const hour = options?.hour ?? koreaHour();
  if (hour < RECURRING_REMIND_HOUR) return [];

  const tomorrow = koreaDateString(1);
  const active = rows.filter((r) => r.active !== false);
  const expenses = options?.expenses ?? [];
  const reflectDate = options?.reflectDate ?? koreaRecurringReflectDate();
  const monthKey = today.slice(0, 7);

  const expenseProgress = computeRecurringMonthProgress(active, expenses, {
    monthKey,
    today,
    reflectDate,
    income: false,
  });
  const incomeProgress = computeRecurringMonthProgress(active, expenses, {
    monthKey,
    today,
    reflectDate,
    income: true,
  });

  const out: RecurringReminder[] = [];

  for (const row of active) {
    const income = isFixedIncomeRow(row);
    const progress = income ? incomeProgress : expenseProgress;
    if (isRecurringDueOnDate(row, tomorrow)) {
      out.push({
        kind: "eve",
        row,
        dueDate: tomorrow,
        message: buildEveReminderMessage(row, tomorrow, progress),
      });
    }
    if (isRecurringDueOnDate(row, today)) {
      out.push({
        kind: "day",
        row,
        dueDate: today,
        message: buildDayReminderMessage(row, today, progress),
      });
    }
  }

  // 전날 안내 → 당일 안내 순, 같은 종류면 금액 큰 순
  return out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "eve" ? -1 : 1;
    return b.row.amount - a.row.amount;
  });
}

const NOTIFICATION_ASKED_KEY = "account_book_notification_permission_asked_v1";

function wasNotificationPermissionAsked() {
  try {
    return window.localStorage.getItem(NOTIFICATION_ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

function markNotificationPermissionAsked() {
  try {
    window.localStorage.setItem(NOTIFICATION_ASKED_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * 알림 권한 확인.
 * requestPermission 대화상자는 앱 기준으로 처음 한 번만 띄웁니다.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  // default: 이미 한 번 물어봤으면 다시 묻지 않음
  if (wasNotificationPermissionAsked()) return false;

  try {
    markNotificationPermissionAsked();
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    markNotificationPermissionAsked();
    return false;
  }
}

export async function showRecurringNotification(
  body: string,
  options?: { isIncome?: boolean },
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const title = options?.isIncome ? "고정 수입 알림" : "고정 지출 알림";
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `recurring-${body.slice(0, 40)}`,
      });
      return;
    }
  } catch {
    // 서비스 워커 알림 실패 시 아래로
  }

  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
    });
  } catch {
    // 무시
  }
}
