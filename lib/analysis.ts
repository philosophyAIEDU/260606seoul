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

    const uniqueRatio = nonEmpty.length ? distinct.size / nonEmpty.length : 0
    const avgLength = nonEmpty.length
      ? nonEmpty.reduce((a: number, v) => a + String(v).length, 0) / nonEmpty.length
      : 0

    // 숫자 비율
    const numericValues = nonEmpty.map(toNumber).filter((n): n is number => n !== null)
    const numericRatio = nonEmpty.length ? numericValues.length / nonEmpty.length : 0

    // 날짜 비율
    const dateRatio = nonEmpty.length
      ? nonEmpty.filter(looksLikeDate).length / nonEmpty.length
      : 0

    // 식별자 판별
    // - 숫자: 연속된 정수 일련번호처럼 보이면 식별자 (조회수/금액 같은 실측 지표는 제외)
    // - 텍스트: 거의 모든 값이 고유한 자유텍스트(제목/본문 등)
    const allInts = numericValues.length === nonEmpty.length && numericValues.every((n) => Number.isInteger(n))
    const numRange = numericValues.length ? Math.max(...numericValues) - Math.min(...numericValues) : 0
    const isSequentialId =
      numericRatio >= 0.9 &&
      allInts &&
      distinct.size === nonEmpty.length &&
      nonEmpty.length >= 5 &&
      numRange + 1 <= distinct.size * 2 // 값이 촘촘히 이어진 정수 = 일련번호
    const isTextId = numericRatio < 0.9 && nonEmpty.length >= 5 && uniqueRatio >= 0.95 && avgLength > 4
    const isLikelyId = isSequentialId || isTextId

    let type: ColumnType
    if (dateRatio >= 0.9) {
      type = 'date'
    } else if (numericRatio >= 0.9 && distinct.size > 1 && !isAllShortCodes(nonEmpty)) {
      type = 'number'
    } else if (
      // 진짜 카테고리: 고유값이 절대적으로 적고, 중복이 충분하며, 값이 짧다
      distinct.size >= 1 &&
      distinct.size <= 30 &&
      avgLength <= 25 &&
      (nonEmpty.length < 5 || uniqueRatio <= 0.6)
    ) {
      type = 'category'
    } else {
      type = 'text'
    }

    const meta: ColumnMeta = {
      key,
      type,
      distinctCount: distinct.size,
      emptyCount,
      uniqueRatio,
      avgLength,
      isLikelyId,
      sampleValues: Array.from(distinct).slice(0, 5),
    }

    if (type === 'number' && numericValues.length) {
      const sorted = [...numericValues].sort((a, b) => a - b)
      const sum = numericValues.reduce((a, b) => a + b, 0)
      const mid = Math.floor(sorted.length / 2)
      const median =
        sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
      meta.numericStats = {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: sum / numericValues.length,
        median,
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
  // 히스토그램 모드: categoryField(숫자)를 균등 구간으로 나눠 분포 표시
  if (spec.bins && spec.bins > 0) {
    return computeHistogram(rows, spec)
  }

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

// 숫자 컬럼을 균등 구간으로 나눈 분포(히스토그램)
function computeHistogram(rows: DataRow[], spec: ChartSpec): ChartDatum[] {
  const nums = rows
    .map((r) => toNumber(r[spec.categoryField]))
    .filter((n): n is number => n !== null)
  if (nums.length === 0) return []

  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const binCount = Math.max(2, Math.min(spec.bins ?? 8, 30))
  if (min === max) return [{ name: String(min), value: nums.length }]

  const width = (max - min) / binCount
  const counts = new Array(binCount).fill(0)
  for (const n of nums) {
    let idx = Math.floor((n - min) / width)
    if (idx >= binCount) idx = binCount - 1
    counts[idx] += 1
  }

  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
  return counts.map((c, i) => {
    const lo = min + width * i
    const hi = i === binCount - 1 ? max : min + width * (i + 1)
    return { name: `${fmt(lo)}~${fmt(hi)}`, value: c }
  })
}

// ───────────────────────────── 자동 차트 추천 ─────────────────────────────

let idCounter = 0
export function newChartId(): string {
  idCounter += 1
  return `chart-${Date.now()}-${idCounter}`
}

function makeSpec(p: Partial<ChartSpec> & Pick<ChartSpec, 'categoryField'>): ChartSpec {
  return {
    id: newChartId(),
    type: 'bar',
    title: '',
    valueField: null,
    aggregation: 'count',
    topN: 12,
    sortBy: 'value-desc',
    ...p,
  }
}

// 컬럼 메타 기반으로 "의미 있는" 기본 차트 자동 생성 (최대 4개)
// - 자유텍스트/식별자 컬럼은 카테고리 축으로 쓰지 않음
// - 숫자형 지표는 분포(히스토그램) + 라벨별 랭킹으로 시각화
export function suggestCharts(columns: ColumnMeta[]): ChartSpec[] {
  const specs: ChartSpec[] = []

  // 그룹에 적합한 진짜 카테고리 (식별자 제외, 구분 2~30)
  const categoricals = columns
    .filter((c) => c.type === 'category' && !c.isLikelyId && c.distinctCount >= 2 && c.distinctCount <= 30)
    .sort((a, b) => a.distinctCount - b.distinctCount)

  // 지표로 쓸 숫자 (식별자성 숫자 제외)
  const metrics = columns.filter((c) => c.type === 'number' && !c.isLikelyId)

  // 라벨로 쓸 수 있는 텍스트(제목 등): 짧은 편의 식별자성 텍스트
  const labels = columns
    .filter((c) => (c.type === 'text' || c.type === 'category') && c.distinctCount >= 2)
    .sort((a, b) => a.avgLength - b.avgLength)

  // 1) 카테고리별 건수
  if (categoricals[0]) {
    specs.push(
      makeSpec({
        type: categoricals[0].distinctCount <= 6 ? 'pie' : 'bar',
        title: `${categoricals[0].key} 분포 (건수)`,
        categoryField: categoricals[0].key,
      }),
    )
  }

  // 2) 숫자 지표 분포 (히스토그램)
  if (metrics[0]) {
    specs.push(
      makeSpec({
        type: 'bar',
        title: `${metrics[0].key} 분포 (구간별 건수)`,
        categoryField: metrics[0].key,
        bins: 8,
        sortBy: 'category',
      }),
    )
  }

  // 3) 라벨별 지표 랭킹 (예: 제목별 조회수 Top N) — 행 단위 비교에 유용
  if (labels[0] && metrics[0]) {
    specs.push(
      makeSpec({
        type: 'bar',
        title: `${labels[0].key} 기준 ${metrics[0].key} 상위 ${10}`,
        categoryField: labels[0].key,
        valueField: metrics[0].key,
        aggregation: 'max',
        topN: 10,
        sortBy: 'value-desc',
      }),
    )
  }

  // 4) 카테고리 × 지표 평균 또는 두 번째 카테고리 분포
  if (categoricals[0] && metrics[0]) {
    specs.push(
      makeSpec({
        type: 'bar',
        title: `${categoricals[0].key} 별 ${metrics[0].key} 평균`,
        categoryField: categoricals[0].key,
        valueField: metrics[0].key,
        aggregation: 'avg',
        topN: 12,
        sortBy: 'value-desc',
      }),
    )
  } else if (categoricals[1]) {
    specs.push(
      makeSpec({
        type: 'bar',
        title: `${categoricals[1].key} 분포 (건수)`,
        categoryField: categoricals[1].key,
      }),
    )
  } else if (metrics[1]) {
    specs.push(
      makeSpec({
        type: 'bar',
        title: `${metrics[1].key} 분포 (구간별 건수)`,
        categoryField: metrics[1].key,
        bins: 8,
        sortBy: 'category',
      }),
    )
  }

  // 아무것도 못 만들면 첫 컬럼으로 건수 차트라도 제공
  if (specs.length === 0 && columns[0]) {
    specs.push(makeSpec({ title: `${columns[0].key} 분포 (건수)`, categoryField: columns[0].key }))
  }

  return specs
}

// ───────────────────────────── 데이터 인사이트 계산 ─────────────────────────────

export interface NumericInsight {
  key: string
  count: number
  min: number
  max: number
  mean: number
  median: number
  sum: number
}

export interface CategoryInsight {
  key: string
  distinctCount: number
  top: { name: string; count: number }[]
}

export interface Insights {
  rowCount: number
  totalCount: number
  numeric: NumericInsight[]
  categorical: CategoryInsight[]
}

// 차트 없이도 바로 읽히는 핵심 통계 산출 (클라이언트 계산, 100% 신뢰)
export function computeInsights(dataset: Dataset): Insights {
  const { rows, columns } = dataset

  const numeric: NumericInsight[] = columns
    .filter((c) => c.type === 'number' && !c.isLikelyId && c.numericStats)
    .map((c) => ({
      key: c.key,
      count: rows.length - c.emptyCount,
      min: c.numericStats!.min,
      max: c.numericStats!.max,
      mean: c.numericStats!.mean,
      median: c.numericStats!.median,
      sum: c.numericStats!.sum,
    }))

  const categorical: CategoryInsight[] = columns
    .filter((c) => c.type === 'category' && !c.isLikelyId && c.distinctCount >= 2 && c.distinctCount <= 50)
    .map((c) => {
      const counts = new Map<string, number>()
      for (const r of rows) {
        const v = String(r[c.key] ?? '').trim()
        if (!v) continue
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      const top = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      return { key: c.key, distinctCount: c.distinctCount, top }
    })

  return { rowCount: rows.length, totalCount: dataset.totalCount, numeric, categorical }
}

// 긴 라벨 축약 (차트 축/파이 라벨용)
export function truncateLabel(s: string, max = 14): string {
  const str = String(s)
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ───────────────────────────── AI용 요약 생성 ─────────────────────────────

export function buildDataSummary(dataset: Dataset): string {
  const lines: string[] = []
  lines.push(`서비스명: ${dataset.serviceName}`)
  lines.push(`불러온 행 수: ${dataset.rows.length}개 (전체 ${dataset.totalCount.toLocaleString()}건 중 일부)`)
  lines.push('')
  lines.push('컬럼 목록 및 특성:')
  for (const c of dataset.columns) {
    const tag = c.isLikelyId ? `${c.type}/식별자` : c.type
    let desc = `- ${c.key} [${tag}], 고유값 ${c.distinctCount}개`
    if (c.numericStats) {
      const s = c.numericStats
      desc += `, 최소 ${s.min}, 최대 ${s.max}, 평균 ${s.mean.toFixed(1)}, 중앙값 ${s.median}, 합계 ${s.sum}`
    } else {
      desc += `, 예시: ${c.sampleValues.map((v) => truncateLabel(String(v), 20)).join(' / ')}`
    }
    lines.push(desc)
  }
  lines.push('')
  lines.push('분석 가이드: [식별자] 표시된 컬럼(제목/본문/일련번호 등)은 집계 기준으로 쓰지 말고,')
  lines.push('숫자 지표는 분포/평균/상위값 관점에서, 카테고리는 구성비 관점에서 해석하세요.')
  return lines.join('\n')
}

// ───────────────────────────── 요청 URL 생성 ─────────────────────────────

const OPENAPI_TYPES = ['json', 'xml', 'xls']

// 사용자가 붙여넣은 샘플 URL + 인증키 + 최대 행수 → 실제 호출 URL
// 표준 형식: http://openapi.seoul.go.kr:8088/{인증키}/{TYPE}/{서비스}/{시작}/{끝}/[필터...]
// 예: http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/
//
// 붙여넣은 URL이 표준에서 조금 달라도(키 자리 누락, 타입 누락 등) 동작하도록 보정합니다.
export function buildRequestUrl(sampleUrl: string, apiKey: string, maxRows = 1000): string {
  const trimmed = sampleUrl.trim()
  if (!/openapi\.seoul\.go\.kr:8088\//i.test(trimmed)) {
    throw new Error('서울 열린데이터광장 샘플 URL 형식이 아닙니다. (openapi.seoul.go.kr:8088 포함 필요)')
  }

  const idx = trimmed.indexOf('8088/') + '8088/'.length
  let path = trimmed.slice(idx)
  // 쿼리스트링 제거
  const qIdx = path.indexOf('?')
  if (qIdx >= 0) path = path.slice(0, qIdx)

  // 세그먼트 분리: 각 항목 trim, 빈 세그먼트(중복/후행 슬래시) 제거
  const segs = path
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (segs.length === 0) {
    throw new Error('샘플 URL에서 경로를 추출할 수 없습니다.')
  }

  // 첫 세그먼트가 타입(json/xml/xls)이면 인증키 자리가 누락된 것 → 앞에 키 자리 삽입
  if (OPENAPI_TYPES.includes(segs[0].toLowerCase())) {
    segs.unshift('')
  }

  // 이제 [0]=KEY, [1]=TYPE, [2]=SERVICE, [3]=START, [4]=END, [5...]=필터
  segs[0] = apiKey.trim() // 인증키 치환

  // TYPE 보정: 비었거나 유효 타입이 아니면 json 삽입
  if (!segs[1] || !OPENAPI_TYPES.includes(segs[1].toLowerCase())) {
    segs.splice(1, 0, 'json')
  }

  if (!segs[2]) {
    throw new Error('샘플 URL에서 서비스명을 찾을 수 없습니다.')
  }

  // START / END 를 1 / maxRows 로 강제
  segs[3] = '1'
  segs[4] = String(maxRows)

  return `http://openapi.seoul.go.kr:8088/${segs.join('/')}/`
}

// 인증키를 가린 URL (에러 메시지/디버깅용)
export function redactUrl(url: string, apiKey: string): string {
  if (!apiKey) return url
  return url.split(apiKey).join('***')
}
