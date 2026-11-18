import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  DEFAULT_CATEGORY_TREE,
  formatCategoryTreeForPrompt,
  normalizeCategoryPair,
  type CategoryTree,
} from "@/lib/categories";
import { koreaDateString } from "@/lib/date";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ExpensePayload = {
  date: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string;
};

type GeminiChatResponse = {
  reply: string;
  expense: ExpensePayload | null;
};

/** Google AI Studio 권장 최신 flash 모델 */
const MODEL_CANDIDATES = ["gemini-3.8-flash"] as const;

function formatKoreanAskConfirm(expense: ExpensePayload) {
  const [, m, d] = expense.date.split("-");
  const amount = new Intl.NumberFormat("ko-KR").format(expense.amount);
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  return `${monthDay} ${expense.description} ${amount}원 — "${expense.category}-${expense.subcategory}"로 저장할까요?`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("[503") ||
    message.includes("[429") ||
    /high demand|rate limit|try again|temporarily/i.test(message)
  );
}

function isModelMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("[404") ||
    /no longer available|not found|is not found/i.test(message)
  );
}

type StatsExpenseRow = {
  date: string;
  amount: number;
  description: string;
  category: string | null;
  subcategory: string | null;
};

function buildStatsSystemInstruction(expenses: StatsExpenseRow[]) {
  const today = koreaDateString(0);
  const yesterday = koreaDateString(-1);
  // 지난주: 어제부터 6일 전까지의 대략 안내 (모델이 날짜 필드로 직접 필터)
  const weekAgo = koreaDateString(-7);
  const thisMonth = today.slice(0, 7);

  const rows =
    expenses.length === 0
      ? "(지출 데이터 없음)"
      : expenses
          .map((e) => {
            const cat = [e.category, e.subcategory].filter(Boolean).join("/");
            return `${e.date}|${e.amount}|${e.description}|${cat || "미분류"}`;
          })
          .join("\n");

  return `당신은 친절한 한국어 가계부 비서입니다.
사용자가 지출 통계·조회를 묻습니다. 아래 데이터만 근거로 답하세요. 없는 숫자는 만들지 마세요.

기준 날짜(한국 Asia/Seoul):
- 오늘: ${today}
- 어제: ${yesterday}
- 최근 7일 시작(참고): ${weekAgo}
- 이번 달(YYYY-MM): ${thisMonth}

지출 데이터 형식: date|amount|description|category/subcategory
${rows}

반드시 JSON만 응답하세요. 형식:
{
  "reply": "사용자에게 보여줄 자연스럽고 친근한 한국어 답변",
  "expense": null
}

답변 규칙:
- expense는 항상 null
- 금액은 천 단위 콤마와 "원"을 사용 (예: 125,000원)
- "이번 달", "어제", "지난주"는 위 기준 날짜로 해석
- 데이터가 없으면 솔직히 "아직 기록이 없어요"라고 말함
- 2~5문장 정도로 핵심만, 딱딱한 보고서 말투 금지`;
}

