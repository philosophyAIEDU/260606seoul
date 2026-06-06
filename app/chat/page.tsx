'use client'
// AI 채팅 페이지: 필터된 학교 데이터 기반 Gemini 스트리밍 대화

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChatMessage, SchoolInfo } from '@/lib/types'
import { useGeminiKey } from '@/lib/GeminiKeyContext'

const SUGGESTED = [
  '공립 학교는 몇 개인가요?',
  '가장 오래된 학교는 어디인가요?',
  '교육지원청별 학교 분포를 알려주세요',
]

function ChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { geminiKey } = useGeminiKey()

  const [schools, setSchools] = useState<SchoolInfo[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  function buildSummary(rows: SchoolInfo[]) {
    const publicN = rows.filter((s) => s.FNDN_SE === '공립').length
    const privateN = rows.filter((s) => s.FNDN_SE === '사립').length
    return `총 ${rows.length}개교 (공립 ${publicN}, 사립 ${privateN}). ` +
      `학교종류: ${Array.from(new Set(rows.map((s) => s.SCHL_KND_NM))).join(', ')}`
  }

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
    }
  }

  const bannerParts = [
    schoolType || '전체 학교종류',
    establishment || '전체 설립구분',
    district || '전체 교육지원청',
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-gray-700 font-medium hover:text-gray-900">
            ← 메인으로
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-500">현재 분석 중인 데이터</p>
            <p className="text-sm font-semibold text-gray-900">
              {bannerParts.join(' · ')} · {schools.length}개교
            </p>
          </div>
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-700 font-medium hover:text-gray-900 border rounded px-2 py-1"
          >
            대화 초기화
          </button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-16">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-sm font-medium">서울시 학교 데이터에 대해 질문해 보세요!</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white border text-gray-900 rounded-bl-sm shadow-sm'
                }`}
              >
                {m.content}
                {m.role === 'assistant' && streaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 animate-pulse rounded" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 추천 질문 */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <div className="max-w-3xl mx-auto flex gap-2 flex-wrap">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs border rounded-full px-3 py-1.5 text-gray-800 font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="bg-white border-t px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="학교 데이터에 대해 질문하세요..."
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
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-600 font-medium">로딩 중...</div>}>
      <ChatContent />
    </Suspense>
  )
}
