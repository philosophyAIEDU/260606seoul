// 범용 서울 공공데이터 분석 도구 타입 정의

// API 응답의 한 행 (임의의 컬럼 구조)
export type DataRow = Record<string, string | number>

// 컬럼 추론 타입
export type ColumnType = 'number' | 'date' | 'category' | 'text'

// 컬럼 메타데이터 (자동 추론 결과)
export interface ColumnMeta {
  key: string
  type: ColumnType
  distinctCount: number
  emptyCount: number
  sampleValues: (string | number)[]
  numericStats?: {
    min: number
    max: number
    mean: number
    sum: number
  }
}

// 불러온 데이터셋 전체
export interface Dataset {
  serviceName: string // OpenAPI 서비스명 (예: tbLnOpendataRentV)
  rows: DataRow[]
  totalCount: number // list_total_count (전체 데이터 건수)
  columns: ColumnMeta[]
}

// 차트 종류
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter'

// 집계 방식
export type Aggregation = 'count' | 'sum' | 'avg' | 'min' | 'max'

// 정렬 방식
export type SortBy = 'value-desc' | 'value-asc' | 'category'

// 차트 명세 (자동 생성 / AI 수정 / 사용자 수정 공통)
export interface ChartSpec {
  id: string
  type: ChartType
  title: string
  categoryField: string // x축 / 그룹 기준 필드
  valueField: string | null // 집계 대상 필드 (null이면 건수 count)
  aggregation: Aggregation
  topN: number // 상위 N개 카테고리만 표시 (0이면 전체)
  sortBy: SortBy
}

// AI가 채팅 중 내보내는 차트 조작 명령
export interface ChartAction extends ChartSpec {
  action: 'add' | 'replace' | 'remove'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  image?: string // base64 data URL (이미지 생성 결과)
}
