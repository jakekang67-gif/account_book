/** 마지막 탭·환영 안내 등 UI 선호 저장 */

const TAB_KEY = "account_book_last_tab_v1";
const WELCOME_SESSION_KEY = "account_book_welcome_shown_session_v1";

export type AppTabPref = "chat" | "monthly" | "category";

export function loadLastTab(): AppTabPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(TAB_KEY);
    if (v === "chat" || v === "monthly" || v === "category") return v;
  } catch {
    // ignore
  }
  return null;
}

export function saveLastTab(tab: AppTabPref) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAB_KEY, tab);
  } catch {
    // ignore
  }
}

/** 이 브라우저 세션에서 이미 환영을 보여줬는지 (앱 전환 후 재표시 방지) */
export function wasWelcomeShownThisSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(WELCOME_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeShownThisSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}
