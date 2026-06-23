// 범용 서울 열린데이터광장 OpenAPI 응답 파싱 및 데이터 분석 유틸리티
//
// 서울 공공 API는 서비스명만 다를 뿐 응답 구조가 동일합니다.
//   { <서비스명>: { list_total_count, RESULT: { CODE, MESSAGE }, row: [...] } }
// 이 모듈은 서비스명을 모르더라도 동작하도록 범용으로 작성되었습니다.

import { XMLParser } from 'fast-xml-parser'
import {
  Aggregation,
  ChartSpec,
  ColumnMeta,
  ColumnType,
  DataRow,
  Dataset,
} from './types'

// ───────────────────────────── 응답 파싱 ─────────────────────────────

export interface ParsedResponse {
  serviceName: string
  rows: DataRow[]
  totalCount: number
}

// XML 문자열 또는 JSON(객체/문자열)을 받아 범용 파싱
export function parseSeoulResponse(input: unknown): ParsedResponse {
  let parsed: Record<string, unknown>

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (trimmed.startsWith('<')) {
      // XML
      const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true })
      parsed = parser.parse(trimmed) as Record<string, unknown>
    } else {
      // JSON 문자열
      parsed = JSON.parse(trimmed) as Record<string, unknown>
    }
  } else if (typeof input === 'object' && input !== null) {
    parsed = input as Record<string, unknown>
  } else {
    throw new Error('지원하지 않는 데이터 형식입니다. (XML 또는 JSON 필요)')
  }

  // 최상위 키들 중 서비스 루트 찾기
  const { serviceName, root } = findServiceRoot(parsed)

  // RESULT.CODE 검사 (INFO-000 이 정상)
  const result = root.RESULT as Record<string, string> | undefined
  const code = result?.CODE
  if (code && code !== 'INFO-000') {
    throw new Error(`API 에러: ${code} - ${result?.MESSAGE ?? '알 수 없는 오류'}`)
  }

  const totalRaw = root.list_total_count
  const totalCount =
    typeof totalRaw === 'number'
      ? totalRaw
      : typeof totalRaw === 'string'
        ? parseInt(totalRaw, 10) || 0
        : 0

  const rawRows = root.row
  let rows: DataRow[] = []
  if (rawRows) {
    rows = (Array.isArray(rawRows) ? rawRows : [rawRows]) as DataRow[]
    // 값을 문자열/숫자로 정규화 (XML 파서가 객체를 만들 수 있으므로 평탄화)
    rows = rows.map(normalizeRow)
  }

  return { serviceName, rows, totalCount: totalCount || rows.length }
}

// 최상위 객체에서 서비스 루트({ RESULT, row, list_total_count })를 탐색
function findServiceRoot(parsed: Record<string, unknown>): {
  serviceName: string
  root: Record<string, unknown>
} {
  // 자기 자신이 이미 루트인 경우
  if ('row' in parsed || 'RESULT' in parsed || 'list_total_count' in parsed) {
    return { serviceName: 'dataset', root: parsed }
  }
  // 한 단계 아래에서 서비스명 키 탐색
  for (const [key, value] of Object.entries(parsed)) {
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>
      if ('row' in v || 'RESULT' in v || 'list_total_count' in v) {
        return { serviceName: key, root: v }
      }
    }
  }
  // 못 찾으면 첫 번째 객체를 루트로 간주
  const firstKey = Object.keys(parsed)[0]
  const firstVal = parsed[firstKey]
  if (firstVal && typeof firstVal === 'object') {
    return { serviceName: firstKey, root: firstVal as Record<string, unknown> }
  }
  throw new Error('응답에서 데이터(row)를 찾을 수 없습니다.')
}

// 한 행의 값들을 문자열/숫자로 평탄화 (중첩 객체/null 방어)
function normalizeRow(row: DataRow): DataRow {
  const out: DataRow = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) out[k] = ''
    else if (typeof v === 'number' || typeof v === 'string') out[k] = v
    else out[k] = String(v)
  }
  return out
}

// ───────────────────────────── 컬럼 추론 ─────────────────────────────

const DATE_RE = /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$|^\d{4}[-.]?\d{2}$|^\d{4}$/

