import type { MetadataRoute } from "next";

/** 홈화면 추가 시 주소창 없는 앱처럼 보이도록 standalone 설정 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI 가계부 챗봇",
    short_name: "AI 가계부",
    description: "대화하듯 지출을 기록하는 AI 가계부",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f7",
    theme_color: "#1d1d1f",
    lang: "ko",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
