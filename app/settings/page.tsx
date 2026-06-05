'use client'
// Gemini API 키 설정 페이지 (/settings)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGeminiKey } from '@/lib/GeminiKeyContext'

export default function SettingsPage() {
  const router = useRouter()
  const { geminiKey, setGeminiKey, clearGeminiKey } = useGeminiKey()

  const [inputKey, setInputKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [hasSavedKey, setHasSavedKey] = useState(false)

  useEffect(() => {
    setHasSavedKey(!!geminiKey)
  }, [geminiKey])

  async function handleVerify() {
    if (!inputKey.trim()) {
      setErrorMsg('API 키를 입력해 주세요.')
      return
    }
    setStatus('testing')
    setErrorMsg('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': inputKey.trim(),
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '안녕' }],
          data: [],
          summary: '테스트',
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? '키 검증 실패')
      }

      setGeminiKey(inputKey.trim())
      setStatus('ok')
      setTimeout(() => router.push('/'), 1200)
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : '키 검증 중 오류가 발생했습니다.')
    }
  }

  function handleDelete() {
    clearGeminiKey()
    setInputKey('')
    setStatus('idle')
    setErrorMsg('')
    setHasSavedKey(false)
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ 설정</h1>

        {/* 서울 공공API 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">서울 공공 API</p>
          <p>서울 열린데이터광장 API 키는 서버에서 자동으로 처리됩니다. 별도 입력이 필요하지 않습니다.</p>
        </div>

        {/* Gemini 키 입력 */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Gemini API 키
          </label>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="AIza..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {hasSavedKey && (
            <p className="text-xs text-green-600">✅ 현재 저장된 키가 있습니다. 새 키를 입력하면 덮어씁니다.</p>
          )}

          {status === 'ok' && (
            <p className="text-xs text-green-600">✅ 키 확인 완료! 메인 페이지로 이동합니다...</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-600">❌ {errorMsg}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={status === 'testing'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {status === 'testing' ? '확인 중...' : '키 확인 및 저장'}
          </button>

          {hasSavedKey && (
            <button
              onClick={handleDelete}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              저장된 키 삭제
            </button>
          )}
        </div>

        {/* 보안 경고 */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-xs text-yellow-800 space-y-1">
          <p className="font-semibold">⚠️ 보안 주의사항</p>
          <p>Gemini API 키는 이 기기의 브라우저에만 저장됩니다.</p>
          <p className="font-semibold">공용 PC에서는 반드시 사용 후 키를 삭제하세요.</p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          ← 메인으로 돌아가기
        </button>
      </div>
    </main>
  )
}
