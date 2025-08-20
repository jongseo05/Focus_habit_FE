'use client'

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface ParticipantFocusData {
  userId: string
  userName: string
  focusHistory: Array<{
    timestamp: number
    score: number
    confidence: number
  }>
  currentScore: number
  isOnline: boolean
}

interface MultiParticipantFocusChartProps {
  participants: ParticipantFocusData[]
  timeRange?: number // 분 단위, 기본값 10분
  sessionStartTime?: number | null // 세션 시작 시간 (timestamp)
  className?: string
}

// 참가자별 색상 배열
const PARTICIPANT_COLORS = [
  '#3B82F6', // 파란색
  '#EF4444', // 빨간색
  '#10B981', // 초록색
  '#F59E0B', // 주황색
  '#8B5CF6', // 보라색
  '#EC4899', // 분홍색
  '#6B7280', // 회색
  '#14B8A6', // 청록색
]

export const MultiParticipantFocusChart = ({ 
  participants, 
  timeRange = 10,
  sessionStartTime,
  className = '' 
}: MultiParticipantFocusChartProps) => {
  
  console.log('🔥 MultiParticipantFocusChart 렌더링 시작:', {
    participantsCount: participants.length,
    participants: participants.map(p => ({ userId: p.userId, userName: p.userName, historyCount: p.focusHistory.length })),
    timeRange,
    sessionStartTime,
    timestamp: new Date().toISOString()
  })
  
  // 실시간 업데이트를 위한 상태
  const [updateTrigger, setUpdateTrigger] = useState(0)
  
  // 15초마다 차트 갱신 (데이터 저장은 5초마다 유지)
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1)
    }, 15000)
    
    return () => clearInterval(interval)
  }, [])

  // 데이터 스무딩 함수 (급격한 변화를 완만하게)
  const smoothData = useCallback((dataPoints: Array<{timestamp: number, score: number, confidence: number}>) => {
    if (dataPoints.length < 3) return dataPoints
    
    const smoothed = [...dataPoints]
    
    // 이동평균 필터 적용 (3점 평균)
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = dataPoints[i - 1].score
      const curr = dataPoints[i].score
      const next = dataPoints[i + 1].score
      
      // 가중 평균 (현재 값에 더 높은 가중치)
      smoothed[i] = {
        ...dataPoints[i],
        score: Math.round((prev * 0.2 + curr * 0.6 + next * 0.2))
      }
    }
    
    return smoothed
  }, [])

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    const now = Date.now()
    
    console.log('📊 차트 데이터 준비 시작:', {
      participantsCount: participants.length,
      timeRange,
      sessionStartTime,
      currentTime: new Date(now).toISOString()
    })
    
    // 세션 시작 시간이 있으면 그것을 기준으로, 없으면 기존 방식 사용
    const startTime = sessionStartTime && sessionStartTime > 0
      ? sessionStartTime 
      : now - (timeRange * 60 * 1000)
      
    console.log('📊 시간 범위 설정:', {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(now).toISOString(),
      rangeMinutes: (now - startTime) / 1000 / 60
    })

    // 시간 축 생성 (5초 간격으로 변경 - 집중도 업데이트 주기와 맞춤)
    const timePoints = []
    for (let t = startTime; t <= now; t += 5000) {
      timePoints.push(t)
    }

    // 참가자별 데이터 처리
    const participantData = participants.map((participant, index) => {
      const color = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]
      
      // 시간 범위 내의 데이터만 필터링하고 시간순 정렬
      const recentData = participant.focusHistory
        .filter(point => point.timestamp >= startTime)
        .sort((a, b) => a.timestamp - b.timestamp)

      // 모든 세션 데이터 사용 (누적 추세 표시)
      const allSessionData = recentData
      
      // 데이터 스무딩 적용 (급격한 변화 완만하게)
      const smoothedData = smoothData(allSessionData)
      
      const dataPoints = smoothedData.map(point => ({
        timestamp: point.timestamp,
        score: point.score,
        confidence: point.confidence
      }))

      return {
        ...participant,
        color,
        dataPoints: dataPoints,
        rawData: allSessionData
      }
    })

    return { timePoints, participantData, startTime, endTime: now }
  }, [participants, timeRange, sessionStartTime, updateTrigger, smoothData])

  // SVG 차트 렌더링
  const renderChart = () => {
    const { timePoints, participantData, startTime, endTime } = chartData
    const width = 1000 // 가로 폭을 200 증가 (800 → 1000)
    const height = 400 // 적당한 높이
    const padding = 60 // 여백

    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // 시간 범위 계산
    const timeRange = endTime - startTime
    
    // 시간 축 라벨 생성 (세션 시간 기반)
    const createTimeLabels = () => {
      const sessionDuration = timeRange / 1000 / 60 // 분 단위
      const labelCount = Math.min(7, Math.max(3, Math.floor(sessionDuration / 2))) // 2분마다 또는 최대 7개
      
      const labels = []
      for (let i = 0; i <= labelCount; i++) {
        const time = startTime + (timeRange * i / labelCount)
        const date = new Date(time)
        const minutes = Math.floor((time - startTime) / 1000 / 60)
        labels.push(`${minutes}분`)
      }
      
      return labels
    }
    
    const timeLabels = createTimeLabels()

    // 데이터가 있는 참가자들만 필터링
    const participantsWithData = participantData.filter(p => p.dataPoints.length > 0)
    
    console.log('📊 차트 데이터 상세 정보:', {
      totalParticipants: participantData.length,
      participantsWithData: participantsWithData.length,
      participantDetails: participantData.map(p => ({
        userId: p.userId,
        userName: p.userName,
        dataPointsCount: p.dataPoints.length,
        hasRecentData: p.dataPoints.some(point => point.timestamp >= startTime - 30000),
        latestTimestamp: p.dataPoints.length > 0 ? new Date(Math.max(...p.dataPoints.map(d => d.timestamp))).toLocaleTimeString() : 'N/A'
      })),
      timeRange: { startTime: new Date(startTime).toLocaleTimeString(), endTime: new Date(endTime).toLocaleTimeString() }
    })
    
    if (participantsWithData.length === 0) {
      return (
        <div className="text-center text-gray-500 py-16">
          <div className="text-lg font-medium mb-2">집중도 데이터 수집 중...</div>
          <div className="text-sm">세션이 진행되면 집중도 차트가 표시됩니다</div>
          <div className="mt-2 text-xs text-blue-600">
            참가자: {participantData.length}명 | 데이터 있는 참가자: {participantsWithData.length}명
          </div>
          <div className="mt-1 text-xs text-gray-400">
            시간 범위: {new Date(startTime).toLocaleTimeString()} ~ {new Date(endTime).toLocaleTimeString()}
          </div>
        </div>
      )
    }

    // 부드러운 곡선을 위한 path 생성 함수
    const createSmoothPath = (points: Array<{x: number, y: number, score: number}>) => {
      if (points.length < 2) return ''
      
      let path = `M ${points[0].x} ${points[0].y}`
      
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const curr = points[i]
        
        // 더 부드러운 곡선을 위한 컨트롤 포인트
        const cp1x = prev.x + (curr.x - prev.x) * 0.4
        const cp1y = prev.y + (curr.y - prev.y) * 0.1
        const cp2x = curr.x - (curr.x - prev.x) * 0.4
        const cp2y = curr.y - (curr.y - prev.y) * 0.1
        
        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`
      }
      
      return path
    }

    return (
      <div className="relative w-full rounded-2xl p-8">
        <svg 
          width="100%" 
          height={height} 
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
        >
          {/* 그라디언트 정의 */}
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#3B82F6" floodOpacity="0.15"/>
            </filter>
          </defs>
          
          {/* 부드러운 격자선 */}
          {[25, 50, 75].map(value => (
              <line 
              key={value}
                x1={padding} 
                y1={padding + chartHeight - (value / 100) * chartHeight}
                x2={width - padding}
                y2={padding + chartHeight - (value / 100) * chartHeight}
              stroke="#E5E7EB"
                strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
              />
          ))}

          {/* Y축 라벨 */}
          {[0, 25, 50, 75, 100].map(value => (
              <text 
              key={value}
              x={padding - 20} 
              y={padding + chartHeight - (value / 100) * chartHeight + 4}
                textAnchor="end"
              fontSize="11"
              fill="#9CA3AF"
              fontFamily="system-ui"
            >
              {value}
              </text>
          ))}

          {/* 참가자별 차트 그리기 */}
          {participantsWithData.map((participant, participantIndex) => {
            // 각 참가자의 포인트 계산 (실제 시간 기반)
            const points = participant.dataPoints.map((point) => {
              const timeProgress = timeRange > 0 ? (point.timestamp - startTime) / timeRange : 0
              const x = padding + timeProgress * chartWidth
              const y = padding + chartHeight - (point.score / 100) * chartHeight
              return { x, y, score: point.score, timestamp: point.timestamp }
            })

            const smoothPath = createSmoothPath(points)
            const areaPath = smoothPath + ` L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`
            
            // 참가자별 색상
            const color = PARTICIPANT_COLORS[participantIndex % PARTICIPANT_COLORS.length]
            const isMainParticipant = participantIndex === 0

            return (
              <g key={participant.userId}>
                {/* 첫 번째 참가자만 영역 채우기 */}
                {isMainParticipant && (
                  <path 
                    d={areaPath}
                    fill="url(#chartGradient)"
                  />
                )}

                {/* 곡선 */}
                <path 
                  d={smoothPath}
                  fill="none"
                  stroke={color}
                  strokeWidth={isMainParticipant ? "4" : "3"}
                  filter={isMainParticipant ? "url(#shadow)" : "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isMainParticipant ? 1 : 0.8}
                />
                
                {/* 투명한 호버 영역 (라인 위에) */}
                <path 
                  d={smoothPath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="10"
                  style={{ cursor: 'pointer' }}
                >
                  <title>
                    {participant.userName} - 평균 집중도: {Math.round(points.reduce((sum, p) => sum + p.score, 0) / points.length) || 0}%
                  </title>
                </path>
              </g>
            )
          })}

          {/* X축 라벨 */}
          {timeLabels.map((label, index) => {
            const x = padding + (index / (timeLabels.length - 1)) * chartWidth
            return (
              <text 
                key={index}
                x={x} 
                y={height - 15}
                textAnchor="middle"
                fontSize="11"
                fill="#9CA3AF"
                fontFamily="system-ui"
              >
                {label}
              </text>
            )
          })}

        </svg>

        {/* 참가자 범례 */}
        {participantsWithData.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-4">
            {participantsWithData.map((participant, index) => {
              const color = PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length]
              const latestScore = participant.dataPoints[participant.dataPoints.length - 1]?.score || 0
              
              return (
                <div key={participant.userId} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-1 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700">
                    {participant.userName} <strong style={{ color }}>{latestScore}%</strong>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* 간단한 통계 */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <div>
            참가자: <strong>{participantsWithData.length}명</strong>
          </div>
          <div>
            총 데이터: <strong>{participantsWithData.reduce((sum, p) => sum + p.dataPoints.length, 0)}개</strong>
          </div>
        </div>

      </div>
    )
  }

  return (
    <Card className={`${className} shadow-lg border-0`}>
      <div className="p-6 pb-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">
          {sessionStartTime ? '실시간 집중도 차트' : '집중도 차트'}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {sessionStartTime ? (
            <>15초마다 차트 갱신 • 5초마다 데이터 수집 • 세션 시작: {new Date(sessionStartTime).toLocaleTimeString()}</>
          ) : (
            '집중 세션을 시작하면 실시간 차트가 나타납니다'
          )}
        </p>
      </div>
      <CardContent className="p-6">
        {participants.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <div className="text-lg font-medium mb-2">참가자 데이터가 없습니다</div>
            <div className="text-sm">세션이 시작되면 집중도 데이터가 표시됩니다</div>
          </div>
        ) : !sessionStartTime ? (
          <div className="text-center py-20">
            <div className="text-xl font-semibold text-gray-800 mb-2">집중 세션을 시작해주세요!</div>
            <div className="text-gray-600">버튼을 눌러 집중도 분석을 시작하면</div>
            <div className="text-gray-600">실시간 차트를 확인할 수 있어요</div>
          </div>
        ) : chartData.participantData.every(p => p.dataPoints.length === 0) ? (
          <div className="text-center text-gray-500 py-16">
            <div className="text-lg font-medium mb-2">집중도 데이터 수집 중...</div>
            <div className="text-sm">5초마다 데이터 수집, 15초마다 차트 업데이트</div>
            <div className="mt-4 text-xs text-blue-600">
              현재 참가자: {participants.length}명
            </div>
          </div>
        ) : (
          renderChart()
        )}
      </CardContent>
    </Card>
  )
}

export default MultiParticipantFocusChart
