'use client'
// Gemini API 키 전역 상태 관리 (React Context + localStorage)

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'

interface GeminiKeyContextType {
  geminiKey: string
  setGeminiKey: (key: string) => void
  clearGeminiKey: () => void
}

const GeminiKeyContext = createContext<GeminiKeyContextType>({
  geminiKey: '',
  setGeminiKey: () => {},
  clearGeminiKey: () => {},
})

export function GeminiKeyProvider({ children }: { children: ReactNode }) {
  const [geminiKey, setGeminiKeyState] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem('geminiKey')
    if (stored) setGeminiKeyState(stored)
  }, [])

  const setGeminiKey = (key: string) => {
    setGeminiKeyState(key)
    localStorage.setItem('geminiKey', key)
  }

  const clearGeminiKey = () => {
    setGeminiKeyState('')
    localStorage.removeItem('geminiKey')
  }

  return (
    <GeminiKeyContext.Provider value={{ geminiKey, setGeminiKey, clearGeminiKey }}>
      {children}
    </GeminiKeyContext.Provider>
  )
}

export function useGeminiKey() {
  return useContext(GeminiKeyContext)
}

// Gemini 키 미설정 시 안내 배너 컴포넌트
export function GeminiKeyGuard() {
  const { geminiKey } = useGeminiKey()
  if (geminiKey) return null

  return (
    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg flex items-center justify-between">
      <span className="text-sm">
        💡 AI 채팅 기능을 사용하려면{' '}
        <Link href="/settings" className="underline font-semibold hover:text-yellow-900">
          /settings 에서 Gemini 키를 입력
        </Link>
        해 주세요.
      </span>
    </div>
  )
}
