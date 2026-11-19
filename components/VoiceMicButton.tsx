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

type VoiceMicButtonProps = {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

/**
 * Web Speech API 마이크 버튼.
 * 최종 인식 문장을 onTranscript로 넘깁니다.
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

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
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
    const recognition = new Ctor();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += piece;
        } else {
          interim += piece;
        }
      }
      if (finalChunk) {
        finalTextRef.current = `${finalTextRef.current}${finalChunk}`.trim();
      }
      // 중간 결과는 무시하고, 최종만 전달 (아래 onend에서)
      void interim;
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "aborted" || event.error === "no-speech") {
        return;
      }
      if (event.error === "not-allowed") {
        onError?.(
          "마이크 권한이 필요합니다. 브라우저 주소창에서 마이크를 허용해 주세요.",
        );
        return;
      }
      onError?.("음성 인식에 실패했어요. 다시 시도해 주세요.");
    };

    recognition.onend = () => {
      setListening(false);
      const text = finalTextRef.current.trim();
      if (text) {
        onTranscript(text);
      }
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
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
      title={listening ? "듣는 중… 다시 누르면 중지" : "음성으로 입력"}
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
