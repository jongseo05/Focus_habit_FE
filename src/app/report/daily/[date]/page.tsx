"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, ArrowLeft, Calendar, Clock, TrendingUp, TrendingDown, Smartphone, Trophy, Sparkles, X, Save, Play, Pause, CheckCircle, AlertCircle, Info, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useParams } from "next/navigation"
import { 
  DailyReportData, 
  FocusScorePoint, 
  SnapshotData,
  TimelineCardProps,
  HighlightCardsProps,
  AIAdviceBubbleProps,
  SmallRewardPanelProps,
  SnapshotModalProps,
  EmptyStateCardProps
} from "@/types/dailyReport"

// Additional types for tabs
interface ActivityData {
  timestamp: string
  action: string
  type: "positive" | "negative" | "neutral"
  impact: number
  description: string
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

// Mock data for development
const mockDailyReportData: DailyReportData = {
  date: "2024-01-15",
  focusScorePoints: Array.from({ length: 36 }, (_, i) => {
    const minute = i * 5 // 5분 간격으로 3시간 (180분)
    const timestamp = new Date(2024, 0, 15, 14, 0, minute * 60).toISOString() // 오후 2시부터 시작
    
    // Generate realistic focus score pattern for 3-hour session
    let baseScore = 70
    if (minute < 30) baseScore = 60 // 시작 시 집중도 낮음
    else if (minute >= 30 && minute < 90) baseScore = 85 // 중간 구간 최고 집중
    else if (minute >= 90 && minute < 150) baseScore = 75 // 후반부 약간 하락
    else baseScore = 65 // 마무리 구간
    
    const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 15))
    
    const events: any[] = []
    if (Math.random() < 0.08) events.push('phone')
    if (Math.random() < 0.03) events.push('distraction')
    if (Math.random() < 0.02) events.push('break')
    if (score > 80) events.push('focus')
    if (Math.random() < 0.05) events.push('posture')
    
    return {
      ts: timestamp,
      score: Math.round(score),
      events
    }
  }),
  highlights: {
    peak: {
      time: "14:30",
      score: 95,
      duration: 45
    },
    drop: {
      time: "16:15",
      score: 35,
      reason: "휴대폰 사용 증가"
    },
    phoneUsage: {
      count: 8,
      totalTime: 23,
      peakTime: "16:00"
    }
  },
  aiAdvice: {
    message: "오후 2-4시에 집중도가 최고조에 달했습니다. 중요한 작업을 이 시간에 배치하는 것을 권장합니다.",
    routine: {
      id: "morning_focus",
      name: "아침 집중 루틴",
      enabled: false,
      description: "오전 9-11시 집중 세션 자동 시작"
    }
  },
  reward: {
    exp: 1250,
    level: 8,
    progress: 75,
    stickers: ["🌟", "🎯", "⚡", "🏆", "💎"]
  }
}

// Mock data for tabs
const mockActivities: ActivityData[] = [
  {
    timestamp: "00:15:30",
    action: "깊은 집중 유지",
    type: "positive",
    impact: 8,
    description: "25분간 방해 없이 지속적인 주의 집중",
  },
  {
    timestamp: "00:45:12",
    action: "휴대폰 사용",
    type: "negative",
    impact: -5,
    description: "집중 세션 중 짧은 휴대폰 확인",
  },
  {
    timestamp: "01:20:08",
    action: "자세 교정",
    type: "positive",
    impact: 3,
    description: "앉은 자세 개선 감지",
  },
  {
    timestamp: "02:15:45",
    action: "세션 마무리",
    type: "neutral",
    impact: 0,
    description: "집중 세션 완료",
  },
]

