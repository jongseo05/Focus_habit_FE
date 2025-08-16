"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Play,
  Pause,
  Square,
  Bell,
  Settings,
  Menu,
  Trophy,
  TrendingUp,
  Zap,
  Users,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Video,
  VideoOff,
  Activity,
  Target,
  AlertCircle,
  BarChart3,
  Database,
  LogOut,
  Watch,
  User,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useFocusSessionWithGesture } from "@/hooks/useFocusSessionWithGesture"
import { useActiveFocusSession } from "@/hooks/useFocusSession"
import CameraPermissionLayer from "@/components/CameraPermissionLayer"
import WebcamPreview from "@/components/WebcamPreview"
import FocusSessionErrorDisplay from "@/components/FocusSessionErrorDisplay"
import { FocusSessionStatus } from "@/types/focusSession"
import ProtectedRoute from "@/components/ProtectedRoute"
import MicrophonePermissionLayer from "@/components/MicrophonePermissionLayer"
import { useMicrophoneStream, useMediaStream } from "@/hooks/useMediaStream"
import HybridAudioPipeline from "@/components/HybridAudioPipeline"
import WebcamAnalysisDisplay from "@/components/WebcamAnalysisDisplay"

import { supabaseBrowser } from "@/lib/supabase/client"
import { ReportService } from "@/lib/database/reportService"
import { useSignOut, useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { SessionEndNotification } from "@/components/SessionEndNotification"
import ChallengeProgressCard from "@/components/social/ChallengeProgressCard"

import { useFriendRanking, useStudyRoomChallenges } from "@/hooks/useSocial"

// 실제 Zustand 스토어 사용
import { useDashboardStore } from "@/stores/dashboardStore"

const useFocusSession = () => {
  const { 
    isRunning, 
    isPaused, 
    elapsed, 
    focusScore, 
    startSession, 
    pauseSession, 
    stopSession, 
    updateFocusScore,
    formatTime
  } = useDashboardStore()

  return {
    isRunning,
    isPaused,
    elapsed,
    focusScore,
    formatTime,
    startSession,
    pauseSession,
    stopSession,
    updateFocusScore
  }
}

// Circular Gauge Component
const CircularGauge = ({ value, size = 88 }: { value: number; size?: number }) => {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  const getColor = (score: number) => {
    if (score >= 80) return "#10B981" // green
    if (score >= 60) return "#F59E0B" // yellow
    return "#EF4444" // red
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth="4" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(value)}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-900">{Math.round(value)}</span>
      </div>
    </div>
  )
}

// Enhanced Mini Chart Components
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

// Sparkline Component
// const Sparkline = ({ data, color = "#3B82F6" }: { data: number[]; color?: string }) => {
//   const max = Math.max(...data)
//   const min = Math.min(...data)
//   const range = max - min || 1

//   const points = data
//     .map((value, index) => {
//       const x = (index / (data.length - 1)) * 60
//       const y = 20 - ((value - min) / range) * 15
//       return `${x},${y}`
//     })
//     .join(" ")

//   return (
//     <svg width="60" height="20" className="inline-block">
//       <polyline
//         points={points}
//         fill="none"
//         stroke={color}
//         strokeWidth="1.5"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   )
// }

