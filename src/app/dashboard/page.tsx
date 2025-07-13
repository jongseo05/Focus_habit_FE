"use client"

import type React from "react"

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
  Plus,
  MoreHorizontal,
  Edit,
  Target,
  Clock,
  Smartphone,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

// Types for goal management
interface Goal {
  id: string
  title: string
  type: "focus_time" | "no_phone" | "consecutive_days"
  targetValue: number
  currentValue: number
  period: "daily" | "weekly" | "monthly"
  createdAt: Date
}

// Mock data and state management
const useFocusSession = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [focusScore, setFocusScore] = useState(85)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1)
        // Simulate focus score fluctuation
        setFocusScore((prev) => Math.max(60, Math.min(100, prev + (Math.random() - 0.5) * 10)))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, isPaused])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return {
    isRunning,
    isPaused,
    elapsed,
    focusScore,
    formatTime,
    startSession: () => setIsRunning(true),
    pauseSession: () => setIsPaused(!isPaused),
    stopSession: () => {
      setIsRunning(false)
      setIsPaused(false)
      setElapsed(0)
    },
  }
}

// Goal management hook
const useGoals = () => {
  const [goals, setGoals] = useState<Goal[]>([
    {
      id: "1",
      title: "저녁 2시간 무휴대폰",
      type: "no_phone",
      targetValue: 120,
      currentValue: 86,
      period: "daily",
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "주간 20시간 집중",
      type: "focus_time",
      targetValue: 1200,
      currentValue: 1020,
      period: "weekly",
      createdAt: new Date(),
    },
    {
      id: "3",
      title: "연속 7일 목표달성",
      type: "consecutive_days",
      targetValue: 7,
      currentValue: 3,
      period: "daily",
      createdAt: new Date(),
    },
  ])

  const addGoal = (goal: Omit<Goal, "id" | "currentValue" | "createdAt">) => {
    const newGoal: Goal = {
      ...goal,
      id: Date.now().toString(),
      currentValue: 0,
      createdAt: new Date(),
    }
    setGoals((prev) => [newGoal, ...prev])
  }

  const updateGoal = (id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal)))
  }

  const deleteGoal = (id: string) => {
    setGoals((prev) => prev.filter((goal) => goal.id !== id))
  }

  const getTodayFocusGoal = () => {
    return goals.find((goal) => goal.type === "focus_time" && goal.period === "daily")
  }

  return {
    goals,
    addGoal,
    updateGoal,
    deleteGoal,
    getTodayFocusGoal,
  }
}

// Circular Gauge Component
const CircularGauge = ({ value, size = 88 }: { value: number; size?: number }) => {
  const radius = (size - 12) / 2
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
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(value)}
          strokeWidth="6"
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

