'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Users, Activity, Maximize2, Minimize2 } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import type { ParticipantWithUser } from '@/types/social'

interface FocusScoreChartProps {
  participants: ParticipantWithUser[]
  currentUserId?: string
}

interface ChartDataPoint {
  timestamp: number
  time: string
  [key: string]: number | string
}

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="text-sm flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full inline-block" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium">{entry.name}:</span>
            <span className="font-bold">{entry.value}점</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function FocusScoreChart({ participants, currentUserId }: FocusScoreChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const participantsRef = useRef(participants)
  const isInitializedRef = useRef(false)

  // 색상 팔레트 (참가자별 고유 색상)
  const getParticipantColor = (userId: string, index: number) => {
    const colors = [
      '#3B82F6', // blue-500
      '#EF4444', // red-500
      '#10B981', // emerald-500
      '#F59E0B', // amber-500
      '#8B5CF6', // violet-500
      '#F97316', // orange-500
      '#06B6D4', // cyan-500
      '#84CC16', // lime-500
      '#EC4899', // pink-500
      '#6366F1', // indigo-500
    ]
    return colors[index % colors.length]
  }

  // 차트 데이터 생성 함수
  const generateChartData = () => {
    const now = Date.now()
    const data: ChartDataPoint[] = []
    const currentParticipants = participantsRef.current
    
    // 최근 30개 데이터 포인트 생성 (3초 간격)
    for (let i = 29; i >= 0; i--) {
      const timestamp = now - (i * 3000)
      const time = new Date(timestamp).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
      
      const dataPoint: ChartDataPoint = {
        timestamp,
        time
      }
      
      currentParticipants.forEach(participant => {
        const key = participant.user.name
        // 실제 데이터가 있으면 사용, 없으면 기본값 50
        if (participant.current_focus_score !== null && participant.current_focus_score !== undefined) {
          dataPoint[key] = participant.current_focus_score
        } else {
          // 기본 집중도 (중간값)
          dataPoint[key] = 50
        }
      })
      
      data.push(dataPoint)
    }
    
    return data
  }

  // 초기 차트 데이터 설정
  useEffect(() => {
    if (!isInitializedRef.current && participants.length > 0) {
      setChartData(generateChartData())
      isInitializedRef.current = true
    }
  }, [participants.length])

  // participants ref 업데이트
  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  // 차트 데이터 업데이트 (3초마다)
  useEffect(() => {
    if (participants.length === 0) return

    // 초기 데이터 설정
    if (chartData.length === 0) {
      setChartData(generateChartData())
    }
    
    // 3초마다 새로운 데이터 포인트 추가
    intervalRef.current = setInterval(() => {
      setChartData(prev => {
        if (prev.length === 0) return prev
        
        const newDataPoint: ChartDataPoint = {
          timestamp: Date.now(),
          time: new Date().toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          })
        }
        
        const currentParticipants = participantsRef.current
        currentParticipants.forEach(participant => {
          const key = participant.user.name
          if (participant.current_focus_score !== null && participant.current_focus_score !== undefined) {
            newDataPoint[key] = participant.current_focus_score
          } else {
            // 기본 집중도 (중간값)
            newDataPoint[key] = 50
          }
        })
        
        // 최근 30개 데이터 포인트만 유지
        const updatedData = [...prev.slice(1), newDataPoint]
        return updatedData
      })
    }, 3000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [participants.length, chartData.length])

  // 참가자 목록이 변경되었을 때 차트 데이터 재생성
  useEffect(() => {
    if (chartData.length > 0 && participants.length > 0) {
      // 새로운 참가자가 추가되었는지 확인
      const currentNames = new Set(
        chartData[0] ? Object.keys(chartData[0]).filter(key => key !== 'timestamp' && key !== 'time') : []
      )
      const newNames = new Set(participants.map(p => p.user.name))
      
      // 참가자 목록이 변경되었을 때만 차트 데이터 재생성
      if (currentNames.size !== newNames.size || 
          !Array.from(currentNames).every(name => newNames.has(name))) {
        setChartData(generateChartData())
      }
    }
  }, [participants.length])

  // 평균 집중도 계산
  const averageFocusScore = useMemo(() => {
    if (participants.length === 0) return 0
    
    const totalScore = participants.reduce((sum, participant) => {
      return sum + (participant.current_focus_score || 0)
    }, 0)
    
    return Math.round(totalScore / participants.length)
  }, [participants])

  // 최고 집중도 참가자
  const topPerformer = useMemo(() => {
    if (participants.length === 0) return null
    
    return participants.reduce((top, participant) => {
      const currentScore = participant.current_focus_score || 0
      const topScore = top?.current_focus_score || 0
      return currentScore > topScore ? participant : top
    })
  }, [participants])

  // 차트 높이 계산
  const chartHeight = isExpanded ? 400 : 300

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  return (
    <Card className="bg-white/80 backdrop-blur-sm w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            실시간 집중도 차트
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {participants.length}명
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              평균 {averageFocusScore}점
            </Badge>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              {isExpanded ? '축소' : '확장'}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 차트 */}
          <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value, index) => {
                    // 6개마다 시간 표시 (3초 간격이므로 18초마다)
                    return index % 6 === 0 ? value : ''
                  }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* 집중도 라인 차트 */}
                {participants.map((participant, participantIndex) => {
                  const color = getParticipantColor(participant.user_id, participantIndex)
                  const isCurrentUser = participant.user_id === currentUserId
                   
                  return (
                    <Line
                      key={participant.user_id}
                      type="monotone"
                      dataKey={participant.user.name}
                      stroke={color}
                      strokeWidth={isCurrentUser ? 3 : 2}
                      dot={{ r: isCurrentUser ? 4 : 3, fill: color }}
                      activeDot={{ r: isCurrentUser ? 6 : 5, fill: color }}
                      name={`${participant.user.name}${isCurrentUser ? ' (나)' : ''}`}
                      isAnimationActive={false}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* 범례 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {participants.map((participant, index) => {
              const color = getParticipantColor(participant.user_id, index)
              const isCurrentUser = participant.user_id === currentUserId
              const currentScore = participant.current_focus_score || 0
               
              return (
                <div
                  key={participant.user_id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className={`text-sm font-medium ${
                    isCurrentUser ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {participant.user.name}
                    {isCurrentUser && ' (나)'}
                  </span>
                  <Badge 
                    variant={currentScore >= 80 ? 'default' : currentScore >= 60 ? 'secondary' : 'destructive'}
                    className="ml-auto text-xs"
                  >
                    {currentScore}점
                  </Badge>
                </div>
              )
            })}
          </div>
          
          {/* 통계 요약 */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{averageFocusScore}</div>
              <div className="text-xs text-gray-500">평균 집중도</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {topPerformer ? topPerformer.current_focus_score || 0 : 0}
              </div>
              <div className="text-xs text-gray-500">
                최고 집중도
                {topPerformer && (
                  <div className="text-green-700 font-medium">
                    {topPerformer.user.name}
                  </div>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {participants.filter(p => (p.current_focus_score || 0) >= 80).length}
              </div>
              <div className="text-xs text-gray-500">고집중 참가자</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