function buildSystemInstruction(
  tree: CategoryTree,
  mode: "extract" | "classify",
  pending?: Omit<ExpensePayload, "category" | "subcategory"> | null,
) {
  const categoryBlock = `허용 카테고리(대분류: 소분류들):
${formatCategoryTreeForPrompt(tree)}

분류 규칙:
- 커피·카페 → 음료 (목록에 있을 때)
- 마트 장보기·식자재 → 생활비 (목록에 있을 때)
- 가족 외식·가족 점심·가족 식사 → 가족 / 가족식대 (목록에 있을 때)
- 술자리·주류 → 주류 (목록에 있을 때)
- 택시·버스·지하철·대리 → 교통비 (목록에 있을 때)
- category/subcategory는 위 허용 목록에 있는 값만 사용
- 목록에 없는 소분류를 만들지 말 것`;

  if (mode === "classify" && pending) {
    return `당신은 친절한 한국어 AI 챗가계부 도우미입니다.
이미 파악된 지출에 대해 사용자가 말한 대·소분류만 정합니다.
저장했다고 말하지 마세요. 앱이 나중에 확인 질문을 합니다.

대기 중인 지출:
- date: ${pending.date}
- amount: ${pending.amount}
- description: ${pending.description}

반드시 JSON만 응답하세요. 형식:
{
  "reply": "짧은 한국어 (분류가 애매할 때만 되물음)",
  "expense": null 또는 {
    "date": "${pending.date}",
    "amount": ${pending.amount},
    "description": "${pending.description}",
    "category": "대분류",
    "subcategory": "소분류"
  }
}

${categoryBlock}

규칙:
- 사용자가 "가족-가족식대", "가족 가족식대", "식대 점심"처럼 말하면 목록에 맞게 expense를 채웁니다.
- date/amount/description은 대기 중인 값을 그대로 씁니다.
- 분류가 목록에 없거나 애매하면 expense는 null, reply로 "어떤 대분류·소분류로 할까요?"처럼 되묻습니다.`;
  }

  return `당신은 친절한 한국어 AI 챗가계부 도우미입니다.
사용자가 자연어로 말한 지출을 분석해 날짜·금액·내용·대분류·소분류를 추출합니다.
직접 저장하지 않습니다. expense를 채우면 앱이 "저장할까요?"라고 묻습니다.
reply에 "저장했어요"라고 쓰지 마세요.

반드시 JSON만 응답하세요. 형식:
{
  "reply": "사용자에게 보여줄 한국어 메시지",
  "expense": null 또는 {
    "date": "YYYY-MM-DD",
    "amount": 숫자,
    "description": "짧은 내용",
    "category": "대분류",
    "subcategory": "소분류"
  }
}

${categoryBlock}

추출 규칙:
- 오늘 날짜는 ${koreaDateString(0)} 입니다. "오늘"이면 이 날짜를 사용합니다.
- "어제"면 ${koreaDateString(-1)} 을 사용합니다.
- amount는 양의 정수(원). "2만 원" → 20000
- description은 짧은 명사/구
- 날짜·금액·내용·대분류·소분류가 모두 명확할 때만 expense를 채웁니다.
- 하나라도 애매하면 expense는 null로 두고, reply로 짧게 되묻습니다.
  예: "택시 요금인가요, 대중교통인가요?" / "금액이 얼마인가요?"
- 가계부와 무관한 말에는 expense null로 짧게 답합니다.`;
}

