const TOKEN_KEY = "account_book_google_access_token";
const EMAIL_KEY = "account_book_google_email";

export type GoogleSession = {
  accessToken: string;
  email: string;
};

export function loadGoogleSession(): GoogleSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  if (!accessToken || !email) return null;
  return { accessToken, email };
}

export function saveGoogleSession(session: GoogleSession) {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(EMAIL_KEY, session.email);
}

export function clearGoogleSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
