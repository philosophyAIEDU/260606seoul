// 범용 서울 열린데이터광장 OpenAPI 프록시 라우트
// - 인증키는 클라이언트가 X-Seoul-Key 헤더로 전달 (서버에 저장하지 않음)
// - 샘플 URL을 받아 실제 호출 URL을 구성하고, CORS/HTTP 제약 없이 서버에서 호출
// - 응답을 범용 파서로 처리해 { serviceName, rows, totalCount } 반환

import { NextRequest, NextResponse } from 'next/server'
import { buildRequestUrl, parseSeoulResponse } from '@/lib/analysis'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const seoulKey = request.headers.get('X-Seoul-Key')
  if (!seoulKey) {
    return NextResponse.json({ error: '서울 OpenAPI 인증키가 필요합니다.' }, { status: 401 })
  }

  let body: { sampleUrl?: string; maxRows?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  const { sampleUrl, maxRows } = body
  if (!sampleUrl) {
    return NextResponse.json({ error: '샘플 URL을 입력해 주세요.' }, { status: 400 })
  }

  let requestUrl: string
  try {
    // 서울 API는 한 번에 최대 1000건까지 요청 가능
    const limit = Math.min(Math.max(maxRows ?? 1000, 1), 1000)
    requestUrl = buildRequestUrl(sampleUrl, seoulKey, limit)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'URL 처리 오류'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const res = await fetch(requestUrl, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json(
        { error: `서울 API 호출 실패: HTTP ${res.status}` },
        { status: 502 },
      )
    }

    const text = await res.text()
    const parsed = parseSeoulResponse(text)

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: '데이터가 비어 있습니다. URL 또는 인증키를 확인해 주세요.' },
        { status: 422 },
      )
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