// Goal Setting Drawer Component
const GoalSettingDrawer = ({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (goal: Omit<Goal, "id" | "currentValue" | "createdAt">) => void
}) => {
  const [formData, setFormData] = useState({
    title: "",
    type: "focus_time" as Goal["type"],
    targetValue: 0,
    period: "daily" as Goal["period"],
  })

  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.title && formData.targetValue > 0) {
      onSave(formData)
      setFormData({ title: "", type: "focus_time", targetValue: 0, period: "daily" })
      onClose()
    }
  }

  const getTypeIcon = (type: Goal["type"]) => {
    switch (type) {
      case "focus_time":
        return <Clock className="w-4 h-4" />
      case "no_phone":
        return <Smartphone className="w-4 h-4" />
      case "consecutive_days":
        return <Calendar className="w-4 h-4" />
    }
  }

  const getTypeLabel = (type: Goal["type"]) => {
    switch (type) {
      case "focus_time":
        return "집중 시간"
      case "no_phone":
        return "무휴대폰"
      case "consecutive_days":
        return "연속 일수"
    }
  }

  const getUnitLabel = (type: Goal["type"]) => {
    switch (type) {
      case "focus_time":
        return "분"
      case "no_phone":
        return "분"
      case "consecutive_days":
        return "일"
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden border-t border-slate-100 bg-slate-50/50"
        >
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-title" className="text-sm font-medium text-slate-700">
                    목표 제목
                  </Label>
                  <Input
                    ref={firstInputRef}
                    id="goal-title"
                    placeholder="예: 오늘 3시간 집중하기"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-type" className="text-sm font-medium text-slate-700">
                    목표 유형
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: Goal["type"]) => setFormData((prev) => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="focus_time">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          집중 시간
                        </div>
                      </SelectItem>
                      <SelectItem value="no_phone">
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          무휴대폰
                        </div>
                      </SelectItem>
                      <SelectItem value="consecutive_days">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          연속 일수
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-value" className="text-sm font-medium text-slate-700">
                    목표 값
                  </Label>
                  <div className="relative">
                    <Input
                      id="goal-value"
                      type="number"
                      placeholder="0"
                      value={formData.targetValue || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, targetValue: Number.parseInt(e.target.value) || 0 }))
                      }
                      className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 pr-12"
                      required
                      min="1"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-500">
                      {getUnitLabel(formData.type)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-period" className="text-sm font-medium text-slate-700">
                    기간
                  </Label>
                  <Select
                    value={formData.period}
                    onValueChange={(value: Goal["period"]) => setFormData((prev) => ({ ...prev, period: value }))}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">일일</SelectItem>
                      <SelectItem value="weekly">주간</SelectItem>
                      <SelectItem value="monthly">월간</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
                >
                  저장
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="rounded-xl hover:bg-slate-100 transition-colors duration-200"
                >
                  취소
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Goal Item Component
const GoalItem = ({
  goal,
  onEdit,
  onDelete,
}: {
  goal: Goal
  onEdit: (goal: Goal) => void
  onDelete: (id: string) => void
}) => {
  const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100)

  const getTypeIcon = (type: Goal["type"]) => {
    switch (type) {
      case "focus_time":
        return <Clock className="w-4 h-4 text-blue-500" />
      case "no_phone":
        return <Smartphone className="w-4 h-4 text-orange-500" />
      case "consecutive_days":
        return <Calendar className="w-4 h-4 text-green-500" />
    }
  }

  const formatValue = (value: number, type: Goal["type"]) => {
    if (type === "focus_time" || type === "no_phone") {
      const hours = Math.floor(value / 60)
      const minutes = value % 60
      if (hours > 0) {
        return `${hours}시간 ${minutes}분`
      }
      return `${minutes}분`
    }
    return `${value}일`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group p-4 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {getTypeIcon(goal.type)}
          <div>
            <h4 className="font-medium text-slate-900 text-sm">{goal.title}</h4>
            <p className="text-xs text-slate-500">
              {formatValue(goal.currentValue, goal.type)} / {formatValue(goal.targetValue, goal.type)}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0 rounded-lg"
              aria-label="목표 옵션 메뉴"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={() => onEdit(goal)} className="text-sm">
              <Edit className="w-4 h-4 mr-2" />
              편집
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(goal.id)} className="text-sm text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600">진행률</span>
          <span className="font-semibold text-blue-600">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </motion.div>
  )
}

// Enhanced Mini Chart Components (keeping existing ones)
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

