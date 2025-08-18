"use client"

import { useState, useMemo } from "react"
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
  Loader2,
  AlertCircle,
  Play,
  CheckCircle,
  Calendar,
  Zap,
  Brain,
  Lightbulb,
  Timer,
  Activity,
  Target as TargetIcon,
  History,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { useTodaySessions } from "@/hooks/useReport"

export default function TodayReportPage() {
  // 한국 시간대 기준으로 오늘 날짜 계산
  const today = (() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })()
  const { data: sessions, isLoading, error } = useTodaySessions(today)
  const [currentPage, setCurrentPage] = useState(0)
  
  // 세션을 최신순으로 정렬하고 페이지네이션
  const sortedSessions = useMemo(() => {
    if (!sessions) return []
    return sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  }, [sessions])
  
  const SESSIONS_PER_PAGE = 9 // 3x3 그리드
  const totalPages = Math.ceil(sortedSessions.length / SESSIONS_PER_PAGE)
  const startIndex = currentPage * SESSIONS_PER_PAGE
  const currentSessions = sortedSessions.slice(startIndex, startIndex + SESSIONS_PER_PAGE)
  
  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }
  
  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">오늘의 리포트를 불러오는 중...</p>
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
          <p className="text-red-600 mb-2">리포트를 불러오는데 실패했습니다</p>
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
              <div>
                <h1 className="text-3xl font-bold text-slate-900">오늘의 집중 리포트</h1>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(today + 'T12:00:00').toLocaleDateString('ko-KR', { 
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
                <Link href="/report/weekly">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  주간 트렌드
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/report/daily/select">
                  <History className="w-4 h-4 mr-2" />
                  과거 기록
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
          className="w-full space-y-8"
        >
          {/* Today's Summary Stats */}
          {sessions && sessions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-blue-700">총 세션</p>
                      <p className="text-2xl font-bold text-blue-900">{sessions.length}개</p>
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
                      <p className="text-2xl font-bold text-emerald-900">
                        {(() => {
                          const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0)
                          const hours = Math.floor(totalMinutes / 60)
                          const mins = totalMinutes % 60
                          return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`
                        })()}
                      </p>
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
                      <p className="text-2xl font-bold text-purple-900">
                        {Math.round(sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length)}점
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
                      <p className="text-2xl font-bold text-amber-900">
                        {Math.max(...sessions.map(s => s.averageScore))}점
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">오늘의 세션</h2>
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-sm">
                  {sessions?.length || 0}개 세션
                </Badge>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      {currentPage + 1} / {totalPages}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {sessions && sessions.length > 0 ? (
              <div className="space-y-6">
                {/* 3x3 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="wait">
                    {currentSessions.map((session, index) => (
                      <motion.div
                        key={`${currentPage}-${session.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
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
                                  <div className="text-lg font-bold text-slate-900">
                                    {(() => {
                                      const hours = Math.floor(session.duration / 60)
                                      const mins = session.duration % 60
                                      return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`
                                    })()}
                                  </div>
                                  <div className="text-xs text-slate-500">총 집중 시간</div>
                                </div>
                              </div>

                              {/* Score */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`text-lg font-bold ${
                                    session.averageScore >= 80 ? 'text-emerald-600' : 
                                    session.averageScore >= 60 ? 'text-amber-600' : 'text-red-600'
                                  }`}>
                                    {session.averageScore}점
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    {session.averageScore >= 80 ? '우수' : 
                                     session.averageScore >= 60 ? '양호' : '개선 필요'}
                                  </div>
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: session.averageScore >= 80 ? '#10B98120' : 
                                                   session.averageScore >= 60 ? '#F59E0B20' : '#EF444420',
                                    color: session.averageScore >= 80 ? '#10B981' : 
                                           session.averageScore >= 60 ? '#F59E0B' : '#EF4444'
                                  }}
                                >
                                  평균 집중도
                                </Badge>
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
                                />
                              </div>

                              {/* Hover effect */}
                              <div className="absolute inset-0 bg-blue-500/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </CardContent>
                          </Card>
                            </Link>
                          </motion.div>
                        ))}
                    </AnimatePresence>
                  </div>
                  
                  {/* 페이지네이션 버튼 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-8">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPrevPage}
                        disabled={currentPage === 0}
                        className="flex items-center gap-2"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        이전
                      </Button>
                      
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                              i === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages - 1}
                        className="flex items-center gap-2"
                      >
                        다음
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
            ) : (
              <div className="text-center py-16">
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
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  )
}
