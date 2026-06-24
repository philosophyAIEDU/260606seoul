'use client'
// AI 데이터 분석가 채팅 패널
// - gemini-3.1-flash-lite 로 데이터 기반 대화 (스트리밍)
// - 응답 속 ```chart-spec``` 블록을 파싱해 차트를 추가/수정/삭제
// - gemini-3.1-flash-image 로 인포그래픽 이미지 생성

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChartAction, ChartSpec, ChatMessage, Dataset } from '@/lib/types'
import { buildDataSummary, newChartId } from '@/lib/analysis'
import { useKeys } from '@/lib/keys'

interface Props {
  dataset: Dataset
  charts: ChartSpec[]
  onChartAction: (action: ChartAction) => void
}

const CHART_SPEC_RE = /```chart-spec\s*([\s\S]*?)```/g

// 응답 텍스트에서 chart-spec 블록을 추출
function extractChartActions(text: string): ChartAction[] {
  const actions: ChartAction[] = []
  let m: RegExpExecArray | null
  CHART_SPEC_RE.lastIndex = 0
  while ((m = CHART_SPEC_RE.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim())
      const action = (obj.action ?? 'add') as ChartAction['action']
      actions.push({
        action,
        id: obj.id || newChartId(),
        type: obj.type ?? 'bar',
        title: obj.title ?? '새 차트',
        categoryField: obj.categoryField ?? '',
        valueField: obj.valueField ?? null,
        aggregation: obj.aggregation ?? 'count',
        topN: typeof obj.topN === 'number' ? obj.topN : 12,
        sortBy: obj.sortBy ?? 'value-desc',
      })
    } catch {
      // 잘못된 JSON 블록은 무시
    }
  }
  return actions
}

// 표시용: chart-spec 블록 제거
function stripChartSpecs(text: string): string {
  return text.replace(CHART_SPEC_RE, '').replace(/\n{3,}/g, '\n\n').trim()
}

const SUGGESTED = [
  '이 데이터의 핵심 인사이트 3가지를 수치 근거와 함께 알려줘',
  '가장 의미 있는 패턴을 찾아 차트로 만들어줘',
  '상위/하위 항목과 이상치를 짚어줘',
]

export default function ChatPanel({ dataset, charts, onChartAction }: Props) {
  const { geminiKey } = useKeys()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // charts 최신값을 클로저에서 참조하기 위한 ref
  const chartsRef = useRef(charts)
  chartsRef.current = charts

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return
    if (!geminiKey) return

    const userMsg: ChatMessage = { role: 'user', content: text.trim() }
    const next = [...messages, userMsg]
    setMessages([...next, { role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          summary: buildDataSummary(dataset),
          columns: dataset.columns.map((c) => ({ key: c.key, type: c.type })),
          sampleRows: dataset.rows.slice(0, 30),
          charts: chartsRef.current,
          geminiKey,
        }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '응답 오류')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        const display = stripChartSpecs(full)
        setMessages([...next, { role: 'assistant', content: display }])
      }

      // 스트림 완료 후 chart-spec 적용
      const actions = extractChartActions(full)
      actions.forEach(onChartAction)
      const cleaned = stripChartSpecs(full)
      const note = actions.length
        ? `${cleaned}\n\n📊 차트 ${actions.length}개를 반영했습니다.`
        : cleaned
      setMessages([...next, { role: 'assistant', content: note }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      setMessages([...next, { role: 'assistant', content: `❌ ${msg}` }])
    } finally {
      setStreaming(false)
    }
  }

  async function generateImage() {
    if (imgLoading || streaming || !geminiKey) return
    setImgLoading(true)
    const placeholder: ChatMessage = { role: 'assistant', content: '🖼️ 인포그래픽 이미지를 생성 중입니다...' }
    setMessages((m) => [...m, placeholder])

    const prompt = `Create a clean, modern Korean data infographic poster summarizing this Seoul public dataset.
Use clear titles, simple icons, and a professional color palette. Make it visually appealing.
Dataset summary:\n${buildDataSummary(dataset)}`

    try {
      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, geminiKey }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '이미지 생성 실패')
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'assistant', content: json.note || '인포그래픽 이미지를 생성했습니다.', image: json.image },
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '이미지 생성 오류'
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: `❌ ${msg}` }])
    } finally {
      setImgLoading(false)
    }
  }

  if (!geminiKey) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-sm text-gray-500">
        🤖 AI 데이터 분석가를 사용하려면{' '}
        <Link href="/settings" className="underline text-blue-600 font-semibold">
          설정에서 Gemini 키
        </Link>
        를 입력하세요.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[640px]">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">🤖 AI 데이터 분석가</h3>
        <div className="flex gap-1">
          <button
            onClick={generateImage}
            disabled={imgLoading || streaming}
            className="text-xs border rounded px-2 py-1 text-purple-600 hover:bg-purple-50 disabled:opacity-40"
            title="gemini-3.1-flash-image 로 인포그래픽 생성"
          >
            🖼️ 이미지
          </button>
          <button
            onClick={() => setMessages([])}
            className="text-xs border rounded px-2 py-1 text-gray-500 hover:bg-gray-50"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">
            <p className="text-3xl mb-2">💬</p>
            데이터에 대해 질문하거나
            <br />
            “~를 차트로 만들어줘”라고 요청해 보세요.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-50 border text-gray-800 rounded-bl-sm'
              }`}
            >
              {m.content}
              {m.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="생성된 인포그래픽" className="mt-2 rounded-lg border max-w-full" />
              )}
              {m.role === 'assistant' && streaming && i === messages.length - 1 && !m.content && (
                <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse rounded" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs border rounded-full px-2.5 py-1 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="border-t px-3 py-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder="질문하거나 차트 수정을 요청하세요..."
          disabled={streaming}
          className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-xl text-sm font-semibold"
        >
          전송
        </button>
      </div>
    </div>
  )
}