const mockEvidenceSnapshots: EvidenceSnapshot[] = [
  {
    id: "1",
    timestamp: "00:30:15",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 95,
    notes: "최고 집중 순간 - 우수한 자세와 주의력",
    type: "high_focus",
  },
  {
    id: "2",
    timestamp: "00:45:32",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 65,
    notes: "휴대폰 방해 요소 감지",
    type: "distraction",
  },
  {
    id: "3",
    timestamp: "01:30:08",
    thumbnail: "/placeholder.svg?height=120&width=160",
    focusScore: 80,
    notes: "휴식 후 좋은 회복",
    type: "break",
  },
]

const mockAchievements: Achievement[] = [
  {
    id: "1",
    title: "3시간 연속 집중",
    description: "3시간 동안 80점 이상 집중 점수 유지",
    progress: 100,
    target: 100,
    completed: true,
    badge: "🎯",
    category: "focus",
  },
  {
    id: "2",
    title: "휴대폰 절제",
    description: "세션 중 휴대폰 사용 3회 이하",
    progress: 2,
    target: 3,
    completed: false,
    badge: "📱",
    category: "improvement",
  },
  {
    id: "3",
    title: "자세 유지",
    description: "세션 중 좋은 자세 90% 이상 유지",
    progress: 85,
    target: 90,
    completed: false,
    badge: "🧘",
    category: "consistency",
  },
]

// Utility function to extract highlights
const extractHighlights = (data: FocusScorePoint[]) => {
  const scores = data.map(d => d.score)
  const maxScore = Math.max(...scores)
  const maxIndex = scores.indexOf(maxScore)
  const maxTime = new Date(data[maxIndex].ts).toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  
  const phoneEvents = data.filter(d => d.events.includes('phone'))
  const phoneCount = phoneEvents.length
  const phoneTime = phoneCount * 5 // 5분씩
  
  const minScore = Math.min(...scores)
  const minIndex = scores.indexOf(minScore)
  const minTime = new Date(data[minIndex].ts).toLocaleTimeString('ko-KR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  
  return {
    peak: {
      time: maxTime,
      score: maxScore,
      duration: 45
    },
    drop: {
      time: minTime,
      score: minScore,
      reason: "집중도 저하"
    },
    phoneUsage: {
      count: phoneCount,
      totalTime: phoneTime,
      peakTime: phoneEvents.length > 0 ? new Date(phoneEvents[0].ts).toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : "없음"
    }
  }
}

// Empty State Card Component
const EmptyStateCard = ({ date, message = "해당 날짜의 데이터가 없습니다." }: EmptyStateCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[400px] text-center"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-6">
        <Calendar className="w-12 h-12 text-slate-400" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">데이터 없음</h3>
      <p className="text-slate-600 mb-6 max-w-md">{message}</p>
      <Button asChild>
        <Link href="/dashboard">
          대시보드로 돌아가기
        </Link>
      </Button>
    </motion.div>
  )
}

