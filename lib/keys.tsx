'use client'
// 서울 OpenAPI 인증키 + Gemini API 키 전역 상태 관리 (React Context + localStorage)
// 두 키 모두 서버에 저장되지 않고 사용자 브라우저에만 보관됩니다.

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import Link from 'next/link'

interface KeysContextType {
  seoulKey: string
  geminiKey: string
  setSeoulKey: (key: string) => void
  setGeminiKey: (key: string) => void
  clearSeoulKey: () => void
  clearGeminiKey: () => void
  loaded: boolean
}

const KeysContext = createContext<KeysContextType>({
  seoulKey: '',
  geminiKey: '',
  setSeoulKey: () => {},
  setGeminiKey: () => {},
  clearSeoulKey: () => {},
  clearGeminiKey: () => {},
  loaded: false,
})

const SEOUL_STORAGE = 'seoulApiKey'
const GEMINI_STORAGE = 'geminiKey'

export function KeysProvider({ children }: { children: ReactNode }) {
  const [seoulKey, setSeoulKeyState] = useState('')
  const [geminiKey, setGeminiKeyState] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setSeoulKeyState(localStorage.getItem(SEOUL_STORAGE) ?? '')
    setGeminiKeyState(localStorage.getItem(GEMINI_STORAGE) ?? '')
    setLoaded(true)
  }, [])

  const setSeoulKey = (key: string) => {
    setSeoulKeyState(key)
    localStorage.setItem(SEOUL_STORAGE, key)
  }
  const setGeminiKey = (key: string) => {
    setGeminiKeyState(key)
    localStorage.setItem(GEMINI_STORAGE, key)
  }
  const clearSeoulKey = () => {
    setSeoulKeyState('')
    localStorage.removeItem(SEOUL_STORAGE)
  }
  const clearGeminiKey = () => {
    setGeminiKeyState('')
    localStorage.removeItem(GEMINI_STORAGE)
  }

  return (
    <KeysContext.Provider
      value={{
        seoulKey,
        geminiKey,
        setSeoulKey,
        setGeminiKey,
        clearSeoulKey,
        clearGeminiKey,
        loaded,
      }}
    >
      {children}
    </KeysContext.Provider>
  )
}

export function useKeys() {
  return useContext(KeysContext)
}

// 키 미설정 안내 배너
export function KeyGuard() {
  const { seoulKey, geminiKey, loaded } = useKeys()
  if (!loaded) return null
  if (seoulKey && geminiKey) return null

  const missing: string[] = []
  if (!seoulKey) missing.push('서울 OpenAPI 인증키')
  if (!geminiKey) missing.push('Gemini API 키')

  return (
    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg flex items-center justify-between gap-3">
      <span className="text-sm">
        💡 {missing.join(', ')}가 필요합니다.{' '}
        <Link href="/settings" className="underline font-semibold hover:text-yellow-900">
          설정에서 입력
        </Link>
        해 주세요.
      </span>
    </div>
  )
}
