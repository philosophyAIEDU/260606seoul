'use client'
// 범용 데이터 테이블: 임의 컬럼 구조 + 전역 검색 + 정렬 + 페이지네이션

import { useMemo, useState } from 'react'
import { ColumnMeta, DataRow } from '@/lib/types'
import { toNumber } from '@/lib/analysis'

const PAGE_SIZE = 15

interface Props {
  rows: DataRow[]
  columns: ColumnMeta[]
}

export default function DataTable({ rows, columns }: Props) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<string>('')
  const [sortAsc, setSortAsc] = useState(true)

  const keys = columns.map((c) => c.key)

  const filtered = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
  }, [rows, query, keys])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    const numeric = col?.type === 'number'
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (numeric) {
        const na = toNumber(va) ?? 0
        const nb = toNumber(vb) ?? 0
        return sortAsc ? na - nb : nb - na
      }
      return sortAsc
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
  }, [filtered, sortKey, sortAsc, columns])

  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const slice = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(true)
    }
    setPage(1)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700">📋 원본 데이터</h3>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
          placeholder="전체 검색..."
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600 uppercase sticky top-0">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                  title={`${c.type} · 고유값 ${c.distinctCount}`}
                >
                  {c.key}
                  {sortKey === c.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slice.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                    {String(r[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-600">
        <span>
          {total.toLocaleString()}개 중 {total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
          {Math.min(safePage * PAGE_SIZE, total)}번째
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            «
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-3 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            이전
          </button>
          <span className="px-3 py-1">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            다음
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded border disabled:opacity-30 hover:bg-gray-100"
          >
            »
          </button>
        </div>
      </div>
    </div>
  )
}
