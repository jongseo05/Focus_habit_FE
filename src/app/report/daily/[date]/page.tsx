"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Download,
  Share2,
  Zap,
  ChevronRight,
  Trophy,
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  Brain,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useDailyReport as useDailyReportQuery } from '@/hooks/useReport'

// Mock data for demonstration - 24시간 타임라인
const mockFocusScorePoints = Array.from({ length: 24 }, (_, i) => {
  const hour = i
  const timestamp = new Date(`2024-01-15T${hour.toString().padStart(2, '0')}:00:00`).toISOString()
  
  // Generate realistic focus score pattern for 24-hour day
  let baseScore = 70
  if (hour < 6) baseScore = 30 // 새벽 시간대
  else if (hour >= 6 && hour < 9) baseScore = 60 // 아침 시작
  else if (hour >= 9 && hour < 12) baseScore = 85 // 오전 최고 집중
  else if (hour >= 12 && hour < 14) baseScore = 50 // 점심 시간
  else if (hour >= 14 && hour < 18) baseScore = 80 // 오후 집중
  else if (hour >= 18 && hour < 22) baseScore = 65 // 저녁 시간
  else baseScore = 40 // 밤 시간
  
  const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 20))
  
  const events: any[] = []
  if (hour === 16 && Math.random() < 0.7) events.push('phone') // 오후 4시 휴대폰 사용
  if (hour === 18 && Math.random() < 0.6) events.push('break') // 오후 6시 휴식
  if (hour === 21 && Math.random() < 0.5) events.push('break') // 오후 9시 휴식
  if (score > 85) events.push('focus') // 높은 집중도
  
  return {
    ts: timestamp,
    score: Math.round(score),
    events
  }
})

// 하이라이트 데이터
const mockHighlights = {
  totalFocusTime: {
    time: "2:34",
    goalProgress: 64,
    weekTrend: 12
  },
  averageFocus: {
    score: 87,
    grade: "우수",
    sessionImprovement: 5
  },
  distractions: {
    count: 3,
    mainCause: "휴대폰",
    details: [
      { name: "휴대폰 확인", count: 2 },
      { name: "자세 변화", count: 1 }
    ],
    yesterdayChange: -2
  }
}

// Circular Progress Component (dashboard에서 가져옴)
const CircularProgress = ({
  value,
  max,
  color = "#3B82F6",
  size = 40,
  strokeWidth = 4,
  showValue = true,
}: {
  value: number
  max: number
  color?: string
  size?: number
  strokeWidth?: number
  showValue?: boolean
}) => {
  const [animatedValue, setAnimatedValue] = useState(0)
  const percentage = (value / max) * 100
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(percentage), 100)
    return () => clearTimeout(timer)
  }, [percentage])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold" style={{ color }}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  )
}

// Animated Line Chart Component (dashboard에서 가져옴)
const AnimatedLineChart = ({
  data,
  color = "#3B82F6",
  gradientId,
  height = 32,
}: {
  data: number[]
  color?: string
  gradientId: string
  height?: number
}) => {
  const [pathLength, setPathLength] = useState(0)
  const pathRef = useRef<SVGPathElement>(null)

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => ({
    x: (index / (data.length - 1)) * 100,
    y: height - ((value - min) / range) * (height - 4),
  }))

  const pathData = points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const prevPoint = points[index - 1]
    const cpx1 = prevPoint.x + (point.x - prevPoint.x) / 3
    const cpx2 = point.x - (point.x - prevPoint.x) / 3
    return `${path} C ${cpx1} ${prevPoint.y} ${cpx2} ${point.y} ${point.x} ${point.y}`
  }, "")

  const areaPath = `${pathData} L 100 ${height} L 0 ${height} Z`

  useEffect(() => {
    if (pathRef.current) {
      const length = pathRef.current.getTotalLength()
      setPathLength(length)
    }
  }, [pathData])

  return (
    <div className="relative">
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Line */}
        <motion.path
          ref={pathRef}
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ strokeDasharray: pathLength, strokeDashoffset: pathLength }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
        />

        {/* Data points */}
        {points.map((point, index) => (
          <motion.circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2"
            fill={color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.8 + index * 0.1 }}
            className="drop-shadow-sm"
          />
        ))}
      </svg>
    </div>
  )
}