// 숫자 변환 (쉼표 제거 후 파싱). 실패 시 null
export function toNumber(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const cleaned = v.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function looksLikeDate(v: string | number): boolean {
  const s = String(v).trim()
  return DATE_RE.test(s)
}

export function inferColumns(rows: DataRow[]): ColumnMeta[] {
  if (rows.length === 0) return []

  // 모든 키 수집 (순서 보존)
  const keys: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k)
        keys.push(k)
      }
    }
  }

  return keys.map((key) => {
    const values = rows.map((r) => r[key])
    const nonEmpty = values.filter((v) => v !== '' && v !== undefined && v !== null)
    const emptyCount = values.length - nonEmpty.length
    const distinct = new Set(nonEmpty.map((v) => String(v)))

    // 숫자 비율
    const numericValues = nonEmpty.map(toNumber).filter((n): n is number => n !== null)
    const numericRatio = nonEmpty.length ? numericValues.length / nonEmpty.length : 0

    // 날짜 비율
    const dateRatio = nonEmpty.length
      ? nonEmpty.filter(looksLikeDate).length / nonEmpty.length
      : 0

    let type: ColumnType
    if (numericRatio >= 0.9 && distinct.size > 1 && !isAllShortCodes(nonEmpty)) {
      type = 'number'
    } else if (dateRatio >= 0.9) {
      type = 'date'
    } else if (distinct.size <= Math.max(50, nonEmpty.length * 0.5)) {
      type = 'category'
    } else {
      type = 'text'
    }

    const meta: ColumnMeta = {
      key,
      type,
      distinctCount: distinct.size,
      emptyCount,
      sampleValues: Array.from(distinct).slice(0, 5),
    }

    if (type === 'number' && numericValues.length) {
      const sum = numericValues.reduce((a, b) => a + b, 0)
      meta.numericStats = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean: sum / numericValues.length,
        sum,
      }
    }

    return meta
  })
}

// 자치구코드 등 고정 자리수 코드값은 숫자 통계 대상에서 제외
function isAllShortCodes(values: (string | number)[]): boolean {
  // 모든 값이 동일 길이의 정수 문자열이고 앞자리가 0이면 코드로 간주
  const strs = values.map((v) => String(v))
  return strs.length > 0 && strs.every((s) => /^0\d+$/.test(s))
}

export function buildDataset(parsed: ParsedResponse): Dataset {
  return {
    serviceName: parsed.serviceName,
    rows: parsed.rows,
    totalCount: parsed.totalCount,
    columns: inferColumns(parsed.rows),
  }
}

// ───────────────────────────── 차트 데이터 집계 ─────────────────────────────

