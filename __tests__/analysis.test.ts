// lib/analysis.ts 단위 테스트: 범용 파싱 / 컬럼 추론 / 차트 집계 / URL 생성

import {
  parseSeoulResponse,
  inferColumns,
  computeChartData,
  suggestCharts,
  buildRequestUrl,
  toNumber,
} from '../lib/analysis'
import { ChartSpec } from '../lib/types'

// 임의 서비스명(tbLnOpendataRentV)의 전월세가 정보 형태 응답
const RENT_JSON = {
  tbLnOpendataRentV: {
    list_total_count: 3,
    RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' },
    row: [
      { RCPT_YR: '2026', CGG_NM: '서대문구', RENT_SE: '전세', RENT_GTN: '30000', RENT_AREA: '59.8' },
      { RCPT_YR: '2026', CGG_NM: '강남구', RENT_SE: '월세', RENT_GTN: '10000', RENT_AREA: '84.2' },
      { RCPT_YR: '2026', CGG_NM: '강남구', RENT_SE: '전세', RENT_GTN: '50000', RENT_AREA: '101.5' },
    ],
  },
}

const ERROR_JSON = {
  tbLnOpendataRentV: {
    RESULT: { CODE: 'ERROR-300', MESSAGE: '해당하는 데이터가 없습니다.' },
  },
}

const SINGLE_ROW_JSON = {
  someService: {
    list_total_count: 1,
    RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' },
    row: { A: '1', B: '서울' },
  },
}

const XML_STRING = `<?xml version="1.0" encoding="UTF-8"?>
<tbLnOpendataRentV>
<list_total_count>2</list_total_count>
<RESULT><CODE>INFO-000</CODE><MESSAGE>정상 처리되었습니다.</MESSAGE></RESULT>
<row><CGG_NM>마포구</CGG_NM><RENT_GTN>20000</RENT_GTN></row>
<row><CGG_NM>종로구</CGG_NM><RENT_GTN>40000</RENT_GTN></row>
</tbLnOpendataRentV>`

describe('parseSeoulResponse', () => {
  test('임의 서비스명 JSON을 파싱한다', () => {
    const r = parseSeoulResponse(RENT_JSON)
    expect(r.serviceName).toBe('tbLnOpendataRentV')
    expect(r.rows).toHaveLength(3)
    expect(r.totalCount).toBe(3)
    expect(r.rows[0].CGG_NM).toBe('서대문구')
  })

  test('단일 row 객체도 배열로 반환한다', () => {
    const r = parseSeoulResponse(SINGLE_ROW_JSON)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].B).toBe('서울')
  })

  test('에러 코드 응답은 예외를 던진다', () => {
    expect(() => parseSeoulResponse(ERROR_JSON)).toThrow('ERROR-300')
  })

  test('XML 문자열을 파싱한다', () => {
    const r = parseSeoulResponse(XML_STRING)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[1].CGG_NM).toBe('종로구')
  })
})

describe('inferColumns', () => {
  test('숫자/카테고리 컬럼을 구분한다', () => {
    const cols = inferColumns(parseSeoulResponse(RENT_JSON).rows)
    const gtn = cols.find((c) => c.key === 'RENT_GTN')
    const cgg = cols.find((c) => c.key === 'CGG_NM')
    expect(gtn?.type).toBe('number')
    expect(gtn?.numericStats?.sum).toBe(90000)
    expect(cgg?.type).toBe('category')
    expect(cgg?.distinctCount).toBe(2)
  })

  test('긴 자유텍스트/고유 식별자는 카테고리가 아닌 text로 분류', () => {
    const rows = [
      { N_SEQ: '1', N_TITLE: '환경 미화원의 1,000원 세상을 따뜻하게 하다', N_VIEW: '282' },
      { N_SEQ: '2', N_TITLE: '혼동하기 쉬운 물가용어 알아보기(소비자물가지수, 생활물가지수)', N_VIEW: '19' },
      { N_SEQ: '3', N_TITLE: '허준 박물관 개관 7주년을 맞이하여 기념행사를 개최합니다', N_VIEW: '366' },
      { N_SEQ: '4', N_TITLE: '함께 걸어요 (3월 24일)', N_VIEW: '297' },
      { N_SEQ: '5', N_TITLE: '학교 밖 청소년들 서울로7017에서 일일장터 연다', N_VIEW: '281' },
    ]
    const cols = inferColumns(rows)
    const title = cols.find((c) => c.key === 'N_TITLE')
    const seq = cols.find((c) => c.key === 'N_SEQ')
    const view = cols.find((c) => c.key === 'N_VIEW')
    expect(title?.type).toBe('text') // 카테고리로 쓰이면 안 됨
    expect(seq?.isLikelyId).toBe(true) // 일련번호는 식별자
    expect(view?.type).toBe('number')
  })
})

