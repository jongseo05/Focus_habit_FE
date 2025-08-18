"use client"

import React, { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, TrendingUp, Clock } from 'lucide-react'
import { compressFocusData, generateTimeLabels, RealtimeDataBuffer } from '@/lib/utils/dataCompression'

interface FocusDataPoint {
  ts: string
  score: number
  confidence: number
  analysis?: string
}

interface RealtimeFocusChartProps {
  focusScores: FocusDataPoint[]
  className?: string
  maxDisplayPoints?: number
  showTrend?: boolean
}

// 전역 데이터 버퍼 (컴포넌트 리렌더링 시에도 데이터 유지)
let globalDataBuffer: RealtimeDataBuffer<FocusDataPoint> | null = null

export function RealtimeFocusChart({ 
  focusScores = [], 
  className = '', 
  maxDisplayPoints = 30,
  showTrend = true 
}: RealtimeFocusChartProps) {
  const [displayData, setDisplayData] = useState<FocusDataPoint[]>([])
  const [bufferStats, setBufferStats] = useState({ bufferSize: 0, displaySize: 0 })

  // 데이터 버퍼 초기화
  useEffect(() => {
    if (!globalDataBuffer) {
      globalDataBuffer = new RealtimeDataBuffer<FocusDataPoint>(1000, maxDisplayPoints)
    }
  }, [maxDisplayPoints])

  // 새로운 집중도 데이터 처리
  useEffect(() => {
    if (!globalDataBuffer || focusScores.length === 0) return

    // 새로운 데이터 포인트들을 버퍼에 추가
    const latestScore = focusScores[focusScores.length - 1]
    const compressed = globalDataBuffer.addDataPoint(latestScore)
    
    setDisplayData(compressed)
    setBufferStats(globalDataBuffer.getStats())
  }, [focusScores])

  // 차트용 압축된 데이터 계산
  const chartData = useMemo(() => {
    if (displayData.length === 0) return { data: [], labels: [], trend: null }

    // 집중도 특화 압축 적용
    const compressed = compressFocusData(displayData, maxDisplayPoints)
    const labels = generateTimeLabels(compressed, 'duration')
    
    // 트렌드 계산
    let trend = null
    if (showTrend && compressed.length >= 2) {
      const recent = compressed.slice(-5) // 최근 5개 포인트
      const earlier = compressed.slice(-10, -5) // 이전 5개 포인트
      
      if (recent.length > 0 && earlier.length > 0) {
        const recentAvg = recent.reduce((sum, item) => sum + item.score, 0) / recent.length
        const earlierAvg = earlier.reduce((sum, item) => sum + item.score, 0) / earlier.length
        trend = recentAvg - earlierAvg
      }
    }

    return { data: compressed, labels, trend }
  }, [displayData, maxDisplayPoints, showTrend])

  // SVG 차트 그리기
  const renderChart = () => {
    if (chartData.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <div className="text-center">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <div className="text-sm">집중도 데이터 수집 중...</div>
          </div>
        </div>
      )
    }

    const width = 400
    const height = 120
    const padding = { top: 10, right: 20, bottom: 30, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const minScore = Math.min(...chartData.data.map(d => d.score), 0)
    const maxScore = Math.max(...chartData.data.map(d => d.score), 100)
    const scoreRange = maxScore - minScore || 1

    // 점들의 좌표 계산
    const points = chartData.data.map((item, index) => ({
      x: padding.left + (index / (chartData.data.length - 1)) * chartWidth,
      y: padding.top + ((maxScore - item.score) / scoreRange) * chartHeight,
      score: item.score,
      confidence: item.confidence,
      time: chartData.labels[index]
    }))

    // 영역 그래프용 패스 생성
    let areaPath = `M ${padding.left} ${padding.top + chartHeight}`
    
    points.forEach((point, index) => {
      if (index === 0) {
        areaPath += ` L ${point.x} ${point.y}`
      } else {
        // 부드러운 곡선 (베지어 곡선)
        const prevPoint = points[index - 1]
        const cpx = (prevPoint.x + point.x) / 2
        areaPath += ` Q ${cpx} ${prevPoint.y} ${point.x} ${point.y}`
      }
    })
    
    areaPath += ` L ${padding.left + chartWidth} ${padding.top + chartHeight} Z`

    // 선 그래프용 패스 생성
    let linePath = points.length > 0 ? `M ${points[0].x} ${points[0].y}` : ''
    
    points.slice(1).forEach((point, index) => {
      const prevPoint = points[index]
      const cpx = (prevPoint.x + point.x) / 2
      linePath += ` Q ${cpx} ${prevPoint.y} ${point.x} ${point.y}`
    })

    // 집중도에 따른 색상 결정
    const getScoreColor = (score: number) => {
      if (score >= 80) return "#10B981" // green
      if (score >= 60) return "#F59E0B" // yellow
      return "#EF4444" // red
    }

    const latestScore = points[points.length - 1]?.score || 0
    const chartColor = getScoreColor(latestScore)

    return (
      <div className="relative">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          <defs>
            <linearGradient id="focusGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* 배경 격자 */}
          {[20, 40, 60, 80, 100].map((value) => {
            const y = padding.top + ((100 - value) / 100) * chartHeight
            return (
              <g key={value}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
                <text
                  x={padding.left - 5}
                  y={y + 3}
                  textAnchor="end"
                  className="text-xs fill-slate-400"
                >
                  {value}
                </text>
              </g>
            )
          })}

          {/* 영역 그래프 */}
          <path
            d={areaPath}
            fill="url(#focusGradient)"
            stroke="none"
          />

          {/* 선 그래프 */}
          <path
            d={linePath}
            fill="none"
            stroke={chartColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 데이터 포인트 */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3"
                fill={getScoreColor(point.score)}
                stroke="white"
                strokeWidth="1"
                className="transition-all duration-200 hover:r-4"
              />
              
              {/* 호버 시 툴팁 */}
              <title>
                {`시간: ${point.time}, 집중도: ${Math.round(point.score)}%, 신뢰도: ${Math.round(point.confidence * 100)}%`}
              </title>
            </g>
          ))}
        </svg>

        {/* 통계 정보 */}
        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>데이터: {bufferStats.displaySize}/{bufferStats.bufferSize}</span>
            </div>
            
            {chartData.trend !== null && showTrend && (
              <div className="flex items-center gap-1">
                <TrendingUp className={`w-3 h-3 ${chartData.trend > 0 ? 'text-green-500' : 'text-red-500'}`} />
                <span className={chartData.trend > 0 ? 'text-green-600' : 'text-red-600'}>
                  {chartData.trend > 0 ? '+' : ''}{Math.round(chartData.trend)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>실시간 업데이트</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="w-5 h-5 text-blue-500" />
          실시간 집중도
          {chartData.data.length > 0 && (
            <span className="ml-auto text-2xl font-bold">
              {Math.round(chartData.data[chartData.data.length - 1]?.score || 0)}%
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  )
}

export default RealtimeFocusChart
