# 서울 공공데이터 AI 분석 (Seoul Open Data AI Analyst)

서울 열린데이터광장의 **어떤 OpenAPI든** 샘플 URL과 예제 응답만 붙여넣으면
자동으로 시각화하고, **AI 데이터 분석가**(Gemini)와 한국어로 대화하며 차트를 만들고
수정할 수 있는 Next.js 웹 서비스입니다.

## ✨ 주요 기능

1. **인증키 직접 입력** — 사용자가 본인의 서울 OpenAPI 인증키와 Gemini API 키를 입력
   (두 키 모두 서버에 저장되지 않고 브라우저 localStorage 에만 보관)
2. **범용 데이터 로더** — 샘플 URL(예: `http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/`)과
   예제 응답을 붙여넣으면, 서비스 종류와 무관하게 자동 파싱 (XML/JSON 모두 지원)
3. **자동 분석·시각화** — 컬럼 타입(숫자/날짜/카테고리/텍스트)을 자동 추론하고
   의미 있는 차트를 자동 생성, 원본 데이터 테이블 제공
4. **AI 데이터 분석가** — `gemini-3.1-flash-lite` 기반으로 데이터에 근거한 대화
5. **대화로 차트 생성·수정** — "~를 막대그래프로 만들어줘", "파이차트로 바꿔줘" 등
   요청하면 AI가 차트를 즉시 추가/교체/삭제 (수동 편집 ✏️ 도 지원)
6. **인포그래픽 이미지 생성** — `gemini-3.1-flash-image` 로 데이터 요약 이미지 생성

## 🛠 기술 스택

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Recharts (막대/선/영역/파이/분산형 차트)
- @google/generative-ai (서버 사이드 전용)
- fast-xml-parser (서울 API XML 응답 파싱)

---

## 1. 설치 및 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

별도의 환경변수(`.env`)는 필요 없습니다. 모든 키는 앱 `/settings` 에서 입력합니다.

## 2. 사용 방법

1. **설정(`/settings`)** 에서
   - ① 서울 OpenAPI 인증키 입력 ([서울 열린데이터광장](https://data.seoul.go.kr) → 인증키 신청)
   - ② Gemini API 키 입력·검증 ([Google AI Studio](https://aistudio.google.com/apikey))
2. **메인 화면**에서 분석할 데이터의 **샘플 URL** 과 (선택) **예제 응답** 붙여넣기
3. **데이터 불러오기 & 자동 분석** 클릭 → 차트·테이블 자동 생성
4. 우측 **🤖 AI 데이터 분석가**에게 질문하거나 차트 생성/수정 요청
5. **🖼️ 이미지** 버튼으로 인포그래픽 생성

> ⚠️ 두 키 모두 브라우저에만 저장됩니다. 공용 PC에서는 사용 후 `/settings`에서 키를 삭제하세요.

---

## 3. 테스트 / 빌드

```bash
npm test             # lib/analysis.ts 단위 테스트
npm run build && npm start
```

---

## 📂 구조

| 경로 | 설명 |
|------|------|
| `lib/types.ts` | 범용 데이터/차트 타입 정의 |
| `lib/analysis.ts` | 응답 파싱, 컬럼 추론, 차트 집계, 자동 추천, URL 생성 |
| `lib/keys.tsx` | 서울/Gemini 키 Context (localStorage) |
| `components/DataLoader.tsx` | 샘플 URL·예제 입력 패널 |
| `components/DynamicChart.tsx` | 명세 기반 동적 차트 + 인라인 편집 |
| `components/DataTable.tsx` | 범용 데이터 테이블 (검색/정렬/페이지) |
| `components/ChatPanel.tsx` | AI 분석가 채팅 + 차트 조작 + 이미지 생성 |
| `app/api/fetch/route.ts` | 서울 OpenAPI 프록시 (인증키는 헤더 전달) |
| `app/api/chat/route.ts` | Gemini 채팅 (gemini-3.1-flash-lite, 스트리밍) |
| `app/api/image/route.ts` | Gemini 이미지 생성 (gemini-3.1-flash-image) |

## 🔌 API

> API 키는 HTTP 헤더가 아닌 **요청 본문(JSON)** 으로 전달합니다. (헤더는 ISO-8859-1만 허용)

### `POST /api/fetch`
바디 `{ sampleUrl, maxRows, seoulKey }` → `{ serviceName, rows, totalCount }`

### `POST /api/chat`
바디 `{ messages, summary, columns, sampleRows, charts, geminiKey }` → 스트리밍 텍스트.
AI는 차트 조작 시 ```` ```chart-spec {JSON} ``` ```` 블록을 함께 출력합니다.

### `POST /api/image`
바디 `{ prompt, geminiKey }` → `{ image: "data:image/...;base64,...", note? }`