export default function DashboardPage() {
  const session = useFocusSession()
  const goals = useGoals()
  const [showWebcam, setShowWebcam] = useState(false)
  const [snapshotCollapsed, setSnapshotCollapsed] = useState(false)
  const [goalDrawerOpen, setGoalDrawerOpen] = useState(false)
  const [notifications] = useState([
    { id: 1, message: "웹캠 연결이 성공적으로 완료되었습니다", type: "success" },
    { id: 2, message: "새로운 업데이트가 있습니다", type: "info" },
  ])

  const challengeCardRef = useRef<HTMLDivElement>(null)

  const handleStartSession = () => {
    session.startSession()
    setShowWebcam(true)
  }

  const handleStopSession = () => {
    session.stopSession()
    setShowWebcam(false)
  }

  const handleGoalLinkClick = () => {
    setGoalDrawerOpen(true)
    setTimeout(() => {
      challengeCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 100)
  }

  const formatTimeRemaining = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, "0")}`
  }

  // Mock data
  const todayStats = {
    totalTime: "2:34",
    avgScore: 87,
    distractions: 3,
    lastUpdate: "2분 전",
  }

  const insights = [
    "18-20시 휴대폰 사용이 집중을 23% 감소시켰어요. 30분 휴식 알림 설정을 시도해보세요.",
    "오후 3시경 집중도가 가장 높습니다. 중요한 학습을 이 시간에 배치해보세요.",
    "주말 학습 시간이 평일보다 40% 적습니다. 일정한 루틴 유지를 권장합니다.",
  ]

  const friends = [
    { name: "김민수", hours: "24:30", avatar: "🧑‍💻" },
    { name: "이지은", hours: "22:15", avatar: "👩‍🎓" },
    { name: "박준호", hours: "20:45", avatar: "👨‍🔬" },
  ]

  const recentFrames = [
    { id: 1, timestamp: "14:23:15", thumbnail: "/placeholder.svg?height=40&width=60" },
    { id: 2, timestamp: "14:18:32", thumbnail: "/placeholder.svg?height=40&width=60" },
    { id: 3, timestamp: "14:12:08", thumbnail: "/placeholder.svg?height=40&width=60" },
  ]

  const todayFocusGoal = goals.getTodayFocusGoal()
  const remainingMinutes = todayFocusGoal ? todayFocusGoal.targetValue - todayFocusGoal.currentValue : 0

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
                      <div className="text-sm">{notif.message}</div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Calendar */}
              <Button variant="ghost" size="sm" asChild aria-label="Open calendar">
                <Link href="/calendar">
                  <Calendar className="w-5 h-5" />
                </Link>
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm">
                <Settings className="w-5 h-5" />
              </Button>

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
                    <SheetDescription>최근 웹캠 프레임 기록</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {recentFrames.map((frame) => (
                      <div key={frame.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                        <img
                          src={frame.thumbnail || "/placeholder.svg"}
                          alt="Frame thumbnail"
                          className="w-15 h-10 rounded object-cover"
                        />
                        <span className="text-sm text-slate-600 flex-1">{frame.timestamp}</span>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-6 bg-transparent">
                      <Download className="w-4 h-4 mr-2" />
                      CSV 다운로드
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Webcam Preview */}
      <AnimatePresence>
        {showWebcam && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20, y: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20, y: -20 }}
            className="fixed top-20 right-6 z-40"
          >
            <div className="w-[150px] h-[112px] bg-slate-900 rounded-lg overflow-hidden shadow-xl border-2 border-white">
              <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center relative">
                <div className="text-white text-xs">웹캠 미리보기</div>
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-1 right-1 w-6 h-6 p-0 text-white hover:bg-white/20"
                  onClick={() => setShowWebcam(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Session Control Bar */}
          <Card className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  {!session.isRunning ? (
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        onClick={handleStartSession}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 text-lg font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        집중 시작!
                      </Button>

                      {/* Goal Link Pill */}
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={session.pauseSession}
                        className="px-6 py-3 rounded-2xl bg-transparent border-slate-200 hover:bg-slate-50"
                      >
                        {session.isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                        {session.isPaused ? "재개" : "일시정지"}
                      </Button>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={handleStopSession}
                        className="px-6 py-3 rounded-2xl"
                      >
                        <Square className="w-5 h-5 mr-2" />
                        종료
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <CircularGauge value={session.focusScore} />
                    <div className="text-sm text-slate-600 mt-1">집중도</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">{session.formatTime(session.elapsed)}</div>
                    <div className="text-sm text-slate-600">세션 시간</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Grid */}
          <div className="grid xl:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Today's Snapshot */}
              <Card className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
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
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Total Focus Time */}
                          <motion.div
                            className="relative p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl border border-blue-100 hover:shadow-md transition-all duration-300 group cursor-pointer"
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
                            className="relative p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 hover:shadow-md transition-all duration-300 group cursor-pointer"
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
                            className="relative p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-2xl border border-orange-100 hover:shadow-md transition-all duration-300 group cursor-pointer"
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

              {/* Personalized Insights */}
              <Card className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                    <Zap className="w-5 h-5 text-purple-500" />
                    맞춤 인사이트
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.map((insight, index) => (
                    <Alert key={index} className="border-blue-200 bg-blue-50 rounded-xl">
                      <AlertDescription className="text-sm text-slate-700">{insight}</AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Challenge Progress */}
              <Card
                ref={challengeCardRef}
                className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      도전 과제
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGoalDrawerOpen(!goalDrawerOpen)}
                      className="rounded-xl hover:bg-slate-100 transition-colors duration-200"
                      aria-label="목표 추가"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Goal Setting Drawer */}
                <GoalSettingDrawer
                  isOpen={goalDrawerOpen}
                  onClose={() => setGoalDrawerOpen(false)}
                  onSave={(goal) => {
                    goals.addGoal(goal)
                    setGoalDrawerOpen(false)
                  }}
                />

                <CardContent className="space-y-4">
                  <div className="max-h-60 overflow-y-auto space-y-3">
                    <AnimatePresence>
                      {goals.goals.map((goal) => (
                        <GoalItem
                          key={goal.id}
                          goal={goal}
                          onEdit={(goal) => {
                            // Handle edit functionality
                            console.log("Edit goal:", goal)
                          }}
                          onDelete={goals.deleteGoal}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {goals.goals.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">아직 설정된 목표가 없습니다</p>
                      <p className="text-xs text-slate-400">위의 + 버튼을 눌러 목표를 추가해보세요</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Social Widget */}
              <Card className="rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
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
                      <div className="space-y-4">
                        {friends.map((friend, index) => (
                          <div key={index} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50">
                            <div className="text-2xl">{friend.avatar}</div>
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{friend.name}</div>
                              <div className="text-sm text-slate-600">이번 주 {friend.hours}</div>
                            </div>
                            <Badge variant="outline">#{index + 1}</Badge>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                    <TabsContent value="team" className="mt-6">
                      <div className="text-center py-8 text-slate-500">팀 기능은 곧 출시됩니다!</div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
