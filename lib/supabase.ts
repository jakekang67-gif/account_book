import { createClient } from "@supabase/supabase-js";
import { authBrowserStorage } from "@/lib/authStorage";

/**
 * 브라우저에서 사용하는 Supabase 클라이언트.
 * .env.local의 NEXT_PUBLIC_* 값을 읽습니다.
 * 세션은 localStorage에 저장되어 다음 방문 시 자동 로그인됩니다.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authBrowserStorage,
    storageKey: "account_book_supabase_auth",
    flowType: "pkce",
  },
});