// Mini Bar Chart Component (dashboard에서 가져옴)
const MiniBarChart = ({ data, color = "#3B82F6", label }: { data: number[]; color?: string; label: string }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const max = Math.max(...data)

  return (
    <div className="relative">
      <div className="flex items-end gap-1 h-8 mb-2">
        {data.map((value, index) => (
          <div
            key={index}
            className="flex-1 relative group cursor-pointer"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(value / max) * 100}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="w-full rounded-t-sm transition-all duration-200"
              style={{
                background:
                  hoveredIndex === index
                    ? `linear-gradient(to top, ${color}, ${color}dd)`
                    : `linear-gradient(to top, ${color}88, ${color}cc)`,
                minHeight: "2px",
              }}
            />

            {/* Tooltip */}
            <AnimatePresence>
              {hoveredIndex === index && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.8 }}
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10"
                >
                  <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {label}: {value.toFixed(1)}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-slate-900" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

// Pulse Indicator Component (dashboard에서 가져옴)
const PulseIndicator = ({
  count,
  color = "#F59E0B",
  size = 8,
}: {
  count: number
  color?: string
  size?: number
}) => {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
        <motion.div
          key={index}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            opacity: 0.7 + index * 0.1,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.2,
          }}
        />
      ))}
      {count > 5 && <span className="text-xs text-slate-500 ml-1">+{count - 5}</span>}
    </div>
  )
}

const mockActivities = [
  {
    timestamp: "00:23:15",
    action: "깊은 집중 유지",
    type: "positive" as const,
    impact: 8,
    description: "25분간 방해 없이 지속적인 주의 집중",
  },
  {
    timestamp: "00:18:32",
    action: "휴대폰 사용",
    type: "negative" as const,
    impact: -5,
    description: "집중 세션 중 짧은 휴대폰 확인",
  },
  {
    timestamp: "00:12:08",
    action: "자세 교정",
    type: "positive" as const,
    impact: 3,
    description: "앉은 자세 개선 감지",
  },
  {
    timestamp: "00:05:45",
    action: "세션 시작",
    type: "neutral" as const,
    impact: 0,
    description: "집중 세션 시작",
  },
]

const mockEvidenceSnapshots = [
  {
    id: "1",
    timestamp: "00:23:15",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 95,
    notes: "최고 집중 순간 - 우수한 자세와 주의력",
    type: "high_focus" as const,
  },
  {
    id: "2",
    timestamp: "00:18:32",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 65,
    notes: "휴대폰 방해 요소 감지",
    type: "distraction" as const,
  },
  {
    id: "3",
    timestamp: "00:12:08",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 80,
    notes: "휴식 후 좋은 회복",
    type: "break" as const,
  },
]

const mockAchievements = [
  {
    id: "1",
    title: "집중력 마스터",
    description: "7일 연속 90점 이상 집중 점수 유지",
    progress: 5,
    target: 7,
    completed: false,
    badge: "🎯",
    category: "focus" as const,
  },
  {
    id: "2",
    title: "일관성 챔피언",
    description: "30일간 매일 집중 세션 완료",
    progress: 30,
    target: 30,
    completed: true,
    badge: "🏆",
    category: "consistency" as const,
  },
  {
    id: "3",
    title: "방해 요소 제거자",
    description: "휴대폰 사용량 50% 감소",
    progress: 35,
    target: 50,
    completed: false,
    badge: "📱",
    category: "improvement" as const,
  },
]

