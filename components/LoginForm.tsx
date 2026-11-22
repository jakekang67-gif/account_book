"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { InstallHelp } from "@/components/InstallHelp";
import { getRememberLogin, getSavedEmail } from "@/lib/authStorage";

type Mode = "login" | "signup";

/** 이메일·비밀번호 로그인 / 회원가입 */
export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  useEffect(() => {
    setEmail(getSavedEmail());
    setRememberMe(getRememberLogin());
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || password.length < 6) {
      setMessage("이메일과 비밀번호(6자 이상)를 입력해 주세요.");
      return;
    }

    setBusy(true);
    setMessage(null);
    const error =
      mode === "login"
        ? await signIn(trimmed, password, rememberMe)
        : await signUp(trimmed, password, rememberMe);
    setBusy(false);

    if (error) {
      setMessage(error);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center bg-[#f5f5f7] px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-center text-[20px] font-semibold text-[#1d1d1f]">
          나의 AI 챗가계부
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[#86868b]">
          채팅으로 지출을 정리하는 나만의 AI 가계부입니다.
        </p>
        <button
          type="button"
          onClick={() => setInstallHelpOpen(true)}
          className="mt-3 w-full text-center text-[12px] font-medium text-[#1d1d1f] underline underline-offset-2"
        >
          홈화면에 앱처럼 추가하는 방법
        </button>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#f5f5f7] p-1">
          {(
            [
              { id: "login", label: "로그인" },
              { id: "signup", label: "회원가입" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                setMessage(null);
              }}
              className={`rounded-xl py-2 text-[13px] font-medium transition-colors ${
                mode === item.id
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#86868b]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          autoComplete="off"
          data-form-type="other"
          onSubmit={handleSubmit}
          className="mt-5 space-y-3"
        >
          <label className="block">
            <span className="mb-1 block px-0.5 text-[12px] text-[#86868b]">
              이메일
            </span>
            <input
              type="email"
              name="account-book-login-email"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block px-0.5 text-[12px] text-[#86868b]">
              비밀번호
            </span>
            <input
              type="text"
              name="account-book-login-secret"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              data-lpignore="true"
              data-1p-ignore="true"
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed] [-webkit-text-security:disc]"
              placeholder="6자 이상"
            />
          </label>

          <label className="flex items-center gap-2 px-0.5 py-1">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 rounded border-black/20"
            />
            <span className="text-[13px] text-[#424245]">
              로그인 상태 유지 (다음에도 자동 로그인)
            </span>
          </label>

          {message && (
            <p className="px-0.5 text-[12px] leading-relaxed text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-2xl bg-[#1d1d1f] py-3 text-[14px] font-medium text-white disabled:opacity-40"
          >
            {busy
              ? "처리 중..."
              : mode === "login"
                ? "로그인"
                : "회원가입"}
          </button>
        </form>
      </div>

      <InstallHelp
        open={installHelpOpen}
        onClose={() => setInstallHelpOpen(false)}
      />
    </div>
  );
}
