// 서울 열린데이터광장 학교정보 API 프록시 라우트 (SEOUL_API_KEY 서버 전용)

import { NextRequest, NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'
import { SchoolInfo } from '@/lib/types'

export async function GET(request: NextRequest) {
  const apiKey = process.env.SEOUL_API_KEY

  if (!apiKey) {
    console.warn('[seoul/route] SEOUL_API_KEY 환경변수가 설정되지 않았습니다.')
    return NextResponse.json({ error: '서버 설정 오류: 서울 API 키가 없습니다.' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') ?? '1'
  const end = searchParams.get('end') ?? '610'
  const schoolName = searchParams.get('schoolName') ?? '%20'

  const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/neisSchoolInfoJS/${start}/${end}/${encodeURIComponent(schoolName)}`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })

    if (!res.ok) {
      return NextResponse.json({ error: `서울 API 호출 실패: ${res.status}` }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') ?? ''
    let rows: SchoolInfo[] = []

    if (contentType.includes('xml')) {
      const text = await res.text()
      const parser = new XMLParser({ ignoreAttributes: false })
      const parsed = parser.parse(text)
      rows = extractRows(parsed)
    } else {
      const json = await res.json()
      rows = extractRows(json)
    }

    return NextResponse.json({ rows, total: rows.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function extractRows(parsed: Record<string, unknown>): SchoolInfo[] {
  const root = (parsed?.neisSchoolInfoJS ?? parsed) as Record<string, unknown>

  const result = root?.RESULT as Record<string, string> | undefined
  const code = result?.CODE
  if (code && code !== 'INFO-000') {
    throw new Error(`API 에러: ${code} - ${result?.MESSAGE ?? ''}`)
  }

  const row = root?.row
  if (!row) return []
  return Array.isArray(row) ? (row as SchoolInfo[]) : [row as SchoolInfo]
}
