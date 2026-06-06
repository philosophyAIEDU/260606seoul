'use client'
// AI 채팅 페이지: 필터된 학교 데이터 기반 Gemini 스트리밍 대화
// 동적 추천 질문, 데이터 현황 패널, 대화 내보내기 포함

import { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChatMessage, SchoolInfo } from '@/lib/types'
import { useGeminiKey } from '@/lib/GeminiKeyContext'

// 현재 데이터 맥락에 맞는 동적 추천 질문 생성
function buildSuggestions(schools: SchoolInfo[], schoolType: string, establishment: string): string[] {
  const base = [
    `공립 학교는 몇 개인가요?`,
    `사립 학교는 몇 개인가요?`,
    `가장 오래된 학교는 어디인가요?`,
    `가장 최근에 설립된 학교는 어디인가요?`,
    `교육지원청별 학교 분포를 알려주세요`,
    `남녀공학 학교와 단성 학교 비율은 어떻게 되나요?`,
    `홈페이지가 없는 학교는 몇 개인가요?`,
    `어느 연대에 학교가 가장 많이 설립됐나요?`,
  ]

  const contextual: string[] = []
  if (!schoolType) contextual.push('초등학교, 중학교, 고등학교 각각 몇 개인가요?')
  if (!establishment) contextual.push('공립과 사립 중 어디가 더 많나요?')
  if (schools.length > 0) {
    const districts = Array.from(new Set(schools.map((s) => s.CMPTNC_OGNZ_NM).filter(Boolean)))
    if (districts.length > 1) {
      contextual.push(`${districts[0]}에는 학교가 몇 개인가요?`)
    }
  }

  return [...contextual, ...base].slice(0, 6)
}

