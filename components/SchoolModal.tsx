'use client'
// 학교 상세 정보 모달 컴포넌트

import { useEffect } from 'react'
import { SchoolInfo } from '@/lib/types'

interface Props {
  school: SchoolInfo
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900 font-medium break-all">{value}</span>
    </div>
  )
}

function formatDate(yyyymmdd: string) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}년 ${yyyymmdd.slice(4, 6)}월 ${yyyymmdd.slice(6, 8)}일`
}

export default function SchoolModal({ school, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const hmpg = school.HMPG_ADDR
    ? (school.HMPG_ADDR.startsWith('http') ? school.HMPG_ADDR : `https://${school.HMPG_ADDR}`)
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{school.SCHL_NM}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{school.ENG_SCHL_NM}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4 mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* 뱃지 */}
        <div className="px-6 pt-4 flex gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{school.SCHL_KND_NM}</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${school.FNDN_SE === '공립' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {school.FNDN_SE}
          </span>
          {school.CEDU_SE_NM && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">{school.CEDU_SE_NM}</span>
          )}
        </div>

        {/* 상세 정보 */}
        <div className="px-6 py-4">
          <Row label="설립일" value={formatDate(school.FNDN_YMD)} />
          <Row label="교육지원청" value={school.CMPTNC_OGNZ_NM} />
          <Row label="시도교육청" value={school.CTPV_EDUO_NM} />
          <Row label="소재지" value={school.LCTN_NM} />
          <Row label="도로명주소" value={school.ROAD_NM_ADDR} />
          <Row label="상세주소" value={school.DADDR} />
          <Row label="전화번호" value={school.TELNO} />
          <Row label="산업특수학급" value={school.INDST_SPC_CLAS_EXST_YN === 'Y' ? '있음' : school.INDST_SPC_CLAS_EXST_YN === 'N' ? '없음' : ''} />
          <Row label="표준학교코드" value={school.STD_SCHL_CD} />
        </div>

        {/* 홈페이지 버튼 */}
        {hmpg && (
          <div className="px-6 pb-6">
            <a
              href={hmpg}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              🌐 학교 홈페이지 방문
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
