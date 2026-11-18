/**
 * Gemini 호출 후보.
 * Vercel/로컬 환경변수 GEMINI_MODEL_CANDIDATES 로 덮어쓸 수 있습니다.
 * 예: gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash-lite,gemini-3.6-flash
 */
export const DEFAULT_GEMINI_MODEL_CANDIDATES = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
] as const;

export function getGeminiModelCandidates(): string[] {
  const raw = process.env.GEMINI_MODEL_CANDIDATES?.trim();
  if (!raw) return [...DEFAULT_GEMINI_MODEL_CANDIDATES];

  const parsed = raw
    .split(/[,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_GEMINI_MODEL_CANDIDATES];
}
