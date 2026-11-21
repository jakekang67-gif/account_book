/** 가계부 앱 잠금(비밀번호). 로그인과 별도로 화면만 잠급니다. */

const PIN_HASH_KEY = "account_book_lock_pin_hash_v1";
const REMEMBER_KEY = "account_book_lock_remember_v1";
const SESSION_UNLOCK_KEY = "account_book_lock_session_unlocked_v1";

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAppLockPin(pin: string) {
  return sha256Hex(`account_book_lock_v1:${pin.trim()}`);
}

export function hasAppLockPin() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(PIN_HASH_KEY));
  } catch {
    return false;
  }
}

export function getAppLockRemember() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAppLockRemember(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    if (remember) {
      window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
    }
  } catch {
    // ignore
  }
}

export async function setAppLockPin(pin: string, remember: boolean) {
  if (typeof window === "undefined") return;
  const trimmed = pin.trim();
  if (!/^\d{4,8}$/.test(trimmed)) {
    throw new Error("비밀번호는 숫자 4~8자리로 입력해 주세요.");
  }
  const hash = await hashAppLockPin(trimmed);
  window.localStorage.setItem(PIN_HASH_KEY, hash);
  setAppLockRemember(remember);
  window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
}

export async function verifyAppLockPin(pin: string) {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await hashAppLockPin(pin.trim());
  return hash === stored;
}

export function unlockAppLockSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
  } catch {
    // ignore
  }
}

export function isAppLockUnlocked() {
  if (typeof window === "undefined") return true;
  try {
    if (!hasAppLockPin()) return true;
    if (getAppLockRemember()) return true;
    return window.sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAppLock() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PIN_HASH_KEY);
    window.localStorage.removeItem(REMEMBER_KEY);
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    // ignore
  }
}

export function lockAppNow() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_KEY, "0");
    window.sessionStorage.removeItem(SESSION_UNLOCK_KEY);
  } catch {
    // ignore
  }
}
