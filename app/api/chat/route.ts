// Gemini AI 데이터 분석가 채팅 라우트
// - 요청 본문(geminiKey)으로 사용자 키 수신 (서버 저장 안 함)
// - 데이터 요약 + 컬럼 정보 + 표본 행 + 현재 차트 명세를 근거로 분석
// - 차트 생성/수정 요청 시 ```chart-spec JSON``` 블록을 함께 출력하도록 유도
// - 스트리밍(text/plain) 응답. 모델: gemini-3.1-flash-lite

import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ChatMessage, ChartSpec, DataRow } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface ChatBody {
  messages: ChatMessage[]
  summary: string
  columns: { key: string; type: string }[]
  sampleRows: DataRow[]
  charts: ChartSpec[]
  geminiKey?: string
}

export async function POST(request: NextRequest) {
  let body: ChatBody
  try {
    body = (await request.json()) as ChatBody
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식입니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const geminiKey = body.geminiKey?.trim()
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'Gemini API 키가 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, summary, columns, sampleRows, charts } = body
  const fieldKeys = (columns ?? []).map((c) => c.key)

  const systemPrompt = `당신은 서울 공공데이터를 분석하는 전문 데이터 분석가입니다.
모든 답변은 한국어로, 친절하고 명확하게 작성하세요.

[분석 원칙]
- 반드시 아래 제공된 데이터 범위 안에서만 답하세요.
- 데이터에 없는 수치는 추측하거나 지어내지 마세요. 모르면 "제공된 데이터에서 확인할 수 없습니다"라고 답하세요.
- 숫자를 인용할 때는 어떤 컬럼/집계 기준인지 함께 밝히세요.
- [식별자]로 표시된 컬럼(제목·본문·일련번호 등)은 행마다 거의 고유하므로 집계 기준으로 쓰지 마세요.
- 분석은 막연한 설명이 아니라 구체적 수치로 답하세요: 숫자 지표는 평균/중앙값/최대·최소/분포,
  카테고리는 구성비(%)와 최빈값, 행 비교는 상위·하위 N위를 제시하세요.
- "핵심 인사이트를 알려달라"는 요청에는 ① 한 줄 요약 ② 근거가 되는 수치 3가지 이상
  ③ 시각화 제안(가능하면 chart-spec 블록 포함) 순으로 구조화해 답하세요.

[차트 생성·수정 기능]
사용자가 그래프/차트를 만들거나 수정해 달라고 하면, 자연어 설명과 함께
반드시 아래 형식의 코드 블록을 출력하세요. 프론트엔드가 이 블록을 읽어 차트를 즉시 반영합니다.

\`\`\`chart-spec
{"action":"add","type":"bar","title":"제목","categoryField":"<필드명>","valueField":null,"aggregation":"count","topN":12,"sortBy":"value-desc"}
\`\`\`

규칙:
- action: "add"(새 차트 추가) | "replace"(기존 차트 교체, 이때 "id" 필수) | "remove"(삭제, "id" 필수)
- type: "bar" | "line" | "pie" | "area" | "scatter"
- categoryField, valueField 는 반드시 아래 실제 컬럼명 중에서만 선택하세요: ${fieldKeys.join(', ')}
- aggregation: "count"(건수) | "sum"(합계) | "avg"(평균) | "min" | "max"
  - count 일 때는 valueField 를 null 로 두세요. sum/avg/min/max 일 때는 숫자형 valueField 를 지정하세요.
- topN: 표시할 상위 카테고리 수 (0이면 전체), sortBy: "value-desc" | "value-asc" | "category"
- 기존 차트를 수정할 때는 현재 차트 목록의 id 를 사용해 "replace" 하세요.

[현재 화면의 차트 목록]
${(charts ?? []).map((c) => `- id=${c.id}: ${c.title} (${c.type}, ${c.categoryField}/${c.valueField ?? '건수'}/${c.aggregation})`).join('\n') || '(없음)'}

[데이터 요약]
${summary}

[표본 행 (최대 30개)]
${JSON.stringify((sampleRows ?? []).slice(0, 30))}`

  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    // 텍스트 생성 모델 — 변경 금지
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

    const history = (messages ?? []).slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        {
          role: 'model',
          parts: [{ text: '네, 제공된 서울 공공데이터를 바탕으로 분석과 시각화를 도와드리겠습니다.' }],
        },
        ...history,
      ],
    })

    const lastMessage = messages[messages.length - 1].content
    const result = await chat.sendMessageStream(lastMessage)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
