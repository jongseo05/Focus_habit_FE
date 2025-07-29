"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
} from "lucide-react"

// Types for report data
interface FocusScoreData {
  overall: number
  trend: "up" | "down" | "stable"
  change: number
  breakdown: {
    attention: number
    posture: number
    phoneUsage: number
    consistency: number
  }
}

interface ActivityData {
  timestamp: string
  action: string
  type: "positive" | "negative" | "neutral"
  impact: number
  description: string
}

interface TimeSeriesData {
  timestamp: string
  focusScore: number
  sessionDuration: number
  distractions: number
  dayOfWeek: string
}

interface EvidenceSnapshot {
  id: string
  timestamp: string
  thumbnail: string
  focusScore: number
  notes: string
  type: "high_focus" | "distraction" | "break"
}

interface Achievement {
  id: string
  title: string
  description: string
  progress: number
  target: number
  completed: boolean
  badge: string
  category: "focus" | "consistency" | "improvement" | "milestone"
}

interface FeedbackItem {
  type: "success" | "warning" | "info" | "tip"
  title: string
  message: string
  actionable: boolean
  priority: "high" | "medium" | "low"
}

// Mock data
const mockFocusScore: FocusScoreData = {
  overall: 87,
  trend: "up",
  change: 12,
  breakdown: {
    attention: 92,
    posture: 85,
    phoneUsage: 78,
    consistency: 94,
  },
}

const mockActivities: ActivityData[] = [
  {
    timestamp: "14:23:15",
    action: "깊은 집중 유지",
    type: "positive",
    impact: 8,
    description: "25분간 방해 없이 지속적인 주의 집중",
  },
  {
    timestamp: "14:18:32",
    action: "휴대폰 사용",
    type: "negative",
    impact: -5,
    description: "집중 세션 중 짧은 휴대폰 확인",
  },
  {
    timestamp: "14:12:08",
    action: "자세 교정",
    type: "positive",
    impact: 3,
    description: "앉은 자세 개선 감지",
  },
  {
    timestamp: "14:05:45",
    action: "세션 시작",
    type: "neutral",
    impact: 0,
    description: "집중 세션 시작",
  },
]

const mockTimeSeriesData: TimeSeriesData[] = [
  {
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 40,
    sessionDuration: 45,
    distractions: 5,
    dayOfWeek: "월",
  },
  {
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 65,
    sessionDuration: 60,
    distractions: 3,
    dayOfWeek: "화",
  },
  {
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 50,
    sessionDuration: 40,
    distractions: 6,
    dayOfWeek: "수",
  },
  {
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 75,
    sessionDuration: 80,
    distractions: 2,
    dayOfWeek: "목",
  },
  {
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 92,
    sessionDuration: 95,
    distractions: 1,
    dayOfWeek: "금",
  },
  {
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    focusScore: 82,
    sessionDuration: 75,
    distractions: 2,
    dayOfWeek: "토",
  },
  { timestamp: new Date().toISOString(), focusScore: 100, sessionDuration: 120, distractions: 0, dayOfWeek: "일" },
]

const mockEvidenceSnapshots: EvidenceSnapshot[] = [
  {
    id: "1",
    timestamp: "14:23:15",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 95,
    notes: "최고 집중 순간 - 우수한 자세와 주의력",
    type: "high_focus",
  },
  {
    id: "2",
    timestamp: "14:18:32",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 65,
    notes: "휴대폰 방해 요소 감지",
    type: "distraction",
  },
  {
    id: "3",
    timestamp: "14:12:08",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 80,
    notes: "휴식 후 좋은 회복",
    type: "break",
  },
]

const mockAchievements: Achievement[] = [
  {
    id: "1",
    title: "집중력 마스터",
    description: "7일 연속 90점 이상 집중 점수 유지",
    progress: 5,
    target: 7,
    completed: false,
    badge: "🎯",
    category: "focus",
  },
  {
    id: "2",
    title: "일관성 챔피언",
    description: "30일간 매일 집중 세션 완료",
    progress: 30,
    target: 30,
    completed: true,
    badge: "🏆",
    category: "consistency",
  },
  {
    id: "3",
    title: "방해 요소 제거자",
    description: "휴대폰 사용량 50% 감소",
    progress: 35,
    target: 50,
    completed: false,
    badge: "📱",
    category: "improvement",
  },
]

