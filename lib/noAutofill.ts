/**
 * 삼성/안드로이드 키보드 상단 Autofill
 * (비밀번호·결제수단·주소·목록) 노출을 줄이기 위한 공통 속성.
 */
export const noAutofillFormProps = {
  autoComplete: "off",
  "data-form-type": "other",
} as const;

export const noAutofillProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-form-type": "other",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
};
