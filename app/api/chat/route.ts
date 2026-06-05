// Gemini AI 채팅 API 라우트 (X-Gemini-Key 헤더로 키 수신, 스트리밍 응답)

import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SchoolInfo, ChatMessage } from '@/lib/types'

export async function POST(request: NextRequest) {
  const geminiKey = request.headers.get('X-Gemini-Key')

  if (!geminiKey) {
    return new Response(JSON.stringify({ error: 'Gemini API 키가 필요합니다.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json() as {
    messages: ChatMessage[]
    data: SchoolInfo[]
    summary: string
  }

  const { messages, data, summary } = body

  const systemPrompt = `당신은 서울시 학교 정보 데이터 분석 도우미입니다.
반드시 아래 제공된 데이터 범위 안에서만 답하세요.
데이터에 없는 수치는 절대 추측하거나 지어내지 마세요.
모르면 '제공된 데이터에서 확인할 수 없습니다'라고 답하세요.
모든 답변은 한국어로 작성하세요.
데이터 요약: ${summary}

현재 분석 대상 데이터 (${data.length}개교):
${JSON.stringify(data.slice(0, 200), null, 0)}`

  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    // 모델명 절대 변경 금지
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '네, 제공된 서울시 학교 데이터를 바탕으로 분석 도와드리겠습니다.' }] },
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
