/** 로그인 유지·이메일 기억용 로컬 키 */
const REMEMBER_KEY = "account_book_remember_login";
const EMAIL_KEY = "account_book_saved_email";

export function getRememberLogin() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_KEY) !== "0";
}

export function setRememberLogin(remember: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
}

export function getSavedEmail() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(EMAIL_KEY) ?? "";
}

export function setSavedEmail(email: string) {
  if (typeof window === "undefined") return;
  const trimmed = email.trim();
  if (!trimmed) {
    window.localStorage.removeItem(EMAIL_KEY);
    return;
  }
  window.localStorage.setItem(EMAIL_KEY, trimmed);
}

export function clearSavedEmail() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_KEY);
}

/**
 * Supabase 세션 저장소.
 * 로그인 유지 ON → localStorage (앱을 닫아도 유지)
 * OFF → sessionStorage (탭을 닫으면 로그아웃)
 */
export const authBrowserStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    if (getRememberLogin()) {
      return (
        window.localStorage.getItem(key) ??
        window.sessionStorage.getItem(key)
      );
    }
    return (
      window.sessionStorage.getItem(key) ??
      window.localStorage.getItem(key)
    );
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    if (getRememberLogin()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};
