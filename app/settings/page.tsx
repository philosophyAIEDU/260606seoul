'use client'
// 설정 페이지: 서울 OpenAPI 인증키 + Gemini API 키 입력·검증·삭제 (/settings)

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKeys } from '@/lib/keys'

export default function SettingsPage() {
  const router = useRouter()
  const { seoulKey, geminiKey, setSeoulKey, setGeminiKey, clearSeoulKey, clearGeminiKey } = useKeys()

  const [seoulInput, setSeoulInput] = useState('')
  const [geminiInput, setGeminiInput] = useState('')
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [geminiError, setGeminiError] = useState('')

  function saveSeoul() {
    if (!seoulInput.trim()) return
    setSeoulKey(seoulInput.trim())
    setSeoulInput('')
  }

  async function verifyGemini() {
    if (!geminiInput.trim()) {
      setGeminiError('API 키를 입력해 주세요.')
      setGeminiStatus('error')
      return
    }
    setGeminiStatus('testing')
    setGeminiError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '안녕' }],
          summary: '테스트',
          columns: [],
          sampleRows: [],
          charts: [],
          geminiKey: geminiInput.trim(),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? '키 검증 실패')
      }
      // 스트림을 끝까지 읽어 검증 완료
      await res.text()
      setGeminiKey(geminiInput.trim())
      setGeminiInput('')
      setGeminiStatus('ok')
    } catch (err: unknown) {
      setGeminiStatus('error')
      setGeminiError(err instanceof Error ? err.message : '키 검증 중 오류가 발생했습니다.')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-lg p-8 space-y-7">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 설정</h1>

        {/* 서울 OpenAPI 인증키 */}
        <section className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">① 서울 OpenAPI 인증키</label>
          <p className="text-xs text-gray-500">
            <a
              href="https://data.seoul.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-600"
            >
              서울 열린데이터광장
            </a>{' '}
            → 인증키 신청에서 발급받은 일반 인증키를 입력하세요.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={seoulInput}
              onChange={(e) => setSeoulInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSeoul()}
              placeholder={seoulKey ? '저장됨 · 새 키 입력 시 덮어쓰기' : '서울 OpenAPI 인증키'}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={saveSeoul}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 rounded-lg text-sm"
            >
              저장
            </button>
          </div>
          {seoulKey && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">✅ 인증키가 저장되어 있습니다.</span>
              <button onClick={clearSeoulKey} className="text-red-500 hover:underline">
                삭제
              </button>
            </div>
          )}
        </section>

        <hr />

        {/* Gemini API 키 */}
        <section className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">② Gemini API 키</label>
          <p className="text-xs text-gray-500">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-600"
            >
              Google AI Studio
            </a>
            에서 발급받은 키를 입력하세요. (텍스트: gemini-3.1-flash-lite / 이미지: gemini-3.1-flash-image)
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={geminiInput}
              onChange={(e) => setGeminiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyGemini()}
              placeholder={geminiKey ? '저장됨 · 새 키 입력 시 덮어쓰기' : 'AIza...'}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={verifyGemini}
              disabled={geminiStatus === 'testing'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 rounded-lg text-sm whitespace-nowrap"
            >
              {geminiStatus === 'testing' ? '확인 중...' : '검증 후 저장'}
            </button>
          </div>
          {geminiStatus === 'ok' && <p className="text-xs text-green-600">✅ 키 검증 완료! 저장되었습니다.</p>}
          {geminiStatus === 'error' && <p className="text-xs text-red-600">❌ {geminiError}</p>}
          {geminiKey && geminiStatus !== 'ok' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-600">✅ Gemini 키가 저장되어 있습니다.</span>
              <button onClick={clearGeminiKey} className="text-red-500 hover:underline">
                삭제
              </button>
            </div>
          )}
        </section>

        {/* 보안 경고 */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-xs text-yellow-800 space-y-1">
          <p className="font-semibold">⚠️ 보안 주의사항</p>
          <p>두 키 모두 서버에 저장되지 않고 이 기기의 브라우저(localStorage)에만 보관됩니다.</p>
          <p className="font-semibold">공용 PC에서는 사용 후 반드시 키를 삭제하세요.</p>
        </div>

        <button onClick={() => router.push('/')} className="text-sm text-gray-500 hover:text-gray-700 underline">
          ← 메인으로 돌아가기
        </button>
      </div>
    </main>
  )
}
