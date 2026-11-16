import { NextResponse } from "next/server";
import { buildExcelMailRaw } from "@/lib/gmail";

type Body = {
  accessToken?: string;
  to?: string;
  fileName?: string;
  fileBase64?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const accessToken = body.accessToken?.trim();
  const fileName = body.fileName?.trim();
  const fileBase64 = body.fileBase64?.trim();
  const to = body.to?.trim();

  if (!accessToken || !fileName || !fileBase64 || !to) {
    return NextResponse.json(
      { error: "메일 발송에 필요한 정보가 부족합니다." },
      { status: 400 },
    );
  }

  try {
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!profileRes.ok) {
      const detail = await profileRes.text();
      return NextResponse.json(
        {
          error:
            "구글 계정이 만료되었거나 권한이 없습니다. 다시 연결해 주세요.",
          detail,
        },
        { status: 401 },
      );
    }

    const profile = (await profileRes.json()) as { emailAddress?: string };
    const from = profile.emailAddress;
    if (!from) {
      return NextResponse.json(
        { error: "구글 메일 주소를 가져오지 못했습니다." },
        { status: 400 },
      );
    }

    const raw = buildExcelMailRaw({
      from,
      to,
      subject: `가계부 내보내기 - ${fileName}`,
      bodyText:
        "AI 가계부에서 보낸 지출 내역 엑셀 파일입니다.\n첨부파일을 확인해 주세요.",
      fileName,
      fileBase64,
    });

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      },
    );

    if (!sendRes.ok) {
      const detail = await sendRes.text();
      return NextResponse.json(
        {
          error: "메일 발송에 실패했습니다. Gmail 권한을 다시 확인해 주세요.",
          detail,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, from, to });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: "메일 발송 중 오류가 발생했습니다.", detail },
      { status: 500 },
    );
  }
}
