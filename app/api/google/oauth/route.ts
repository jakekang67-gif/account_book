import { NextResponse } from "next/server";

type Body = {
  action?: "exchange" | "refresh";
  code?: string;
  refreshToken?: string;
};

function googleClientConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return { clientId, clientSecret };
}

/** 인가 코드 → 토큰 / refresh → 액세스 토큰 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { clientId, clientSecret } = googleClientConfig();
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "서버에 GOOGLE_CLIENT_SECRET(및 NEXT_PUBLIC_GOOGLE_CLIENT_ID)가 필요합니다. Google Cloud 콘솔에서 클라이언트 보안 비밀을 발급해 .env.local / 배포 환경에 넣어 주세요.",
      },
      { status: 500 },
    );
  }

  const action = body.action ?? "exchange";

  try {
    if (action === "exchange") {
      const code = body.code?.trim();
      if (!code) {
        return NextResponse.json(
          { error: "인가 코드가 없습니다." },
          { status: 400 },
        );
      }

      // @react-oauth/google auth-code(popup) 교환 시 redirect_uri는 postmessage
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: "postmessage",
          grant_type: "authorization_code",
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        return NextResponse.json(
          {
            error:
              tokenJson.error_description ||
              tokenJson.error ||
              "구글 토큰 교환에 실패했습니다.",
          },
          { status: 502 },
        );
      }

      const profileRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        },
      );
      if (!profileRes.ok) {
        return NextResponse.json(
          { error: "구글 프로필을 가져오지 못했습니다." },
          { status: 502 },
        );
      }
      const profile = (await profileRes.json()) as { email?: string };
      if (!profile.email) {
        return NextResponse.json(
          { error: "구글 이메일을 확인할 수 없습니다." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresIn: tokenJson.expires_in ?? 3600,
        email: profile.email,
      });
    }

    if (action === "refresh") {
      const refreshToken = body.refreshToken?.trim();
      if (!refreshToken) {
        return NextResponse.json(
          { error: "refresh token이 없습니다." },
          { status: 400 },
        );
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
        error?: string;
        error_description?: string;
      };

      if (!tokenRes.ok || !tokenJson.access_token) {
        return NextResponse.json(
          {
            error:
              tokenJson.error_description ||
              tokenJson.error ||
              "토큰 갱신에 실패했습니다. 구글 계정을 다시 연결해 주세요.",
          },
          { status: 401 },
        );
      }

      return NextResponse.json({
        accessToken: tokenJson.access_token,
        expiresIn: tokenJson.expires_in ?? 3600,
        refreshToken: tokenJson.refresh_token ?? null,
      });
    }

    return NextResponse.json({ error: "알 수 없는 action입니다." }, { status: 400 });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: "구글 OAuth 처리 중 오류가 발생했습니다.", detail },
      { status: 500 },
    );
  }
}
