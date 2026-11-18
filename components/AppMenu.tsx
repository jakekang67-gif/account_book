"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";
import {
  downloadExpensesExcel,
  expensesToExcelBase64,
  type ExcelExpenseRow,
} from "@/lib/excel";
import {
  clearGoogleSession,
  loadGoogleSession,
  saveGoogleSession,
  type GoogleSession,
} from "@/lib/googleSession";

type AppMenuProps = {
  expenses: ExcelExpenseRow[];
  onOpenCategoryEditor?: () => void;
  onOpenBudgetList?: () => void;
  onOpenInstallHelp?: () => void;
  accountEmail?: string | null;
  onSignOut?: () => void;
};

export function AppMenu({
  expenses,
  onOpenCategoryEditor,
  onOpenBudgetList,
  onOpenInstallHelp,
  accountEmail,
  onSignOut,
}: AppMenuProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return (
      <MenuPanel
        expenses={expenses}
        googleEnabled={false}
        onOpenCategoryEditor={onOpenCategoryEditor}
        onOpenBudgetList={onOpenBudgetList}
        onOpenInstallHelp={onOpenInstallHelp}
        accountEmail={accountEmail}
        onSignOut={onSignOut}
      />
    );
  }
  return (
    <MenuWithGoogle
      expenses={expenses}
      onOpenCategoryEditor={onOpenCategoryEditor}
      onOpenBudgetList={onOpenBudgetList}
      onOpenInstallHelp={onOpenInstallHelp}
      accountEmail={accountEmail}
      onSignOut={onSignOut}
    />
  );
}

function MenuWithGoogle({
  expenses,
  onOpenCategoryEditor,
  onOpenBudgetList,
  onOpenInstallHelp,
  accountEmail,
  onSignOut,
}: AppMenuProps) {
  const [session, setSession] = useState<GoogleSession | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSession(loadGoogleSession());
  }, []);

  const login = useGoogleLogin({
    scope:
      "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
    onSuccess: async (tokenResponse) => {
      setBusy(true);
      setStatus(null);
      try {
        const profileRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          },
        );
        if (!profileRes.ok) {
          throw new Error("구글 프로필을 가져오지 못했습니다.");
        }
        const profile = (await profileRes.json()) as { email?: string };
        if (!profile.email) {
          throw new Error("구글 이메일을 확인할 수 없습니다.");
        }
        const next = {
          accessToken: tokenResponse.access_token,
          email: profile.email,
        };
        saveGoogleSession(next);
        setSession(next);
        setStatus(`연결됨: ${profile.email}`);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "구글 연결에 실패했습니다.",
        );
      } finally {
        setBusy(false);
      }
    },
    onError: () => setStatus("구글 로그인에 실패했습니다."),
  });

  return (
    <MenuPanel
      expenses={expenses}
      googleEnabled
      session={session}
      status={status}
      busy={busy}
      setStatus={setStatus}
      setBusy={setBusy}
      setSession={setSession}
      onConnectGoogle={() => login()}
      onOpenCategoryEditor={onOpenCategoryEditor}
      onOpenBudgetList={onOpenBudgetList}
      onOpenInstallHelp={onOpenInstallHelp}
      accountEmail={accountEmail}
      onSignOut={onSignOut}
    />
  );
}

function MenuPanel({
  expenses,
  googleEnabled,
  session: sessionProp,
  status: statusProp,
  busy: busyProp,
  setStatus: setStatusProp,
  setBusy: setBusyProp,
  setSession: setSessionProp,
  onConnectGoogle,
  onOpenCategoryEditor,
  onOpenBudgetList,
  onOpenInstallHelp,
  accountEmail,
  onSignOut,
}: AppMenuProps & {
  googleEnabled: boolean;
  session?: GoogleSession | null;
  status?: string | null;
  busy?: boolean;
  setStatus?: (value: string | null) => void;
  setBusy?: (value: boolean) => void;
  setSession?: (value: GoogleSession | null) => void;
  onConnectGoogle?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [localSession, setLocalSession] = useState<GoogleSession | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const session = sessionProp ?? localSession;
  const status = statusProp ?? localStatus;
  const busy = busyProp ?? localBusy;
  const setStatus = setStatusProp ?? setLocalStatus;
  const setBusy = setBusyProp ?? setLocalBusy;
  const setSession = setSessionProp ?? setLocalSession;

  useEffect(() => {
    if (sessionProp === undefined) {
      setLocalSession(loadGoogleSession());
    }
  }, [sessionProp]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function handleDownload() {
    if (expenses.length === 0) {
      setStatus("내보낼 지출 내역이 없습니다.");
      return;
    }
    downloadExpensesExcel(expenses);
    setStatus("엑셀 파일을 다운로드했습니다.");
    setOpen(false);
  }

  async function handleSendMail() {
    if (expenses.length === 0) {
      setStatus("보낼 지출 내역이 없습니다.");
      return;
    }
    if (!session) {
      setStatus("먼저 구글 계정을 연결해 주세요.");
      return;
    }

    setBusy(true);
    setStatus("메일 보내는 중...");
    try {
      const file = expensesToExcelBase64(expenses);
      const response = await fetch("/api/export/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.accessToken,
          to: session.email,
          fileName: file.fileName,
          fileBase64: file.base64,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "메일 발송에 실패했습니다.");
      }
      setStatus(`${session.email}로 메일을 보냈습니다.`);
      setOpen(false);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "메일 발송에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleConnect() {
    if (!googleEnabled || !onConnectGoogle) {
      setStatus(
        ".env.local에 NEXT_PUBLIC_GOOGLE_CLIENT_ID를 넣고 서버를 재시작해 주세요.",
      );
      return;
    }
    onConnectGoogle();
  }

  function handleDisconnect() {
    clearGoogleSession();
    setSession(null);
    setStatus("구글 계정 연결을 해제했습니다.");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="메뉴"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1d1d1f] hover:bg-[#f5f5f7]"
      >
        <span className="text-[20px] leading-none">☰</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <div className="border-b border-black/5 px-3 py-2.5">
            <p className="text-[12px] text-[#86868b]">
              {accountEmail
                ? `로그인: ${accountEmail}`
                : "가계부 미로그인"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#aeaeb2]">
              {session ? `Gmail: ${session.email}` : "구글 메일 미연결"}
            </p>
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={handleDownload}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                엑셀 다운로드
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendMail()}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                메일로 보내기
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onOpenBudgetList?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                월 예산 목록
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onOpenInstallHelp?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                홈화면에 추가 안내
              </button>
            </li>
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onOpenCategoryEditor?.();
                }}
                className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
              >
                카테고리 편집
              </button>
            </li>
            <li>
              {session ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDisconnect}
                  className="w-full px-3 py-2.5 text-left text-[14px] text-[#b42318] hover:bg-[#f5f5f7] disabled:opacity-40"
                >
                  구글 계정 연결 해제
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleConnect}
                  className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-40"
                >
                  구글 계정 연결
                </button>
              )}
            </li>
            {onSignOut && (
              <li>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                  className="w-full px-3 py-2.5 text-left text-[14px] text-[#b42318] hover:bg-[#f5f5f7] disabled:opacity-40"
                >
                  로그아웃
                </button>
              </li>
            )}
          </ul>
          {status && (
            <p className="border-t border-black/5 px-3 py-2 text-[12px] leading-relaxed text-[#86868b]">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
