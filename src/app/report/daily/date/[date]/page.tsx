"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Brain,
  Activity,
  Zap,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ko } from "date-fns/locale"

interface Session {
  session_id: string
  started_at: string
  ended_at: string | null
  focus_score: number | null
  goal_min: number | null
  context_tag: string | null
  notes: string | null
  distractions: number
}

interface DailyReport {
  date: string
  totalSessions: number
  totalFocusTime: number
  averageScore: number
  peakScore: number
  totalDistractions: number
  sessions: Session[]
}

export default function DailyDateReportPage() {
  const params = useParams()
  const date = params.date as string
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDailyReport = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/report/daily/${date}`)
        
        if (!response.ok) {
          throw new Error('일일 리포트를 불러오는데 실패했습니다')
        }
        
        const data = await response.json()
        setDailyReport(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    if (date) {
      fetchDailyReport()
    }
  }, [date])

  const getDateLabel = (dateStr: string) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const targetDate = new Date(dateStr)
    
    if (format(targetDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return '오늘'
    } else if (format(targetDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return '어제'
    } else {
      return format(targetDate, 'M월 d일', { locale: ko })
    }
  }

  const getDayOfWeek = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[new Date(dateStr).getDay()]
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700'
    if (score >= 60) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">일일 리포트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-2">일일 리포트를 불러오는데 실패했습니다</p>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <Button asChild>
            <Link href="/report/daily/select">
              날짜 선택으로 돌아가기
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!dailyReport) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-8 h-8 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 mb-2">해당 날짜의 데이터를 찾을 수 없습니다</p>
          <Button asChild>
            <Link href="/report/daily/select">
              날짜 선택으로 돌아가기
            </Link>
          </Button>
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
                <Link href="/report/daily/select" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">날짜 선택</span>
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {format(new Date(date), 'yyyy년 M월 d일', { locale: ko })} ({getDayOfWeek(date)})
                </h1>
                <p className="text-slate-600">{getDateLabel(date)}의 집중 리포트</p>
              </div>
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
          className="space-y-8"
        >
          {/* Daily Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">총 세션</p>
                    <p className="text-2xl font-bold text-blue-900">{dailyReport.totalSessions}개</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-emerald-700">총 집중 시간</p>
                    <p className="text-2xl font-bold text-emerald-900">{formatDuration(dailyReport.totalFocusTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">평균 집중도</p>
                    <p className={`text-2xl font-bold ${getScoreColor(dailyReport.averageScore)}`}>
                      {Math.round(dailyReport.averageScore)}점
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-amber-700">최고 집중도</p>
                    <p className={`text-2xl font-bold ${getScoreColor(dailyReport.peakScore)}`}>
                      {Math.round(dailyReport.peakScore)}점
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sessions List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">세션 목록</h2>
              <Badge variant="secondary" className="text-sm">
                {dailyReport.sessions.length}개 세션
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dailyReport.sessions
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .map((session, index) => {
                const startTime = new Date(session.started_at)
                const endTime = session.ended_at ? new Date(session.ended_at) : null
                const duration = endTime 
                  ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
                  : session.goal_min || 0

                return (
                  <motion.div
                    key={session.session_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={`/report/session/${session.session_id}`}>
                      <Card className="relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg bg-white hover:bg-slate-50">
                        <CardContent className="p-6">
                          {/* Session Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                세션 {index + 1}
                              </h3>
                              <p className="text-sm text-slate-600">
                                {format(startTime, 'HH:mm')} - {endTime ? format(endTime, 'HH:mm') : '진행중'}
                              </p>
                            </div>
                            {session.focus_score && (
                              <Badge className={getScoreBadgeColor(session.focus_score)}>
                                {Math.round(session.focus_score)}점
                              </Badge>
                            )}
                          </div>

                          {/* Session Details */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">집중 시간</span>
                              <span className="font-semibold text-slate-900">{formatDuration(duration)}</span>
                            </div>
                            
                            {session.context_tag && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">태그</span>
                                <span className="font-semibold text-slate-900">{session.context_tag}</span>
                              </div>
                            )}
                            
                            {session.distractions > 0 && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">방해 요소</span>
                                <span className="font-semibold text-red-600">{session.distractions}회</span>
                              </div>
                            )}
                          </div>

                          {/* Hover effect */}
                          <div className="absolute inset-0 bg-blue-500/5 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300" />
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
} 