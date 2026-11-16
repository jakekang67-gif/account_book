import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  formatCategoryTreeForPrompt,
  normalizeCategoryPair,
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

function formatKoreanConfirm(expense: ExpensePayload) {
  const [, m, d] = expense.date.split("-");
  const amount = new Intl.NumberFormat("ko-KR").format(expense.amount);
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  return `${monthDay} ${expense.category}(${expense.subcategory}) ${expense.description} ${amount}원을 저장했어요!`;
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

const SYSTEM_INSTRUCTION = `당신은 친절한 한국어 가계부 챗봇입니다.
사용자가 자연어로 말한 지출을 분석해 날짜·금액·내용·대분류·소분류를 추출합니다.

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

허용 카테고리(대분류: 소분류들):
${formatCategoryTreeForPrompt()}

분류 규칙:
- 커피·카페 → 음료 (식대 아님)
- 마트 장보기·식자재 → 생활비 (외식만 식대)
- 가족 외식 → 가족 / 가족식대
- 술자리·주류 → 주류
- 택시·버스·지하철·대리 → 교통비
- category/subcategory는 위 허용 목록에 있는 값만 사용
- 목록에 없는 소분류를 만들지 말 것

저장 규칙:
- 오늘 날짜는 ${koreaDateString(0)} 입니다. "오늘"이면 이 날짜를 사용합니다.
- "어제"면 ${koreaDateString(-1)} 을 사용합니다.
- amount는 양의 정수(원). "2만 원" → 20000
- description은 짧은 명사/구
- 날짜·금액·내용·대분류·소분류가 모두 명확할 때만 expense를 채웁니다.
- 하나라도 애매하면 expense는 null로 두고, reply로 짧게 되묻습니다.
  예: "택시 요금인가요, 대중교통인가요?" / "금액이 얼마인가요?"
- 가계부와 무관한 말에는 expense null로 짧게 답합니다.`;

async function generateWithFallback(
  apiKey: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
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

  let body: { message?: string; history?: ChatMessage[] };
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

    const text = await generateWithFallback(apiKey, contents);

    let parsed: GeminiChatResponse;
    try {
      parsed = JSON.parse(text) as GeminiChatResponse;
    } catch {
      return NextResponse.json({
        reply:
          "메시지를 이해하지 못했어요. 예: “오늘 점심 15000원”처럼 다시 말씀해 주세요.",
        expense: null,
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
        ? formatKoreanConfirm(expense)
        : typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : "날짜·금액·카테고리를 다시 알려 주세요. 예: “어제 택시 20000원”";

    return NextResponse.json({ reply, expense });
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
