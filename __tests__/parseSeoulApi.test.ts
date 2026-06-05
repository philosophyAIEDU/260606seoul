// lib/parseSeoulApi.ts 단위 테스트: 정상/에러/빈 데이터 케이스

import { parseSeoulApiResponse } from '../lib/parseSeoulApi'

const NORMAL_JSON = {
  neisSchoolInfoJS: {
    list_total_count: 2,
    RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' },
    row: [
      {
        STD_SCHL_CD: 'A001',
        SCHL_NM: '테스트초등학교',
        ENG_SCHL_NM: 'Test Elementary',
        SCHL_KND_NM: '초등학교',
        FNDN_SE: '공립',
        CMPTNC_OGNZ_NM: '서울강남교육지원청',
        LCTN_NM: '서울특별시',
        ROAD_NM_ADDR: '서울시 강남구 테헤란로 1',
        DADDR: '',
        TELNO: '02-1234-5678',
        HMPG_ADDR: 'http://test.kr',
        CEDU_SE_NM: '남녀공학',
        FNDN_YMD: '19800301',
        INDST_SPC_CLAS_EXST_YN: 'N',
        CTPV_EDUO_NM: '서울특별시교육청',
        LOAD_DT: '20240101',
      },
      {
        STD_SCHL_CD: 'A002',
        SCHL_NM: '테스트중학교',
        ENG_SCHL_NM: 'Test Middle',
        SCHL_KND_NM: '중학교',
        FNDN_SE: '사립',
        CMPTNC_OGNZ_NM: '서울강북교육지원청',
        LCTN_NM: '서울특별시',
        ROAD_NM_ADDR: '서울시 강북구 도봉로 1',
        DADDR: '',
        TELNO: '02-9876-5432',
        HMPG_ADDR: '',
        CEDU_SE_NM: '남학교',
        FNDN_YMD: '19950301',
        INDST_SPC_CLAS_EXST_YN: 'N',
        CTPV_EDUO_NM: '서울특별시교육청',
        LOAD_DT: '20240101',
      },
    ],
  },
}

const ERROR_JSON = {
  neisSchoolInfoJS: {
    RESULT: { CODE: 'ERROR-300', MESSAGE: '해당하는 데이터가 없습니다.' },
  },
}

const EMPTY_JSON = {
  neisSchoolInfoJS: {
    list_total_count: 0,
    RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' },
  },
}

const SINGLE_ROW_JSON = {
  neisSchoolInfoJS: {
    list_total_count: 1,
    RESULT: { CODE: 'INFO-000', MESSAGE: '정상 처리되었습니다.' },
    row: {
      STD_SCHL_CD: 'A003',
      SCHL_NM: '단일학교',
      ENG_SCHL_NM: '',
      SCHL_KND_NM: '고등학교',
      FNDN_SE: '공립',
      CMPTNC_OGNZ_NM: '',
      LCTN_NM: '',
      ROAD_NM_ADDR: '',
      DADDR: '',
      TELNO: '',
      HMPG_ADDR: '',
      CEDU_SE_NM: '',
      FNDN_YMD: '',
      INDST_SPC_CLAS_EXST_YN: '',
      CTPV_EDUO_NM: '',
      LOAD_DT: '',
    },
  },
}

describe('parseSeoulApiResponse', () => {
  test('정상 응답: 여러 학교 배열 반환', () => {
    const result = parseSeoulApiResponse(NORMAL_JSON)
    expect(result).toHaveLength(2)
    expect(result[0].SCHL_NM).toBe('테스트초등학교')
    expect(result[1].FNDN_SE).toBe('사립')
  })

  test('정상 응답: 단일 row 객체도 배열로 반환', () => {
    const result = parseSeoulApiResponse(SINGLE_ROW_JSON)
    expect(result).toHaveLength(1)
    expect(result[0].SCHL_NM).toBe('단일학교')
  })

  test('에러 코드 응답: 예외 throw', () => {
    expect(() => parseSeoulApiResponse(ERROR_JSON)).toThrow('API 에러')
    expect(() => parseSeoulApiResponse(ERROR_JSON)).toThrow('ERROR-300')
  })

  test('빈 데이터 응답: 빈 배열 반환', () => {
    const result = parseSeoulApiResponse(EMPTY_JSON)
    expect(result).toEqual([])
  })
})
