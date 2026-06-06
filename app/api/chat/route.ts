// Gemini AI 채팅 API 라우트 (X-Gemini-Key 헤더로 키 수신, 스트리밍 응답)
// 원시 JSON 대신 사전 계산된 통계 요약을 AI에 전달하여 정확도 향상

import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { SchoolInfo, ChatMessage } from '@/lib/types'

function buildStructuredContext(data: SchoolInfo[]): string {
  const total = data.length

  // 학교종류별 집계
  const byType: Record<string, number> = {}
  data.forEach((s) => { byType[s.SCHL_KND_NM || '기타'] = (byType[s.SCHL_KND_NM || '기타'] ?? 0) + 1 })

  // 설립구분별 집계
  const byEst: Record<string, number> = {}
  data.forEach((s) => { byEst[s.FNDN_SE || '기타'] = (byEst[s.FNDN_SE || '기타'] ?? 0) + 1 })

  // 교육지원청별 집계
  const byDistrict: Record<string, number> = {}
  data.forEach((s) => { byDistrict[s.CMPTNC_OGNZ_NM || '미상'] = (byDistrict[s.CMPTNC_OGNZ_NM || '미상'] ?? 0) + 1 })

  // 남녀공학 여부 집계
  const byCoedu: Record<string, number> = {}
  data.forEach((s) => { byCoedu[s.CEDU_SE_NM || '미상'] = (byCoedu[s.CEDU_SE_NM || '미상'] ?? 0) + 1 })

  // 설립연도 기준 정렬 (오래된/최신 순)
  const withDate = data.filter((s) => s.FNDN_YMD && s.FNDN_YMD.length === 8)
  withDate.sort((a, b) => a.FNDN_YMD.localeCompare(b.FNDN_YMD))
  const oldest = withDate.slice(0, 5).map((s) => `${s.SCHL_NM}(${s.FNDN_YMD.slice(0,4)}년, ${s.FNDN_SE})`)
  const newest = withDate.slice(-5).reverse().map((s) => `${s.SCHL_NM}(${s.FNDN_YMD.slice(0,4)}년, ${s.FNDN_SE})`)

  // 연대별 설립 분포
  const byDecade: Record<string, number> = {}
  withDate.forEach((s) => {
    const decade = `${Math.floor(parseInt(s.FNDN_YMD.slice(0,4)) / 10) * 10}년대`
    byDecade[decade] = (byDecade[decade] ?? 0) + 1
  })

  // 홈페이지 보유 현황
  const withWebsite = data.filter((s) => s.HMPG_ADDR).length

  // 전체 학교명 목록 (AI가 특정 학교 검색 시 참조)
  const schoolNames = data.map((s) => `${s.SCHL_NM}(${s.SCHL_KND_NM},${s.FNDN_SE},${s.CMPTNC_OGNZ_NM})`).join(' / ')

  return `
=== 분석 대상 데이터 통계 ===
총 학교 수: ${total}개교
홈페이지 보유: ${withWebsite}개교 / 미보유: ${total - withWebsite}개교

[학교종류별]
${Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}개교`).join('\n')}

[설립구분별]
${Object.entries(byEst).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}개교`).join('\n')}

[교육지원청별]
${Object.entries(byDistrict).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}개교`).join('\n')}

[남녀공학 현황]
${Object.entries(byCoedu).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}개교`).join('\n')}

[연대별 설립 현황]
${Object.entries(byDecade).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`  ${k}: ${v}개교`).join('\n')}

[가장 오래된 학교 TOP 5]
${oldest.join(', ')}

[가장 최근 설립 학교 TOP 5]
${newest.join(', ')}

[전체 학교 목록 (학교명/종류/설립/교육지원청)]
${schoolNames}
`.trim()
}

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

  const { messages, data } = body
  const context = buildStructuredContext(data)

  const systemPrompt = `당신은 서울시 학교 정보 데이터 분석 도우미입니다.
반드시 아래 제공된 데이터 범위 안에서만 답하세요.
데이터에 없는 수치는 절대 추측하거나 지어내지 마세요.
모르면 '제공된 데이터에서 확인할 수 없습니다'라고 답하세요.
모든 답변은 한국어로 작성하세요.
숫자를 말할 때는 반드시 아래 통계표의 수치만 사용하세요.

${context}`

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
        { role: 'model', parts: [{ text: '네, 제공된 서울시 학교 통계 데이터를 바탕으로 정확하게 답변 드리겠습니다.' }] },
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
