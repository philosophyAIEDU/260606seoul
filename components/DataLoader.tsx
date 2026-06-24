'use client'
// 데이터 불러오기 패널
// 방법 A(권장): 인증키 + 샘플 URL → 서버 프록시(/api/fetch)로 전체 데이터 호출 (최대 1,000건)
// 방법 B: 예제 응답 붙여넣기 → 소량 미리보기/오프라인 분석

import { useState } from 'react'
import Link from 'next/link'
import { Dataset } from '@/lib/types'
import { buildDataset, parseSeoulResponse } from '@/lib/analysis'
import { useKeys } from '@/lib/keys'

export interface LoadMeta {
  source: 'live' | 'example'
  requestedMax: number
}

interface Props {
  onLoaded: (dataset: Dataset, meta: LoadMeta) => void
}

export default function DataLoader({ onLoaded }: Props) {
  const { seoulKey } = useKeys()
  const [sampleUrl, setSampleUrl] = useState('')
  const [example, setExample] = useState('')
  const [maxRows, setMaxRows] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debugUrl, setDebugUrl] = useState('')

  const canLive = !!seoulKey && !!sampleUrl.trim()
  const canExample = !!example.trim()

  async function handleLoad() {
    setError('')
    setDebugUrl('')
    setLoading(true)
    try {
      // 방법 A: 인증키 + URL → 전체 데이터 호출
      if (canLive) {
        const res = await fetch('/api/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sampleUrl: sampleUrl.trim(), maxRows, seoulKey }),
        })
        const json = await res.json()
        if (!res.ok) {
          if (json.requestUrl) setDebugUrl(json.requestUrl)
          // 실데이터 호출 실패 시, 예제가 있으면 예제 파싱으로 폴백
          if (canExample) {
            const parsed = parseSeoulResponse(example.trim())
            if (parsed.rows.length > 0) {
              onLoaded(buildDataset(parsed), { source: 'example', requestedMax: maxRows })
              setError(`실데이터 호출 실패(${json.error ?? '오류'}) → 붙여넣은 예제로 분석합니다.`)
              return
            }
          }
          throw new Error(json.error ?? '데이터 호출 실패')
        }
        onLoaded(buildDataset(json), { source: 'live', requestedMax: maxRows })
        return
      }

      // 방법 B: 예제 응답 직접 파싱
      if (canExample) {
        const parsed = parseSeoulResponse(example.trim())
        if (parsed.rows.length === 0) throw new Error('예제에서 데이터(row)를 찾지 못했습니다.')
        onLoaded(buildDataset(parsed), { source: 'example', requestedMax: maxRows })
        return
      }

      if (sampleUrl.trim() && !seoulKey) {
        throw new Error('샘플 URL로 전체 데이터를 불러오려면 먼저 설정에서 인증키를 입력하세요.')
      }
      throw new Error('샘플 URL + 인증키를 입력하거나, 예제 응답을 붙여넣어 주세요.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-800">📥 데이터 불러오기</h2>
        <p className="text-xs text-gray-500 mt-1">
          전체 데이터를 분석하려면 <b>방법 A</b>(샘플 URL + 인증키)를 권장합니다.
        </p>
      </div>

      {/* 방법 A: 전체 데이터 */}
      <div className="border rounded-xl p-4 space-y-2 bg-blue-50/40 border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-blue-800">방법 A · 전체 데이터 (권장)</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              seoulKey ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}
          >
            인증키 {seoulKey ? '저장됨 ✓' : '없음'}
          </span>
        </div>
        {!seoulKey && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg text-xs">
            인증키가 없어 전체 데이터를 불러올 수 없습니다.{' '}
            <Link href="/settings" className="underline font-semibold">설정에서 인증키 입력</Link>
          </div>
        )}
        <label className="text-sm font-semibold text-gray-700">샘플 URL</label>
        <input
          value={sampleUrl}
          onChange={(e) => setSampleUrl(e.target.value)}
          placeholder="http://openapi.seoul.go.kr:8088/(인증키)/xml/tbLnOpendataRentV/1/5/"
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
          <span>
            <code>(인증키)</code>는 자동 치환, 조회 범위는 1~
          </span>
          <input
            type="number"
            min={1}
            max={1000}
            value={maxRows}
            onChange={(e) => setMaxRows(Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="border rounded px-2 py-1 w-20 text-sm"
          />
          <span>로 확장됩니다. (API 1회 최대 1,000건)</span>
        </div>
      </div>

      {/* 방법 B: 예제 */}
      <div className="border rounded-xl p-4 space-y-2">
        <span className="text-sm font-bold text-gray-700">방법 B · 예제 응답으로 미리보기</span>
        <p className="text-xs text-gray-400">
          인증키가 없을 때 사용하세요. 붙여넣은 행(보통 5건 등 소량)만 분석되므로 통계가 제한적입니다.
        </p>
        <textarea
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder={'<?xml version="1.0" ...>\n<tbLnOpendataRentV>\n  <row>...</row>\n</tbLnOpendataRentV>'}
          rows={5}
          className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm space-y-1">
          <p>❌ {error}</p>
          {debugUrl && (
            <p className="text-xs text-red-500 break-all font-mono">실제 호출 URL(키 가림): {debugUrl}</p>
          )}
          {error.includes('ERROR-300') && (
            <p className="text-xs text-red-600">
              👉 샘플 URL이 <code>.../인증키/타입/서비스명/시작/끝/</code> 형식인지, 인증키가 이 데이터셋용으로 발급된 것인지 확인하세요.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleLoad}
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
      >
        {loading
          ? '불러오는 중...'
          : canLive
            ? '전체 데이터 불러오기 & 자동 분석'
            : canExample
              ? '예제로 분석 (소량)'
              : '데이터 불러오기 & 자동 분석'}
      </button>
    </div>
  )
}