async function generateWithFallback(
  apiKey: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemInstruction: string,
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    try {
      const result = await model.generateContent({ contents });
      return result.response.text();
    } catch (error) {
      lastError = error;
      if (isModelMissingError(error)) {
        continue;
      }
      if (isRetryableError(error)) {
        await sleep(1_200);
        try {
          const result = await model.generateContent({ contents });
          return result.response.text();
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini 호출에 실패했습니다.");
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인해 주세요.",
      },
      { status: 500 },
    );
  }

  let body: {
    message?: string;
    history?: ChatMessage[];
    categoryTree?: CategoryTree;
    mode?: "extract" | "classify" | "stats";
    pendingExpense?: {
      date?: string;
      amount?: number;
      description?: string;
    } | null;
    expenses?: StatsExpenseRow[] | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json(
      { error: "메시지를 입력해 주세요." },
      { status: 400 },
    );
  }

  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
  const categoryTree =
    body.categoryTree && Object.keys(body.categoryTree).length > 0
      ? body.categoryTree
      : DEFAULT_CATEGORY_TREE;
  const requestedMode = body.mode;
  const mode =
    requestedMode === "stats"
      ? "stats"
      : requestedMode === "classify"
        ? "classify"
        : "extract";
  const pendingRaw = body.pendingExpense;
  const pendingForClassify =
    mode === "classify" &&
    pendingRaw &&
    typeof pendingRaw === "object" &&
    Number(pendingRaw.amount) > 0 &&
    String(pendingRaw.description ?? "").trim()
      ? {
          date:
            String(pendingRaw.date ?? "").trim() || koreaDateString(0),
          amount: Math.round(Number(pendingRaw.amount)),
          description: String(pendingRaw.description).trim(),
        }
      : null;

  const statsExpenses: StatsExpenseRow[] = Array.isArray(body.expenses)
    ? body.expenses
        .slice(0, 800)
        .map((row) => ({
          date: String(row?.date ?? "").trim(),
          amount: Math.round(Number(row?.amount) || 0),
          description: String(row?.description ?? "").trim().slice(0, 80),
          category: row?.category != null ? String(row.category) : null,
          subcategory:
            row?.subcategory != null ? String(row.subcategory) : null,
        }))
        .filter((row) => row.date && row.amount > 0)
    : [];

  try {
    const contents = [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }],
      })),
      {
        role: "user" as const,
        parts: [{ text: message }],
      },
    ];

    const systemInstruction =
      mode === "stats"
        ? buildStatsSystemInstruction(statsExpenses)
        : buildSystemInstruction(
            categoryTree,
            mode === "classify" && pendingForClassify
              ? "classify"
              : "extract",
            pendingForClassify,
          );

    const text = await generateWithFallback(
      apiKey,
      contents,
      systemInstruction,
    );

    let parsed: GeminiChatResponse;
    try {
      parsed = JSON.parse(text) as GeminiChatResponse;
    } catch {
      return NextResponse.json({
        reply:
          mode === "stats"
            ? "통계를 정리하지 못했어요. 조금 다르게 다시 물어봐 주세요."
            : "메시지를 이해하지 못했어요. 예: “오늘 점심 15000원”처럼 다시 말씀해 주세요.",
        expense: null,
        action: mode === "stats" ? "stats" : "clarify",
      });
    }

    if (mode === "stats") {
      const reply =
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : statsExpenses.length === 0
            ? "아직 저장된 지출이 없어요. 먼저 지출을 말해 주시면 기록해 둘게요."
            : "질문을 이해하지 못했어요. 예: “이번 달 총 지출이 얼마야?”";

      return NextResponse.json({
        reply,
        expense: null,
        action: "stats",
      });
    }

    let expense: ExpensePayload | null = null;
    if (parsed.expense && typeof parsed.expense === "object") {
      const amount = Number(parsed.expense.amount);
      const description = String(parsed.expense.description ?? "").trim();
      const date =
        String(parsed.expense.date ?? "").trim() || koreaDateString(0);
      const pair = normalizeCategoryPair(
        parsed.expense.category,
        parsed.expense.subcategory,
        categoryTree,
      );

      if (
        description &&
        Number.isFinite(amount) &&
        amount > 0 &&
        pair
      ) {
        expense = {
          date,
          amount: Math.round(amount),
          description,
          category: pair.category,
          subcategory: pair.subcategory,
        };
      }
    }

    const reply =
      expense != null
        ? formatKoreanAskConfirm(expense)
        : typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : mode === "classify"
            ? "카테고리 분류 어떻게 할까요? 예: “가족-가족식대”"
            : "날짜·금액·카테고리를 다시 알려 주세요. 예: “어제 택시 20000원”";

    return NextResponse.json({
      reply,
      expense,
      action: expense != null ? "confirm" : "clarify",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error("[api/chat]", detail);
    const quota =
      /429|quota|rate-limit|rate limit|RetryInfo/i.test(detail);
    const busy =
      /timeout|aborted|high demand|503|try again/i.test(detail);
    return NextResponse.json(
      {
        error: quota
          ? "오늘 Gemini 무료 사용량을 모두 썼어요. 내일 다시 시도하거나 Google AI Studio에서 요금제를 확인해 주세요."
          : busy
            ? "AI 서버가 Busy 상태예요. 잠시 후 다시 보내 주세요."
            : "AI 응답에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        detail,
      },
      { status: 500 },
    );
  }
}
