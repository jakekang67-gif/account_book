import { koreaDateString, koreaHour, koreaToday } from "@/lib/date";
import {
  dueMonthsForRecurring,
  recurringDateForMonth,
  summarizeRecurringForMonth,
  type RecurringExpense,
} from "@/lib/recurringStore";

const STORAGE_PREFIX = "account_book_recurring_remind_v1:";
/** 알림·대화창 안내를 띄우기 시작하는 한국 시간 (시) */
export const RECURRING_REMIND_HOUR = 10;

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

function remainingAfterItem(
  rows: RecurringExpense[],
  dueDate: string,
  amount: number,
  income: boolean,
) {
  const filtered = rows.filter((r) => isFixedIncomeRow(r) === income);
  const summary = summarizeRecurringForMonth(filtered, dueDate.slice(0, 7));
  return Math.max(0, summary.total - amount);
}

export function buildEveReminderMessage(
  row: RecurringExpense,
  dueDate: string,
  remaining: number,
) {
  const day = dayLabel(dueDate);
  const kindLabel = isFixedIncomeRow(row) ? "정기 수입" : "정기 지출";
  return `내일(${day}일) ${row.description} ${formatRecurringSpeechAmount(row.amount)} ${kindLabel}, 이번달 나머지 ${kindLabel} 금액은 ${new Intl.NumberFormat("ko-KR").format(remaining)}원`;
}

export function buildDayReminderMessage(row: RecurringExpense, dueDate: string) {
  const day = dayLabel(dueDate);
  const kindLabel = isFixedIncomeRow(row) ? "정기 수입" : "정기 지출";
  return `오늘(${day}일) ${row.description} ${formatRecurringSpeechAmount(row.amount)} ${kindLabel}`;
}

/**
 * 한국 시간 기준 오전 10시 이후라면, 전날/당일 안내 목록을 만듭니다.
 * (앱이 닫혀 있어도 10시 이후 다시 열면 놓친 안내를 보여 줍니다.)
 */
export function collectRecurringReminders(
  rows: RecurringExpense[],
  options?: { today?: string; hour?: number },
): RecurringReminder[] {
  const today = options?.today ?? koreaToday();
  const hour = options?.hour ?? koreaHour();
  if (hour < RECURRING_REMIND_HOUR) return [];

  const tomorrow = koreaDateString(1);
  const active = rows.filter((r) => r.active !== false);
  const out: RecurringReminder[] = [];

  for (const row of active) {
    if (isRecurringDueOnDate(row, tomorrow)) {
      const remaining = remainingAfterItem(
        active,
        tomorrow,
        row.amount,
        isFixedIncomeRow(row),
      );
      out.push({
        kind: "eve",
        row,
        dueDate: tomorrow,
        message: buildEveReminderMessage(row, tomorrow, remaining),
      });
    }
    if (isRecurringDueOnDate(row, today)) {
      out.push({
        kind: "day",
        row,
        dueDate: today,
        message: buildDayReminderMessage(row, today),
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

  const title = options?.isIncome ? "정기 수입 알림" : "정기 지출 알림";
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
