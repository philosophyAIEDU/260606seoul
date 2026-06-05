# 서울시 학교 정보 검색 및 AI 분석 서비스

서울 열린데이터광장 공공 API(neisSchoolInfoJS)를 활용해 서울시 학교 데이터를 검색·시각화하고,
Gemini AI와 한국어로 대화할 수 있는 Next.js 웹 서비스입니다.

## 기술 스택

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Recharts (차트 시각화)
- @google/generative-ai (서버 사이드 전용)
- fast-xml-parser (서울 API 응답 파싱)

---

## 1. 환경변수 설정

프로젝트 루트에 `.env.local` 파일을 생성합니다.

```env
SEOUL_API_KEY=여기에_발급받은_서울_API_키_입력
```

**서울 공공API 키 발급 방법:**
1. [서울 열린데이터광장](https://data.seoul.go.kr) 접속
2. 회원가입 후 로그인
3. 상단 메뉴 > 마이페이지 > 인증키 발급/관리에서 키 발급
4. 발급받은 키를 `.env.local`에 입력

> ⚠️ `SEOUL_API_KEY`는 절대 클라이언트에 노출하지 마세요. 반드시 `.env.local`에만 보관하고 Git에 커밋하지 마세요.

---

## 2. 패키지 설치

```bash
npm install
```

---

## 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 4. Gemini API 키 입력 방법

Gemini API 키는 서버에 저장되지 않고 **사용자 브라우저(localStorage)에만 저장**됩니다.

1. 앱 실행 후 우측 상단 **⚙️ 설정** 클릭 또는 `/settings` 직접 접속
2. Gemini API 키 입력 후 **키 확인 및 저장** 버튼 클릭
3. 키 검증 완료 시 자동으로 메인 페이지로 이동
4. 이후 **🤖 이 데이터로 AI에게 물어보기** 버튼으로 채팅 페이지 이동 가능

**Gemini API 키 발급:** Google AI Studio에서 발급

> ⚠️ 공용 PC 사용 후에는 반드시 /settings에서 **저장된 키 삭제** 버튼을 눌러 키를 삭제하세요.

---

## 5. 주요 기능

| 페이지 | 기능 |
|--------|------|
| `/` | 학교명·종류·설립구분·교육지원청 필터링, BarChart/PieChart 시각화, 테이블 정렬/페이지네이션 |
| `/settings` | Gemini API 키 입력·검증·삭제 |
| `/chat` | 필터된 학교 데이터 기반 Gemini AI 스트리밍 대화 |

---

## 6. 테스트 실행

```bash
npm test
```

`lib/parseSeoulApi.ts` XML/JSON 파싱 함수 단위 테스트 (Jest + ts-jest)

---

## 7. 빌드 및 프로덕션 실행

```bash
npm run build
npm start
```

---

## API 구조

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/seoul` | 서울 공공API 프록시 (SEOUL_API_KEY 서버 전용) |
| `POST /api/chat` | Gemini AI 채팅 (X-Gemini-Key 헤더 필요) |

### `/api/seoul` 쿼리 파라미터

| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `start` | 1 | 시작 인덱스 |
| `end` | 610 | 종료 인덱스 |
| `schoolName` | (공백) | 학교명 검색어 |

### `/api/chat` 요청 바디

```json
{
  "messages": [{ "role": "user", "content": "질문 내용" }],
  "data": [...SchoolInfo 배열...],
  "summary": "데이터 요약 문자열"
}
```

헤더: `X-Gemini-Key: <Gemini API 키>`
