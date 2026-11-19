/** 환영 안내 등 UI 선호 저장 */

const WELCOME_SESSION_KEY = "account_book_welcome_shown_session_v1";

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
