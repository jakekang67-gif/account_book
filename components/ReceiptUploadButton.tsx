"use client";

import { useEffect, useRef, useState } from "react";

type ReceiptUploadButtonProps = {
  disabled?: boolean;
  onPick: (payload: { base64: string; mimeType: string }) => void;
  onError?: (message: string) => void;
};

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

/** 이미지를 축소·JPEG로 바꿔 base64(순수)를 만듭니다. */
async function compressImageFile(file: File): Promise<{
  base64: string;
  mimeType: string;
}> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("이미지를 처리할 수 없어요.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    base64: btoa(binary),
    mimeType: "image/jpeg",
  };
}

/**
 * 영수증 사진 업로드 버튼.
 * 촬영 / 갤러리 첨부를 선택해 이미지를 고른 뒤 onPick으로 넘깁니다.
 */
export function ReceiptUploadButton({
  disabled,
  onPick,
  onError,
}: ReceiptUploadButtonProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  async function handleChange(
    file: File | null,
    input: HTMLInputElement | null,
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.("이미지 파일만 올릴 수 있어요.");
      return;
    }

    setBusy(true);
    setMenuOpen(false);
    try {
      const payload = await compressImageFile(file);
      onPick(payload);
    } catch {
      onError?.("이미지를 읽지 못했어요. 다른 사진으로 시도해 주세요.");
    } finally {
      setBusy(false);
      if (input) input.value = "";
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      {/* 촬영 전용 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) =>
          void handleChange(e.target.files?.[0] ?? null, cameraInputRef.current)
        }
      />
      {/* 갤러리·첨부 전용 */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) =>
          void handleChange(
            e.target.files?.[0] ?? null,
            galleryInputRef.current,
          )
        }
      />

      <button
        type="button"
        disabled={disabled || busy}
        aria-label="영수증 사진 올리기"
        aria-expanded={menuOpen}
        title="영수증 사진 올리기"
        onClick={() => setMenuOpen((prev) => !prev)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[#1d1d1f] transition-colors hover:bg-[#ebebed] disabled:cursor-not-allowed disabled:opacity-35"
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#86868b] border-t-transparent" />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden
          >
            <path d="M4 5a2 2 0 0 1 2-2h3.2a1 1 0 0 1 .8.4l.9 1.2H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
          </svg>
        )}
      </button>

      {menuOpen && !busy && (
        <div className="absolute bottom-12 left-0 z-40 w-40 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
          <button
            type="button"
            className="w-full px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => {
              setMenuOpen(false);
              cameraInputRef.current?.click();
            }}
          >
            카메라 촬영
          </button>
          <button
            type="button"
            className="w-full border-t border-black/5 px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
            onClick={() => {
              setMenuOpen(false);
              galleryInputRef.current?.click();
            }}
          >
            앨범에서 선택
          </button>
        </div>
      )}
    </div>
  );
}
