// 루트 레이아웃: GeminiKeyProvider로 전체 앱 래핑

import type { Metadata } from 'next'
import './globals.css'
import { GeminiKeyProvider } from '@/lib/GeminiKeyContext'

export const metadata: Metadata = {
  title: '서울시 학교 정보',
  description: '서울 열린데이터광장 학교 정보 검색 및 AI 분석 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <GeminiKeyProvider>
          {children}
        </GeminiKeyProvider>
      </body>
    </html>
  )
}
