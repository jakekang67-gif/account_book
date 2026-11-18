const STORAGE_KEY = "account_book_budget_alert_percent";
const DEFAULT_PERCENT = 80;

/** 경고 기준 %(1~200). 기기별 저장 */
export function loadBudgetAlertPercent(): number {
  if (typeof window === "undefined") return DEFAULT_PERCENT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERCENT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_PERCENT;
    return Math.min(200, Math.max(1, Math.round(n)));
  } catch {
    return DEFAULT_PERCENT;
  }
}

export function saveBudgetAlertPercent(percent: number): number {
  const next = Math.min(200, Math.max(1, Math.round(percent)));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore quota / private mode
    }
  }
  return next;
}

/** 짧은 경고음 (Web Audio) */
export function playBudgetWarningSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    function beep(start: number, freq: number, duration: number) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    }

    beep(now, 880, 0.12);
    beep(now + 0.16, 660, 0.16);

    window.setTimeout(() => {
      void ctx.close();
    }, 500);
  } catch {
    // 자동재생 제한 등이면 조용히 무시
  }
}