// Timeline Card Component
const TimelineCard = ({ data, onPointClick }: TimelineCardProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState<{ start: number; end: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Group data into 5-minute buckets (36 points for 3 hours)
  const buckets = Array.from({ length: 36 }, (_, i) => {
    const minute = i * 5
    const timestamp = new Date(2024, 0, 15, 14, 0, minute * 60).toISOString()
    const point = data.find(d => {
      const dMinute = new Date(d.ts).getMinutes()
      return Math.floor(dMinute / 5) === i
    })
    
    return {
      time: `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`,
      score: point?.score || 0,
      events: point?.events || [],
      timestamp: point?.ts || timestamp
    }
  })

  const getEventIcon = (events: string[]) => {
    if (events.includes('phone')) return '📱'
    if (events.includes('distraction')) return '👀'
    if (events.includes('break')) return '⏸'
    if (events.includes('focus')) return '🎯'
    if (events.includes('posture')) return '🧘'
    return null
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500"
    if (score >= 60) return "bg-blue-500"
    if (score >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <Card className="rounded-2xl bg-white shadow-md w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Clock className="w-5 h-5 text-blue-500" />
          집중 세션 타임라인 (3시간)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div ref={containerRef} className="relative w-full">
          {/* Chart Container */}
          <div className="relative h-80 bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100 w-full">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 1200 200"
              className="overflow-visible"
            >
              <defs>
                <linearGradient id="focusGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Background */}
              <rect width="1200" height="200" fill="#F8FAFC" />

              {/* Y-axis labels */}
              {[100, 80, 60, 40, 20, 0].map((value, index) => (
                <g key={value}>
                  <text x="30" y={20 + (index * 36) + 5} textAnchor="end" className="text-xs fill-slate-500 font-medium">
                    {value}
                  </text>
                  <line
                    x1="40"
                    y1={20 + (index * 36)}
                    x2="1160"
                    y2={20 + (index * 36)}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                </g>
              ))}

              {/* Data points and line */}
              <g transform="translate(40, 20)">
                {/* Area fill */}
                <path
                  d={`M 0 ${200 - (buckets[0].score / 100) * 180} ${buckets.map((bucket, i) => 
                    `L ${(i / 35) * 1120} ${200 - (bucket.score / 100) * 180}`
                  ).join(' ')} L 1120 200 L 0 200 Z`}
                  fill="url(#focusGradient)"
                />

                {/* Line */}
                <path
                  d={`M 0 ${200 - (buckets[0].score / 100) * 180} ${buckets.map((bucket, i) => 
                    `L ${(i / 35) * 1120} ${200 - (bucket.score / 100) * 180}`
                  ).join(' ')}`}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {buckets.map((bucket, i) => {
                  const x = (i / 35) * 1120
                  const y = 200 - (bucket.score / 100) * 180
                  const isHovered = hoveredPoint === i
                  const eventIcon = getEventIcon(bucket.events)

                  return (
                    <g key={i}>
                      {/* Hover area */}
                      <rect
                        x={x - 15}
                        y={0}
                        width="30"
                        height="180"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onClick={() => onPointClick({
                          ts: bucket.timestamp,
                          score: bucket.score,
                          events: bucket.events
                        })}
                      />

                      {/* Data point */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 8 : 4}
                        fill="white"
                        stroke={bucket.score >= 80 ? "#10B981" : bucket.score >= 60 ? "#3B82F6" : "#F59E0B"}
                        strokeWidth="3"
                        className="transition-all duration-200 drop-shadow-sm"
                      />

                      {/* Event icon */}
                      {eventIcon && (
                        <text
                          x={x}
                          y={y - 20}
                          textAnchor="middle"
                          className="text-sm"
                          fontSize="14"
                        >
                          {eventIcon}
                        </text>
                      )}

                      {/* Hover highlight */}
                      {isHovered && (
                        <circle
                          cx={x}
                          cy={y}
                          r="16"
                          fill={bucket.score >= 80 ? "#10B981" : bucket.score >= 60 ? "#3B82F6" : "#F59E0B"}
                          fillOpacity="0.15"
                          className="animate-pulse"
                        />
                      )}
                    </g>
                  )
                })}
              </g>

              {/* X-axis labels */}
              {[0, 30, 60, 90, 120, 150, 180].map((minute) => (
                <text
                  key={minute}
                  x={40 + (minute / 180) * 1120}
                  y="220"
                  textAnchor="middle"
                  className="text-xs fill-slate-600 font-medium"
                >
                  {Math.floor(minute / 60)}:{(minute % 60).toString().padStart(2, '0')}
                </text>
              ))}
            </svg>

            {/* Tooltip */}
            <AnimatePresence>
              {hoveredPoint !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 min-w-[150px]"
                  style={{
                    left: `${30 + (hoveredPoint / 287) * 1170}px`,
                    top: "20px",
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{buckets[hoveredPoint].time}</span>
                      <span className={`text-sm px-2 py-1 rounded-full text-white ${getScoreColor(buckets[hoveredPoint].score)}`}>
                        {buckets[hoveredPoint].score}점
                      </span>
                    </div>
                    {buckets[hoveredPoint].events.length > 0 && (
                      <div className="text-xs text-slate-600">
                        이벤트: {buckets[hoveredPoint].events.join(', ')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chart insights */}
          <div className="mt-6 grid grid-cols-3 gap-6 text-center">
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="text-xl font-bold text-emerald-600">
                {Math.max(...buckets.map(b => b.score))}점
              </div>
              <div className="text-sm text-emerald-700">일일 최고점</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-xl font-bold text-blue-600">
                {Math.round(buckets.reduce((sum, b) => sum + b.score, 0) / buckets.length)}점
              </div>
              <div className="text-sm text-blue-700">일일 평균</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-lg font-bold text-purple-600">
                {buckets.filter(b => b.events.length > 0).length}회
              </div>
              <div className="text-sm text-purple-700">이벤트 발생</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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

// Highlight Cards Component
const HighlightCards = ({ highlights }: HighlightCardsProps) => {
  return (
    <div className="space-y-4">
      {/* Peak Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">최고 집중 순간</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-600 font-bold">{highlights.peak.time}</span>
                  <span className="text-slate-600">{highlights.peak.score}점</span>
                  <span className="text-slate-500">{highlights.peak.duration}분 지속</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Drop Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="rounded-2xl bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">집중도 저하</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-red-600 font-bold">{highlights.drop.time}</span>
                  <span className="text-slate-600">{highlights.drop.score}점</span>
                  <span className="text-slate-500">{highlights.drop.reason}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Phone Usage Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="rounded-2xl bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-yellow-600 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 mb-1">휴대폰 사용</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-orange-600 font-bold">{highlights.phoneUsage.count}회</span>
                  <span className="text-slate-600">{highlights.phoneUsage.totalTime}분</span>
                  <span className="text-slate-500">최대: {highlights.phoneUsage.peakTime}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// AI Advice Bubble Component
const AIAdviceBubble = ({ message, routine, onRoutineToggle }: AIAdviceBubbleProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <Card className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-2">AI 조언</h3>
              <p className="text-sm text-slate-700 mb-4">{message}</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                  <div>
                    <h4 className="font-medium text-slate-900 text-sm">{routine.name}</h4>
                    <p className="text-xs text-slate-600">{routine.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={routine.enabled ? "default" : "outline"}
                    onClick={() => onRoutineToggle(routine.id, !routine.enabled)}
                    className="text-xs"
                    aria-label={`${routine.name} ${routine.enabled ? '비활성화' : '활성화'}`}
                  >
                    {routine.enabled ? "활성화됨" : "활성화"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Small Reward Panel Component
const SmallRewardPanel = ({ reward, onClaim, claimed }: SmallRewardPanelProps) => {
  const [showConfetti, setShowConfetti] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleClaim = () => {
    onClaim()
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
  }

  // Simple confetti effect
  useEffect(() => {
    if (showConfetti && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = 300
      canvas.height = 200

      const confetti = Array.from({ length: 50 }, () => ({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 5)]
      }))

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        confetti.forEach((c, i) => {
          c.x += c.vx
          c.y += c.vy
          c.vy += 0.1

          ctx.fillStyle = c.color
          ctx.fillRect(c.x, c.y, 4, 4)

          if (c.y > canvas.height) {
            confetti.splice(i, 1)
          }
        })

        if (confetti.length > 0) {
          requestAnimationFrame(animate)
        }
      }

      animate()
    }
  }, [showConfetti])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="relative"
    >
      <Card className="rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">일일 보상</h3>
              <p className="text-sm text-slate-600">레벨 {reward.level} • {reward.exp} EXP</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">다음 레벨까지</span>
              <span className="font-medium text-slate-900">{reward.progress}%</span>
            </div>
            <Progress value={reward.progress} className="h-2" />
          </div>

          {/* Sticker carousel */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {reward.stickers.map((sticker, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm border border-yellow-200"
              >
                {sticker}
              </div>
            ))}
          </div>

          {/* Claim button */}
          <Button
            onClick={handleClaim}
            disabled={claimed}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            aria-label={claimed ? "보상 수령 완료" : "일일 보상 받기"}
          >
            {claimed ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                보상 수령 완료
              </>
            ) : (
              <>
                <Trophy className="w-4 h-4 mr-2" />
                보상 받기
              </>
            )}
          </Button>

          {/* Confetti canvas */}
          {showConfetti && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 10 }}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Snapshot Modal Component
const SnapshotModal = ({ snapshot, isOpen, onClose, onSaveNote }: SnapshotModalProps) => {
  const [note, setNote] = useState(snapshot?.note || "")
  const [scrubTime, setScrubTime] = useState(0)

  useEffect(() => {
    if (snapshot) {
      setNote(snapshot.note || "")
      setScrubTime(0)
    }
  }, [snapshot])

  const handleSave = () => {
    if (snapshot) {
      onSaveNote(note)
      onClose()
    }
  }

  if (!snapshot) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">집중 스냅샷</h2>
              <Button variant="ghost" size="sm" onClick={onClose} aria-label="모달 닫기">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Image */}
              <div className="aspect-video relative bg-slate-100 rounded-xl overflow-hidden">
                <img
                  src={snapshot.imageUrl || "/placeholder.svg"}
                  alt={`집중 스냅샷 ${snapshot.timestamp}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {snapshot.focusScore}점
                </div>
              </div>

              {/* Scrub slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">시간 조정</label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">-10초</span>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    value={scrubTime}
                    onChange={(e) => setScrubTime(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-slate-500">+10초</span>
                </div>
                <div className="text-center text-sm text-slate-600">
                  {scrubTime > 0 ? `+${scrubTime}초` : `${scrubTime}초`}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">메모</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="이 순간에 대한 메모를 작성하세요..."
                  className="w-full h-24 p-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onClose}>
                  취소
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Custom hooks
const useDailyReport = (date: string) => {
  const [data, setData] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // 임시로 mock 데이터 사용 (API 호출 대신)
        await new Promise(resolve => setTimeout(resolve, 500)) // 로딩 시뮬레이션
        
        const mockData: DailyReportData = {
          date,
          focusScorePoints: Array.from({ length: 36 }, (_, i) => {
            const minute = i * 5 // 5분 간격으로 3시간 (180분)
            const timestamp = new Date(date + `T14:${minute.toString().padStart(2, '0')}:00`).toISOString() // 오후 2시부터 시작
            
            // Generate realistic focus score pattern for 3-hour session
            let baseScore = 70
            if (minute < 30) baseScore = 60 // 시작 시 집중도 낮음
            else if (minute >= 30 && minute < 90) baseScore = 85 // 중간 구간 최고 집중
            else if (minute >= 90 && minute < 150) baseScore = 75 // 후반부 약간 하락
            else baseScore = 65 // 마무리 구간
            
            const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 15))
            
            const events: any[] = []
            if (Math.random() < 0.08) events.push('phone')
            if (Math.random() < 0.03) events.push('distraction')
            if (Math.random() < 0.02) events.push('break')
            if (score > 80) events.push('focus')
            if (Math.random() < 0.05) events.push('posture')
            
            return {
              ts: timestamp,
              score: Math.round(score),
              events
            }
          }),
          highlights: {
            peak: {
              time: "00:45",
              score: 95,
              duration: 45
            },
            drop: {
              time: "01:15",
              score: 35,
              reason: "휴대폰 사용 증가"
            },
            phoneUsage: {
              count: 3,
              totalTime: 8,
              peakTime: "01:00"
            }
          },
          aiAdvice: {
            message: "세션 중반에 집중도가 최고조에 달했습니다. 중요한 작업을 이 시간에 배치하는 것을 권장합니다.",
            routine: {
              id: "morning_focus",
              name: "아침 집중 루틴",
              enabled: false,
              description: "오전 9-11시 집중 세션 자동 시작"
            }
          },
          reward: {
            exp: 1250,
            level: 8,
            progress: 75,
            stickers: ["🌟", "🎯", "⚡", "🏆", "💎"]
          }
        }
        
        setData(mockData)
        
        // 실제 API 호출 (나중에 활성화)
        // const response = await fetch(`/api/report/daily?date=${date}`)
        // if (!response.ok) {
        //   if (response.status === 404) {
        //     throw new Error('해당 날짜의 데이터가 없습니다')
        //   }
        //   throw new Error('데이터를 불러올 수 없습니다')
        // }
        // const reportData = await response.json()
        // setData(reportData)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [date])

  return { data, loading, error }
}

const useSnapshotModal = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotData | null>(null)

  const openModal = (snapshot: SnapshotData) => {
    setSelectedSnapshot(snapshot)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setSelectedSnapshot(null)
  }

  return {
    isOpen,
    selectedSnapshot,
    openModal,
    closeModal
  }
}



// Main Daily Report Page Component
export default function DailyReportPage() {
  const params = useParams()
  const date = params.date as string
  const { data, loading, error } = useDailyReport(date)
  const { isOpen, selectedSnapshot, openModal, closeModal } = useSnapshotModal()
  const [claimed, setClaimed] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  // Validate date format
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date)

  const handlePointClick = (point: FocusScorePoint) => {
    const snapshot: SnapshotData = {
      id: point.ts,
      timestamp: new Date(point.ts).toLocaleTimeString('ko-KR'),
      imageUrl: "/placeholder.svg",
      focusScore: point.score,
      note: ""
    }
    openModal(snapshot)
  }

  const handleRoutineToggle = async (routineId: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/routine', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routineId, enabled })
      })
      
      if (!response.ok) {
        throw new Error('루틴 상태 변경에 실패했습니다')
      }
      
      const result = await response.json()
      console.log('Routine toggled:', result)
    } catch (error) {
      console.error('Failed to toggle routine:', error)
    }
  }

  const handleClaim = async () => {
    try {
      const response = await fetch('/api/reward?type=daily', { method: 'POST' })
      
      if (!response.ok) {
        throw new Error('보상 수령에 실패했습니다')
      }
      
      const result = await response.json()
      setClaimed(true)
      console.log('Reward claimed:', result)
    } catch (error) {
      console.error('Failed to claim reward:', error)
    }
  }

  const handleSaveNote = async (note: string) => {
    try {
      const response = await fetch('/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId: selectedSnapshot?.id, note })
      })
      
      if (!response.ok) {
        throw new Error('메모 저장에 실패했습니다')
      }
      
      const result = await response.json()
      console.log('Note saved:', result)
    } catch (error) {
      console.error('Failed to save note:', error)
    }
  }

  if (!isValidDate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <EmptyStateCard date={date} message="잘못된 날짜 형식입니다." />
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
        <EmptyStateCard date={date} message={error || "데이터를 불러올 수 없습니다."} />
      </div>
    )
  }

  const highlights = extractHighlights(data.focusScorePoints)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">FocusAI</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-slate-600">일일 리포트</span>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-slate-900 font-medium">{date}</span>
            </div>

                              <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard" className="flex items-center gap-2" aria-label="대시보드로 돌아가기">
                      <ArrowLeft className="w-4 h-4" />
                      대시보드로 돌아가기
                    </Link>
                  </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full space-y-6"
        >
          {/* Timeline Card */}
          <TimelineCard 
            data={data.focusScorePoints} 
            onPointClick={handlePointClick}
          />

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
                      <TimelineCard 
                        data={data.focusScorePoints} 
                        onPointClick={handlePointClick}
                      />
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
        </motion.div>
      </main>

      {/* Snapshot Modal */}
      <SnapshotModal
        snapshot={selectedSnapshot}
        isOpen={isOpen}
        onClose={closeModal}
        onSaveNote={handleSaveNote}
      />
    </div>
  )
} 