// Enhanced Focus Trend Chart Component
const EnhancedFocusTrendChart = () => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [chartType, setChartType] = useState<"area" | "line">("area")

  // Enhanced mock data with more details
  const weeklyDetailedData = [
    { day: "월", date: "12/16", score: 75, sessions: 3, totalTime: "2:30", peak: 85, low: 65 },
    { day: "화", date: "12/17", score: 82, sessions: 4, totalTime: "3:15", peak: 92, low: 72 },
    { day: "수", date: "12/18", score: 78, sessions: 2, totalTime: "2:45", peak: 88, low: 68 },
    { day: "목", date: "12/19", score: 85, sessions: 5, totalTime: "4:20", peak: 95, low: 75 },
    { day: "금", date: "12/20", score: 90, sessions: 4, totalTime: "3:50", peak: 98, low: 82 },
    { day: "토", date: "12/21", score: 87, sessions: 3, totalTime: "3:10", peak: 94, low: 80 },
    { day: "일", date: "12/22", score: 92, sessions: 2, totalTime: "2:20", peak: 96, low: 88 },
  ]

  const maxScore = Math.max(...weeklyDetailedData.map((d) => d.score))
  const minScore = Math.min(...weeklyDetailedData.map((d) => d.score))

  // Generate smooth curve points for area/line chart
  const generateSmoothPath = (data: typeof weeklyDetailedData, width: number, height: number) => {
    const points = data.map((item, index) => ({
      x: (index / (data.length - 1)) * width,
      y: height - ((item.score - minScore) / (maxScore - minScore)) * height,
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

  const chartWidth = 400
  const chartHeight = 120
  const { path, points } = generateSmoothPath(weeklyDetailedData, chartWidth, chartHeight)

  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-emerald-400 to-emerald-500"
    if (score >= 60) return "from-blue-400 to-blue-500"
    return "from-orange-400 to-orange-500"
  }

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "url(#emeraldGradient)"
    if (score >= 60) return "url(#blueGradient)"
    return "url(#orangeGradient)"
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
      <div className="relative bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100">
        <svg
          width="100%"
          height="160"
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
              const data = weeklyDetailedData[index]
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
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Data point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 6 : 4}
                    fill="white"
                    stroke={data.score >= 80 ? "#10B981" : data.score >= 60 ? "#3B82F6" : "#F59E0B"}
                    strokeWidth="3"
                    className="transition-all duration-200 drop-shadow-sm"
                  />

                  {/* Hover highlight */}
                  {isHovered && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      fill={data.score >= 80 ? "#10B981" : data.score >= 60 ? "#3B82F6" : "#F59E0B"}
                      fillOpacity="0.1"
                      className="animate-pulse"
                    />
                  )}
                </g>
              )
            })}
          </g>

          {/* X-axis labels */}
          {weeklyDetailedData.map((data, index) => (
            <text
              key={index}
              x={40 + (index / (weeklyDetailedData.length - 1)) * chartWidth}
              y={chartHeight + 45}
              textAnchor="middle"
              className="text-xs fill-slate-600 font-medium"
            >
              {data.day}
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
                left: `${40 + (hoveredPoint / (weeklyDetailedData.length - 1)) * (chartWidth * 0.8)}px`,
                top: "10px",
                transform: hoveredPoint > 3 ? "translateX(-100%)" : "translateX(0%)",
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{weeklyDetailedData[hoveredPoint].day}요일</span>
                  <span className="text-sm text-slate-500">{weeklyDetailedData[hoveredPoint].date}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">평균 집중도</span>
                    <span
                      className={`font-bold text-lg ${
                        weeklyDetailedData[hoveredPoint].score >= 80
                          ? "text-emerald-600"
                          : weeklyDetailedData[hoveredPoint].score >= 60
                            ? "text-blue-600"
                            : "text-orange-600"
                      }`}
                    >
                      {weeklyDetailedData[hoveredPoint].score}점
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">최고점</span>
                    <span className="font-medium text-emerald-600">{weeklyDetailedData[hoveredPoint].peak}점</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">최저점</span>
                    <span className="font-medium text-orange-600">{weeklyDetailedData[hoveredPoint].low}점</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">세션 수</span>
                      <span className="font-medium">{weeklyDetailedData[hoveredPoint].sessions}회</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">총 시간</span>
                      <span className="font-medium">{weeklyDetailedData[hoveredPoint].totalTime}</span>
                    </div>
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
              {Math.max(...weeklyDetailedData.map((d) => d.score))}점
            </div>
            <div className="text-xs text-emerald-700">주간 최고점</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-600">
              {Math.round(weeklyDetailedData.reduce((sum, d) => sum + d.score, 0) / weeklyDetailedData.length)}점
            </div>
            <div className="text-xs text-blue-700">주간 평균</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-lg font-bold text-purple-600">
              +
              {Math.round(
                ((weeklyDetailedData[weeklyDetailedData.length - 1].score - weeklyDetailedData[0].score) /
                  weeklyDetailedData[0].score) *
                  100,
              )}
              %
            </div>
            <div className="text-xs text-purple-700">주간 개선율</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}

function DashboardContent() {
  const session = useFocusSession()
  const { updateElapsed } = useDashboardStore()
  const signOut = useSignOut()
  const router = useRouter()
  

  
  // 현재 사용자 정보 가져오기
  const { user } = useAuth()
  


  // 로그아웃 성공 시 홈페이지로 리다이렉트
  useEffect(() => {
    if (signOut.isSuccess) {
      router.push('/')
    }
  }, [signOut.isSuccess, router])

  // 로그아웃 에러 처리
  useEffect(() => {
    if (signOut.error) {
      alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }, [signOut.error])
  
  // 실시간 집중 상태 분석 상태
  const [currentFocusStatus, setCurrentFocusStatus] = useState<'focused' | 'distracted' | 'unknown'>('unknown')
  const [focusConfidence, setFocusConfidence] = useState(0)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    timestamp: Date
    status: 'focused' | 'distracted'
    confidence: number
    text: string
  }>>([])
  
  // 현재 활성 세션 조회
  const { data: activeSession } = useActiveFocusSession(user?.id)
  
  // 최근 완료된 세션들 조회 (데이터 로그용)
  const { data: recentSessions } = useQuery({
    queryKey: ['recent-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null) // 완료된 세션만
        .order('ended_at', { ascending: false })
        .limit(5) // 최근 5개
      
      if (error) {
        return []
      }
      
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5분
  })
  
  // elapsed 시간 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (session.isRunning && !session.isPaused) {
      interval = setInterval(() => {
        updateElapsed()
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [session.isRunning, session.isPaused, updateElapsed])
  

  
  // 미디어 스트림과 제스처 인식을 통합 관리
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  
  const mediaStream = useFocusSessionWithGesture(
    session.isRunning, 
    currentSessionId || activeSession?.session_id, // 현재 세션 ID 우선 사용
    {
      frameRate: 10, // 1초에 10번 (10fps)
      enableGestureRecognition: true, // 제스처 인식 활성화
      gestureJpegQuality: 0.95
    }
  )
  const microphoneStream = useMicrophoneStream()
  const [showWebcam, setShowWebcam] = useState(false)
  const [snapshotCollapsed, setSnapshotCollapsed] = useState(false)
  const [showCameraPermissionLayer, setShowCameraPermissionLayer] = useState(false)
  
  // 세션 종료 알림 상태
  const [showSessionEndNotification, setShowSessionEndNotification] = useState(false)
  const [sessionEndData, setSessionEndData] = useState<{
    duration: number
    averageFocusScore: number
    sampleCount: number
    eventCount: number
    mlFeatureCount: number
    sessionId: string
  } | null>(null)
  const [showMicrophonePermissionLayer, setShowMicrophonePermissionLayer] = useState(false)
  const [showErrorDisplay, setShowErrorDisplay] = useState(false)
  const [showAudioPipeline, setShowAudioPipeline] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 1, message: "웹캠 연결이 성공적으로 완료되었습니다", type: "success" },
    { id: 2, message: "새로운 업데이트가 있습니다", type: "info" },
  ])
  


  // 에러 상태 모니터링
  useEffect(() => {
    if (mediaStream.lastSessionError && mediaStream.sessionStatus === FocusSessionStatus.ERROR) {
      setShowErrorDisplay(true)
    } else if (mediaStream.sessionStatus === FocusSessionStatus.ACTIVE) {
      // 성공적으로 복구된 경우 3초 후 에러 표시 해제
      const timer = setTimeout(() => {
        setShowErrorDisplay(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [mediaStream.lastSessionError, mediaStream.sessionStatus])

  // 집중 시작 버튼 클릭 시 권한 순차 요청
  const handleStartSession = () => {
    if (!mediaStream.isPermissionGranted) {
      setShowCameraPermissionLayer(true)
      return
    }
    if (!microphoneStream.isPermissionGranted) {
      setShowMicrophonePermissionLayer(true)
      return
    }
    // 둘 다 있으면 바로 시작
    startFocusSession()
  }

  // 집중모드 시작 함수
  const startFocusSession = async () => {
    if (!session.isRunning) {
      try {
        console.log('🚀 데이터베이스 세션 생성 시작')
        
        // 1. 로컬 세션 시작
        session.startSession()
        
        // 2. 데이터베이스에 세션 생성
        const supabase = supabaseBrowser()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          alert('사용자 인증에 실패했습니다. 다시 로그인해주세요.')
          return
        }
        
        const { data: newSession, error: sessionError } = await supabase
          .from('focus_session')
          .insert({
            user_id: user.id,
            started_at: new Date().toISOString(),
            goal_min: 30,
            context_tag: '집중 세션',
            session_type: 'study'
          })
          .select()
          .single()
        
        if (sessionError) {
          console.error('Session creation failed:', sessionError)
          console.error('Error details:', {
            code: sessionError.code,
            message: sessionError.message,
            details: sessionError.details,
            hint: sessionError.hint
          })
          alert(`세션 생성에 실패했습니다: ${sessionError.message}`)
          return
        }
        
        console.log('✅ 데이터베이스 세션 생성 성공:', newSession)
        
        // 세션 ID를 상태에 저장
        setCurrentSessionId(newSession.session_id)
        
        // 3. 미디어 스트림 시작
        await mediaStream.startStream()
        await microphoneStream.startStream()
        setShowWebcam(true)
        setShowAudioPipeline(true)
        
      } catch (error) {
        console.error('❌ 세션 시작 중 오류:', error)
        alert('세션 시작 중 오류가 발생했습니다. 다시 시도해주세요.')
      }
    }
  }

  // DB 상태 확인 기능 제거됨

  const handleStopSession = async () => {
    try {
      const supabase = supabaseBrowser()
      
      // 1. 현재 사용자 인증 상태 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        alert('사용자 인증에 실패했습니다. 다시 로그인해주세요.')
        return
      }
      
      if (!user) {
        alert('사용자 인증 정보가 없습니다. 다시 로그인해주세요.')
        return
      }

      // 2. 활성 세션 조회 (API 사용)
      let activeSession = null
      try {
        const sessionResponse = await fetch('/api/focus-session?active=true')
        
        if (!sessionResponse.ok) {
          // API 실패 시 직접 DB에서 조회 시도
          const { data: directSession, error: directError } = await supabase
            .from('focus_session')
            .select('*')
            .eq('user_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!directError || directError.code === 'PGRST116') {
            activeSession = directSession
          }
        } else {
          const sessionData = await sessionResponse.json()
          activeSession = sessionData.data
        }
      } catch (fetchError) {
        // 네트워크 오류 시 직접 DB 조회 시도
        try {
          const { data: directSession, error: directError } = await supabase
            .from('focus_session')
            .select('*')
            .eq('user_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!directError || directError.code === 'PGRST116') {
            activeSession = directSession
          }
        } catch (dbError) {
          // 직접 DB 조회 실패 시 조용히 처리
        }
      }
      
      if (!activeSession) {
        // 활성 세션이 없어도 로컬 상태는 초기화
      } else {
        // 3. 세션 종료 및 리포트 생성
        try {
          // API를 통해 세션 종료 처리
          const response = await fetch('/api/focus-session/end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: activeSession.session_id,
                             finalFocusScore: session.focusScore
            })
          })

          if (response.ok) {
            const result = await response.json()
            
                          if (result.success) {
                // 4. 성공 알림 표시
                const sessionDuration = Math.floor(session.elapsed / 60) // 분 단위
                
                
                
                // 세션 종료 데이터 설정
                setSessionEndData({
                  duration: sessionDuration,
                  averageFocusScore: result.data.summary.averageFocusScore || session.focusScore,
                  sampleCount: result.data.summary.sampleCount,
                  eventCount: result.data.summary.eventCount,
                  mlFeatureCount: result.data.summary.mlFeatureCount,
                  sessionId: activeSession.session_id
                })
                
                // 알림 표시
                setShowSessionEndNotification(true)
              } else {
              console.error('세션 종료 실패:', result.error)
              alert(`세션 종료 중 오류가 발생했습니다: ${result.error}`)
            }
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
        } catch (error) {
          console.error('세션 종료 처리 중 예외 발생:', error)
          alert('세션 종료 중 예상치 못한 오류가 발생했습니다. 관리자에게 문의해주세요.')
        }
      }
    } catch (error) {
      alert('세션 종료 중 오류가 발생했습니다.')
      // 오류가 발생해도 로컬 상태는 초기화
    }

    // 6. 로컬 상태 초기화 (항상 실행)
    session.stopSession()
    mediaStream.stopStream()
    microphoneStream.stopStream()
    setShowWebcam(false)
    setShowAudioPipeline(false)
    setCurrentSessionId(null) // 세션 ID 초기화
  }

  const handlePauseSession = () => {
    session.pauseSession()
    // 일시정지 시에는 스트림은 유지하되, 오디오 파이프라인과 제스처 인식만 일시정지
    // (HybridAudioPipeline과 useFocusSessionWithGesture에서 자동으로 처리됨)
  }

  const handleWebcamToggle = async () => {
    if (showWebcam) {
      setShowWebcam(false)
    } else {
      try {
        if (mediaStream.stream) {
          setShowWebcam(true)
        } else {
          // 스트림이 없으면 다시 시작
          const success = await mediaStream.startStream()
          if (success) {
            setShowWebcam(true)
          } else {
            // 실패 시 권한 레이어 표시
            setShowMicrophonePermissionLayer(true)
          }
        }
      } catch (error) {
        setShowMicrophonePermissionLayer(true)
      }
    }
  }

  const handlePermissionGranted = async () => {
    // 권한이 부여되면 카메라 스트림 시작 시도
    const success = await mediaStream.startStream()
    
    if (success) {
      setShowWebcam(true)
      setShowMicrophonePermissionLayer(false)
      
      // 세션이 아직 시작되지 않았다면 시작
      if (!session.isRunning) {
        session.startSession()
      }
    } else {
      // 스트림 시작 실패해도 권한 레이어는 닫고 세션은 유지
      setShowMicrophonePermissionLayer(false)
    }
  }

  const handleCameraPermissionLayerClose = () => {
    setShowMicrophonePermissionLayer(false)
    
    // 권한이 확실히 부여되지 않았고, 스트림도 없는 경우에만 웹캠을 끔
    // 스트림이 있으면 권한이 부여된 것으로 간주
    if (!mediaStream.isPermissionGranted && !mediaStream.stream && !showWebcam) {
      mediaStream.stopStream()
      setShowWebcam(false)
      // 세션은 계속 유지 - 카메라 없이도 집중 세션은 가능
    }
  }

  const handleMicrophonePermissionLayerClose = () => {
    setShowMicrophonePermissionLayer(false)
    
    // 권한이 확실히 부여되지 않았고, 스트림도 없는 경우에만 마이크를 끔
    // 스트림이 있으면 권한이 부여된 것으로 간주
    if (!microphoneStream.isPermissionGranted && !microphoneStream.stream) {
      microphoneStream.stopStream()
    }
  }

  // ML 피쳐값 CSV 내보내기
  const handleMLFeaturesExport = async () => {
    if (!session.isRunning || !activeSession?.session_id) {
      alert('활성 집중 세션이 없습니다.');
      return;
    }

    try {
      const response = await fetch(`/api/ml-features?sessionId=${activeSession.session_id}&format=csv`);
      if (!response.ok) throw new Error('ML 피쳐값 조회 실패');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ml-features-${activeSession.session_id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('ML 피쳐값 내보내기 실패');
    }
  }

  // 세션 전체 데이터 다운로드
  const handleSessionDownload = async (format: 'json' | 'csv' = 'json', sessionId?: string, includeAllUsers: boolean = false) => {
    const targetSessionId = sessionId || activeSession?.session_id;
    
    if (!targetSessionId) {
      alert('세션 ID가 없습니다.');
      return;
    }

    try {
      const queryParams = new URLSearchParams({
        format: format,
        uid: user?.id || '',
        includeAllUsers: includeAllUsers.toString()
      });
      
      const response = await fetch(`/api/focus-session/${targetSessionId}/download?${queryParams}`);
      if (!response.ok) throw new Error('세션 데이터 조회 실패');
      
      if (format === 'csv') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = includeAllUsers 
          ? `focus-session-all-users-${targetSessionId}-${new Date().toISOString().split('T')[0]}.csv`
          : `focus-session-${targetSessionId}-${new Date().toISOString().split('T')[0]}.csv`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = includeAllUsers 
          ? `focus-session-all-users-${targetSessionId}-${new Date().toISOString().split('T')[0]}.json`
          : `focus-session-${targetSessionId}-${new Date().toISOString().split('T')[0]}.json`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert('세션 다운로드 실패');
    }
  }

  // 카메라 권한 승인 감지 → 마이크 권한 없으면 마이크 Layer, 있으면 바로 집중모드
  useEffect(() => {
    // ...existing code...
    if (
      showCameraPermissionLayer &&
      mediaStream.isPermissionGranted
    ) {
      setShowCameraPermissionLayer(false)
      if (!microphoneStream.isPermissionGranted) {
        setShowMicrophonePermissionLayer(true)
      } else {
        startFocusSession()
      }
    }
  }, [mediaStream.isPermissionGranted, showCameraPermissionLayer])

  // 마이크 권한 승인 감지 → 자동으로 오디오 파이프라인 시작
  useEffect(() => {
    if (
      showMicrophonePermissionLayer &&
      microphoneStream.isPermissionGranted
    ) {
      setShowMicrophonePermissionLayer(false)
      
      // 오디오 파이프라인 자동 시작
      setShowAudioPipeline(true)
      
      // 두 권한 모두 있으면 집중 세션도 시작
      if (mediaStream.isPermissionGranted && microphoneStream.isPermissionGranted) {
        startFocusSession()
      }
    }
  }, [microphoneStream.isPermissionGranted, showMicrophonePermissionLayer])

  // Mock data
  const todayStats = {
    totalTime: "2:34",
    avgScore: 87,
    distractions: 3,
    lastUpdate: "2분 전",
  }

  const weeklyData = [75, 82, 78, 85, 90, 87, 92]
  const challenges = [
    { name: "저녁 2시간 무휴대폰", progress: 72 },
    { name: "주간 20시간 집중", progress: 85 },
    { name: "연속 7일 목표달성", progress: 43 },
  ]

  const insights = [
    "18-20시 휴대폰 사용이 집중을 23% 감소시켰어요. 30분 휴식 알림 설정을 시도해보세요.",
    "오후 3시경 집중도가 가장 높습니다. 중요한 학습을 이 시간에 배치해보세요.",
    "주말 학습 시간이 평일보다 40% 적습니다. 일정한 루틴 유지를 권장합니다.",
  ]

  const friends = [
    { name: "김민수", 시간: "24:30", avatar: "KM" },
    { name: "이지은", 시간: "22:15", avatar: "PJ" },
    { name: "박준호", 시간: "20:45", avatar: "PJ" },
  ]

  // ML 피쳐값 및 집중도 점수 데이터 상태
  const [mlFeatures, setMlFeatures] = useState<any[]>([])
  const [focusScores, setFocusScores] = useState<Array<{
    ts: string
    score: number
    confidence: number
    analysis: string
  }>>([])
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false)

  // ML 피쳐값 로드 함수
  const loadMLFeatures = async () => {
    if (!activeSession?.session_id) return
    
    setIsLoadingFeatures(true)
    try {
      const response = await fetch(`/api/ml-features?sessionId=${activeSession.session_id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setMlFeatures(result.data || [])
        }
      }
    } catch (error) {
      // ML 피쳐값 로드 실패 시 조용히 처리
    } finally {
      setIsLoadingFeatures(false)
    }
  }

  // 활성 세션이 변경될 때마다 ML 피쳐값 로드
  useEffect(() => {
    if (activeSession?.session_id) {
      loadMLFeatures()
    }
  }, [activeSession?.session_id])

  // 세션 시작 시 ML 피쳐값 초기화하지 않음 (데이터 유지)
  // useEffect(() => {
  //   if (session.isRunning) {
  //     setMlFeatures([])
  //   }
  // }, [session.isRunning])

  // AI 집중도 점수 계산 및 저장 함수 (useEffect 외부로 이동)
const calculateAndSaveFocusScore = async () => {
  try {
    // AI 집중도 엔진 import
    const { FocusScoreEngine } = await import('@/lib/focusScoreEngine')
    
          // 현재 시간 기반 지표 계산 (elapsed 시간 사용)
      const currentTime = Date.now()
      const sessionDuration = Math.floor(session.elapsed / 60) // 분 단위
      
      // 1초마다 실행되므로 너무 자주 로그 출력하지 않도록 제한
      if (Math.floor(session.elapsed) % 10 === 0) { // 10초마다만 로그 출력
        console.log('📊 실시간 집중도 수집 중:', { 
          elapsed: session.elapsed, 
        sessionDuration, 
        timestamp: new Date().toISOString() 
      })
    }
      
      // AI 집중도 계산을 위한 피쳐 데이터 구성
      const focusFeatures = {
        // 시각적 지표 (ML 피쳐값에서 가져오거나 기본값 사용)
        visual: {
          eyeStatus: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.eye_status 
            ? mlFeatures[mlFeatures.length - 1].eye_status 
            : 'OPEN',
          earValue: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.ear_value 
            ? mlFeatures[mlFeatures.length - 1].ear_value 
            : 0.3,
          headPose: {
            pitch: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_pitch 
              ? mlFeatures[mlFeatures.length - 1].head_pose_pitch 
              : 0,
            yaw: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_yaw 
              ? mlFeatures[mlFeatures.length - 1].head_pose_yaw 
              : 0,
            roll: mlFeatures.length > 0 && mlFeatures[mlFeatures.length - 1]?.head_pose_roll 
              ? mlFeatures[mlFeatures.length - 1].head_pose_roll 
              : 0
          },
          gazeDirection: 'FORWARD' as const
        },
        
        // 청각적 지표 (음성 분석 결과에서 가져오거나 기본값 사용)
        audio: {
          isSpeaking: false, // 실제로는 음성 분석 결과 사용
          speechContent: '',
          isStudyRelated: true,
          confidence: 0.8,
          audioLevel: 20 // 기본 조용함
        },
        
        // 행동 지표 (실제로는 사용자 활동 모니터링에서 가져와야 함)
        behavior: {
          mouseActivity: true, // 기본값
          keyboardActivity: true, // 기본값
          tabSwitches: 0, // 실제로는 탭 전환 감지 필요
          idleTime: 0 // 실제로는 유휴 시간 감지 필요
        },
        
        // 시간 지표
        time: {
          sessionDuration,
          lastBreakTime: Math.floor(sessionDuration * 0.8), // 예시값
          consecutiveFocusTime: Math.floor(sessionDuration * 0.9) // 예시값
        }
      }

      // AI 집중도 점수 계산 및 저장
      if (!activeSession?.session_id) {
        console.error('❌ 활성 세션 ID가 없습니다')
        return
      }
      
      const focusScoreResult = await FocusScoreEngine.trackFocusScore(
        activeSession.session_id,
        focusFeatures
      )

      // 로컬 상태 업데이트
      setMlFeatures(prev => [...prev, {
        ts: new Date().toISOString(),
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        topic_tag: 'ai_focus_analysis',
        created_at: new Date().toISOString()
      }])

      // 집중도 점수 히스토리 업데이트
      setFocusScores(prev => [...prev, {
        ts: new Date().toISOString(),
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        analysis: focusScoreResult.analysis.primaryFactor
      }])

      // 집중도 점수 업데이트
      session.updateFocusScore(focusScoreResult.score)

      console.log('🤖 AI 집중도 분석 완료:', {
        score: focusScoreResult.score,
        confidence: focusScoreResult.confidence,
        breakdown: focusScoreResult.breakdown,
        analysis: focusScoreResult.analysis
      })

    } catch (error) {
      console.error('❌ AI 집중도 점수 계산 실패:', error)
    }
  }

  // AI 집중도 점수 계산 및 저장 (세션 중일 때)
  useEffect(() => {
    if (!session.isRunning || !activeSession?.session_id) return
    
    // 5초마다 AI 집중도 점수 계산 및 저장 (UI 업데이트용)
    const interval = setInterval(calculateAndSaveFocusScore, 5000)
    
    return () => clearInterval(interval)
     }, [session.isRunning, activeSession?.session_id, mlFeatures, session])



  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">FocusAI</span>
            </Link>

            <div className="flex items-center gap-4">
              {/* 웹캠 상태 표시 (세션 중일 때만) */}
              {session.isRunning && mediaStream.isPermissionGranted && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${showWebcam ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    {showWebcam ? '카메라 활성' : '카메라 비활성'}
                  </span>
                </div>
              )}

              {/* 제스처 인식 상태 표시 (세션 중일 때만) */}
              {session.isRunning && mediaStream.isPermissionGranted && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    mediaStream.isGestureRecognitionActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    {mediaStream.isGestureRecognitionActive ? '제스처 분석' : '제스처 대기'}
                  </span>
                  {mediaStream.gestureFramesSent > 0 && (
                    <span className="text-xs text-slate-400">
                      ({mediaStream.gestureFramesSent}프레임)
                    </span>
                  )}
                </div>
              )}

              {/* AI 집중도 점수 표시 (세션 중일 때만) */}
              {session.isRunning && (
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    session.focusScore >= 80 ? 'bg-green-500' :
                    session.focusScore >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  } animate-pulse`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    AI 집중도: {session.focusScore}점
                  </span>
                  <span className="text-xs text-slate-400">
                    (실시간)
                  </span>
                  {/* 웹캠 분석 상태 표시 */}
                  {mediaStream.webcamAnalysisResult && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>🎥 분석 중</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs"></span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  {notifications.map((notif) => (
                    <DropdownMenuItem key={notif.id} className="p-3">
                      <div className={`text-sm ${
                        notif.type === 'error' ? 'text-red-600' : 
                        notif.type === 'success' ? 'text-green-600' : 
                        'text-slate-700'
                      }`}>
                        {notif.message}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => signOut.mutate()}
                    disabled={signOut.isPending}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {signOut.isPending ? '로그아웃 중...' : '로그아웃'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Weekly Report */}
              <Link href="/report/weekly">
                <Button variant="ghost" size="sm" title="주간 리포트 보기">
                  <BarChart3 className="w-5 h-5" />
                </Button>
              </Link>

              {/* Social Features */}
              <Link href="/social">
                <Button variant="ghost" size="sm" title="소셜 스터디">
                  <Users className="w-5 h-5" />
                </Button>
              </Link>

              {/* Personal Challenges */}
              <Link href="/social/challenge">
                <Button variant="ghost" size="sm" title="개인 챌린지로 이동">
                  <Trophy className="w-5 h-5" />
                </Button>
              </Link>

              {/* Profile */}
              <Link href="/profile">
                <Button variant="ghost" size="sm" title="프로필 보기">
                  <User className="w-5 h-5" />
                </Button>
              </Link>

              {/* Watch Connection */}
              <Link href="/connect">
                <Button variant="ghost" size="sm" title="스마트워치 연동">
                  <Watch className="w-5 h-5" />
                </Button>
              </Link>

              {/* Data Log Drawer */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label="Open data log">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>데이터 로그</SheetTitle>
                    <SheetDescription>ML 분석 결과 및 집중도 데이터</SheetDescription>

                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {activeSession?.session_id ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                          <Database className="w-8 h-8 text-blue-600" />
                        </div>
                        <div className="text-lg font-semibold text-slate-800 mb-2">세션 데이터 다운로드</div>
                        <div className="text-sm text-slate-600 mb-6">
                          현재 활성 세션의 모든 데이터를 다운로드할 수 있습니다
                        </div>
                        
                        <div className="space-y-3">
                          <Button 
                            variant="default" 
                            className="w-full bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleSessionDownload('json')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            JSON 형식으로 다운로드
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => handleSessionDownload('csv')}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            CSV 형식으로 다운로드
                          </Button>
                        </div>
                        
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-sm font-medium text-blue-800 mb-2">💡 전체 세션 데이터 다운로드</div>
                          <div className="text-xs text-blue-600 mb-3">
                            세션에 참여한 모든 사용자의 데이터를 다운로드하려면 아래 버튼을 사용하세요
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              onClick={() => handleSessionDownload('json', undefined, true)}
                            >
                              전체 JSON
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                              onClick={() => handleSessionDownload('csv', undefined, true)}
                            >
                              전체 CSV
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-4 text-xs text-slate-500 bg-slate-50 p-3 rounded">
                          <div className="font-medium mb-1">📊 포함되는 데이터:</div>
                          <ul className="text-left space-y-1">
                            <li>• 세션 기본 정보 (시작/종료 시간, 집중도 등)</li>
                            <li>• ML 분석 결과 (눈 상태, 머리 방향 등)</li>
                            <li>• 제스처 인식 데이터</li>
                            <li>• 세션 상세 기록</li>
                          </ul>
                        </div>
                      </div>
                    ) : recentSessions && recentSessions.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                            <Database className="w-6 h-6 text-green-600" />
                          </div>
                          <div className="text-md font-semibold text-slate-800 mb-2">최근 완료된 세션</div>
                          <div className="text-sm text-slate-600 mb-4">
                            완료된 세션의 데이터를 다운로드할 수 있습니다
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {recentSessions.map((session) => (
                            <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900">
                                  {session.context_tag || `세션 ${new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {new Date(session.started_at).toLocaleDateString('ko-KR')} {new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.ended_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleSessionDownload('json', session.session_id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  JSON
                                </Button>
                                <Button
                                  onClick={() => handleSessionDownload('csv', session.session_id)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                >
                                  CSV
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-500">
                        <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                          <Database className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-sm font-medium mb-1">활성 세션이 없습니다</div>
                        <div className="text-xs mb-3">집중 세션을 시작하면 데이터 다운로드가 가능합니다</div>
                        {!session.isRunning && (
                          <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded">
                            💡 집중 세션을 시작해보세요
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Webcam Preview */}
      <AnimatePresence>
        {showWebcam && mediaStream.stream && (
          <WebcamPreview
            stream={mediaStream.stream}
            onClose={handleWebcamToggle}
          />
        )}
      </AnimatePresence>

      {/* Audio Pipeline - 세션 중일 때만 표시 */}
      <AnimatePresence>
        {showAudioPipeline && session.isRunning && (
          <div className="fixed bottom-4 right-4 z-50">
            <HybridAudioPipeline />
          </div>
        )}
      </AnimatePresence>

      {/* Camera Permission Layer */}
      <CameraPermissionLayer
        isVisible={showCameraPermissionLayer && !mediaStream.isPermissionGranted}
        isLoading={mediaStream.isLoading}
        error={mediaStream.error}
        isPermissionDenied={mediaStream.isPermissionDenied}
        isPermissionGranted={mediaStream.isPermissionGranted}
        onRequestPermission={mediaStream.requestPermission}
        onRetry={mediaStream.retryPermission}
        onClose={handleCameraPermissionLayerClose}
        onDismissError={() => {
          mediaStream.resetError()
          setShowCameraPermissionLayer(false)
        }}
      />
      <MicrophonePermissionLayer
        isVisible={showMicrophonePermissionLayer && !microphoneStream.isPermissionGranted}
        isLoading={microphoneStream.isLoading}
        error={microphoneStream.error}
        isPermissionDenied={microphoneStream.isPermissionDenied}
        isPermissionGranted={microphoneStream.isPermissionGranted}
        onRequestPermission={microphoneStream.requestPermission}
        onRetry={microphoneStream.retryPermission}
        onClose={handleMicrophonePermissionLayerClose}
        onDismissError={() => {
          microphoneStream.resetError()
          setShowMicrophonePermissionLayer(false)
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Session Control Bar */}
          <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  {!session.isRunning ? (
                    <div className="flex items-center gap-3">
                      <Button
                        size="lg"
                        onClick={handleStartSession}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        집중 시작!
                      </Button>
                      
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handlePauseSession}
                        className="px-6 py-3 rounded-xl bg-transparent"
                      >
                        {session.isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                        {session.isPaused ? "재개" : "일시정지"}
                      </Button>
                      
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopSession}
                        className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        세션 종료
                      </Button>
                      
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <CircularGauge value={session.focusScore} />
                    <div className="text-sm text-slate-600 mt-1">집중도</div>
                  </div>
                  <div className="text-center">
                                         <div className="text-2xl font-bold text-slate-900">{session.formatTime(session.elapsed)}</div>
                    <div className="text-sm text-slate-600">세션 시간</div>
                  </div>
                  

                  
                  {/* 웹캠 토글 버튼 (세션 중일 때만 표시) */}
                  {session.isRunning && mediaStream.isPermissionGranted && (
                    <div className="text-center">
                      <Button
                        variant={showWebcam ? "default" : "outline"}
                        size="lg"
                        onClick={handleWebcamToggle}
                        className={`px-4 py-3 rounded-xl transition-all duration-200 ${
                          showWebcam 
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                            : "bg-transparent border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50"
                        }`}
                        title={showWebcam ? "웹캠 미리보기 끄기" : "웹캠 미리보기 켜기"}
                      >
                        {showWebcam ? (
                          <Video className="w-5 h-5" />
                        ) : (
                          <VideoOff className="w-5 h-5" />
                        )}
                      </Button>
                      <div className="text-sm text-slate-600 mt-1">
                        {showWebcam ? "카메라 켜짐" : "카메라 꺼짐"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Grid */}
          <div className="grid xl:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Today's Snapshot */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900">오늘의 현황</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSnapshotCollapsed(!snapshotCollapsed)}>
                      {snapshotCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <AnimatePresence>
                  {!snapshotCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Total Focus Time */}
                          <motion.div
                            className="relative p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-blue-600 mb-1">{todayStats.totalTime}</div>
                                <div className="text-sm font-medium text-blue-700">총 집중 시간</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <CircularProgress value={154} max={240} color="#3B82F6" size={48} strokeWidth={4} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-blue-600">목표 대비</span>
                                <span className="font-semibold text-blue-700">64%</span>
                              </div>

                              <AnimatedLineChart
                                data={[2.1, 2.3, 2.2, 2.4, 2.6, 2.8, 2.9]}
                                color="#3B82F6"
                                gradientId="blueGradient"
                                height={32}
                              />

                              <div className="flex items-center justify-between text-xs text-blue-600">
                                <span>지난 7일 추이</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+12%</span>
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
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-emerald-600 mb-1">{todayStats.avgScore}</div>
                                <div className="text-sm font-medium text-emerald-700">평균 집중도</div>
                              </div>
                              <div className="relative">
                                <CircularProgress value={87} max={100} color="#10B981" size={48} strokeWidth={4} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-emerald-600">성과 등급</span>
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                                  우수
                                </Badge>
                              </div>

                              <MiniBarChart data={[82, 85, 83, 87, 89, 91, 87]} color="#10B981" label="집중도" />

                              <div className="flex items-center justify-between text-xs text-emerald-600">
                                <span>최근 세션 평균</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>+5점</span>
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
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-3xl font-bold text-orange-600 mb-1">{todayStats.distractions}</div>
                                <div className="text-sm font-medium text-orange-700">방해 요소</div>
                              </div>
                              <div className="flex flex-col items-center gap-2">
                                <PulseIndicator count={todayStats.distractions} color="#F59E0B" size={8} />
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-orange-600">주요 원인</span>
                                <span className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full">
                                  휴대폰
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-orange-600">휴대폰 확인</span>
                                  <span className="font-medium text-orange-700">2회</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-orange-600">자세 변화</span>
                                  <span className="font-medium text-orange-700">1회</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-orange-600">
                                <span>어제 대비</span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 rotate-180" />
                                  <span>-2회</span>
                                </div>
                              </div>
                            </div>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </motion.div>
                        </div>

                        <div className="text-center">
                          <div className="inline-flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>마지막 업데이트: {todayStats.lastUpdate}</span>
                          </div>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Focus Trend Chart */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900">주간 집중 패턴</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        상세 보기
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <EnhancedFocusTrendChart />
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      가장 취약한 시간대: 오후 2-4시
                    </Badge>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"></div>
                        <span>우수 (80+)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"></div>
                        <span>양호 (60-79)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full"></div>
                        <span>개선 필요 (60미만)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Challenge Progress */}
              <ChallengeProgressCard className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm" />

              {/* AI 집중 상태 분석 히스토리 */}
              {session.isRunning && (
                <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                      <Brain className="w-5 h-5 text-blue-500" />
                      AI 집중 분석
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 웹캠 분석 결과 - 집중도만 표시 */}
                    <WebcamAnalysisDisplay
                      analysisResult={mediaStream.webcamAnalysisResult}
                      focusFeatures={mediaStream.focusFeatures}
                      lastFocusScore={mediaStream.lastFocusScore}
                      isConnected={mediaStream.gestureWebSocketConnected}
                    />
                    
                    {/* 간단한 상태 표시 */}
                    <div className="text-center py-4 text-slate-500">
                      <Activity className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                      <div className="text-sm">웹캠을 통한 집중도 분석</div>
                      <div className="text-xs">실시간으로 집중 상태를 모니터링합니다</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Personalized Insights */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Zap className="w-5 h-5 text-purple-500" />
                    맞춤 인사이트
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.map((insight, index) => (
                    <Alert key={index} className="border-blue-200 bg-blue-50">
                      <AlertDescription className="text-sm text-slate-700">{insight}</AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Social Widget */}
          <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Users className="w-5 h-5 text-green-500" />
                소셜
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="friends" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="friends">친구 랭킹</TabsTrigger>
                  <TabsTrigger value="team">팀 목표</TabsTrigger>
                </TabsList>
                <TabsContent value="friends" className="mt-6">
                  <DashboardFriendRanking />
                </TabsContent>
                <TabsContent value="team" className="mt-6">
                  <DashboardTeamGoals />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 집중 세션 에러 표시 */}
      <FocusSessionErrorDisplay
        sessionStatus={mediaStream.sessionStatus}
        sessionErrors={mediaStream.sessionErrors}
        lastSessionError={mediaStream.lastSessionError}
        canRecoverFromError={mediaStream.canRecoverFromError}
        onRetryRecovery={mediaStream.retrySessionRecovery}
        onDismissError={() => setShowErrorDisplay(false)}
        isVisible={showErrorDisplay}
      />

      {/* 세션 종료 알림 */}
      {sessionEndData && (
        <SessionEndNotification
          isOpen={showSessionEndNotification}
          onClose={() => {
            setShowSessionEndNotification(false)
            setSessionEndData(null)
          }}
          onViewReport={() => {
            const today = new Date().toISOString().split('T')[0]
            window.open(`/report/daily/date/${today}`, '_blank')
            setShowSessionEndNotification(false)
            setSessionEndData(null)
          }}
          sessionData={sessionEndData}
        />
      )}
    </div>
  )
}

// 대시보드용 친구 랭킹 컴포넌트 (간단한 버전)
function DashboardFriendRanking() {
  const { data: rankingData, isLoading, error } = useFriendRanking('weekly')

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">친구 랭킹을 불러올 수 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">친구를 추가하고 함께 성장해보세요!</p>
      </div>
    )
  }

  // 친구가 없거나 랭킹 데이터가 없는 경우
  if (!rankingData?.rankings || rankingData.rankings.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">아직 친구 랭킹이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">친구를 추가하고 집중 세션을 시작해보세요!</p>
      </div>
    )
  }

  const formatFocusTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  return (
    <div className="space-y-3">
      {rankingData.rankings.slice(0, 5).map((ranking) => (
        <div
          key={ranking.user_id}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
            ranking.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Badge 
              variant={ranking.rank <= 3 ? 'default' : 'outline'}
              className={ranking.rank <= 3 ? 'bg-yellow-500' : ''}
            >
              {ranking.rank}위
            </Badge>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
              {ranking.display_name.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <div className="flex-1">
            <div className="font-medium text-sm text-slate-900">{ranking.display_name}</div>
            <div className="text-xs text-slate-600">
              이번 주 {formatFocusTime(ranking.total_focus_time)}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-slate-500">
              평균 {ranking.average_focus_score}%
            </div>
          </div>
        </div>
      ))}
      
      {rankingData.user_rank && (
        <div className="pt-2 border-t border-slate-200">
          <div className="text-center text-xs text-slate-500">
            내 순위: {rankingData.user_rank}위
          </div>
        </div>
      )}
    </div>
  )
}

// 대시보드용 팀 목표 컴포넌트 (스터디룸 챌린지)
function DashboardTeamGoals() {
  console.log('DashboardTeamGoals 컴포넌트 렌더링 시작')
  const { data: studyRooms, isLoading, error } = useStudyRoomChallenges()
  const { user } = useAuth()
  console.log('useStudyRoomChallenges 결과:', { studyRooms, isLoading, error })
  console.log('현재 사용자:', user)
  
  // 데이터 구조 상세 분석
  if (studyRooms && studyRooms.length > 0) {
    console.log('첫 번째 스터디룸 상세 데이터:', studyRooms[0])
    console.log('linked_challenge_id가 있는 룸들:', studyRooms.filter(room => room.linked_challenge_id))
    console.log('linked_challenge가 있는 룸들:', studyRooms.filter(room => room.linked_challenge))
    console.log('활성 챌린지가 있는 룸들:', studyRooms.filter(room => room.linked_challenge && room.linked_challenge.is_active))
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">스터디룸 챌린지를 불러올 수 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">잠시 후 다시 시도해주세요</p>
      </div>
    )
  }

  // 스터디룸이 없는 경우
  if (!studyRooms || studyRooms.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">참여 중인 스터디룸이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">스터디룸에 참여하고 팀 챌린지를 시작해보세요!</p>
      </div>
    )
  }

  // 챌린지가 연동된 스터디룸만 필터링
  const roomsWithChallenges = studyRooms.filter(room => 
    room.linked_challenge && room.linked_challenge.is_active
  )

  // 스터디룸은 있지만 챌린지가 연동되지 않은 경우
  if (roomsWithChallenges.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">연동된 챌린지가 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">스터디룸에 챌린지를 연동해보세요!</p>
        <div className="mt-3">
          <Link 
            href="/social" 
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            스터디룸 보기 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {roomsWithChallenges.slice(0, 3).map((room) => {
        const challenge = room.linked_challenge!
        const progressPercentage = Math.min((challenge.current_value / challenge.target_value) * 100, 100)
        
        return (
          <div
            key={`${room.room_id}-${challenge.challenge_id}`}
            className="p-4 border border-slate-200 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-lg transition-all duration-300 cursor-pointer group"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {challenge.title}
                  </h4>
                </div>
                <p className="text-sm text-slate-600 mb-2">{room.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    팀 챌린지
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(challenge.end_date).toLocaleDateString()}까지
                  </span>
                </div>
              </div>
              <Badge 
                variant={challenge.is_active ? "default" : "secondary"} 
                className="text-xs px-2 py-1"
              >
                {challenge.is_active ? '진행중' : '완료'}
              </Badge>
            </div>
            
            {/* 진행률 정보 */}
            <div className="space-y-3">
              {/* 목표 정보 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">목표</span>
                <span className="font-bold text-blue-600">
                  {challenge.target_value} {challenge.unit === 'hours' ? '시간' : challenge.unit}
                </span>
              </div>
              
              {/* 현재 진행률 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">현재 진행률</span>
                <span className="font-bold text-green-600">
                  {challenge.current_value} / {challenge.target_value}
                </span>
              </div>
              
              {/* 진행률 바 */}
              {challenge.is_active && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>진행률</span>
                    <span className="font-medium text-blue-600">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 액션 버튼 */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
              <Link href={`/social/room/${room.room_id}`}>
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm py-2"
                  size="sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  스터디룸 보기
                </Button>
              </Link>

            </div>
          </div>
        )
      })}
      
      {/* 더 보기 링크 */}
      <div className="pt-2 text-center">
        <Link 
          href="/social" 
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline hover:no-underline transition-all duration-200"
        >
          <span>더 많은 팀 목표 보기</span>
          <TrendingUp className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}