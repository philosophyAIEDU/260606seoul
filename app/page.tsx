'use client'
// 메인 조회 페이지: 서울시 학교 정보 검색·시각화 및 AI 채팅 연계

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SchoolInfo, FilterState } from '@/lib/types'
import { useGeminiKey, GeminiKeyGuard } from '@/lib/GeminiKeyContext'
import SchoolCharts from '@/components/SchoolCharts'
import SchoolTable from '@/components/SchoolTable'
import SchoolModal from '@/components/SchoolModal'

const INIT_FILTER: FilterState = { schoolName: '', schoolType: '', establishment: '', district: '' }

const SELECT_CLS = 'border rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

function downloadCSV(schools: SchoolInfo[]) {
  const headers = ['학교명', '학교종류', '설립구분', '교육지원청', '도로명주소', '전화번호', '홈페이지', '설립일']
  const rows = schools.map((s) => [
    s.SCHL_NM, s.SCHL_KND_NM, s.FNDN_SE, s.CMPTNC_OGNZ_NM,
    s.ROAD_NM_ADDR, s.TELNO, s.HMPG_ADDR,
    s.FNDN_YMD ? `${s.FNDN_YMD.slice(0,4)}-${s.FNDN_YMD.slice(4,6)}-${s.FNDN_YMD.slice(6,8)}` : '',
  ].map((v) => `"${(v ?? '').replace(/"/g, '""')}"`))

  const csv = '﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `서울시학교정보_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function HomePage() {
  const router = useRouter()
  const { geminiKey } = useGeminiKey()

  const [allSchools, setAllSchools] = useState<SchoolInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterState>(INIT_FILTER)
  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(null)

  useEffect(() => {
    fetch('/api/seoul')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setAllSchools(d.rows ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const districts = useMemo(() => {
    const set = new Set(allSchools.map((s) => s.CMPTNC_OGNZ_NM).filter(Boolean))
    return Array.from(set).sort()
  }, [allSchools])

  const filtered = useMemo(() => {
    return allSchools.filter((s) => {
      if (filter.schoolName && !s.SCHL_NM.includes(filter.schoolName)) return false
      if (filter.schoolType && s.SCHL_KND_NM !== filter.schoolType) return false
      if (filter.establishment && s.FNDN_SE !== filter.establishment) return false
      if (filter.district && s.CMPTNC_OGNZ_NM !== filter.district) return false
      return true
    })
  }, [allSchools, filter])

  const publicCount = allSchools.filter((s) => s.FNDN_SE === '공립').length
  const privateCount = allSchools.filter((s) => s.FNDN_SE === '사립').length

  function handleChatClick() {
    if (!geminiKey) { router.push('/settings'); return }
    const params = new URLSearchParams({
      schoolType: filter.schoolType,
      establishment: filter.establishment,
      district: filter.district,
      schoolName: filter.schoolName,
    })
    router.push(`/chat?${params.toString()}`)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800">🏫 서울시 학교 정보</h1>
          <p className="text-xs text-gray-500 mt-0.5">서울 열린데이터광장 · neisSchoolInfoJS</p>
        </div>
        <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-1.5">
          ⚙️ 설정
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <GeminiKeyGuard />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-gray-600">데이터 불러오는 중...</span>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            ❌ 오류: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '전체 학교', value: allSchools.length, color: 'bg-blue-500' },
                { label: '공립', value: publicCount, color: 'bg-green-500' },
                { label: '사립', value: privateCount, color: 'bg-orange-500' },
                { label: '검색 결과', value: filtered.length, color: 'bg-purple-500' },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-xl border shadow-sm p-5">
                  <div className={`w-3 h-3 rounded-full ${c.color} mb-2`} />
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{c.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* 필터 영역 */}
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="학교명 검색"
                  value={filter.schoolName}
                  onChange={(e) => setFilter((f) => ({ ...f, schoolName: e.target.value }))}
                  className={SELECT_CLS}
                />
                <select
                  value={filter.schoolType}
                  onChange={(e) => setFilter((f) => ({ ...f, schoolType: e.target.value }))}
                  className={SELECT_CLS}
                >
                  <option value="">학교종류 전체</option>
                  <option>초등학교</option>
                  <option>중학교</option>
                  <option>고등학교</option>
                  <option>특수학교</option>
                </select>
                <select
                  value={filter.establishment}
                  onChange={(e) => setFilter((f) => ({ ...f, establishment: e.target.value }))}
                  className={SELECT_CLS}
                >
                  <option value="">설립구분 전체</option>
                  <option>공립</option>
                  <option>사립</option>
                </select>
                <select
                  value={filter.district}
                  onChange={(e) => setFilter((f) => ({ ...f, district: e.target.value }))}
                  className={SELECT_CLS}
                >
                  <option value="">교육지원청 전체</option>
                  {districts.map((d) => <option key={d}>{d}</option>)}
                </select>
                <button
                  onClick={() => setFilter(INIT_FILTER)}
                  className="border rounded-lg px-3 py-2 text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  필터 초기화
                </button>
              </div>
            </div>

            {/* 차트 */}
            <SchoolCharts schools={filtered} />

            {/* 버튼 행 */}
            <div className="flex justify-between items-center flex-wrap gap-3">
              <button
                onClick={() => downloadCSV(filtered)}
                className="flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold px-5 py-2.5 rounded-xl text-sm shadow-sm transition-colors"
              >
                📥 CSV 내보내기 ({filtered.length}개교)
              </button>
              <button
                onClick={handleChatClick}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-xl shadow-md transition-all text-sm"
              >
                🤖 이 데이터로 AI에게 물어보기 ({filtered.length}개교)
              </button>
            </div>

            {/* 테이블 */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
                검색 결과가 없습니다.
              </div>
            ) : (
              <SchoolTable schools={filtered} onRowClick={setSelectedSchool} />
            )}
          </>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedSchool && (
        <SchoolModal school={selectedSchool} onClose={() => setSelectedSchool(null)} />
      )}
    </main>
  )
}
