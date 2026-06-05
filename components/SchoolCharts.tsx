'use client'
// 학교 데이터 시각화 차트 컴포넌트 (BarChart + PieChart)

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { SchoolInfo } from '@/lib/types'

const PIE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6']

interface Props {
  schools: SchoolInfo[]
}

export default function SchoolCharts({ schools }: Props) {
  // 교육지원청별 학교 수 집계
  const districtMap: Record<string, number> = {}
  schools.forEach((s) => {
    const d = s.CMPTNC_OGNZ_NM || '미상'
    districtMap[d] = (districtMap[d] ?? 0) + 1
  })
  const barData = Object.entries(districtMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 공립 vs 사립 집계
  const estMap: Record<string, number> = {}
  schools.forEach((s) => {
    const e = s.FNDN_SE || '기타'
    estMap[e] = (estMap[e] ?? 0) + 1
  })
  const pieData = Object.entries(estMap).map(([name, value]) => ({ name, value }))

  if (schools.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 교육지원청별 BarChart */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">교육지원청별 학교 수</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="학교 수" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 공립/사립 PieChart */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="text-sm font-semibold text-gray-600 mb-4">설립구분 비율</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip formatter={(v) => `${v}개교`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