describe('suggestCharts', () => {
  test('식별자/자유텍스트를 카테고리 축으로 쓰지 않는다', () => {
    const rows = [
      { N_SEQ: '1', N_TITLE: '환경 미화원의 1,000원 세상을 따뜻하게 하다', N_VIEW: '282' },
      { N_SEQ: '2', N_TITLE: '혼동하기 쉬운 물가용어 알아보기', N_VIEW: '19' },
      { N_SEQ: '3', N_TITLE: '허준 박물관 개관 7주년 기념행사', N_VIEW: '366' },
      { N_SEQ: '4', N_TITLE: '함께 걸어요', N_VIEW: '297' },
      { N_SEQ: '5', N_TITLE: '학교 밖 청소년 일일장터', N_VIEW: '281' },
    ]
    const cols = inferColumns(rows)
    const specs = suggestCharts(cols)
    expect(specs.length).toBeGreaterThan(0)
    // count 집계의 categoryField로 식별자가 쓰이면 안 됨
    const badCount = specs.find(
      (s) => s.aggregation === 'count' && !s.bins && (s.categoryField === 'N_SEQ' || s.categoryField === 'N_TITLE'),
    )
    expect(badCount).toBeUndefined()
    // 숫자 분포(히스토그램) 차트가 포함되어야 함
    expect(specs.some((s) => (s.bins ?? 0) > 0)).toBe(true)
  })
})

describe('computeChartData', () => {
  const rows = parseSeoulResponse(RENT_JSON).rows

  test('카테고리별 건수 집계', () => {
    const spec: ChartSpec = {
      id: 't', type: 'bar', title: '', categoryField: 'CGG_NM',
      valueField: null, aggregation: 'count', topN: 0, sortBy: 'value-desc',
    }
    const data = computeChartData(rows, spec)
    expect(data.find((d) => d.name === '강남구')?.value).toBe(2)
    expect(data.find((d) => d.name === '서대문구')?.value).toBe(1)
  })

  test('카테고리별 합계 집계', () => {
    const spec: ChartSpec = {
      id: 't', type: 'bar', title: '', categoryField: 'CGG_NM',
      valueField: 'RENT_GTN', aggregation: 'sum', topN: 0, sortBy: 'value-desc',
    }
    const data = computeChartData(rows, spec)
    expect(data.find((d) => d.name === '강남구')?.value).toBe(60000)
  })

  test('topN 제한', () => {
    const spec: ChartSpec = {
      id: 't', type: 'bar', title: '', categoryField: 'CGG_NM',
      valueField: null, aggregation: 'count', topN: 1, sortBy: 'value-desc',
    }
    expect(computeChartData(rows, spec)).toHaveLength(1)
  })
})

describe('toNumber', () => {
  test('쉼표 포함 숫자 파싱', () => {
    expect(toNumber('1,234')).toBe(1234)
    expect(toNumber('12.5')).toBe(12.5)
    expect(toNumber('abc')).toBeNull()
    expect(toNumber('')).toBeNull()
  })
})

describe('buildRequestUrl', () => {
  test('인증키 치환 및 범위 확장', () => {
    const url = buildRequestUrl(
      'http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/',
      'MYKEY',
      1000,
    )
    expect(url).toBe('http://openapi.seoul.go.kr:8088/MYKEY/xml/tbLnOpendataRentV/1/1000/')
  })

  test('후행 슬래시 없는 URL도 처리', () => {
    const url = buildRequestUrl(
      'http://openapi.seoul.go.kr:8088/(인증키)/json/tbLnOpendataRentV/1/5',
      'MYKEY',
      500,
    )
    expect(url).toBe('http://openapi.seoul.go.kr:8088/MYKEY/json/tbLnOpendataRentV/1/500/')
  })

  test('인증키 자리가 누락된 URL 보정', () => {
    const url = buildRequestUrl(
      'http://openapi.seoul.go.kr:8088/xml/tbLnOpendataRentV/1/5/',
      'MYKEY',
      1000,
    )
    expect(url).toBe('http://openapi.seoul.go.kr:8088/MYKEY/xml/tbLnOpendataRentV/1/1000/')
  })

  test('필터 파라미터 보존', () => {
    const url = buildRequestUrl(
      'http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/2026/',
      'MYKEY',
      1000,
    )
    expect(url).toBe('http://openapi.seoul.go.kr:8088/MYKEY/xml/tbLnOpendataRentV/1/1000/2026/')
  })

  test('서울 API URL이 아니면 예외', () => {
    expect(() => buildRequestUrl('http://example.com/foo', 'K')).toThrow()
  })
})