// 대화 내용을 텍스트로 내보내기
function exportChat(messages: ChatMessage[], title: string) {
  const lines = [`# ${title}`, `내보낸 날짜: ${new Date().toLocaleString('ko-KR')}`, '']
  messages.forEach((m) => {
    lines.push(m.role === 'user' ? `[나] ${m.content}` : `[AI] ${m.content}`)
    lines.push('')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AI대화_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// 데이터 현황 패널 컴포넌트
function DataPanel({ schools }: { schools: SchoolInfo[] }) {
  const byType = useMemo(() => {
    const m: Record<string, number> = {}
    schools.forEach((s) => { m[s.SCHL_KND_NM || '기타'] = (m[s.SCHL_KND_NM || '기타'] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [schools])

  const byEst = useMemo(() => {
    const m: Record<string, number> = {}
    schools.forEach((s) => { m[s.FNDN_SE || '기타'] = (m[s.FNDN_SE || '기타'] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [schools])

  const oldest = useMemo(() => {
    const w = schools.filter((s) => s.FNDN_YMD?.length === 8)
    w.sort((a, b) => a.FNDN_YMD.localeCompare(b.FNDN_YMD))
    return w[0]
  }, [schools])

  const withWebsite = schools.filter((s) => s.HMPG_ADDR).length

  if (schools.length === 0) return null

  return (
    <div className="bg-white border-l w-64 flex-shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">분석 데이터 현황</p>
          <p className="text-2xl font-bold text-gray-900">{schools.length}<span className="text-sm font-normal text-gray-500 ml-1">개교</span></p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">학교종류</p>
          <div className="space-y-1.5">
            {byType.map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-xs text-gray-700 mb-0.5">
                  <span>{k}</span><span className="font-semibold">{v}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${(v / schools.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">설립구분</p>
          <div className="space-y-1.5">
            {byEst.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k === '공립' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{k}</span>
                <span className="text-xs font-bold text-gray-900">{v}개교</span>
              </div>
            ))}
          </div>
        </div>

        {oldest && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">가장 오래된 학교</p>
            <p className="text-xs font-bold text-gray-900">{oldest.SCHL_NM}</p>
            <p className="text-xs text-gray-500">{oldest.FNDN_YMD.slice(0,4)}년 설립</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-600 mb-1">홈페이지 보유</p>
          <p className="text-xs text-gray-900">
            <span className="font-bold">{withWebsite}</span>개교 보유 ·{' '}
            <span className="font-bold">{schools.length - withWebsite}</span>개교 미보유
          </p>
        </div>
      </div>
    </div>
  )
}

function buildSummary(rows: SchoolInfo[]) {
  const publicN = rows.filter((s) => s.FNDN_SE === '공립').length
  const privateN = rows.filter((s) => s.FNDN_SE === '사립').length
  return `총 ${rows.length}개교 (공립 ${publicN}, 사립 ${privateN}). ` +
    `학교종류: ${Array.from(new Set(rows.map((s) => s.SCHL_KND_NM))).join(', ')}`
}

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { geminiKey } = useGeminiKey()

  const [schools, setSchools] = useState<SchoolInfo[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const schoolType = searchParams.get('schoolType') || ''
  const establishment = searchParams.get('establishment') || ''
  const district = searchParams.get('district') || ''
  const schoolName = searchParams.get('schoolName') || ''

  useEffect(() => {
    if (!geminiKey) { router.replace('/settings'); return }
    const params = new URLSearchParams()
    if (schoolName) params.set('schoolName', schoolName)
    fetch(`/api/seoul?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        let rows: SchoolInfo[] = d.rows ?? []
        if (schoolType) rows = rows.filter((s) => s.SCHL_KND_NM === schoolType)
        if (establishment) rows = rows.filter((s) => s.FNDN_SE === establishment)
        if (district) rows = rows.filter((s) => s.CMPTNC_OGNZ_NM === district)
        setSchools(rows)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiKey, router, schoolName, schoolType, establishment, district])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const suggestions = useMemo(
    () => buildSuggestions(schools, schoolType, establishment),
    [schools, schoolType, establishment]
  )

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setStreaming(true)
    setMessages([...next, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': geminiKey },
        body: JSON.stringify({ messages: next, data: schools, summary: buildSummary(schools) }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json()
        throw new Error(json.error ?? '응답 오류')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages([...next, { role: 'assistant', content: full }])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      setMessages([...next, { role: 'assistant', content: `❌ ${msg}` }])
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  function handleCopy() {
    const text = messages.map((m) => `${m.role === 'user' ? '[나]' : '[AI]'} ${m.content}`).join('\n\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filterLabel = [
    schoolType || '전체 학교종류',
    establishment || '전체 설립구분',
    district || '전체 교육지원청',
  ].join(' · ')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 헤더 */}
        <header className="bg-white border-b px-4 py-3 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/')} className="text-sm text-gray-700 font-medium hover:text-gray-900">
              ← 메인으로
            </button>
            <div className="text-center flex-1 mx-4">
              <p className="text-xs text-gray-500">현재 분석 중인 데이터</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{filterLabel} · {schools.length}개교</p>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-700 font-medium hover:text-gray-900 border rounded px-2 py-1"
                  >
                    {copied ? '✅ 복사됨' : '📋 복사'}
                  </button>
                  <button
                    onClick={() => exportChat(messages, filterLabel)}
                    className="text-xs text-gray-700 font-medium hover:text-gray-900 border rounded px-2 py-1"
                  >
                    💾 저장
                  </button>
                  <button
                    onClick={() => setMessages([])}
                    className="text-xs text-gray-700 font-medium hover:text-gray-900 border rounded px-2 py-1"
                  >
                    🗑 초기화
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">🤖</p>
                <p className="text-base font-semibold text-gray-800 mb-1">서울시 학교 데이터 분석 도우미</p>
                <p className="text-sm text-gray-500 mb-8">
                  현재 <span className="font-bold text-gray-800">{schools.length}개교</span> 데이터를 분석할 수 있습니다.<br/>
                  아래 추천 질문을 클릭하거나 직접 질문해 보세요.
                </p>

                {/* 추천 질문 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all text-left shadow-sm"
                    >
                      💬 {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-1">
                    🤖
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white border text-gray-900 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {m.content || (streaming && i === messages.length - 1 ? '' : '')}
                  {m.role === 'assistant' && streaming && i === messages.length - 1 && (
                    <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 animate-pulse rounded" />
                  )}
                </div>
              </div>
            ))}

            {/* 대화 중 추가 추천 질문 */}
            {messages.length > 0 && !streaming && messages[messages.length - 1].role === 'assistant' && (
              <div className="flex flex-wrap gap-2 pl-9">
                {suggestions.slice(0, 3).map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-xs border rounded-full px-3 py-1.5 text-gray-700 font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors bg-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="bg-white border-t px-4 py-3 flex-shrink-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
              placeholder={streaming ? 'AI가 답변 중입니다...' : '학교 데이터에 대해 질문하세요...'}
              disabled={streaming}
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              전송
            </button>
          </div>
        </div>
      </div>

      {/* 데이터 현황 패널 (우측 사이드바, 데스크탑만) */}
      <DataPanel schools={schools} />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen text-gray-600 font-medium">
        로딩 중...
      </div>
    }>
      <ChatContent />
    </Suspense>
  )
}
