// Gemini 이미지 생성 라우트 (인포그래픽/시각 자료 생성)
// - 요청 본문(geminiKey)으로 사용자 키 수신 (서버 저장 안 함)
// - 모델: gemini-3.1-flash-image
// - 응답에서 inlineData(base64 이미지)를 추출해 data URL 로 반환

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: { prompt?: string; geminiKey?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const geminiKey = body.geminiKey?.trim()
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API 키가 필요합니다.' }, { status: 401 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return NextResponse.json({ error: '이미지 생성 프롬프트를 입력해 주세요.' }, { status: 400 })
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    // 이미지 생성 모델 — 변경 금지
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image' })

    const result = await model.generateContent(prompt)
    const parts = result.response.candidates?.[0]?.content?.parts ?? []

    let imageData: string | null = null
    let mimeType = 'image/png'
    let textNote = ''

    for (const part of parts) {
      const p = part as { inlineData?: { data: string; mimeType: string }; text?: string }
      if (p.inlineData?.data) {
        imageData = p.inlineData.data
        mimeType = p.inlineData.mimeType || 'image/png'
      } else if (p.text) {
        textNote += p.text
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: '이미지를 생성하지 못했습니다.', note: textNote || undefined },
        { status: 502 },
      )
    }

    return NextResponse.json({
      image: `data:${mimeType};base64,${imageData}`,
      note: textNote || undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
