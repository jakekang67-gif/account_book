"use client";

type AndroidInstallHelpProps = {
  open: boolean;
  onClose: () => void;
};

/** 네이버 등 브라우저 바 없이 쓰는 안드로이드 앱 설치 안내 */
export function AndroidInstallHelp({ open, onClose }: AndroidInstallHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="android-install-title"
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2
          id="android-install-title"
          className="text-[17px] font-semibold text-[#1d1d1f]"
        >
          안드로이드 앱 설치
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#86868b]">
          네이버 「홈 화면에 추가」는 브라우저 바가 남습니다. 아래 앱을 설치하면
          가계부 화면만 전체로 열립니다.
        </p>

        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-[#1d1d1f]">
          <li>아래 「APK 다운로드」를 누릅니다. (PC면 받은 파일을 폰으로 보내도 됩니다)</li>
          <li>휴대폰에서 APK를 열어 설치합니다. (출처 알 수 없는 앱 허용 필요할 수 있음)</li>
          <li>
            홈화면의 <span className="font-medium">챗가계부</span> 아이콘으로
            실행합니다. 네이버 하단 바 없이 가계부만 보입니다.
          </li>
        </ol>

        <a
          href="/downloads/AI-chatgaegyebu.apk"
          download="AI챗가계부.apk"
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#1d1d1f] py-2.5 text-[14px] font-medium text-white"
        >
          APK 다운로드
        </a>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl bg-[#f5f5f7] py-2.5 text-[14px] font-medium text-[#1d1d1f]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
