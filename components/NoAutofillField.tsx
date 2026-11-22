"use client";

import {
  forwardRef,
  useCallback,
  useState,
  type FocusEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { noAutofillProps } from "@/lib/noAutofill";

/**
 * 포커스 전까지 readOnly로 두어 키보드 Autofill이
 * 필드를 비밀번호/주소 등으로 추측하지 않게 합니다.
 */
export const NoAutofillInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function NoAutofillInput({ onFocus, autoComplete, ...props }, ref) {
  const [locked, setLocked] = useState(true);

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (locked) {
        setLocked(false);
        const el = e.currentTarget;
        requestAnimationFrame(() => {
          try {
            const len = el.value.length;
            el.setSelectionRange(len, len);
          } catch {
            /* date/number 등은 미지원 */
          }
        });
      }
      onFocus?.(e);
    },
    [locked, onFocus],
  );

  return (
    <input
      {...noAutofillProps}
      {...props}
      ref={ref}
      autoComplete={autoComplete ?? "new-password"}
      readOnly={locked}
      onFocus={handleFocus}
    />
  );
});

export const NoAutofillTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function NoAutofillTextarea({ onFocus, autoComplete, ...props }, ref) {
  const [locked, setLocked] = useState(true);

  const handleFocus = useCallback(
    (e: FocusEvent<HTMLTextAreaElement>) => {
      if (locked) {
        setLocked(false);
        const el = e.currentTarget;
        requestAnimationFrame(() => {
          try {
            const len = el.value.length;
            el.setSelectionRange(len, len);
          } catch {
            /* ignore */
          }
        });
      }
      onFocus?.(e);
    },
    [locked, onFocus],
  );

  return (
    <textarea
      {...noAutofillProps}
      {...props}
      ref={ref}
      autoComplete={autoComplete ?? "new-password"}
      readOnly={locked}
      onFocus={handleFocus}
    />
  );
});

/** 브라우저/비밀번호 관리자가 실제 칸을 채우지 않도록 유인 */
export function AutofillDecoys() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
    >
      <input
        type="text"
        name="fake-username"
        autoComplete="username"
        tabIndex={-1}
        defaultValue=""
      />
      <input
        type="password"
        name="fake-password"
        autoComplete="new-password"
        tabIndex={-1}
        defaultValue=""
      />
    </div>
  );
}
