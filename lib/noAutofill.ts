/**
 * 삼성/안드로이드 키보드 상단 Autofill
 * (비밀번호·결제수단·주소·목록) 노출을 줄이기 위한 공통 속성.
 *
 * "off"만으로는 삼성 키보드가 무시하는 경우가 많아
 * "new-password" + 포커스 전 readOnly 조합을 사용합니다.
 */
export const noAutofillFormProps = {
  autoComplete: "off",
  "data-form-type": "other",
} as const;

export const noAutofillProps = {
  autoComplete: "new-password",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-form-type": "other",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-no-autofill": "true",
} as const;
