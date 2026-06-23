'use client'
// 메인 워크스페이스: 데이터 불러오기 → 자동 시각화 → AI 분석가 대화 + 차트 수정

import { useState } from 'react'
import Link from 'next/link'
import { ChartAction, ChartSpec, Dataset } from '@/lib/types'
import { newChartId, suggestCharts } from '@/lib/analysis'
import { useKeys, KeyGuard } from '@/lib/keys'
import DataLoader from '@/components/DataLoader'
import DynamicChart from '@/components/DynamicChart'
import DataTable from '@/components/DataTable'
import ChatPanel from '@/components/ChatPanel'

export default function HomePage() {
  const { seoulKey, geminiKey } = useKeys()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [charts, setCharts] = useState<ChartSpec[]>([])

  function handleLoaded(ds: Dataset) {
    setDataset(ds)
    setCharts(suggestCharts(ds.columns))
  }

  function updateChart(id: string, spec: ChartSpec) {
    setCharts((cs) => cs.map((c) => (c.id === id ? spec : c)))
  }

  function removeChart(id: string) {
    setCharts((cs) => cs.filter((c) => c.id !== id))
  }

  function addChart() {
    if (!dataset) return
    const firstCat = dataset.columns.find((c) => c.type === 'category') ?? dataset.columns[0]
    setCharts((cs) => [
      ...cs,
      {
        id: newChartId(),
        type: 'bar',
        title: '새 차트',
        categoryField: firstCat?.key ?? '',
        valueField: null,
        aggregation: 'count',
        topN: 12,
        sortBy: 'value-desc',
      },
    ])
  }

  // AI가 보낸 차트 조작 명령 처리
  function handleChartAction(action: ChartAction) {
    const { action: kind, ...spec } = action
    if (kind === 'remove') {
      removeChart(spec.id)
    } else if (kind === 'replace') {
      setCharts((cs) => {
        const exists = cs.some((c) => c.id === spec.id)
        return exists ? cs.map((c) => (c.id === spec.id ? spec : c)) : [...cs, spec]
      })
    } else {
      // add
      setCharts((cs) => [...cs, { ...spec, id: spec.id || newChartId() }])
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-800">📊 서울 공공데이터 AI 분석</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            서울 열린데이터광장 OpenAPI · 자동 시각화 + AI 데이터 분석가
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex gap-1.5 text-xs">
            <span className={`px-2 py-1 rounded-full ${seoulKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              서울키 {seoulKey ? '✓' : '−'}
            </span>
            <span className={`px-2 py-1 rounded-full ${geminiKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              Gemini {geminiKey ? '✓' : '−'}
            </span>
          </span>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
            ⚙️ 설정
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <KeyGuard />

        {!dataset ? (
          <>
            <DataLoader onLoaded={handleLoaded} />
            <HowItWorks />
          </>
        ) : (
          <>
            {/* 요약 + 다시 불러오기 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-4 flex-wrap">
                <SummaryCard label="서비스" value={dataset.serviceName} color="bg-indigo-500" />
                <SummaryCard label="불러온 행" value={dataset.rows.length.toLocaleString()} color="bg-blue-500" />
                <SummaryCard label="전체 건수" value={dataset.totalCount.toLocaleString()} color="bg-green-500" />
                <SummaryCard label="컬럼 수" value={String(dataset.columns.length)} color="bg-orange-500" />
              </div>
              <button
                onClick={() => {
                  setDataset(null)
                  setCharts([])
                }}
                className="text-sm border rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
              >
                ↻ 다른 데이터 불러오기
              </button>
            </div>

            {/* 본문: 좌측 차트/테이블, 우측 AI 채팅 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">📈 자동 생성 차트</h2>
                  <button
                    onClick={addChart}
                    className="text-sm border rounded-lg px-3 py-1.5 text-blue-600 hover:bg-blue-50"
                  >
                    + 차트 추가
                  </button>
                </div>
                {charts.length === 0 ? (
                  <div className="bg-white rounded-xl border p-10 text-center text-gray-400 text-sm">
                    차트가 없습니다. “+ 차트 추가” 또는 AI에게 차트 생성을 요청하세요.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {charts.map((spec) => (
                      <DynamicChart
                        key={spec.id}
                        spec={spec}
                        rows={dataset.rows}
                        columns={dataset.columns}
                        onChange={(s) => updateChart(spec.id, s)}
                        onRemove={() => removeChart(spec.id)}
                      />
                    ))}
                  </div>
                )}

                <DataTable rows={dataset.rows} columns={dataset.columns} />
              </div>

              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24">
                  <ChatPanel dataset={dataset} charts={charts} onChartAction={handleChartAction} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm px-5 py-3">
      <div className={`w-3 h-3 rounded-full ${color} mb-1.5`} />
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800 mt-0.5 break-all">{value}</p>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    ['1', '인증키 입력', '설정에서 서울 OpenAPI 인증키와 Gemini API 키를 입력합니다.'],
    ['2', '샘플 URL · 예제 붙여넣기', '분석할 데이터의 샘플 URL과 예제 응답을 붙여넣습니다.'],
    ['3', '자동 시각화', '컬럼을 자동 분석해 차트와 표를 생성합니다.'],
    ['4', 'AI 분석가와 대화', 'AI에게 질문하고 “~를 차트로 만들어줘”로 그래프를 수정합니다.'],
  ]
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-gray-800 mb-4">이용 방법</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map(([n, t, d]) => (
          <div key={n} className="border rounded-lg p-4">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mb-2">
              {n}
            </div>
            <p className="font-semibold text-sm text-gray-800">{t}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
