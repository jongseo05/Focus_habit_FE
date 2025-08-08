"use client"

import { useState, use } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import { useSessionReport } from "@/hooks/useReport"

export default function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const [activeTab, setActiveTab] = useState("overview")
  const { data: sessionData, isLoading, error } = useSessionReport(sessionId)

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">세션 리포트를 불러오는 중...</p>
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
          <p className="text-red-600 mb-2">세션 리포트를 불러오는데 실패했습니다</p>
          <p className="text-slate-500 text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-2">세션 데이터를 찾을 수 없습니다</p>
        </div>
      </div>
    )
  }

  const { session, samples, events, snapshots } = sessionData

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/report/daily/date/${new Date(session.started_at).toISOString().split('T')[0]}`} className="flex items-center gap-2" aria-label="일일 리포트로 돌아가기">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">일일 리포트</span>
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{session.context_tag || '집중 세션'}</h1>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(session.started_at).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                  })}</span>
                  <span>•</span>
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - 
                    {session.ended_at ? new Date(session.ended_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '진행 중'}
                  </span>
                </div>
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
          className="w-full space-y-6"
        >
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
                      <div className="bg-slate-50 rounded-lg p-8 text-center">
                        <p className="text-slate-600">집중력 추이 차트가 여기에 표시됩니다.</p>
                        <p className="text-sm text-slate-500 mt-2">샘플 데이터: {samples.length}개</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activities" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">활동 분석</h3>
                    <div className="bg-slate-50 rounded-lg p-8 text-center">
                      <p className="text-slate-600">활동 타임라인이 여기에 표시됩니다.</p>
                      <p className="text-sm text-slate-500 mt-2">이벤트 데이터: {events.length}개</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="evidence" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">증거 스냅샷</h3>
                    <div className="bg-slate-50 rounded-lg p-8 text-center">
                      <p className="text-slate-600">증거 스냅샷이 여기에 표시됩니다.</p>
                      <p className="text-sm text-slate-500 mt-2">스냅샷 데이터: {snapshots.length}개</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="achievements" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">세션 성취도</h3>
                    <div className="bg-slate-50 rounded-lg p-8 text-center">
                      <p className="text-slate-600">이 세션에서 달성한 성취도 정보가 여기에 표시됩니다.</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Session Info */}
          <Card className="rounded-2xl bg-white shadow-md">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">세션 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {session.goal_min || 0}분
                  </div>
                  <div className="text-sm text-slate-600">목표 집중 시간</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {session.focus_score || 0}점
                  </div>
                  <div className="text-sm text-slate-600">평균 집중도</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {events.length}
                  </div>
                  <div className="text-sm text-slate-600">감지된 이벤트</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
} 