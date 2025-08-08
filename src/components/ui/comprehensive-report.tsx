"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  Loader2,
} from "lucide-react"
import { useWeeklyReportForComprehensive } from "@/hooks/useWeeklyReport"
import { mockComprehensiveReportData } from "@/lib/mockData"
import { TrendGraph } from "@/components/ui/trend-graph"

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

  // 데이터 검증 및 필터링
  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-slate-50 rounded-xl">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  // undefined 또는 null 요소 필터링
  const validData = data.filter(d => d && typeof d.focusScore === 'number')
  
  if (validData.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-slate-50 rounded-xl">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>유효한 데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  // 날짜별로 데이터 그룹화하여 중복 제거
  const groupedData = validData.reduce((acc, item) => {
    const date = new Date(item.timestamp)
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        timestamp: item.timestamp,
        focusScore: item.focusScore,
        sessionDuration: item.sessionDuration,
        distractions: item.distractions,
        dayOfWeek: item.dayOfWeek,
        count: 1
      }
    } else {
      // 같은 날짜의 데이터가 있으면 평균값 계산
      acc[dateKey].focusScore = Math.round((acc[dateKey].focusScore + item.focusScore) / 2)
      acc[dateKey].sessionDuration = Math.round((acc[dateKey].sessionDuration + item.sessionDuration) * 10) / 20
      acc[dateKey].distractions = Math.round((acc[dateKey].distractions + item.distractions) / 2)
      acc[dateKey].count += 1
    }
    
    return acc
  }, {} as Record<string, any>)

  // 그룹화된 데이터를 배열로 변환하고 날짜순으로 정렬
  const uniqueData = Object.values(groupedData).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // 종합 리포트용: Y축을 50~100점으로 고정하여 추세만 표시
  const fixedMinScore = 50
  const fixedMaxScore = 100
  const fixedScoreRange = fixedMaxScore - fixedMinScore
  
  const normalizedScore = (score: number) => {
    // 50점 미만은 50점으로, 100점 초과는 100점으로 클램핑
    const clampedScore = Math.max(fixedMinScore, Math.min(fixedMaxScore, score))
    return (clampedScore - fixedMinScore) / fixedScoreRange
  }
  const avgScore = Math.round(uniqueData.reduce((sum, d) => sum + d.focusScore, 0) / uniqueData.length)
  const improvement = uniqueData.length > 1 
    ? Math.round(((uniqueData[uniqueData.length - 1].focusScore - uniqueData[0].focusScore) / uniqueData[0].focusScore) * 100)
    : 0

  // Generate smooth curve points for area/line chart
  const generateSmoothPath = (data: TimeSeriesData[], width: number, height: number) => {
    const points = data.map((item, index) => {
      if (!item || typeof item.focusScore !== 'number') return null
      return {
        x: (index / (data.length - 1)) * width,
        y: height - (normalizedScore(item.focusScore) * height),
      }
    }).filter(point => point !== null)

    // Create smooth curve using quadratic bezier curves
    if (points.length === 0) {
      return { path: "", points: [] }
    }

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
  const { path, points } = generateSmoothPath(uniqueData, chartWidth, chartHeight)

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
          {[100, 87, 75, 62, 50].map((value, index) => (
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
             {points.length > 0 && points.map((point, index) => {
               const dataPoint = uniqueData[index]
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

                     {/* X축 라벨 제거됨 */}
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
                   <span className="font-semibold text-slate-900">{uniqueData[hoveredPoint].dayOfWeek}요일</span>
                   <span className="text-sm text-slate-500">{new Date(uniqueData[hoveredPoint].timestamp).toLocaleDateString()}</span>
                 </div>

                <div className="space-y-1">
                                     <div className="flex justify-between items-center">
                     <span className="text-sm text-slate-600">집중도</span>
                     <span
                       className={`font-bold text-lg ${
                         uniqueData[hoveredPoint].focusScore >= 80
                           ? "text-emerald-600"
                           : uniqueData[hoveredPoint].focusScore >= 60
                             ? "text-blue-600"
                             : "text-orange-600"
                       }`}
                     >
                       {uniqueData[hoveredPoint].focusScore}점
                     </span>
                   </div>

                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">세션 시간</span>
                     <span className="font-medium text-slate-900">{uniqueData[hoveredPoint].sessionDuration}분</span>
                   </div>

                   <div className="flex justify-between items-center text-sm">
                     <span className="text-slate-600">방해 요소</span>
                     <span className="font-medium text-slate-900">{uniqueData[hoveredPoint].distractions}회</span>
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
               {Math.max(...uniqueData.map((d) => d.focusScore))}점
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
  const { data: weeklyReport, isLoading, error } = useWeeklyReportForComprehensive()

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">데이터를 불러오는데 실패했습니다: {error.message}</div>
  }

  if (!weeklyReport) {
    return <div className="text-center py-8 text-slate-500">데이터가 없습니다.</div>
  }

     const mockFocusScore: FocusScoreData = mockComprehensiveReportData.focusScore
   const mockFeedback: FeedbackItem[] = mockComprehensiveReportData.feedback

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

      {/* Trend Graph */}
      <TrendGraph />

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