const mockFeedback: FeedbackItem[] = [
  {
    type: "success",
    title: "훌륭한 진전!",
    message: "이번 주 집중 점수가 12% 향상되었습니다. 계속 좋은 성과를 유지하세요!",
    actionable: false,
    priority: "high",
  },
  {
    type: "warning",
    title: "휴대폰 사용 알림",
    message: "지난주 대비 휴대폰 방해가 23% 증가했습니다. 방해 금지 모드 사용을 고려해보세요.",
    actionable: true,
    priority: "high",
  },
  {
    type: "tip",
    title: "일정 최적화",
    message: "오후 2-4시에 집중도가 최고조에 달합니다. 중요한 작업을 이 시간에 배치해보세요.",
    actionable: true,
    priority: "medium",
  },
  {
    type: "info",
    title: "주간 요약",
    message: "이번 주 계획된 집중 세션의 85%를 완료했습니다.",
    actionable: false,
    priority: "low",
  },
]

// Circular Progress Component
const CircularProgress = ({
  value,
  size = 120,
  strokeWidth = 8,
  color = "#3B82F6",
  backgroundColor = "#E5E7EB",
}: {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={backgroundColor} strokeWidth={strokeWidth} fill="none" />
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{Math.round(value)}</div>
          <div className="text-xs text-slate-500">점수</div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Time Series Chart Component matching dashboard design
const TimeSeriesChart = ({ data, period }: { data: TimeSeriesData[]; period: "weekly" | "monthly" }) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [chartType, setChartType] = useState<"area" | "line">("area")
  const [containerWidth, setContainerWidth] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const maxScore = Math.max(...data.map((d) => d.focusScore))
  const minScore = Math.min(...data.map((d) => d.focusScore))
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.focusScore, 0) / data.length)
  const improvement = Math.round(((data[data.length - 1].focusScore - data[0].focusScore) / data[0].focusScore) * 100)

  // Generate smooth curve points for area/line chart
  const generateSmoothPath = (data: TimeSeriesData[], width: number, height: number) => {
    const points = data.map((item, index) => ({
      x: (index / (data.length - 1)) * width,
      y: height - ((item.focusScore - minScore) / (maxScore - minScore)) * height,
    }))

    // Create smooth curve using quadratic bezier curves
    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`
    }

    return { path, points }
  }

  const chartWidth = 1200
  const chartHeight = 200
  const { path, points } = generateSmoothPath(data, chartWidth, chartHeight)

  // 컨테이너 크기 측정
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setContainerWidth(rect.width)
    }
  }, [])

  // 데이터 포인트의 실제 픽셀 위치 계산
  const getDataPointPixelPosition = (index: number) => {
    if (containerWidth === 0) return 80 + (index * 180)
    
    // SVG의 실제 렌더링 크기에서 데이터 포인트 위치 계산
    // SVG viewBox: 0 0 1280 260
    // 데이터 포인트: 40 + (index / 6) * 1200
    const svgViewBoxWidth = 1280
    const chartAreaWidth = 1200
    const chartOffset = 40
    
    const dataPointInSvg = chartOffset + (index / 6) * chartAreaWidth
    const pixelPosition = (dataPointInSvg / svgViewBoxWidth) * containerWidth
    
    return pixelPosition
  }



  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-emerald-500"
    if (score >= 60) return "from-blue-400 to-blue-500"
    return "from-orange-400 to-orange-500"
  }

  return (
    <div className="relative">
      {/* Chart Type Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              chartType === "area" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            영역 차트
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              chartType === "line" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            선 차트
          </button>
        </div>
      </div>

      {/* Enhanced Chart */}
      <div ref={containerRef} className="relative bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100">
        <svg
          width="100%"
          height="280"
          viewBox={`0 0 ${chartWidth + 80} ${chartHeight + 60}`}
          className="overflow-visible"
        >
          <defs>
            {/* Gradients for different score ranges */}
            <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
            </linearGradient>

            {/* Grid pattern */}
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.5" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width={chartWidth} height={chartHeight} fill="url(#grid)" x="40" y="20" />

          {/* Y-axis labels */}
          {[100, 80, 60, 40].map((value, index) => (
            <g key={value}>
              <text x="30" y={20 + (index * chartHeight) / 3 + 5} textAnchor="end" className="text-xs fill-slate-400">
                {value}
              </text>
              <line
                x1="35"
                y1={20 + (index * chartHeight) / 3}
                x2={chartWidth + 40}
                y2={20 + (index * chartHeight) / 3}
                stroke="#E2E8F0"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </g>
          ))}

          {/* Chart area/line */}
          <g transform="translate(40, 20)">
            {chartType === "area" ? (
              <path
                d={`${path} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#blueGradient)"
                className="transition-all duration-500"
              />
            ) : null}

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
              const dataPoint = data[index]
              const isHovered = hoveredPoint === index

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
                    onMouseEnter={(e) => {
                      setHoveredPoint(index)
                      const rect = containerRef.current?.getBoundingClientRect()
                      if (rect) {
                        setMousePosition({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        })
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Data point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 6 : 4}
                    fill="white"
                    stroke={dataPoint.focusScore >= 80 ? "#10B981" : dataPoint.focusScore >= 60 ? "#3B82F6" : "#F59E0B"}
                    strokeWidth="3"
                    className="transition-all duration-200 drop-shadow-sm"
                  />

                  {/* Hover highlight */}
                  {isHovered && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      fill={dataPoint.focusScore >= 80 ? "#10B981" : dataPoint.focusScore >= 60 ? "#3B82F6" : "#F59E0B"}
                      fillOpacity="0.1"
                      className="animate-pulse"
                    />
                  )}
                </g>
              )
            })}
          </g>

          {/* X-axis labels */}
          {data.map((dataPoint, index) => (
            <text
              key={index}
              x={40 + (index / (data.length - 1)) * chartWidth}
              y={chartHeight + 45}
              textAnchor="middle"
              className="text-xs fill-slate-600 font-medium"
            >
              {dataPoint.dayOfWeek}
            </text>
          ))}
        </svg>

        {/* Enhanced Tooltip */}
        <AnimatePresence>
          {hoveredPoint !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-4 min-w-[200px]"
              style={{
                left: `${mousePosition.x}px`,
                top: `${mousePosition.y - 80}px`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{data[hoveredPoint].dayOfWeek}요일</span>
                  <span className="text-sm text-slate-500">{new Date(data[hoveredPoint].timestamp).toLocaleDateString()}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">집중도</span>
                    <span
                      className={`font-bold text-lg ${
                        data[hoveredPoint].focusScore >= 80
                          ? "text-emerald-600"
                          : data[hoveredPoint].focusScore >= 60
                            ? "text-blue-600"
                            : "text-orange-600"
                      }`}
                    >
                      {data[hoveredPoint].focusScore}점
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">세션 시간</span>
                    <span className="font-medium text-slate-900">{data[hoveredPoint].sessionDuration}분</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">방해 요소</span>
                    <span className="font-medium text-slate-900">{data[hoveredPoint].distractions}회</span>
                  </div>
                </div>
              </div>

              {/* Tooltip arrow */}
              <div
                className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"
                style={{
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chart insights */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="text-lg font-bold text-emerald-600">
              {maxScore}점
            </div>
            <div className="text-xs text-emerald-700">주간 최고점</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-600">
              {avgScore}점
            </div>
            <div className="text-xs text-blue-700">주간 평균</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-lg font-bold text-purple-600">
              {improvement > 0 ? "+" : ""}{improvement}%
            </div>
            <div className="text-xs text-purple-700">주간 개선율</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Activity Timeline Component
const ActivityTimeline = ({ activities }: { activities: ActivityData[] }) => {
  const getActivityIcon = (type: ActivityData["type"]) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "negative":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getActivityColor = (type: ActivityData["type"]) => {
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
const EvidenceGallery = ({ snapshots }: { snapshots: EvidenceSnapshot[] }) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<EvidenceSnapshot | null>(null)

  const getSnapshotBorder = (type: EvidenceSnapshot["type"]) => {
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

  const getSnapshotBadge = (type: EvidenceSnapshot["type"]) => {
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
              onClick={() => setSelectedSnapshot(snapshot)}
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

      {/* Modal for selected snapshot */}
      <AnimatePresence>
        {selectedSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedSnapshot(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video relative">
                <img
                  src={selectedSnapshot.thumbnail || "/placeholder.svg"}
                  alt={`집중 스냅샷 ${selectedSnapshot.timestamp}`}
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 bg-black/20 text-white hover:bg-black/40"
                  onClick={() => setSelectedSnapshot(null)}
                >
                  ×
                </Button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">집중 스냅샷</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={getSnapshotBadge(selectedSnapshot.type).color}>
                      {getSnapshotBadge(selectedSnapshot.type).text}
                    </Badge>
                    <Badge variant="outline">점수: {selectedSnapshot.focusScore}</Badge>
                  </div>
                </div>
                <p className="text-slate-600 mb-4">{selectedSnapshot.notes}</p>
                <div className="text-sm text-slate-500">촬영 시간: {selectedSnapshot.timestamp}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Achievement Grid Component
const AchievementGrid = ({ achievements }: { achievements: Achievement[] }) => {
  const getCategoryColor = (category: Achievement["category"]) => {
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

// Feedback Section Component
const FeedbackSection = ({ feedback }: { feedback: FeedbackItem[] }) => {
  const getFeedbackIcon = (type: FeedbackItem["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case "info":
        return <Info className="w-5 h-5 text-blue-500" />
      case "tip":
        return <Lightbulb className="w-5 h-5 text-purple-500" />
      default:
        return <Info className="w-5 h-5 text-slate-500" />
    }
  }

  const getFeedbackColor = (type: FeedbackItem["type"]) => {
    switch (type) {
      case "success":
        return "border-green-200 bg-green-50"
      case "warning":
        return "border-yellow-200 bg-yellow-50"
      case "info":
        return "border-blue-200 bg-blue-50"
      case "tip":
        return "border-purple-200 bg-purple-50"
      default:
        return "border-slate-200 bg-slate-50"
    }
  }

  const getPriorityLabel = (priority: FeedbackItem["priority"]) => {
    switch (priority) {
      case "high":
        return "높음"
      case "medium":
        return "보통"
      case "low":
        return "낮음"
      default:
        return "보통"
    }
  }

  const sortedFeedback = [...feedback].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })

  return (
    <div className="space-y-4">
      {sortedFeedback.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className={`flex items-start gap-4 p-4 rounded-xl border ${getFeedbackColor(item.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getFeedbackIcon(item.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-slate-900">{item.title}</h4>
              <Badge
                variant="outline"
                className={`text-xs ${
                  item.priority === "high"
                    ? "border-red-300 text-red-700"
                    : item.priority === "medium"
                      ? "border-yellow-300 text-yellow-700"
                      : "border-slate-300 text-slate-700"
                }`}
              >
                {getPriorityLabel(item.priority)}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 mb-3">{item.message}</p>
            {item.actionable && (
              <Button size="sm" variant="outline" className="text-xs bg-transparent">
                조치 취하기
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// Main Report Component
export default function ComprehensiveReport() {
  const [timePeriod, setTimePeriod] = useState<"weekly" | "monthly">("weekly")
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="space-y-8">
      {/* Report Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">집중력 리포트</h1>
          <p className="text-slate-600">생산성과 집중 습관에 대한 종합적인 분석</p>
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

      {/* Focus Score Overview - Enhanced Design */}
      <Card className="rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0">
        <CardHeader className="pb-6">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Target className="w-6 h-6 text-white" />
            </div>
            집중력 점수 분석
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Enhanced Circular Progress */}
            <div className="flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-indigo-100/30 rounded-full blur-3xl"></div>
              <div className="relative">
                <CircularProgress value={mockFocusScore.overall} size={200} strokeWidth={16} />
              </div>
            </div>

            {/* Enhanced Stats Section */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40">
                <div className="flex items-center gap-3">
                  {mockFocusScore.trend === "up" ? (
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  ) : mockFocusScore.trend === "down" ? (
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                      <TrendingDown className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-slate-400 to-slate-500 rounded-xl flex items-center justify-center">
                      <div className="w-6 h-1 bg-white rounded-full" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-slate-600">이번 주 변화</div>
                    <div
                      className={`text-xl font-bold ${
                        mockFocusScore.trend === "up"
                          ? "text-green-600"
                          : mockFocusScore.trend === "down"
                            ? "text-red-600"
                            : "text-slate-600"
                      }`}
                    >
                      {mockFocusScore.change > 0 ? "+" : ""}
                      {mockFocusScore.change}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  {
                    key: "attention",
                    label: "주의 집중력",
                    value: mockFocusScore.breakdown.attention,
                    color: "from-blue-500 to-blue-600",
                  },
                  {
                    key: "posture",
                    label: "자세 유지",
                    value: mockFocusScore.breakdown.posture,
                    color: "from-green-500 to-green-600",
                  },
                  {
                    key: "phoneUsage",
                    label: "휴대폰 절제",
                    value: mockFocusScore.breakdown.phoneUsage,
                    color: "from-orange-500 to-orange-600",
                  },
                  {
                    key: "consistency",
                    label: "일관성",
                    value: mockFocusScore.breakdown.consistency,
                    color: "from-purple-500 to-purple-600",
                  },
                ].map((item) => (
                  <div key={item.key} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <span className="text-sm font-bold text-slate-900">{item.value}%</span>
                    </div>
                    <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${item.color} rounded-full shadow-sm`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Card className="rounded-3xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <BarChart3 className="w-6 h-6 text-purple-500" />
              상세 분석
            </CardTitle>
            <Select value={timePeriod} onValueChange={(value: "weekly" | "monthly") => setTimePeriod(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">주간</SelectItem>
                <SelectItem value="monthly">월간</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">개요</TabsTrigger>
              <TabsTrigger value="activities">활동 내역</TabsTrigger>
              <TabsTrigger value="evidence">증거 자료</TabsTrigger>
              <TabsTrigger value="achievements">성취도</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">집중력 추이</h3>
                  <TimeSeriesChart data={mockTimeSeriesData} period={timePeriod} />
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

      {/* Personalized Feedback */}
      <Card className="rounded-3xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Zap className="w-6 h-6 text-yellow-500" />
            맞춤형 피드백
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FeedbackSection feedback={mockFeedback} />
        </CardContent>
      </Card>
    </div>
  )
}
