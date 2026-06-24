// 루트 레이아웃: KeysProvider로 전체 앱 래핑

import type { Metadata } from 'next'
import './globals.css'
import { KeysProvider } from '@/lib/keys'

export const metadata: Metadata = {
  title: '서울 공공데이터 AI 분석',
  description: '서울 열린데이터광장 OpenAPI를 시각화하고 AI 데이터 분석가와 대화하는 서비스',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <KeysProvider>{children}</KeysProvider>
      </body>
    </html>
  )
}
