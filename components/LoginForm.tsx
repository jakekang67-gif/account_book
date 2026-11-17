"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Mode = "login" | "signup";

/** 이메일·비밀번호 로그인 / 회원가입 */
export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
        ? await signIn(trimmed, password)
        : await signUp(trimmed, password);
    setBusy(false);

    if (error) {
      setMessage(error);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center bg-[#f5f5f7] px-5">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-center text-[20px] font-semibold text-[#1d1d1f]">
          AI 가계부
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[#86868b]">
          이메일로 로그인하면 나만의 장부가 만들어집니다.
        </p>

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

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block px-0.5 text-[12px] text-[#86868b]">
              이메일
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block px-0.5 text-[12px] text-[#86868b]">
              비밀번호
            </span>
            <input
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed]"
              placeholder="6자 이상"
            />
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
    </div>
  );
}
