# ClaimSnap PWA

영수증 사진을 한 번에 최대 10장까지 브라우저에서 순차 OCR 처리해 상호, 날짜, 금액, 분류, 설명이 들어간 경비 한 줄로 각각 확정하는 MVP입니다.

## 로컬 실행

```bash
npm run install:ci
CODEX_SANDBOX=seatbelt npm run dev -- --hostname 127.0.0.1
```

기본 주소는 `http://127.0.0.1:5173`입니다.

## 검증

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## 개인정보 처리

- 영수증 이미지는 서버나 데이터베이스에 업로드하지 않습니다.
- OCR은 Tesseract.js Web Worker를 사용해 브라우저 안에서 실행됩니다.
- 확정한 경비는 현재 브라우저 세션의 메모리에만 존재하며 새로고침하면 삭제됩니다.
