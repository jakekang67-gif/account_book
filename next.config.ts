import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 같은 Wi-Fi 휴대폰에서 http://192.168.x.x:3000 접속 허용
  allowedDevOrigins: ["192.168.219.42"],
  // 개발용 Next.js 도구 메뉴(영어) 숨김
  devIndicators: false,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
