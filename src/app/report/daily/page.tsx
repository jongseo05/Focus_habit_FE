"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Play,
  CheckCircle,
  Calendar,
  Zap,
  Brain,
} from "lucide-react"
import Link from "next/link"
import { useTodaySessions } from "@/hooks/useReport"

// Circular Progress Component
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
  const percentage = (value / max) * 100
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
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

// Session Card Component
const SessionCard = ({ session, index }: { session: any; index: number }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10B981"
    if (score >= 60) return "#F59E0B"
    return "#EF4444"
  }

  const getScoreGrade = (score: number) => {
    if (score >= 80) return "우수"
    if (score >= 60) return "양호"
    return "개선 필요"
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Link href={`/report/session/${session.id}`}>
        <Card className="relative overflow-hidden bg-gradient-to-br from-white to-slate-50/50 border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer group">
          {/* Active indicator */}
          {session.isActive && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600 font-medium">진행 중</span>
              </div>
            </div>
          )}

          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {session.title}
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">{session.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {session.isActive ? (
                  <Play className="w-5 h-5 text-green-500" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Time and Duration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>{session.startTime} - {session.endTime}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{formatDuration(session.duration)}</div>
                <div className="text-xs text-slate-500">총 집중 시간</div>
              </div>
            </div>

            {/* Score and Progress */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CircularProgress 
                  value={session.averageScore} 
                  max={100} 
                  color={getScoreColor(session.averageScore)}
                  size={48}
                  strokeWidth={4}
                />
                <div>
                  <div className="text-lg font-bold" style={{ color: getScoreColor(session.averageScore) }}>
                    {session.averageScore}점
                  </div>
                  <div className="text-xs text-slate-600">{getScoreGrade(session.averageScore)}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  style={{ 
                    backgroundColor: `${getScoreColor(session.averageScore)}20`,
                    color: getScoreColor(session.averageScore)
                  }}
                >
                  평균 집중도
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>집중도 분포</span>
                <span>{session.averageScore}%</span>
              </div>
              <Progress 
                value={session.averageScore} 
                className="h-2"
                style={{
                  backgroundColor: `${getScoreColor(session.averageScore)}20`,
                }}
              />
            </div>

            {/* Hover effect */}
            <div className="absolute inset-0 bg-blue-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

// Empty State Component
const EmptyState = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Brain className="w-12 h-12 text-blue-600" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">오늘의 집중 세션이 없습니다</h3>
      <p className="text-slate-600 mb-6 max-w-md mx-auto">
        아직 오늘 집중 세션을 시작하지 않으셨네요. 
        첫 번째 집중 세션을 시작하고 리포트를 확인해보세요.
      </p>
      <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
        <Link href="/dashboard">
          <Zap className="w-4 h-4 mr-2" />
          집중 세션 시작하기
        </Link>
      </Button>
    </motion.div>
  )
}

// Main Component
export default function DailyReportPage() {
  const today = new Date().toISOString().split('T')[0]
  const { data: sessions, isLoading, error } = useTodaySessions(today)

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">세션 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-2">세션 데이터를 불러오는데 실패했습니다</p>
          <p className="text-slate-500 text-sm">{error.message}</p>
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
                <h1 className="text-2xl font-bold text-slate-900">오늘의 집중 세션</h1>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(today).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                  })}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/report/daily/select">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  전체 리포트 보기
                </Link>
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
          className="w-full"
        >
          {/* Summary Stats */}
          {sessions && sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
                      <div className="text-sm text-blue-700">총 세션 수</div>
                    </div>
                    <Target className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / 60)}시간
                      </div>
                      <div className="text-sm text-emerald-700">총 집중 시간</div>
                    </div>
                    <Clock className="w-8 h-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.round(sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length)}점
                      </div>
                      <div className="text-sm text-purple-700">평균 집중도</div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-orange-600">
                        {sessions.filter(s => s.isActive).length}
                      </div>
                      <div className="text-sm text-orange-700">진행 중</div>
                    </div>
                    <Play className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sessions Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">세션 목록</h2>
              <Badge variant="secondary" className="text-sm">
                {sessions?.length || 0}개 세션
              </Badge>
            </div>

            {sessions && sessions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {sessions.map((session, index) => (
                    <SessionCard key={session.id} session={session} index={index} />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
} 