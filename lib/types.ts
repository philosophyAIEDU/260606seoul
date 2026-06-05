// 서울시 학교 정보 데이터 타입 정의 (neisSchoolInfoJS API 기반)

export interface SchoolInfo {
  STD_SCHL_CD: string        // 표준학교코드 (고유키)
  SCHL_NM: string            // 학교명
  ENG_SCHL_NM: string        // 영문학교명
  SCHL_KND_NM: string        // 학교종류 (초등학교/중학교/고등학교 등)
  FNDN_SE: string            // 설립구분 (공립/사립)
  CMPTNC_OGNZ_NM: string     // 관할 교육지원청
  LCTN_NM: string            // 소재지명
  ROAD_NM_ADDR: string       // 도로명주소
  DADDR: string              // 상세주소
  TELNO: string              // 전화번호
  HMPG_ADDR: string          // 홈페이지 URL
  CEDU_SE_NM: string         // 남녀공학 여부
  FNDN_YMD: string           // 설립일자 (YYYYMMDD)
  INDST_SPC_CLAS_EXST_YN: string  // 산업특수학급 존재 여부 (Y/N)
  CTPV_EDUO_NM: string       // 시도교육청명
  LOAD_DT: string            // 데이터 갱신일자
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FilterState {
  schoolName: string
  schoolType: string
  establishment: string
  district: string
}
