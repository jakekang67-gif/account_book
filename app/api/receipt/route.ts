import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  DEFAULT_CATEGORY_TREE,
  formatCategoryTreeForPrompt,
  normalizeCategoryPair,
  type CategoryTree,
} from "@/lib/categories";
import { koreaDateString } from "@/lib/date";

type ExpensePayload = {
  date: string;
  amount: number;
  description: string;
  category: string;
  subcategory: string;
};

type GeminiReceiptResponse = {
  reply: string;
  expense: ExpensePayload | null;
  storeName?: string | null;
};

const MODEL_CANDIDATES = ["gemini-3.8-flash"] as const;

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

function formatKoreanAskConfirm(expense: ExpensePayload) {
  const [, m, d] = expense.date.split("-");
  const amount = new Intl.NumberFormat("ko-KR").format(expense.amount);
  const monthDay =
    m && d ? `${Number(m)}월 ${Number(d)}일` : expense.date;
  return `${monthDay} ${expense.description} ${amount}원 — "${expense.category}-${expense.subcategory}"로 저장할까요?`;
}

function buildReceiptInstruction(tree: CategoryTree) {
  return `당신은 한국어 가계부 비서입니다.
영수증 이미지를 보고 결제 금액·날짜·가게(상호)를 추출한 뒤 카테고리를 제안합니다.
저장했다고 말하지 마세요. 앱이 확인 질문을 합니다.

오늘(한국): ${koreaDateString(0)}

허용 카테고리(대분류: 소분류들):
${formatCategoryTreeForPrompt(tree)}

반드시 JSON만 응답하세요:
{
  "reply": "짧게 무엇을 읽었는지 한 줄",
  "storeName": "가게 이름 또는 null",
  "expense": null 또는 {
    "date": "YYYY-MM-DD",
    "amount": 숫자,
    "description": "가게명 또는 짧은 내용",
    "category": "대분류",
    "subcategory": "소분류"
  }
}

규칙:
- amount는 총 결제 금액(원, 양의 정수). 부가세만 쓰지 말 것
- 날짜가 안 보이면 오늘(${koreaDateString(0)}) 사용
- description은 가게 이름 우선, 없으면 "영수증"
- category/subcategory는 허용 목록만
- 카페·커피 → 음료, 식당·한식·중식 → 식대, 마트 → 생활비 등
- 읽기 어려우면 expense null, reply로 되묻기`;
}

async function generateReceipt(
  apiKey: string,
  systemInstruction: string,
  imageBase64: string,
  mimeType: string,
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: "이 영수증에서 금액, 날짜, 가게 이름을 추출해 JSON으로 답하세요.",
        },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
    },
  ];

  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    try {
      const result = await model.generateContent({ contents });
      return result.response.text();
    } catch (error) {
      lastError = error;
      if (isModelMissingError(error)) continue;
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
    : new Error("Gemini Vision 호출에 실패했습니다.");
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
    imageBase64?: string;
    mimeType?: string;
    categoryTree?: CategoryTree;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const raw = String(body.imageBase64 ?? "").trim();
  const imageBase64 = raw.includes(",")
    ? raw.slice(raw.indexOf(",") + 1)
    : raw;
  const mimeType = String(body.mimeType ?? "image/jpeg").trim() || "image/jpeg";

  if (!imageBase64 || imageBase64.length < 100) {
    return NextResponse.json(
      { error: "영수증 이미지가 없습니다." },
      { status: 400 },
    );
  }

  // 대략 4MB base64 제한
  if (imageBase64.length > 4_000_000) {
    return NextResponse.json(
      { error: "이미지가 너무 큽니다. 더 작은 사진으로 다시 올려 주세요." },
      { status: 400 },
    );
  }

  if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mimeType)) {
    return NextResponse.json(
      { error: "지원하지 않는 이미지 형식입니다. JPG/PNG/WebP를 사용해 주세요." },
      { status: 400 },
    );
  }

  const categoryTree =
    body.categoryTree && Object.keys(body.categoryTree).length > 0
      ? body.categoryTree
      : DEFAULT_CATEGORY_TREE;

  try {
    const text = await generateReceipt(
      apiKey,
      buildReceiptInstruction(categoryTree),
      imageBase64,
      mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType,
    );

    let parsed: GeminiReceiptResponse;
    try {
      parsed = JSON.parse(text) as GeminiReceiptResponse;
    } catch {
      return NextResponse.json({
        reply:
          "영수증을 읽지 못했어요. 더 선명한 사진으로 다시 올려 주세요.",
        expense: null,
        action: "clarify",
      });
    }

    let expense: ExpensePayload | null = null;
    if (parsed.expense && typeof parsed.expense === "object") {
      const amount = Number(parsed.expense.amount);
      const description = String(
        parsed.expense.description ?? parsed.storeName ?? "영수증",
      ).trim();
      const date =
        String(parsed.expense.date ?? "").trim() || koreaDateString(0);
      const pair = normalizeCategoryPair(
        parsed.expense.category,
        parsed.expense.subcategory,
        categoryTree,
      );

      if (description && Number.isFinite(amount) && amount > 0 && pair) {
        expense = {
          date,
          amount: Math.round(amount),
          description: description.slice(0, 80),
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
          : "영수증에서 금액을 찾지 못했어요. 직접 “가게이름 12000원”처럼 말해 주세요.";

    return NextResponse.json({
      reply,
      expense,
      action: expense != null ? "confirm" : "clarify",
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    console.error("[api/receipt]", detail);
    const quota =
      /429|quota|rate-limit|rate limit|RetryInfo/i.test(detail);
    const busy =
      /timeout|aborted|high demand|503|try again/i.test(detail);
    return NextResponse.json(
      {
        error: quota
          ? "오늘 Gemini 무료 사용량을 모두 썼어요. 내일 다시 시도해 주세요."
          : busy
            ? "AI 서버가 Busy 상태예요. 잠시 후 다시 올려 주세요."
            : "영수증 인식에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        detail,
      },
      { status: 500 },
    );
  }
}
