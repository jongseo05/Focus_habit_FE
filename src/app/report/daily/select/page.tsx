"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  BarChart3,
  Clock,
  Target,
  TrendingUp,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { useDailyStats } from "@/hooks/useDailyStats"

export default function DateSelectPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // 실제 데이터 가져오기
  const { data: dailyStatsData, isLoading, error } = useDailyStats(30)

  // 실제 데이터가 있는 날짜들만 필터링
  const recentDates = dailyStatsData?.dailyStats
    ?.filter(stat => stat.hasData)
    ?.map(stat => new Date(stat.date))
    ?.sort((a, b) => b.getTime() - a.getTime()) || []

  // 실제 데이터에서 날짜별 통계 가져오기
  const getDateStats = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const isYesterday = format(date, 'yyyy-MM-dd') === format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    
    // 실제 데이터에서 해당 날짜 찾기
    const stat = dailyStatsData?.dailyStats?.find(s => s.date === dateStr)
    
    if (stat) {
      return {
        sessions: stat.sessions,
        totalTime: stat.totalTime,
        averageScore: stat.averageScore,
        hasData: stat.hasData,
        isToday,
        isYesterday
      }
    }
    
    // 데이터가 없는 경우
    return {
      sessions: 0,
      totalTime: 0,
      averageScore: 0,
      hasData: false,
      isToday,
      isYesterday
    }
  }



  const getDateLabel = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return '오늘'
    } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return '어제'
    } else {
      return format(date, 'M월 d일', { locale: ko })
    }
  }

  const getDayOfWeek = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[date.getDay()]
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">일일 통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    const isAuthError = error.message?.includes('Unauthorized') || error.message?.includes('401')
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-2">
            {isAuthError ? '로그인이 필요합니다' : '일일 통계를 불러오는데 실패했습니다'}
          </p>
          <p className="text-slate-500 text-sm mb-4">
            {isAuthError ? '다시 로그인해주세요' : error.message}
          </p>
          {isAuthError && (
            <Button asChild>
              <Link href="/login">
                로그인하기
              </Link>
            </Button>
          )}
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
                <Link href="/report/daily" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">일일 리포트 목록</span>
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">날짜별 리포트</h1>
                <p className="text-slate-600">원하는 날짜의 집중 리포트를 확인해보세요</p>
              </div>
            </div>

                         <div className="flex items-center gap-3">
               <Button 
                 variant="outline" 
                 className="flex items-center gap-2"
                 onClick={() => setIsCalendarOpen(!isCalendarOpen)}
               >
                 <CalendarIcon className="w-4 h-4" />
                 {selectedDate ? format(selectedDate, 'yyyy년 M월 d일', { locale: ko }) : '날짜 선택'}
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
          className="space-y-8"
        >
          {/* Selected Date Info */}
          {selectedDate && (
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <CalendarIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-blue-900">
                        {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} ({getDayOfWeek(selectedDate)})
                      </h2>
                      <p className="text-blue-700">{getDateLabel(selectedDate)}의 집중 리포트</p>
                    </div>
                  </div>
                  <Button asChild>
                    <Link href={`/report/daily/date/${format(selectedDate, 'yyyy-MM-dd')}`}>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      리포트 보기
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

                     {/* Recent Dates Grid */}
           <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h2 className="text-xl font-semibold text-slate-900">활동 기록</h2>
               <Badge variant="secondary" className="text-sm">
                 {recentDates.length}일
               </Badge>
             </div>

                         {recentDates.length === 0 ? (
               <Card className="bg-white/80 backdrop-blur-sm">
                 <CardContent className="p-8 text-center">
                   <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                     <BarChart3 className="w-8 h-8 text-slate-400" />
                   </div>
                   <h3 className="text-lg font-semibold text-slate-900 mb-2">아직 활동 기록이 없습니다</h3>
                   <p className="text-slate-600 mb-4">집중 세션을 시작하면 여기에 기록이 표시됩니다</p>
                   <Button asChild>
                     <Link href="/dashboard">
                       대시보드로 이동
                     </Link>
                   </Button>
                 </CardContent>
               </Card>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {recentDates.map((date, index) => {
                const stats = getDateStats(date)
                const dateKey = format(date, 'yyyy-MM-dd')
                
                return (
                  <motion.div
                    key={dateKey}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={`/report/daily/date/${dateKey}`}>
                      <Card className={`relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg ${
                        stats.isToday ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200' :
                        stats.isYesterday ? 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-200' :
                        'bg-white hover:bg-slate-50'
                      }`}>
                        <CardContent className="p-4">
                          {/* Date Header */}
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="text-sm font-medium text-slate-600">
                                {format(date, 'M월 d일', { locale: ko })}
                              </div>
                              <div className="text-xs text-slate-500">
                                {getDayOfWeek(date)}요일
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {stats.isToday && (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">오늘</Badge>
                              )}
                              {stats.isYesterday && (
                                <Badge className="bg-green-100 text-green-700 text-xs">어제</Badge>
                              )}
                            </div>
                          </div>

                                                     {/* Stats */}
                           <div className="space-y-2">
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-slate-600">세션</span>
                               <span className="font-semibold text-slate-900">{stats.sessions}개</span>
                             </div>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-slate-600">시간</span>
                               <span className="font-semibold text-slate-900">
                                 {Math.floor(stats.totalTime / 60)}시간 {stats.totalTime % 60}분
                               </span>
                             </div>
                             <div className="flex items-center justify-between text-sm">
                               <span className="text-slate-600">집중도</span>
                               <span className="font-semibold" style={{ 
                                 color: stats.averageScore >= 80 ? '#10B981' : 
                                        stats.averageScore >= 60 ? '#F59E0B' : '#EF4444' 
                               }}>
                                 {Math.round(stats.averageScore)}점
                               </span>
                             </div>
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
             )}
          </div>

                     {/* Quick Stats */}
           <Card className="bg-white/80 backdrop-blur-sm">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <TrendingUp className="w-5 h-5 text-purple-500" />
                 최근 30일 요약
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="text-center">
                   <div className="text-2xl font-bold text-blue-600">
                     {dailyStatsData?.totalStats?.activeDays || 0}일
                   </div>
                   <div className="text-sm text-slate-600">활동한 날</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-emerald-600">
                     {dailyStatsData?.totalStats?.averageScore || 0}점
                   </div>
                   <div className="text-sm text-slate-600">평균 집중도</div>
                 </div>
                 <div className="text-center">
                   <div className="text-2xl font-bold text-purple-600">
                     {dailyStatsData?.totalStats?.totalSessions || 0}개
                   </div>
                   <div className="text-sm text-slate-600">총 세션 수</div>
                 </div>
               </div>
             </CardContent>
           </Card>
        </motion.div>
      </main>
    </div>
  )
} 