// Timeline Card Component
const TimelineCard = ({ data }: { data: any[] }) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)



  // 안전한 데이터 처리
  if (!data || data.length === 0) {
    return (
      <Card className="rounded-2xl bg-white shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <BarChart3 className="w-6 h-6 text-purple-500" />
            일일 집중력 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    )
  }

  // 유효한 score 값만 필터링
  const validData = data.filter(d => d && typeof d.score === 'number' && !isNaN(d.score))
  
  if (validData.length === 0) {
    return (
      <Card className="rounded-2xl bg-white shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <BarChart3 className="w-6 h-6 text-purple-500" />
            일일 집중력 추이
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            유효한 집중도 데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxScore = Math.max(...validData.map((d) => d.score))
  const minScore = Math.min(...validData.map((d) => d.score))
  const avgScore = Math.round(validData.reduce((sum, d) => sum + d.score, 0) / validData.length)

  // Generate smooth curve points
  const generateSmoothPath = (data: any[], width: number, height: number) => {
    // 안전장치: maxScore와 minScore가 같으면 기본값 사용
    const safeMaxScore = maxScore === minScore ? 100 : maxScore
    const safeMinScore = maxScore === minScore ? 0 : minScore
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((item.score - safeMinScore) / (safeMaxScore - safeMinScore)) * height
      return { x, y }
    })

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`
    }

    return { path, points }
  }

  // 스마트 데이터 샘플링
  const getSampledData = (data: any[], maxPoints: number = 50) => {
    if (data.length <= maxPoints) return data
    
    const step = Math.ceil(data.length / maxPoints)
    const sampled = []
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i])
    }
    
    // 마지막 포인트는 항상 포함
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1])
    }
    
    return sampled
  }
  
  // 세션 길이에 따른 샘플링 전략
  const sessionDurationMinutes = validData.length * 5 // 5분 간격 가정
  let maxDisplayPoints = 50
  
  if (sessionDurationMinutes <= 60) {
    maxDisplayPoints = 30 // 60분 이하: 30개 포인트 (2분마다)
  } else if (sessionDurationMinutes <= 180) {
    maxDisplayPoints = 40 // 3시간 이하: 40개 포인트 (4.5분마다)
  } else {
    maxDisplayPoints = 50 // 3시간 초과: 50개 포인트 (6분마다)
  }
  
  const sampledData = getSampledData(validData, maxDisplayPoints)
  console.log(`📊 데이터 샘플링: ${validData.length}개 → ${sampledData.length}개 (${sessionDurationMinutes}분 세션)`)
  
  const chartWidth = 1200
  const chartHeight = 200
  const { path, points } = generateSmoothPath(sampledData, chartWidth, chartHeight)

  const getEventIcon = (events: string[]) => {
    if (events.includes('phone')) return '📱'
    if (events.includes('break')) return '⏸️'
    if (events.includes('focus')) return '🎯'
    return null
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-emerald-500"
    if (score >= 60) return "from-blue-400 to-blue-500"
    return "from-orange-400 to-orange-500"
  }

  return (
    <Card className="rounded-2xl bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <BarChart3 className="w-6 h-6 text-purple-500" />
          일일 집중력 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100">
          <svg
            width="100%"
            height="280"
            viewBox={`0 0 ${chartWidth + 80} ${chartHeight + 60}`}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Y-axis labels */}
            {[100, 75, 50, 25, 0].map((value, index) => (
              <g key={value}>
                <text x="30" y={20 + (index * chartHeight) / 4 + 5} textAnchor="end" className="text-xs fill-slate-400">
                  {value}
                </text>
                <line
                  x1="35"
                  y1={20 + (index * chartHeight) / 4}
                  x2={chartWidth + 40}
                  y2={20 + (index * chartHeight) / 4}
                  stroke="#E2E8F0"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              </g>
            ))}

            {/* Chart area/line */}
            <g transform="translate(40, 20)">
              <path
                d={`${path} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#blueGradient)"
                className="transition-all duration-500"
              />

              <path
                d={path}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-500"
              />

              {/* Data points */}
              {points.map((point, index) => {
                const dataPoint = sampledData[index]
                const isHovered = hoveredPoint === index
                const eventIcon = getEventIcon(dataPoint.events)

                return (
                  <g key={index}>
                    {/* Hover area */}
                    <rect
                      x={point.x - 20}
                      y={0}
                      width="40"
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPoint(index)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />

                    {/* Data point */}
                    <circle
                      cx={point.x || 0}
                      cy={point.y || 0}
                      r={isHovered ? 6 : 4}
                      fill="white"
                      stroke={dataPoint.score >= 80 ? "#10B981" : dataPoint.score >= 60 ? "#3B82F6" : "#F59E0B"}
                      strokeWidth="3"
                      className="transition-all duration-200 drop-shadow-sm"
                    />

                    {/* Event icon */}
                    {eventIcon && (
                      <g>
                        <circle
                          cx={point.x || 0}
                          cy={(point.y || 0) - 20}
                          r="12"
                          fill="#EBF8FF"
                          stroke="#3B82F6"
                          strokeWidth="1"
                        />
                        <text
                          x={point.x || 0}
                          y={(point.y || 0) - 16}
                          textAnchor="middle"
                          className="text-xs"
                          fontSize="10"
                        >
                          {eventIcon}
                        </text>
                      </g>
                    )}

                    {/* Hover highlight */}
                    {isHovered && (
                      <circle
                        cx={point.x || 0}
                        cy={point.y || 0}
                        r="12"
                        fill={dataPoint.score >= 80 ? "#10B981" : dataPoint.score >= 60 ? "#3B82F6" : "#F59E0B"}
                        fillOpacity="0.1"
                        className="animate-pulse"
                      />
                    )}
                  </g>
                )
              })}
            </g>

            {/* X-axis labels - 스마트 라벨링 */}
            {sampledData.filter((_, index) => {
              // 라벨 개수를 제한하여 겹치지 않도록 함
              const totalLabels = Math.min(8, sampledData.length)
              const step = Math.max(1, Math.floor(sampledData.length / totalLabels))
              return index % step === 0 || index === sampledData.length - 1
            }).map((dataPoint, index) => {
              const originalIndex = sampledData.findIndex(d => d === dataPoint)
              const timestamp = new Date(dataPoint.ts)
              const timeString = timestamp.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })
              
              return (
                <text
                  key={index}
                  x={40 + (originalIndex / (sampledData.length - 1)) * chartWidth}
                  y={chartHeight + 45}
                  textAnchor="middle"
                  className="text-xs fill-slate-600 font-medium"
                >
                  {timeString}
                </text>
              )
            })}
          </svg>

          {/* Chart insights */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="text-lg font-bold text-emerald-600">
                {maxScore}점
              </div>
              <div className="text-xs text-emerald-700">일일 최고점</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-lg font-bold text-blue-600">
                {avgScore}점
              </div>
              <div className="text-xs text-blue-700">일일 평균</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-lg font-bold text-purple-600">
                24시간
              </div>
              <div className="text-xs text-purple-700">분석 기간</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Highlight Cards Component (dashboard 스타일로 변경)
const HighlightCards = ({ highlights }: { highlights: any }) => {
  // 안전장치: highlights가 없으면 기본값 사용
  if (!highlights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-100 rounded-2xl text-center text-slate-500">
          하이라이트 데이터가 없습니다.
        </div>
      </div>
    )
  }
  
  // 안전한 데이터 접근
  const totalFocusTime = highlights.totalFocusTime || { time: "0:00", goalProgress: 0, weekTrend: 0 }
  const averageFocus = highlights.averageFocus || { score: 0, grade: "보통", sessionImprovement: 0 }
  const distractions = highlights.distractions || { count: 0, mainCause: "없음", details: [], yesterdayChange: 0 }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Total Focus Time */}
      <motion.div
        className="relative p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-3xl font-bold text-blue-600 mb-1">{totalFocusTime.time}</div>
            <div className="text-sm font-medium text-blue-700">총 집중 시간</div>
          </div>
          <div className="flex items-center gap-2">
            <CircularProgress value={154} max={240} color="#3B82F6" size={64} strokeWidth={6} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600">목표 대비</span>
            <span className="font-semibold text-blue-700">{totalFocusTime.goalProgress}%</span>
          </div>

          <div className="h-10 flex items-end gap-1">
            {[2.1, 2.3, 2.2, 2.4, 2.6, 2.8, 2.9].map((value, index) => (
              <motion.div
                key={index}
                initial={{ height: 0 }}
                animate={{ height: `${(value / 2.9) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex-1 rounded-t-sm transition-all duration-200"
                style={{
                  background: `linear-gradient(to top, #3B82F688, #3B82F6cc)`,
                  minHeight: "2px",
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-blue-600">
            <span>지난 7일 추이</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+{totalFocusTime.weekTrend}%</span>
            </div>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.div>

      {/* Average Focus Score */}
      <motion.div
        className="relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">{averageFocus.score}</div>
            <div className="text-sm font-medium text-emerald-700">평균 집중도</div>
          </div>
          <div className="relative">
            <CircularProgress value={averageFocus.score} max={100} color="#10B981" size={64} strokeWidth={6} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-600">성과 등급</span>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
              {averageFocus.grade}
            </Badge>
          </div>

          <div className="h-10 flex items-end gap-1">
            {[82, 85, 83, 87, 89, 91, 87].map((value, index) => (
              <motion.div
                key={index}
                initial={{ height: 0 }}
                animate={{ height: `${(value / 91) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex-1 rounded-t-sm transition-all duration-200"
                style={{
                  background: `linear-gradient(to top, #10B98188, #10B981cc)`,
                  minHeight: "2px",
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-emerald-600">
            <span>최근 세션 평균</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+{averageFocus.sessionImprovement}점</span>
            </div>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.div>

      {/* Distraction Events */}
      <motion.div
        className="relative p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-3xl font-bold text-orange-600 mb-1">{distractions.count}</div>
            <div className="text-sm font-medium text-orange-700">방해 요소</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <PulseIndicator count={distractions.count} color="#F59E0B" size={10} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-orange-600">주요 원인</span>
            <span className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
              {distractions.mainCause}
            </span>
          </div>

          <div className="space-y-2">
            {distractions.details.map((detail: any, index: number) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-orange-600">{detail.name}</span>
                <span className="font-medium text-orange-700">{detail.count}회</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-orange-600">
            <span>어제 대비</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 rotate-180" />
              <span>{distractions.yesterdayChange}회</span>
            </div>
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.div>
    </div>
  )
}

// Activity Timeline Component
const ActivityTimeline = ({ activities }: { activities: any[] }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "negative":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case "positive":
        return "border-green-200 bg-green-50"
      case "negative":
        return "border-red-200 bg-red-50"
      default:
        return "border-blue-200 bg-blue-50"
    }
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className={`flex items-start gap-4 p-4 rounded-xl border ${getActivityColor(activity.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getActivityIcon(activity.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-slate-900 text-sm">{activity.action}</h4>
              <span className="text-xs text-slate-500">{activity.timestamp}</span>
            </div>
            <p className="text-sm text-slate-600 mb-2">{activity.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">영향도:</span>
              <div className="flex items-center gap-1">
                {activity.impact > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : activity.impact < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                ) : null}
                <span
                  className={`text-xs font-medium ${
                    activity.impact > 0 ? "text-green-600" : activity.impact < 0 ? "text-red-600" : "text-slate-600"
                  }`}
                >
                  {activity.impact > 0 ? "+" : ""}
                  {activity.impact}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// Evidence Gallery Component
const EvidenceGallery = ({ snapshots }: { snapshots: any[] }) => {
  const getSnapshotBorder = (type: string) => {
    switch (type) {
      case "high_focus":
        return "border-green-300"
      case "distraction":
        return "border-red-300"
      case "break":
        return "border-yellow-300"
      default:
        return "border-slate-300"
    }
  }

  const getSnapshotBadge = (type: string) => {
    switch (type) {
      case "high_focus":
        return { text: "높은 집중", color: "bg-green-100 text-green-700" }
      case "distraction":
        return { text: "방해 요소", color: "bg-red-100 text-red-700" }
      case "break":
        return { text: "휴식", color: "bg-yellow-100 text-yellow-700" }
      default:
        return { text: "일반", color: "bg-slate-100 text-slate-700" }
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {snapshots.map((snapshot) => {
          const badge = getSnapshotBadge(snapshot.type)
          return (
            <motion.div
              key={snapshot.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`relative group cursor-pointer rounded-xl border-2 overflow-hidden hover:shadow-lg transition-all duration-200 ${getSnapshotBorder(snapshot.type)}`}
            >
              <div className="aspect-video relative">
                <img
                  src={snapshot.thumbnail || "/placeholder.svg"}
                  alt={`집중 스냅샷 ${snapshot.timestamp}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                <div className="absolute top-2 left-2">
                  <Badge className={`text-xs ${badge.color}`}>{badge.text}</Badge>
                </div>
                <div className="absolute top-2 right-2">
                  <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full">{snapshot.focusScore}</div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-white text-xs">{snapshot.timestamp}</div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// Achievement Grid Component
const AchievementGrid = ({ achievements }: { achievements: any[] }) => {
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "focus":
        return "from-blue-500 to-blue-600"
      case "consistency":
        return "from-green-500 to-green-600"
      case "improvement":
        return "from-purple-500 to-purple-600"
      case "milestone":
        return "from-yellow-500 to-yellow-600"
      default:
        return "from-slate-500 to-slate-600"
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {achievements.map((achievement) => (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`relative p-6 rounded-2xl border ${
            achievement.completed
              ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200"
              : "bg-white border-slate-200"
          } hover:shadow-lg transition-all duration-200`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCategoryColor(achievement.category)} flex items-center justify-center text-2xl`}
              >
                {achievement.badge}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{achievement.title}</h3>
                <p className="text-sm text-slate-600">{achievement.description}</p>
              </div>
            </div>
            {achievement.completed && <Trophy className="w-6 h-6 text-yellow-500" />}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">진행률</span>
              <span className="font-semibold text-slate-900">
                {achievement.progress} / {achievement.target}
              </span>
            </div>
            <Progress
              value={(achievement.progress / achievement.target) * 100}
              className={`h-2 ${achievement.completed ? "bg-green-100" : ""}`}
            />
          </div>

          {achievement.completed && (
            <div className="absolute top-4 right-4">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// Main Daily Report Page Component
export default function DailyReportPage() {
  const params = useParams()
  const date = params.date as string
  
  console.log('🔍 리포트 페이지 렌더링 - 날짜:', date)
  
  // DB 데이터 가져오기
  const { data, isLoading: loading, error } = useDailyReportQuery(date)
  
  console.log('🔍 Hook 상태:', { data, loading, error })
  
  const [activeTab, setActiveTab] = useState("overview")
  
  // 날짜 형식 검증
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
  
  if (!isValidDate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="container mx-auto px-6 py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용해주세요.</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="grid lg:grid-cols-[3fr_2fr] gap-6 md:grid-cols-1">
              <div className="space-y-6">
                <div className="h-64 bg-slate-200 rounded-2xl"></div>
                <div className="space-y-4">
                  <div className="h-24 bg-slate-200 rounded-2xl"></div>
                  <div className="h-24 bg-slate-200 rounded-2xl"></div>
                  <div className="h-24 bg-slate-200 rounded-2xl"></div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-48 bg-slate-200 rounded-2xl"></div>
                <div className="h-64 bg-slate-200 rounded-2xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="container mx-auto px-6 py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error?.message || "데이터를 불러올 수 없습니다."}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/report" className="flex items-center gap-2" aria-label="리포트로 돌아가기">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">리포트</span>
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">일일 집중력 리포트</h1>
                <span className="text-slate-600">오늘의 집중 세션 분석</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                공유
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full space-y-6"
        >
          {/* Detailed Analysis Tabs */}
          <Card className="rounded-2xl bg-white shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                세션 상세 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">집중력 추이</TabsTrigger>
                  <TabsTrigger value="activities">활동 내역</TabsTrigger>
                  <TabsTrigger value="evidence">증거 자료</TabsTrigger>
                  <TabsTrigger value="achievements">성취도</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">세션 집중력 추이</h3>
                      <TimelineCard data={data.focusScorePoints} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activities" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">활동 분석</h3>
                    <ActivityTimeline activities={mockActivities} />
                  </div>
                </TabsContent>

                <TabsContent value="evidence" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">증거 스냅샷</h3>
                    <EvidenceGallery snapshots={mockEvidenceSnapshots} />
                  </div>
                </TabsContent>

                <TabsContent value="achievements" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">도전 과제 진행률</h3>
                    <AchievementGrid achievements={mockAchievements} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Highlight Cards */}
          <HighlightCards highlights={data.highlights} />

          {/* AI Coaching Section */}
          <Card className="rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200 shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-slate-900">AI 코칭 제안</h2>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Coaching Item 1 - 알림 차단 */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-3">
                    21시 이후 집중도가 급락하는 패턴이 감지되었습니다. 
                    <span className="font-medium text-purple-600">알림 차단 루틴</span>을 적용해보세요.
                  </p>
                  <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg border border-purple-100">
                    <span className="text-xs text-slate-600">21:00-23:00 자동 적용</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" id="routine-toggle-1" />
                      <label 
                        htmlFor="routine-toggle-1"
                        className="block w-10 h-5 bg-slate-200 rounded-full cursor-pointer transition-colors duration-200 hover:bg-slate-300"
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 translate-x-0.5 translate-y-0.5"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coaching Item 2 - 휴식 시간 */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-3">
                    연속 집중 시간이 2시간을 초과했습니다. 
                    <span className="font-medium text-emerald-600">5분 휴식 루틴</span>을 활성화하여 
                    집중력을 유지하세요.
                  </p>
                  <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg border border-emerald-100">
                    <span className="text-xs text-slate-600">2시간마다 5분 휴식</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" id="routine-toggle-2" />
                      <label 
                        htmlFor="routine-toggle-2"
                        className="block w-10 h-5 bg-slate-200 rounded-full cursor-pointer transition-colors duration-200 hover:bg-slate-300"
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 translate-x-0.5 translate-y-0.5"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coaching Item 3 - 자세 교정 */}
              <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 mb-3">
                    자세가 좋지 않은 시간이 30분 이상 지속되었습니다. 
                    <span className="font-medium text-orange-600">자세 교정 알림</span>을 설정하여 
                    건강한 자세를 유지하세요.
                  </p>
                  <div className="flex items-center justify-between p-2 bg-white/60 rounded-lg border border-orange-100">
                    <span className="text-xs text-slate-600">30분마다 자세 체크</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" id="routine-toggle-3" />
                      <label 
                        htmlFor="routine-toggle-3"
                        className="block w-10 h-5 bg-slate-200 rounded-full cursor-pointer transition-colors duration-200 hover:bg-slate-300"
                      >
                        <div className="w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 translate-x-0.5 translate-y-0.5"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
} 