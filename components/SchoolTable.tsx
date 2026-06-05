'use client'
// 학교 정보 테이블 컴포넌트 (정렬 + 페이지네이션)

import { useState } from 'react'
import { SchoolInfo } from '@/lib/types'

const PAGE_SIZE = 20

type SortKey = 'SCHL_NM' | 'FNDN_YMD'

interface Props {
  schools: SchoolInfo[]
}

export default function SchoolTable({ schools }: Props) {
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('SCHL_NM')
  const [sortAsc, setSortAsc] = useState(true)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
    setPage(1)
  }

  const sorted = [...schools].sort((a, b) => {
    const va = a[sortKey] ?? ''
    const vb = b[sortKey] ?? ''
    return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
  })

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ''

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                onClick={() => toggleSort('SCHL_NM')}
              >
                학교명{sortIcon('SCHL_NM')}
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">학교종류</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">설립구분</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">교육지원청</th>
              <th className="px-4 py-3 text-left">도로명주소</th>
              <th className="px-4 py-3 text-left whitespace-nowrap">전화번호</th>
              <th
                className="px-4 py-3 text-left cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                onClick={() => toggleSort('FNDN_YMD')}
              >
                설립일{sortIcon('FNDN_YMD')}
              </th>
              <th className="px-4 py-3 text-left whitespace-nowrap">홈페이지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slice.map((s) => (
              <tr key={s.STD_SCHL_CD} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{s.SCHL_NM}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.SCHL_KND_NM}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    s.FNDN_SE === '공립' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {s.FNDN_SE}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.CMPTNC_OGNZ_NM}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{s.ROAD_NM_ADDR}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.TELNO}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {s.FNDN_YMD ? `${s.FNDN_YMD.slice(0, 4)}.${s.FNDN_YMD.slice(4, 6)}.${s.FNDN_YMD.slice(6, 8)}` : '-'}
                </td>
                <td className="px-4 py-3">
                  {s.HMPG_ADDR ? (
                    <a
                      href={s.HMPG_ADDR.startsWith('http') ? s.HMPG_ADDR : `https://${s.HMPG_ADDR}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline text-xs"
                    >
                      바로가기
                    </a>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
        <span>{total}개 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            이전
          </button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            다음
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            »
          </button>
        </div>
      </div>
    </div>
  )
}
