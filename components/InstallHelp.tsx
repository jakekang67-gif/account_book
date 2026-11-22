"use client";

type InstallHelpProps = {
  open: boolean;
  onClose: () => void;
};

/** 캐시 때문에 예전 사진이 안 바뀌는 것 방지 */
const IMG_V = "20261122e";

const CHROME_STEPS: { src: string; caption: string }[] = [
  {
    src: `/install-guide/step-01.jpg?v=${IMG_V}`,
    caption: "1. 검색에서 Chrome을 찾아 엽니다.",
  },
  {
    src: `/install-guide/step-02.jpg?v=${IMG_V}`,
    caption: "2. 주소창에서 가계부 주소를 눌러 엽니다.",
  },
  {
    src: `/install-guide/step-03.jpg?v=${IMG_V}`,
    caption: "3. 오른쪽 위 ⋮(점 세 개)를 누릅니다.",
  },
  {
    src: `/install-guide/step-04.jpg?v=${IMG_V}`,
    caption: "4. 「설치 및 바로가기 만들기」를 누릅니다.",
  },
  {
    src: `/install-guide/step-05.jpg?v=${IMG_V}`,
    caption: "5. 「설치」를 누릅니다.",
  },
  {
    src: `/install-guide/step-06.jpg?v=${IMG_V}`,
    caption: "6. 「설치」를 한 번 더 눌러 확인합니다.",
  },
  {
    src: `/install-guide/step-07.jpg?v=${IMG_V}`,
    caption: "7. 앱 목록에서 「나의 챗가계부」를 찾습니다.",
  },
  {
    src: `/install-guide/step-08.jpg?v=${IMG_V}`,
    caption: "8. 아이콘을 길게 누르고 「홈 화면에 추가」를 누릅니다.",
  },
];

/** Chrome 사진 안내 + 네이버·APK 안내 */
export function InstallHelp({ open, onClose }: InstallHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-help-title"
        className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="shrink-0 border-b border-black/5 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="install-help-title"
                className="text-[17px] font-semibold text-[#1d1d1f]"
              >
                홈화면에 앱처럼 추가
              </h2>
              <p className="mt-1 text-[13px] text-[#86868b]">
                분홍 표시를 따라 순서대로 눌러 주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#b42318]"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-2 text-[14px] font-semibold text-[#1d1d1f]">
              Chrome으로 추가하기
            </h3>
            <div className="mb-3 overflow-hidden rounded-2xl bg-[#f5f5f7] px-3 py-2.5">
              <p className="mb-1.5 text-[12px] text-[#86868b]">가계부 주소</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/install-guide/url.jpg?v=${IMG_V}`}
                alt="https://account-book-chi-blue.vercel.app"
                className="h-auto w-full rounded-lg bg-white"
              />
            </div>
            <ol className="space-y-4">
              {CHROME_STEPS.map((step) => (
                <li key={step.src} className="space-y-1.5">
                  <p className="text-[14px] font-medium leading-snug text-[#1d1d1f]">
                    {step.caption}
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={step.src}
                    alt={step.caption}
                    className="h-auto w-full rounded-2xl border border-black/5 bg-[#f5f5f7] object-cover object-top"
                  />
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-[#86868b]">
              설치가 끝나면 주소창·하단 바 없이 앱처럼 열립니다.
            </p>
          </section>

          <section className="rounded-2xl bg-[#f5f5f7] px-3.5 py-3">
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">네이버</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-[#1d1d1f]">
              <li>하단 메뉴(≡ 또는 ⋯) 누르기</li>
              <li>
                <span className="font-medium">홈 화면에 추가</span> 선택
              </li>
              <li>홈화면 아이콘으로 실행</li>
            </ol>
            <p className="mt-2 text-[12px] leading-relaxed text-[#86868b]">
              바로가기로 추가됩니다. 네이버에서는 하단 바가 남을 수 있어요. 바
              없이 쓰려면 Chrome 「설치」 또는 아래 APK를 권장합니다.
            </p>
          </section>

          <section className="rounded-2xl bg-[#f5f5f7] px-3.5 py-3">
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              안드로이드 앱 (APK)
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868b]">
              브라우저 바 없이 가계부만 전체 화면으로 씁니다.
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-[#1d1d1f]">
              <li>아래 「APK 다운로드」 누르기</li>
              <li>
                파일 열어 설치 (삼성폰은 설정 → 보안 및 개인정보 보호 → 보안
                위험 자동 차단을 잠시 꺼야 할 수 있음)
              </li>
              <li>홈화면 「나의 챗가계부」로 실행</li>
            </ol>
            <a
              href="/downloads/AI-chatgaegyebu.apk"
              download="나의AI챗가계부.apk"
              className="mt-3 flex w-full items-center justify-center rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
            >
              APK 다운로드
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
