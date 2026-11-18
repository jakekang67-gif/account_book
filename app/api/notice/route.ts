import { NextResponse } from "next/server";
import { getGeminiModelCandidates } from "@/lib/geminiModels";

export const dynamic = "force-dynamic";

/**
 * 채팅 상단 공지.
 * - CHAT_NOTICE : 본문 (없으면 기본 안내)
 * - CHAT_NOTICE_ID : 공지 버전. 바꾸면 닫았던 사용자에게 다시 표시
 * - CHAT_NOTICE_TITLE : 제목 (선택)
 */
export async function GET() {
  const models = getGeminiModelCandidates();
  const custom = process.env.CHAT_NOTICE?.trim();
  const title =
    process.env.CHAT_NOTICE_TITLE?.trim() || "모델·업데이트 안내";
  const id =
    process.env.CHAT_NOTICE_ID?.trim() ||
    (custom ? `custom:${hashText(custom)}` : `models:${models.join("|")}`);

  const message =
    custom ||
    [
      "AI 응답은 아래 모델을 앞에서부터 순서대로 사용합니다.",
      "서버가 바쁘면 다음 모델로 자동 전환됩니다.",
      "",
      ...models.map((m, i) => `${i + 1}. ${m}`),
      "",
      "• 공지/모델은 Vercel 환경변수로 바꿀 수 있습니다.",
      "• 닫은 뒤에도 새 공지(ID·문구·모델 변경)가 오면 다시 표시됩니다.",
      "• 메뉴 → 「안내 다시 보기」로 언제든 다시 열 수 있습니다.",
    ].join("\n");

  return NextResponse.json({
    id,
    title,
    message,
    models,
  });
}

function hashText(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
