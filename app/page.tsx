"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** expenses 테이블 한 행 */
type Expense = {
  id: number;
  created_at: string;
  date: string;
  amount: number;
  description: string;
};

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/** 금액 숫자만 (원화 기호는 UI에서 분리 표시) */
function formatAmount(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount);
}

/** 미니멀 입력 필드 — 테두리 없이 배경 차이만 */
const fieldClassName =
  "w-full min-h-14 rounded-xl bg-[#f5f5f7] px-4 py-3.5 text-lg text-[#1d1d1f] outline-none transition placeholder:text-[#86868b] focus:bg-[#ebebed] sm:min-h-12 sm:text-[15px]";

const labelClassName =
  "block text-[15px] font-medium tracking-tight text-[#1d1d1f] sm:text-sm";

export default function Home() {
  // 빌드(프리렌더) 중 new Date() 호출을 피하기 위해 빈 값으로 시작
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 브라우저에서만 오늘 날짜를 채움 (Vercel 빌드 오류 방지)
    setDate(todayString());
    void loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("expenses")
      .select("id, created_at, date, amount, description")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setExpenses([]);
    } else {
      setExpenses((data as Expense[]) ?? []);
    }

    setLoading(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/,/g, ""));
    if (!date || !description.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        date,
        amount: parsedAmount,
        description: description.trim(),
      })
      .select("id, created_at, date, amount, description")
      .single();

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setExpenses((prev) => [data as Expense, ...prev]);
    setAmount("");
    setDescription("");
    setDate(todayString());
    setSaving(false);
  }

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f5f5f7]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-12 sm:px-6 sm:py-16">
        {/* 타이포그래피 중심 헤더 */}
        <header className="mb-12 sm:mb-14">
          <p className="mb-3 text-[13px] font-medium tracking-[0.04em] text-[#86868b]">
            Account Book
          </p>
          <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[#1d1d1f] sm:text-[2.25rem]">
            나의 AI 가계부
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#86868b] sm:text-sm">
            오늘의 지출을 기록해보세요.
          </p>
        </header>

        {/* 입력 영역 — 흰 표면, 테두리/그림자 없음 */}
        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl bg-white px-5 py-7 sm:space-y-6 sm:px-6 sm:py-8"
        >
          <div className="space-y-2.5">
            <label htmlFor="date" className={labelClassName}>
              날짜
            </label>
            <input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2.5">
            <label htmlFor="amount" className={labelClassName}>
              금액
            </label>
            <input
              id="amount"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              required
              placeholder="12000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${fieldClassName} font-mono tabular-nums`}
            />
          </div>

          <div className="space-y-2.5">
            <label htmlFor="description" className={labelClassName}>
              내용
            </label>
            <input
              id="description"
              type="text"
              required
              placeholder="점심 식사"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClassName}
            />
          </div>

          {/* Flat 버튼 — 강조색 하나(#1d1d1f), hover 시만 살짝 어두움 */}
          <button
            type="submit"
            disabled={saving}
            className="mt-2 w-full min-h-14 rounded-xl bg-[#1d1d1f] px-4 py-4 text-[17px] font-medium text-white transition-colors hover:bg-[#000000] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-12 sm:py-3.5 sm:text-[15px]"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </form>

        {errorMessage && (
          <p className="mt-6 text-[15px] leading-relaxed text-[#1d1d1f]/80">
            {errorMessage}
          </p>
        )}

        {/* 목록 — 여백으로 구분, 카드는 흰 배경만 */}
        <section className="mt-14 sm:mt-16">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-medium text-[#1d1d1f]">지출 내역</h2>
            <p className="font-mono text-[15px] tabular-nums tracking-tight text-[#1d1d1f]">
              <span className="mr-1 text-[13px] text-[#86868b]">합계</span>
              {formatAmount(total)}
              <span className="ml-0.5 text-[13px] text-[#86868b]">원</span>
            </p>
          </div>

          {loading ? (
            <p className="py-12 text-center text-[15px] text-[#86868b]">불러오는 중...</p>
          ) : expenses.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-[#86868b]">
              아직 저장된 내역이 없습니다.
            </p>
          ) : (
            <ul className="space-y-3">
              {expenses.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl bg-white px-5 py-5 sm:px-6 sm:py-5"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate text-[17px] font-medium tracking-tight text-[#1d1d1f] sm:text-[15px]">
                        {item.description}
                      </p>
                      <p className="mt-1.5 text-[13px] text-[#86868b]">{item.date}</p>
                    </div>
                    {/* 금액: 숫자 폰트, 크고 명확하게 */}
                    <p className="shrink-0 font-mono text-[1.35rem] font-medium tabular-nums tracking-tight text-[#1d1d1f] sm:text-xl">
                      {formatAmount(item.amount)}
                      <span className="ml-0.5 text-sm font-normal text-[#86868b]">원</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
