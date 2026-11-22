"use client";

import { FormEvent, useState } from "react";
import {
  setAppLockPin,
  setAppLockRemember,
  unlockAppLockSession,
  verifyAppLockPin,
} from "@/lib/appLock";

type AppLockScreenProps = {
  mode: "setup" | "unlock";
  onUnlocked: () => void;
};

/** 가계부 열 때 비밀번호 설정·해제 */
export function AppLockScreen({ mode, onUnlocked }: AppLockScreenProps) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "setup") {
        if (pin !== pinConfirm) {
          setError("비밀번호가 서로 달라요.");
          return;
        }
        await setAppLockPin(pin, remember);
        onUnlocked();
        return;
      }
      const ok = await verifyAppLockPin(pin);
      if (!ok) {
        setError("비밀번호가 올바르지 않아요.");
        return;
      }
      setAppLockRemember(remember);
      unlockAppLockSession();
      onUnlocked();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "잠금 처리에 실패했어요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-1 flex-col items-center justify-center bg-[#f5f5f7] px-5">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
      >
        <h1 className="text-center text-[20px] font-semibold text-[#1d1d1f]">
          {mode === "setup" ? "잠금 비밀번호 설정" : "가계부 잠금 해제"}
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[#86868b]">
          {mode === "setup"
            ? "다른 사람이 보지 못하도록 숫자 비밀번호를 정하세요."
            : "비밀번호를 입력하면 가계부가 열립니다."}
        </p>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-[13px] text-[#86868b]">
            비밀번호 (숫자 4~8자리)
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            name="app-lock-pin"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed] [-webkit-text-security:disc]"
            disabled={busy}
            autoFocus
          />
        </label>

        {mode === "setup" && (
          <label className="mt-3 block">
            <span className="mb-1.5 block text-[13px] text-[#86868b]">
              비밀번호 확인
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              name="app-lock-pin-confirm"
              value={pinConfirm}
              onChange={(e) =>
                setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              className="w-full rounded-xl bg-[#f5f5f7] px-3 py-2.5 text-[15px] text-[#1d1d1f] outline-none focus:bg-[#ebebed] [-webkit-text-security:disc]"
              disabled={busy}
            />
          </label>
        )}

        <label className="mt-4 flex items-start gap-2.5 px-0.5">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-black/20"
            disabled={busy}
          />
          <span className="text-[13px] leading-relaxed text-[#1d1d1f]">
            이 기기에서 비밀번호 기억하기
            <span className="mt-0.5 block text-[12px] text-[#86868b]">
              켜면 다음부터 비밀번호 없이 바로 열립니다. 끄면 열 때마다
              입력합니다.
            </span>
          </span>
        </label>

        {error && (
          <p className="mt-3 text-[13px] text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || pin.length < 4}
          className="mt-5 w-full rounded-2xl bg-[#1d1d1f] py-3 text-[15px] font-medium text-white disabled:opacity-40"
        >
          {busy
            ? "처리 중..."
            : mode === "setup"
              ? "설정 완료"
              : "열기"}
        </button>
      </form>
    </div>
  );
}
