// 서울 공공API XML/JSON 응답 파싱 유틸리티 함수

import { XMLParser } from 'fast-xml-parser'
import { SchoolInfo } from './types'

interface SeoulApiResponse {
  neisSchoolInfoJS?: {
    list_total_count?: number
    RESULT?: {
      CODE?: string
      MESSAGE?: string
    }
    row?: SchoolInfo | SchoolInfo[]
  }
}

export function parseSeoulApiResponse(data: unknown): SchoolInfo[] {
  // JSON 응답인 경우 직접 처리
  if (typeof data === 'object' && data !== null) {
    return extractRows(data as SeoulApiResponse)
  }

  // XML 문자열인 경우 파싱
  if (typeof data === 'string') {
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(data) as SeoulApiResponse
    return extractRows(parsed)
  }

  throw new Error('지원하지 않는 데이터 형식입니다.')
}

function extractRows(parsed: SeoulApiResponse): SchoolInfo[] {
  const root = parsed?.neisSchoolInfoJS

  if (!root) throw new Error('응답 구조가 올바르지 않습니다.')

  const code = root?.RESULT?.CODE
  if (code && code !== 'INFO-000') {
    throw new Error(`API 에러: ${code} - ${root?.RESULT?.MESSAGE ?? '알 수 없는 오류'}`)
  }

  if (!root.row) return []

  // row가 단일 객체인 경우 배열로 변환
  return Array.isArray(root.row) ? root.row : [root.row]
}
