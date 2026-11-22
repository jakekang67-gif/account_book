"use client";

type InstallHelpProps = {
  open: boolean;
  onClose: () => void;
};

const PHOTO_STEPS: { src: string; caption: string }[] = [
  {
    src: "/install-guide/step-01.jpg",
    caption: "1. Chrome 앱을 누릅니다.",
  },
  {
    src: "/install-guide/step-02.jpg",
    caption: "2. 가계부 주소(account-book…)를 누릅니다.",
  },
  {
    src: "/install-guide/step-03.jpg",
    caption: "3. 오른쪽 ⋮(메뉴)를 누릅니다.",
  },
  {
    src: "/install-guide/step-04.jpg",
    caption: "4. 「설치 및 바로가기 만들기」를 누릅니다.",
  },
  {
    src: "/install-guide/step-05.jpg",
    caption: "5. 「설치」를 누릅니다.",
  },
  {
    src: "/install-guide/step-06.jpg",
    caption: "6. 「설치」를 한 번 더 확인합니다.",
  },
  {
    src: "/install-guide/step-07.jpg",
    caption: "7. 앱 목록에서 「나의 챗가계부」를 찾습니다.",
  },
  {
    src: "/install-guide/step-08.jpg",
    caption: "8. 길게 누른 뒤 「홈 화면에 추가」를 누릅니다.",
  },
];

/** Chrome 홈화면 추가 — 사진 단계 안내 + APK */
export function InstallHelp({ open, onClose }: InstallHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-help-title"
        className="flex max-h-[90dvh] w-full max-w-sm flex-col rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <div className="shrink-0 border-b border-black/5 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="install-help-title"
                className="text-[17px] font-semibold text-[#1d1d1f]"
              >
                홈화면에 추가 안내
              </h2>
              <p className="mt-1 text-[13px] text-[#86868b]">
                분홍 칸을 순서대로 눌러 주세요. (안드로이드 Chrome)
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
          <section className="rounded-2xl bg-[#f5f5f7] px-3.5 py-3">
            <p className="text-[13px] font-medium text-[#1d1d1f]">주소</p>
            <img
              src="/install-guide/url.jpg"
              alt="https://account-book-chi-blue.vercel.app"
              className="mt-2 w-full rounded-xl bg-white object-contain"
            />
            <p className="mt-2 break-all text-[12px] leading-relaxed text-[#5856d6]">
              https://account-book-chi-blue.vercel.app
            </p>
          </section>

          {PHOTO_STEPS.map((step) => (
            <section
              key={step.src}
              className="overflow-hidden rounded-2xl bg-[#f5f5f7]"
            >
              <p className="px-3.5 pt-3 text-[14px] font-semibold text-[#1d1d1f]">
                {step.caption}
              </p>
              <img
                src={step.src}
                alt={step.caption}
                className="mt-2 w-full object-cover object-top"
              />
            </section>
          ))}

          <section className="rounded-2xl bg-[#f5f5f7] px-3.5 py-3">
            <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
              안드로이드 앱 (APK)
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868b]">
              브라우저 바 없이 가계부만 전체 화면으로 씁니다.
            </p>
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
