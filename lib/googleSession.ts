const TOKEN_KEY = "account_book_google_access_token";
const REFRESH_KEY = "account_book_google_refresh_token";
const EMAIL_KEY = "account_book_google_email";
const EXPIRES_KEY = "account_book_google_expires_at";

export type GoogleSession = {
  accessToken: string;
  email: string;
  refreshToken?: string | null;
  /** 만료 시각 (ms). 없으면 알 수 없음 */
  expiresAt?: number | null;
};

export function loadGoogleSession(): GoogleSession | null {
  if (typeof window === "undefined") return null;
  try {
    const accessToken = window.localStorage.getItem(TOKEN_KEY);
    const email = window.localStorage.getItem(EMAIL_KEY);
    if (!accessToken || !email) return null;
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    const expiresRaw = window.localStorage.getItem(EXPIRES_KEY);
    const expiresAt = expiresRaw ? Number(expiresRaw) : null;
    return {
      accessToken,
      email,
      refreshToken,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    };
  } catch {
    return null;
  }
}

export function saveGoogleSession(session: GoogleSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, session.accessToken);
    window.localStorage.setItem(EMAIL_KEY, session.email);
    if (session.refreshToken) {
      window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
    if (session.expiresAt) {
      window.localStorage.setItem(EXPIRES_KEY, String(session.expiresAt));
    } else {
      window.localStorage.removeItem(EXPIRES_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearGoogleSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(EMAIL_KEY);
    window.localStorage.removeItem(EXPIRES_KEY);
  } catch {
    // ignore
  }
}

/**
 * 만료 임박/만료 시 refresh token으로 액세스 토큰을 갱신합니다.
 * @param options.force true면 만료 시각과 관계없이 refresh 시도 (401 재시도용)
 */
export async function ensureFreshGoogleSession(options?: {
  force?: boolean;
}): Promise<{
  session: GoogleSession | null;
  error: string | null;
}> {
  const current = loadGoogleSession();
  if (!current) {
    return { session: null, error: "구글 메일이 연결되어 있지 않습니다." };
  }

  const skewMs = 90_000;
  const stillValid =
    !options?.force &&
    current.expiresAt != null &&
    current.expiresAt > Date.now() + skewMs;

  if (stillValid) {
    return { session: current, error: null };
  }

  // 만료 시각이 없거나 임박 — refresh 시도
  if (!current.refreshToken) {
    // 예전 방식(액세스만) — 만료가 확실하면 재연결 유도
    if (
      options?.force ||
      (current.expiresAt != null && current.expiresAt <= Date.now() + skewMs)
    ) {
      return {
        session: null,
        error:
          "구글 연결이 만료됐어요. 메뉴에서 「구글 계정 연결」을 다시 해주세요.",
      };
    }
    return { session: current, error: null };
  }

  try {
    const response = await fetch("/api/google/oauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refresh",
        refreshToken: current.refreshToken,
      }),
    });
    const data = (await response.json()) as {
      accessToken?: string;
      expiresIn?: number;
      refreshToken?: string;
      error?: string;
    };
    if (!response.ok || !data.accessToken) {
      clearGoogleSession();
      return {
        session: null,
        error:
          data.error ??
          "구글 연결이 만료됐어요. 메뉴에서 「구글 계정 연결」을 다시 해주세요.",
      };
    }

    const next: GoogleSession = {
      accessToken: data.accessToken,
      email: current.email,
      refreshToken: data.refreshToken || current.refreshToken,
      expiresAt: data.expiresIn
        ? Date.now() + data.expiresIn * 1000
        : Date.now() + 3500 * 1000,
    };
    saveGoogleSession(next);
    return { session: next, error: null };
  } catch {
    return {
      session: null,
      error:
        "구글 토큰 갱신에 실패했어요. 메뉴에서 「구글 계정 연결」을 다시 해주세요.",
    };
  }
}
