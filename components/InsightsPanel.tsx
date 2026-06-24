'use client'
// 데이터 인사이트 패널: 숫자 지표 통계 + 카테고리 구성비를 바로 읽히게 요약
// (AI 없이 클라이언트에서 계산하므로 항상 정확)

import { useMemo } from 'react'
import { Dataset } from '@/lib/types'
import { computeInsights } from '@/lib/analysis'

interface Props {
  dataset: Dataset
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-'
  const rounded = Math.round(n * 100) / 100
  return rounded.toLocaleString()
}

export default function InsightsPanel({ dataset }: Props) {
  const insights = useMemo(() => computeInsights(dataset), [dataset])

  const hasContent = insights.numeric.length > 0 || insights.categorical.length > 0
  if (!hasContent) return null

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5 space-y-5">
      <h2 className="text-lg font-bold text-gray-800">🔎 데이터 인사이트</h2>

      {insights.numeric.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">숫자 지표 통계</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">지표</th>
                  <th className="px-3 py-2 text-right">건수</th>
                  <th className="px-3 py-2 text-right">최소</th>
                  <th className="px-3 py-2 text-right">평균</th>
                  <th className="px-3 py-2 text-right">중앙값</th>
                  <th className="px-3 py-2 text-right">최대</th>
                  <th className="px-3 py-2 text-right">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {insights.numeric.map((n) => (
                  <tr key={n.key} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{n.key}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(n.count)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(n.min)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">{fmt(n.mean)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(n.median)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(n.max)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(n.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.categorical.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-2">카테고리 구성 (상위 값)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.categorical.map((c) => {
              const total = c.top.reduce((a, t) => a + t.count, 0)
              return (
                <div key={c.key} className="border rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    {c.key} <span className="text-gray-400 font-normal">· {c.distinctCount}종</span>
                  </p>
                  <div className="space-y-1.5">
                    {c.top.map((t) => {
                      const pct = total ? Math.round((t.count / insights.rowCount) * 100) : 0
                      return (
                        <div key={t.name} className="flex items-center gap-2 text-xs">
                          <span className="w-24 truncate text-gray-600" title={t.name}>{t.name}</span>
                          <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                            <div className="bg-blue-400 h-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-14 text-right text-gray-500">{t.count} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
