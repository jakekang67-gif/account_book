"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  clearSavedEmail,
  setRememberLogin,
  setSavedEmail,
} from "@/lib/authStorage";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<string | null>;
  signUp: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session) {
          // 만료 임박 시 갱신해 자동 로그인 유지
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (!mounted) return;
          setSession(refreshed.session ?? data.session);
        } else {
          setSession(null);
        }
      } catch {
        if (mounted) setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void restoreSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      setRememberLogin(rememberMe);
      const trimmed = email.trim();
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) return error.message;
      if (rememberMe) setSavedEmail(trimmed);
      else clearSavedEmail();
      return null;
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string, rememberMe = true) => {
      setRememberLogin(rememberMe);
      const trimmed = email.trim();
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
      });
      if (error) return error.message;
      if (!data.session) {
        return "가입 확인 메일을 보냈어요. 메일함에서 확인한 뒤 로그인해 주세요.";
      }
      if (rememberMe) setSavedEmail(trimmed);
      else clearSavedEmail();
      return null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}
