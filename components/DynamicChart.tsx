'use client'
// 범용 동적 차트: ChartSpec + 행 데이터로 차트를 렌더링하고, 인라인 편집 지원

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartSpec, ColumnMeta, DataRow, ChartType, Aggregation, SortBy } from '@/lib/types'
import { computeChartData, truncateLabel } from '@/lib/analysis'

const COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6',
  '#eab308', '#ec4899', '#6366f1', '#84cc16', '#06b6d4', '#f43f5e',
]

interface Props {
  spec: ChartSpec
  rows: DataRow[]
  columns: ColumnMeta[]
  onChange: (spec: ChartSpec) => void
  onRemove: () => void
  highlight?: boolean
}

export default function DynamicChart({ spec, rows, columns, onChange, onRemove, highlight }: Props) {
  const [editing, setEditing] = useState(false)
  const data = useMemo(() => computeChartData(rows, spec), [rows, spec])

  const numericFields = columns.filter((c) => c.type === 'number').map((c) => c.key)
  const categoryIsNumeric = columns.find((c) => c.key === spec.categoryField)?.type === 'number'

  function patch(p: Partial<ChartSpec>) {
    onChange({ ...spec, ...p })
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-5 transition-all ${
        highlight ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-gray-700 break-keep">{spec.title}</h3>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-gray-500 hover:text-blue-600 border rounded px-2 py-1"
            title="차트 편집"
          >
            ✏️
          </button>
          <button
            onClick={onRemove}
            className="text-xs text-gray-500 hover:text-red-600 border rounded px-2 py-1"
            title="차트 삭제"
          >
            🗑️
          </button>
        </div>
      </div>

      {editing && (
        <div className="bg-gray-50 border rounded-lg p-3 mb-4 grid grid-cols-2 gap-2 text-xs">
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-gray-500">제목</span>
            <input
              value={spec.title}
              onChange={(e) => patch({ title: e.target.value })}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">차트 종류</span>
            <select
              value={spec.type}
              onChange={(e) => patch({ type: e.target.value as ChartType })}
              className="border rounded px-2 py-1"
            >
              <option value="bar">막대</option>
              <option value="line">선</option>
              <option value="area">영역</option>
              <option value="pie">파이</option>
              <option value="scatter">분산형</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">집계</span>
            <select
              value={spec.aggregation}
              onChange={(e) => patch({ aggregation: e.target.value as Aggregation })}
              className="border rounded px-2 py-1"
            >
              <option value="count">건수</option>
              <option value="sum">합계</option>
              <option value="avg">평균</option>
              <option value="min">최소</option>
              <option value="max">최대</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">기준 필드 (카테고리)</span>
            <select
              value={spec.categoryField}
              onChange={(e) => patch({ categoryField: e.target.value })}
              className="border rounded px-2 py-1"
            >
              {columns.map((c) => (
                <option key={c.key} value={c.key}>{c.key}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">값 필드 (숫자)</span>
            <select
              value={spec.valueField ?? ''}
              onChange={(e) => patch({ valueField: e.target.value || null })}
              disabled={spec.aggregation === 'count'}
              className="border rounded px-2 py-1 disabled:bg-gray-100"
            >
              <option value="">(건수)</option>
              {numericFields.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">상위 N개 (0=전체)</span>
            <input
              type="number"
              min={0}
              value={spec.topN}
              onChange={(e) => patch({ topN: parseInt(e.target.value, 10) || 0 })}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-gray-500">정렬</span>
            <select
              value={spec.sortBy}
              onChange={(e) => patch({ sortBy: e.target.value as SortBy })}
              className="border rounded px-2 py-1"
            >
              <option value="value-desc">값 내림차순</option>
              <option value="value-asc">값 오름차순</option>
              <option value="category">이름순</option>
            </select>
          </label>
          {categoryIsNumeric && (
            <label className="col-span-2 flex flex-col gap-1">
              <span className="text-gray-500">구간(히스토그램) 개수 · 0이면 끔</span>
              <input
                type="number"
                min={0}
                max={30}
                value={spec.bins ?? 0}
                onChange={(e) => patch({ bins: parseInt(e.target.value, 10) || 0 })}
                className="border rounded px-2 py-1"
              />
            </label>
          )}
        </div>
      )}

      {data.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
          표시할 데이터가 없습니다. (필드/집계 설정을 확인하세요)
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {renderChart(spec.type, data)}
        </ResponsiveContainer>
      )}
    </div>
  )
}

function renderChart(type: ChartType, data: { name: string; value: number }[]) {
  const margin = { top: 5, right: 10, left: -10, bottom: 60 }

  if (type === 'pie') {
    return (
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ name, percent }) => `${truncateLabel(String(name), 8)} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    )
  }

  if (type === 'line') {
    return (
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} tickFormatter={(v) => truncateLabel(v)} height={70} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    )
  }

  if (type === 'area') {
    return (
      <AreaChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} tickFormatter={(v) => truncateLabel(v)} height={70} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#93c5fd" />
      </AreaChart>
    )
  }

  if (type === 'scatter') {
    return (
      <ScatterChart margin={margin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} tickFormatter={(v) => truncateLabel(v)} height={70} />
        <YAxis dataKey="value" tick={{ fontSize: 11 }} />
        <Tooltip />
        <Scatter data={data} fill="#3b82f6" />
      </ScatterChart>
    )
  }

  // bar (기본)
  return (
    <BarChart data={data} margin={margin}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
        {data.map((_, i) => (
          <Cell key={i} fill={COLORS[i % COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  )
}
