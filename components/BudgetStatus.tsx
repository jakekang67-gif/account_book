"use client";

type BudgetStatusProps = {
  monthLabel: string;
  spent: number;
  budget: number | null;
  onEdit: () => void;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/**
 * 이번 달 지출/예산 비율 표시.
 * 80% 이상이면 경고, 100% 이상이면 초과 강조.
 */
export function BudgetStatus({
  monthLabel,
  spent,
  budget,
  onEdit,
}: BudgetStatusProps) {
  if (budget == null || budget <= 0) {
    return (
      <div className="mx-4 mt-3 mb-2 shrink-0 rounded-2xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-[#86868b]">
            {monthLabel} 예산이 아직 없어요.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-xl bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#1d1d1f]"
          >
            설정
          </button>
        </div>
      </div>
    );
  }

  const ratio = spent / budget;
  const percent = Math.min(999, Math.round(ratio * 100));
  const barWidth = Math.min(100, Math.round(ratio * 100));
  const warn = ratio >= 0.8;
  const over = ratio >= 1;

  const barColor = over ? "#b42318" : warn ? "#b54708" : "#1d1d1f";
  const boxClass = over
    ? "bg-[#fef3f2] ring-1 ring-[#fecdca]"
    : warn
      ? "bg-[#fffaeb] ring-1 ring-[#fedf89]"
      : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

  return (
    <div className={`mx-4 mt-3 mb-2 shrink-0 rounded-2xl px-3.5 py-3 ${boxClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] text-[#86868b]">{monthLabel} 예산</p>
          <p className="mt-0.5 font-mono text-[14px] tabular-nums text-[#1d1d1f]">
            {formatAmount(spent)}
            <span className="text-[#86868b]"> / </span>
            {formatAmount(budget)}
            <span className="ml-0.5 text-[12px] text-[#86868b]">원</span>
            <span className="ml-2 text-[12px] font-sans text-[#86868b]">
              ({percent}%)
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-xl bg-white/80 px-2.5 py-1.5 text-[12px] font-medium text-[#1d1d1f] ring-1 ring-black/5"
        >
          수정
        </button>
      </div>

      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/8">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>

      {warn && (
        <p
          className={`mt-2 text-[12px] leading-relaxed ${
            over ? "text-[#b42318]" : "text-[#b54708]"
          }`}
        >
          {over
            ? "예산을 초과했어요. 지출을 한번 점검해 보세요."
            : "예산을 80% 이상 사용했어요. 남은 지출을 조심해 주세요."}
        </p>
      )}
    </div>
  );
}