function aggregate(values: number[], agg: Aggregation): number {
  if (agg === 'count') return values.length
  if (values.length === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  switch (agg) {
    case 'sum':
      return sum
    case 'avg':
      return sum / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
    default:
      return values.length
  }
}

export interface ChartDatum {
  name: string
  value: number
}

// 차트 명세 + 행 데이터 → 차트용 집계 데이터
export function computeChartData(rows: DataRow[], spec: ChartSpec): ChartDatum[] {
  const groups = new Map<string, number[]>()

  for (const r of rows) {
    const cat = String(r[spec.categoryField] ?? '(없음)') || '(없음)'
    let val = 1
    if (spec.aggregation !== 'count' && spec.valueField) {
      const n = toNumber(r[spec.valueField])
      if (n === null) continue // 숫자 아닌 값은 제외
      val = n
    }
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(val)
  }

  let data: ChartDatum[] = Array.from(groups.entries()).map(([name, vals]) => ({
    name,
    value: Math.round(aggregate(vals, spec.aggregation) * 100) / 100,
  }))

  // 정렬
  if (spec.sortBy === 'value-desc') data.sort((a, b) => b.value - a.value)
  else if (spec.sortBy === 'value-asc') data.sort((a, b) => a.value - b.value)
  else data.sort((a, b) => a.name.localeCompare(b.name))

  // 상위 N개 제한
  if (spec.topN && spec.topN > 0 && data.length > spec.topN) {
    data = data.slice(0, spec.topN)
  }

  return data
}

// ───────────────────────────── 자동 차트 추천 ─────────────────────────────

let idCounter = 0
export function newChartId(): string {
  idCounter += 1
  return `chart-${Date.now()}-${idCounter}`
}

// 컬럼 메타 기반으로 기본 차트 자동 생성 (최대 4개)
export function suggestCharts(columns: ColumnMeta[]): ChartSpec[] {
  const specs: ChartSpec[] = []

  const categoricals = columns.filter(
    (c) => c.type === 'category' && c.distinctCount >= 2 && c.distinctCount <= 40,
  )
  const numerics = columns.filter((c) => c.type === 'number')

  // 1) 카테고리별 건수 (가장 구분 적은 컬럼 → 파이)
  const sortedCats = [...categoricals].sort((a, b) => a.distinctCount - b.distinctCount)
  if (sortedCats[0]) {
    specs.push({
      id: newChartId(),
      type: sortedCats[0].distinctCount <= 6 ? 'pie' : 'bar',
      title: `${sortedCats[0].key} 별 건수`,
      categoryField: sortedCats[0].key,
      valueField: null,
      aggregation: 'count',
      topN: 12,
      sortBy: 'value-desc',
    })
  }

  // 2) 두 번째 카테고리별 건수 (막대)
  if (sortedCats[1]) {
    specs.push({
      id: newChartId(),
      type: 'bar',
      title: `${sortedCats[1].key} 별 건수`,
      categoryField: sortedCats[1].key,
      valueField: null,
      aggregation: 'count',
      topN: 12,
      sortBy: 'value-desc',
    })
  }

  // 3) 카테고리 × 숫자 합계
  if (sortedCats[0] && numerics[0]) {
    specs.push({
      id: newChartId(),
      type: 'bar',
      title: `${sortedCats[0].key} 별 ${numerics[0].key} 합계`,
      categoryField: sortedCats[0].key,
      valueField: numerics[0].key,
      aggregation: 'sum',
      topN: 12,
      sortBy: 'value-desc',
    })
  }

  // 4) 카테고리 × 숫자 평균
  if (sortedCats[0] && numerics[1]) {
    specs.push({
      id: newChartId(),
      type: 'bar',
      title: `${sortedCats[0].key} 별 ${numerics[1].key} 평균`,
      categoryField: sortedCats[0].key,
      valueField: numerics[1].key,
      aggregation: 'avg',
      topN: 12,
      sortBy: 'value-desc',
    })
  }

  // 카테고리가 전혀 없으면 첫 텍스트/날짜 컬럼으로 건수 차트라도 제공
  if (specs.length === 0 && columns[0]) {
    specs.push({
      id: newChartId(),
      type: 'bar',
      title: `${columns[0].key} 별 건수`,
      categoryField: columns[0].key,
      valueField: null,
      aggregation: 'count',
      topN: 12,
      sortBy: 'value-desc',
    })
  }

  return specs
}

// ───────────────────────────── AI용 요약 생성 ─────────────────────────────

export function buildDataSummary(dataset: Dataset): string {
  const lines: string[] = []
  lines.push(`서비스명: ${dataset.serviceName}`)
  lines.push(`불러온 행 수: ${dataset.rows.length}개 (전체 ${dataset.totalCount.toLocaleString()}건 중 일부)`)
  lines.push('')
  lines.push('컬럼 목록 및 특성:')
  for (const c of dataset.columns) {
    let desc = `- ${c.key} [${c.type}], 고유값 ${c.distinctCount}개`
    if (c.numericStats) {
      const s = c.numericStats
      desc += `, 최소 ${s.min}, 최대 ${s.max}, 평균 ${s.mean.toFixed(1)}, 합계 ${s.sum}`
    } else {
      desc += `, 예시: ${c.sampleValues.join(' / ')}`
    }
    lines.push(desc)
  }
  return lines.join('\n')
}

// ───────────────────────────── 요청 URL 생성 ─────────────────────────────

// 사용자가 붙여넣은 샘플 URL + 인증키 + 최대 행수 → 실제 호출 URL
// 예: http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/
export function buildRequestUrl(sampleUrl: string, apiKey: string, maxRows = 1000): string {
  const trimmed = sampleUrl.trim()
  const marker = trimmed.match(/openapi\.seoul\.go\.kr:8088\//i)
  if (!marker) {
    throw new Error('서울 열린데이터광장 샘플 URL 형식이 아닙니다. (openapi.seoul.go.kr:8088 포함 필요)')
  }

  const idx = trimmed.indexOf('8088/') + '8088/'.length
  const path = trimmed.slice(idx)
  const parts = path.split('/').filter((p, i, arr) => p !== '' || i === arr.length - 1)
  // parts: [KEY, TYPE, SERVICE, START, END, ...extra]
  if (parts.length < 3) {
    throw new Error('샘플 URL에서 서비스 정보를 추출할 수 없습니다.')
  }

  parts[0] = apiKey.trim() // 인증키 치환
  // TYPE: json/xml 둘 다 파서가 처리하므로 그대로 두되, 누락 시 json
  if (!parts[1]) parts[1] = 'json'
  // START / END 를 1 / maxRows 로 확장
  if (parts.length >= 4) parts[3] = '1'
  else parts.push('1')
  if (parts.length >= 5) parts[4] = String(maxRows)
  else parts.push(String(maxRows))

  return `http://openapi.seoul.go.kr:8088/${parts.join('/')}`
}
