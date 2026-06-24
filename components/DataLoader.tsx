'use client'
// 데이터 불러오기 패널: 샘플 URL + 예제 응답 입력 → 데이터셋 생성
// - 인증키 + 샘플 URL 있으면 서버 프록시(/api/fetch)로 실데이터 호출 (더 많은 행)
// - 그 외에는 붙여넣은 예제 응답을 직접 파싱

import { useState } from 'react'
import Link from 'next/link'
import { Dataset } from '@/lib/types'
import { buildDataset, parseSeoulResponse } from '@/lib/analysis'
import { useKeys } from '@/lib/keys'

interface Props {
  onLoaded: (dataset: Dataset) => void
}

export default function DataLoader({ onLoaded }: Props) {
  const { seoulKey } = useKeys()
  const [sampleUrl, setSampleUrl] = useState('')
  const [example, setExample] = useState('')
  const [maxRows, setMaxRows] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLoad() {
    setError('')
    setLoading(true)
    try {
      // 1) 인증키 + URL → 실데이터 호출
      if (seoulKey && sampleUrl.trim()) {
        const res = await fetch('/api/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleUrl: sampleUrl.trim(), maxRows, seoulKey }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? '데이터 호출 실패')
        onLoaded(buildDataset(json))
        return
      }

      // 2) 예제 응답 직접 파싱
      if (example.trim()) {
        const parsed = parseSeoulResponse(example.trim())
        if (parsed.rows.length === 0) throw new Error('예제에서 데이터(row)를 찾지 못했습니다.')
        onLoaded(buildDataset(parsed))
        return
      }

      throw new Error('인증키 + 샘플 URL 을 입력하거나, 예제 응답을 붙여넣어 주세요.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">📥 데이터 불러오기</h2>
        <p className="text-xs text-gray-500 mt-1">
          분석하고 싶은 서울 공공데이터의 <b>샘플 URL</b>과 <b>예제 응답</b>을 붙여넣으세요.
        </p>
      </div>

      {!seoulKey && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg text-xs">
          서울 OpenAPI 인증키가 없어 <b>예제 응답 파싱</b>만 가능합니다. 실데이터를 더 많이 불러오려면{' '}
          <Link href="/settings" className="underline font-semibold">설정에서 인증키 입력</Link>.
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-semibold text-gray-700">샘플 URL</label>
        <input
          value={sampleUrl}
          onChange={(e) => setSampleUrl(e.target.value)}
          placeholder="http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <p className="text-xs text-gray-400">
          URL의 <code>(인증키)</code> 부분은 입력한 인증키로 자동 치환되고, 조회 범위는 1~{maxRows}로 확장됩니다.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-gray-700">예제 응답 (선택 · XML 또는 JSON)</label>
        <textarea
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder={'<?xml version="1.0" ...>\n<tbLnOpendataRentV>\n  <row>...</row>\n</tbLnOpendataRentV>'}
          rows={6}
          className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-gray-500 flex items-center gap-2">
          최대 행 수
          <input
            type="number"
            min={1}
            max={1000}
            value={maxRows}
            onChange={(e) => setMaxRows(Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="border rounded px-2 py-1 w-20 text-sm"
          />
          <span className="text-gray-400">(서울 API는 한 번에 최대 1,000건)</span>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          ❌ {error}
        </div>
      )}

      <button
        onClick={handleLoad}
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
      >
        {loading ? '불러오는 중...' : '데이터 불러오기 & 자동 분석'}
      </button>
    </div>
  )
}
