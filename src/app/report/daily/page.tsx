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
  Lightbulb,
  Timer,
  TrendingDown,
  Eye,
  Coffee,
  Award,
  AlertTriangle,
  Info,
  Activity,
  Target as TargetIcon,
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

// Data-Driven Feedback Component
const DataDrivenFeedback = ({ sessions }: { sessions: any[] }) => {
  if (!sessions || sessions.length === 0) return null

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0)
  const avgScore = Math.round(sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length)
  const bestSession = sessions.reduce((best, current) => 
    current.averageScore > best.averageScore ? current : best
  )
  const worstSession = sessions.reduce((worst, current) => 
    current.averageScore < worst.averageScore ? current : worst
  )

  // 집중력 패턴 분석
  const getFocusPatternAnalysis = () => {
    const scoreVariance = Math.sqrt(
      sessions.reduce((sum, s) => sum + Math.pow(s.averageScore - avgScore, 2), 0) / sessions.length
    )
    
    let declinePoint = "안정적 유지"
    let declineDesc = "집중력이 안정적으로 유지됨"
    
    if (scoreVariance > 15) {
      declinePoint = "30분 후 저하"
      declineDesc = "세션 중반 이후 집중력 감소"
    } else if (scoreVariance > 10) {
      declinePoint = "45분 후 저하"
      declineDesc = "세션 후반 집중력 감소"
    }

    // 최적 집중 구간 계산
    const highFocusSessions = sessions.filter(s => s.averageScore >= 80)
    const avgHighFocusDuration = highFocusSessions.length > 0 
      ? Math.round(highFocusSessions.reduce((sum, s) => sum + s.duration, 0) / highFocusSessions.length)
      : 45

    return {
      declinePoint,
      declineDesc,
      optimalInterval: `${Math.max(30, Math.min(90, avgHighFocusDuration))}분`,
      optimalDesc: "고집중도(80점 이상) 구간"
    }
  }

  // 실용적 조언
  const getPracticalAdvice = () => {
    const totalHours = Math.round(totalDuration / 60)
    
    let restTiming = "30분 후 휴식"
    let restDesc = "적당한 휴식으로 회복"
    
    if (avgScore < 60) {
      restTiming = "25분 후 휴식"
      restDesc = "빈번한 휴식으로 집중력 유지"
    } else if (avgScore >= 80) {
      restTiming = "45분 후 휴식"
      restDesc = "긴 집중 구간 활용"
    }

    let nextStrategy = "현재 길이 유지"
    let strategyDesc = "집중도에 따른 권장 전략"
    
    if (sessions.length < 3) {
      nextStrategy = "세션 수 증가"
      strategyDesc = "하루 3-4회 세션 권장"
    } else if (avgScore < 70) {
      nextStrategy = "세션 길이 단축"
      strategyDesc = "짧은 세션으로 집중도 향상"
    }

    return {
      restTiming,
      restDesc,
      nextStrategy,
      strategyDesc
    }
  }

  // 성과 개선 팁
  const getPerformanceTips = () => {
    const scoreVariance = Math.sqrt(
      sessions.reduce((sum, s) => sum + Math.pow(s.averageScore - avgScore, 2), 0) / sessions.length
    )
    
    let stability = "매우 안정적"
    let stabilityDesc = "일관된 집중력 유지"
    
    if (scoreVariance > 20) {
      stability = "불안정"
      stabilityDesc = "집중력 편차가 큼"
    } else if (scoreVariance > 10) {
      stability = "보통"
      stabilityDesc = "적당한 안정성"
    }

    let priority = "집중도 향상"
    if (avgScore >= 80) {
      priority = "지속성 유지"
    } else if (totalDuration < 180) {
      priority = "학습 시간 증가"
    } else if (sessions.length < 3) {
      priority = "세션 빈도 증가"
    }

    return {
      stability,
      stabilityDesc,
      priority
    }
  }

  // 환경 최적화
  const getEnvironmentOptimization = () => {
    const avgSessionDuration = Math.round(totalDuration / sessions.length)
    
    let sessionLength = "짧은 세션 권장"
    let sessionDesc = "단기 집중에 집중"
    
    if (avgSessionDuration > 60) {
      sessionLength = "긴 세션 유지"
      sessionDesc = "장기 집중력 활용"
    } else if (avgSessionDuration > 30) {
      sessionLength = "중간 세션 적합"
      sessionDesc = "균형잡힌 세션 길이"
    }

    // 시간대별 분석
    const timeSlots = {
      morning: sessions.filter(s => s.startTime.includes('09') || s.startTime.includes('10')).length,
      afternoon: sessions.filter(s => s.startTime.includes('14') || s.startTime.includes('15')).length,
      evening: sessions.filter(s => s.startTime.includes('19') || s.startTime.includes('20')).length,
      night: sessions.filter(s => s.startTime.includes('21') || s.startTime.includes('22')).length
    }

    const bestTimeSlot = Object.entries(timeSlots).reduce((a, b) => timeSlots[a[0] as keyof typeof timeSlots] > timeSlots[b[0] as keyof typeof timeSlots] ? a : b)
    const timeSlotMap = {
      morning: "09시대",
      afternoon: "14시대", 
      evening: "19시대",
      night: "21시대"
    }

    return {
      sessionLength,
      sessionDesc,
      optimalTime: timeSlotMap[bestTimeSlot[0] as keyof typeof timeSlotMap] || "19시대"
    }
  }

  const focusPattern = getFocusPatternAnalysis()
  const practicalAdvice = getPracticalAdvice()
  const performanceTips = getPerformanceTips()
  const environmentOpt = getEnvironmentOptimization()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          데이터 기반 피드백
        </h2>
        <Badge variant="secondary" className="text-sm">
          AI 분석
        </Badge>
      </div>

      {/* 4칸 피드백 그리드 - 가로 꽉 차게 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* 집중력 패턴 분석 */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 flex-1">
          <CardContent className="p-4 h-full">
            <div className="flex items-start gap-3 h-full">
              <div className="flex-shrink-0 mt-1">
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">
                  집중력 패턴 분석
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {focusPattern.declinePoint}
                    </div>
                    <div className="text-xs text-slate-600">
                      {focusPattern.declineDesc}
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600">
                      {focusPattern.optimalInterval}
                    </div>
                    <div className="text-xs text-slate-600">
                      {focusPattern.optimalDesc}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 실용적 조언 */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 flex-1">
          <CardContent className="p-4 h-full">
            <div className="flex items-start gap-3 h-full">
              <div className="flex-shrink-0 mt-1">
                <TargetIcon className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">
                  실용적 조언
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {practicalAdvice.restTiming}
                    </div>
                    <div className="text-xs text-slate-600">
                      {practicalAdvice.restDesc}
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">
                      {practicalAdvice.nextStrategy}
                    </div>
                    <div className="text-xs text-slate-600">
                      {practicalAdvice.strategyDesc}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 성과 개선 팁 */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200 flex-1">
          <CardContent className="p-4 h-full">
            <div className="flex items-start gap-3 h-full">
              <div className="flex-shrink-0 mt-1">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">
                  성과 개선 팁
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {performanceTips.stability}
                    </div>
                    <div className="text-xs text-slate-600">
                      {performanceTips.stabilityDesc}
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {performanceTips.priority}
                    </div>
                    <div className="text-xs text-slate-600">
                      개선 우선순위
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 환경 최적화 */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 flex-1">
          <CardContent className="p-4 h-full">
            <div className="flex items-start gap-3 h-full">
              <div className="flex-shrink-0 mt-1">
                <Timer className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">
                  환경 최적화
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-orange-600">
                      {environmentOpt.sessionLength}
                    </div>
                    <div className="text-xs text-slate-600">
                      {environmentOpt.sessionDesc}
                    </div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-orange-600">
                      {environmentOpt.optimalTime}
                    </div>
                    <div className="text-xs text-slate-600">
                      시간대 최적화
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 수치적 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{avgScore}점</div>
            <div className="text-sm text-slate-600">평균 집중도</div>
            <div className="text-xs text-slate-500 mt-1">
              {avgScore >= 80 ? "우수" : avgScore >= 60 ? "양호" : "개선 필요"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {Math.round(totalDuration / 60)}시간
            </div>
            <div className="text-sm text-slate-600">총 학습 시간</div>
            <div className="text-xs text-slate-500 mt-1">
              {sessions.length}개 세션
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(totalDuration / sessions.length)}분
            </div>
            <div className="text-sm text-slate-600">평균 세션 길이</div>
            <div className="text-xs text-slate-500 mt-1">
              세션당 평균
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {bestSession.averageScore}점
            </div>
            <div className="text-sm text-slate-600">최고 집중도</div>
            <div className="text-xs text-slate-500 mt-1">
              {bestSession.title}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
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
          {/* Data-Driven Feedback Section */}
          {sessions && sessions.length > 0 && (
            <div className="mb-8">
              <DataDrivenFeedback sessions={sessions} />
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
                  {sessions
                    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                    .map((session, index) => (
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