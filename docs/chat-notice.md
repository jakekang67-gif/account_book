# 채팅 상단 공지 (모델·업데이트 안내)

## 목적
사용자가 채팅 화면에서 현재 AI 모델 순서와 업데이트 안내를 확인할 수 있게 합니다.

## 동작
1. 채팅 탭 상단에 공지 배너 표시
2. 「닫기」 시 해당 공지 id를 로컬에 저장해 숨김
3. 공지 id·문구·모델 목록이 바뀌면 다시 표시
4. 메뉴 → 「안내 다시 보기」로 언제든 재표시

## API
- `GET /api/notice` — `{ id, title, message, models }`

## 환경변수 (Vercel / `.env.local`)
| 변수 | 설명 |
| --- | --- |
| `CHAT_NOTICE` | 커스텀 본문. 없으면 모델 목록 기본 안내 |
| `CHAT_NOTICE_TITLE` | 제목 (기본: 모델·업데이트 안내) |
| `CHAT_NOTICE_ID` | 버전. 바꾸면 닫은 사용자에게 다시 표시 |
| `GEMINI_MODEL_CANDIDATES` | 쉼표 구분 모델 후보 (앞에서부터 시도) |

## 관련 파일
- `components/ChatNoticeBanner.tsx`
- `app/api/notice/route.ts`
- `lib/chatNotice.ts`
- `lib/geminiModels.ts`
- `app/api/chat/route.ts` (후보 모델 사용)
