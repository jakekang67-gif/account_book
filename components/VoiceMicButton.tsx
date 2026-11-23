"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 금액이 포함됐는지 (원 / 숫자 3자리 이상) */
function hasAmount(text: string) {
  const t = text.replace(/\s+/g, "");
  if (/\d+원/.test(t)) return true;
  if (/\d{1,3}(,\d{3})+원?/.test(t)) return true;
  // "이천원" 등은 숫자 변환 전이므로, 숫자+원 또는 순수 큰 숫자
  if (/\d{3,}/.test(t)) return true;
  return false;
}

type VoiceMicButtonProps = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

/**
 * Web Speech API 마이크 버튼.
 * 잠깐 쉬어도 계속 듣고, 금액이 나온 뒤에만 입력창으로 넘깁니다.
 */
export function VoiceMicButton({
  disabled,
  onTranscript,
  onError,
}: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const wantListenRef = useRef(false);
  const deliveredRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      wantListenRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function stopListening() {
    wantListenRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
  }

  function deliverIfReady() {
    const text = finalTextRef.current.trim();
    if (!text || deliveredRef.current) return false;
    if (!hasAmount(text)) return false;
    deliveredRef.current = true;
    wantListenRef.current = false;
    onTranscript(text);
    recognitionRef.current?.stop();
    setListening(false);
    return true;
  }

  function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onError?.(
        "이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해 주세요.",
      );
      setSupported(false);
      return;
    }

    finalTextRef.current = "";
    deliveredRef.current = false;
    wantListenRef.current = true;

    const recognition = new Ctor();
    recognition.lang = "ko-KR";
    // 쉼 후에도 이어서 듣기
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += piece;
        }
      }
      if (finalChunk) {
        finalTextRef.current = `${finalTextRef.current} ${finalChunk}`.replace(
          /\s+/g,
          " ",
        ).trim();
        deliverIfReady();
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        // 잠깐 침묵 — 계속 듣기
        return;
      }
      setListening(false);
      wantListenRef.current = false;
      if (event.error === "not-allowed") {
        onError?.(
          "마이크 권한이 필요합니다. 브라우저 주소창에서 마이크를 허용해 주세요.",
        );
        return;
      }
      onError?.("음성 인식에 실패했어요. 다시 시도해 주세요.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (deliveredRef.current) {
        setListening(false);
        return;
      }
      // 금액 없이 끊기면: 계속 들을지, 사용자가 끈 건지
      if (wantListenRef.current) {
        try {
          const again = new Ctor();
          again.lang = "ko-KR";
          again.continuous = true;
          again.interimResults = true;
          again.onresult = recognition.onresult;
          again.onerror = recognition.onerror;
          again.onend = recognition.onend;
          recognitionRef.current = again;
          again.start();
          setListening(true);
        } catch {
          setListening(false);
          wantListenRef.current = false;
          const text = finalTextRef.current.trim();
          if (text && !hasAmount(text)) {
            onError?.(
              "금액까지 말씀해 주세요. 예: 오늘 커피 2000원",
            );
          }
        }
        return;
      }
      setListening(false);
      const text = finalTextRef.current.trim();
      if (text && !hasAmount(text) && !deliveredRef.current) {
        onError?.(
          "금액까지 말씀해 주세요. 예: 오늘 커피 2000원",
        );
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      wantListenRef.current = false;
      onError?.("마이크를 시작할 수 없어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  function handleClick() {
    if (disabled) return;
    if (listening) {
      stopListening();
      return;
    }
    startListening();
  }

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "음성 인식 중지" : "음성으로 입력"}
      title={
        listening
          ? "듣는 중… 금액까지 말한 뒤 자동 입력 (다시 누르면 중지)"
          : "음성으로 입력 (금액까지 말씀해 주세요)"
      }
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        listening
          ? "bg-[#ff3b30] text-white"
          : "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebed]"
      }`}
    >
      {listening ? (
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden
        >
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
          <path d="M17 11a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
        </svg>
      )}
    </button>
  );
}
