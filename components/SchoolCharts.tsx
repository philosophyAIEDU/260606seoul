'use client'
// 학교 데이터 시각화 차트 컴포넌트 (교육지원청별 BarChart + 설립구분 PieChart + 설립연도 추이 LineChart)

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { SchoolInfo } from '@/lib/types'

const PIE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6']

interface Props {
  schools: SchoolInfo[]
}

export default function SchoolCharts({ schools }: Props) {
  // 교육지원청별 학교 수
  const districtMap: Record<string, number> = {}
  schools.forEach((s) => {
    const d = s.CMPTNC_OGNZ_NM || '미상'
    districtMap[d] = (districtMap[d] ?? 0) + 1
  })
  const barData = Object.entries(districtMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // 공립 vs 사립
  const estMap: Record<string, number> = {}
  schools.forEach((s) => {
    const e = s.FNDN_SE || '기타'
    estMap[e] = (estMap[e] ?? 0) + 1
  })
  const pieData = Object.entries(estMap).map(([name, value]) => ({ name, value }))

  // 연대별 설립 추이 (10년 단위)
  const decadeMap: Record<string, number> = {}
  schools.forEach((s) => {
    if (!s.FNDN_YMD || s.FNDN_YMD.length < 4) return
    const year = parseInt(s.FNDN_YMD.slice(0, 4))
    if (isNaN(year) || year < 1900 || year > 2030) return
    const decade = `${Math.floor(year / 10) * 10}년대`
    decadeMap[decade] = (decadeMap[decade] ?? 0) + 1
  })
  const trendData = Object.entries(decadeMap)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade))

  if (schools.length === 0) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 교육지원청별 BarChart */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">교육지원청별 학교 수</h3>
          <p className="text-xs text-gray-500 mb-4">각 교육지원청 관할 학교 현황</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} angle={-40} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#374151' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, color: '#111827' }}
                formatter={(v) => [`${v}개교`, '학교 수']}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="학교 수" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 공립/사립 PieChart */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">설립구분 비율</h3>
          <p className="text-xs text-gray-500 mb-4">공립 · 사립 학교 비율</p>
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
                labelLine={true}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: '#111827' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, color: '#111827' }}
                formatter={(v) => [`${v}개교`]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 연대별 설립 추이 LineChart */}
      {trendData.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">연대별 학교 설립 추이</h3>
          <p className="text-xs text-gray-500 mb-4">10년 단위로 몇 개 학교가 설립되었는지 보여줍니다</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="decade" tick={{ fontSize: 11, fill: '#374151' }} />
              <YAxis tick={{ fontSize: 11, fill: '#374151' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, color: '#111827' }}
                formatter={(v) => [`${v}개교`, '설립 학교 수']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ fill: '#8b5cf6', r: 5 }}
                activeDot={{ r: 7 }}
                name="설립 학교 수"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
