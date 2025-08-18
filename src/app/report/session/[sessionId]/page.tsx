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
  TrendingUp,
  Activity,
} from "lucide-react"
import Link from "next/link"
import { useSessionReport } from "@/hooks/useReport"
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { compressFocusData, generateTimeLabels } from "@/lib/utils/dataCompression"

// 집중력 추이 그래프 컴포넌트
const FocusTrendChart = ({ samples }: { samples: any[] }) => {
  if (!samples || samples.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-slate-50 rounded-xl">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>집중력 데이터가 없습니다</p>
          <p className="text-sm text-slate-400 mt-1">집중 세션을 다시 시작해보세요</p>
        </div>
      </div>
    )
  }

  // 새로운 데이터 압축 로직 적용
  const formatChartData = (data: any[]) => {
    if (data.length === 0) return []

    // 데이터를 적절한 형태로 변환
    const focusData = data.map(sample => ({
      ts: sample.ts,
      score: sample.focus_score || sample.score || 0,
      confidence: sample.score_conf || 0.8
    }))

    // 집중도 특화 압축 적용 (최대 30개 포인트)
    const compressedData = compressFocusData(focusData, 30)
    const timeLabels = generateTimeLabels(compressedData, 'time')

    return compressedData.map((item, index) => ({
      time: timeLabels[index],
      timestamp: new Date(item.ts).getTime(),
      focusScore: Math.round(item.score),
      confidence: item.confidence,
      originalData: item
    }))
  }

  const chartData = formatChartData(samples)
  const maxScore = Math.max(...chartData.map(d => d.focusScore), 100)
  const minScore = Math.min(...chartData.map(d => d.focusScore), 0)

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-medium text-slate-900">{`시간: ${label}`}</p>
          <p className="text-emerald-600 font-bold">{`집중도: ${data.focusScore}점`}</p>
          <p className="text-blue-600">{`신뢰도: ${Math.round(data.confidence * 100)}%`}</p>
          <p className="text-xs text-slate-500">압축된 데이터 포인트</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
             {/* 유용한 통계 요약 */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {/* 집중 지속 시간 */}
         <div className="bg-white p-4 rounded-lg border border-slate-200">
           <div className="text-2xl font-bold text-emerald-600">
             {(() => {
               const highFocusCount = chartData.filter(d => d.focusScore >= 80).length
               const totalTime = chartData.length
               return totalTime > 0 ? Math.round((highFocusCount / totalTime) * 100) : 0
             })()}%
           </div>
           <div className="text-sm text-slate-600">고집중 시간 비율</div>
           <div className="text-xs text-slate-400 mt-1">80점 이상</div>
         </div>
         
         {/* 집중력 안정성 */}
         <div className="bg-white p-4 rounded-lg border border-slate-200">
           <div className="text-2xl font-bold text-blue-600">
             {(() => {
               const scores = chartData.map(d => d.focusScore)
               const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length
               const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length
               const stdDev = Math.sqrt(variance)
               return Math.round(100 - (stdDev / 100) * 100)
             })()}%
           </div>
           <div className="text-sm text-slate-600">집중력 안정성</div>
           <div className="text-xs text-slate-400 mt-1">변동성 낮음</div>
         </div>
         
         {/* 집중력 개선도 */}
         <div className="bg-white p-4 rounded-lg border border-slate-200">
           <div className="text-2xl font-bold text-orange-600">
             {(() => {
               if (chartData.length < 2) return 0
               const firstHalf = chartData.slice(0, Math.ceil(chartData.length / 2))
               const secondHalf = chartData.slice(Math.ceil(chartData.length / 2))
               const firstAvg = firstHalf.reduce((sum, d) => sum + d.focusScore, 0) / firstHalf.length
               const secondAvg = secondHalf.reduce((sum, d) => sum + d.focusScore, 0) / secondHalf.length
               return Math.round(secondAvg - firstAvg)
             })()}점
           </div>
           <div className="text-sm text-slate-600">집중력 개선도</div>
           <div className="text-xs text-slate-400 mt-1">후반부 - 전반부</div>
         </div>
         
         {/* 최고 집중 구간 */}
         <div className="bg-white p-4 rounded-lg border border-slate-200">
           <div className="text-2xl font-bold text-purple-600">
             {(() => {
               let maxStreak = 0
               let currentStreak = 0
               chartData.forEach(d => {
                 if (d.focusScore >= 85) {
                   currentStreak++
                   maxStreak = Math.max(maxStreak, currentStreak)
                 } else {
                   currentStreak = 0
                 }
               })
               return maxStreak
             })()}분
           </div>
           <div className="text-sm text-slate-600">최고 집중 구간</div>
           <div className="text-xs text-slate-400 mt-1">85점 이상 연속</div>
         </div>
       </div>

      {/* 집중력 추이 그래프 */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h4 className="font-semibold text-slate-900">집중력 추이</h4>
        </div>
        
                 <div className="h-80">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
               <defs>
                 <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                   <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                 </linearGradient>
               </defs>
               <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
               <XAxis 
                 dataKey="time" 
                 tick={{ fontSize: 12, fill: '#64748B' }}
                 interval="preserveStartEnd"
                 minTickGap={30}
               />
               <YAxis 
                 domain={[Math.max(0, minScore - 10), Math.min(100, maxScore + 10)]}
                 tick={{ fontSize: 12, fill: '#64748B' }}
                 tickFormatter={(value) => `${value}점`}
               />
               <Tooltip content={<CustomTooltip />} />
               <Area
                 type="monotone"
                 dataKey="focusScore"
                 stroke="#10B981"
                 strokeWidth={3}
                 fill="url(#focusGradient)"
                 dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                 activeDot={{ r: 6, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                 name="집중도"
               />
             </AreaChart>
           </ResponsiveContainer>
         </div>
      </div>
    </div>
  )
}

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

  const { session, samples, events } = sessionData

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/report" className="flex items-center gap-2" aria-label="오늘 리포트로 돌아가기">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">오늘 리포트</span>
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
                      <FocusTrendChart samples={samples} />
                    </div>
                  </div>
                </TabsContent>

                                 <TabsContent value="activities" className="mt-6">
                   <div>
                     <h3 className="text-lg font-semibold text-slate-900 mb-4">활동 분석</h3>
                     {events.length > 0 ? (
                       <div className="bg-slate-50 rounded-lg p-8">
                         <div className="space-y-4">
                           <h4 className="font-medium text-slate-900">이벤트 타임라인</h4>
                           <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                             {events.map((event, index) => (
                               <div key={index} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-200">
                                 <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center justify-between">
                                     <span className="font-medium text-slate-900 truncate">
                                       {event.event_type === 'focus' ? '집중 상태 변화' : 
                                        event.event_type === 'distraction' ? '방해 요소 감지' :
                                        event.event_type === 'break' ? '휴식 시간' :
                                        event.event_type === 'posture' ? '자세 변화' :
                                        event.event_type === 'audio_analysis' ? '음성 분석' :
                                        event.event_type}
                                     </span>
                                     <span className="text-sm text-slate-500 flex-shrink-0 ml-2">
                                       {new Date(event.ts).toLocaleTimeString('ko-KR', { 
                                         hour: '2-digit', 
                                         minute: '2-digit',
                                         second: '2-digit'
                                       })}
                                     </span>
                                   </div>
                                   {event.payload && (
                                     <div className="mt-1 text-sm text-slate-600">
                                       {event.payload.focus_status && (
                                         <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                                           {event.payload.focus_status}
                                         </span>
                                       )}
                                       {event.payload.focus_score && (
                                         <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                           {event.payload.focus_score}점
                                         </span>
                                       )}
                                     </div>
                                   )}
                                 </div>
                               </div>
                             ))}
                           </div>
                           <div className="text-center pt-2 border-t border-slate-200">
                             <p className="text-xs text-slate-500">
                               총 {events.length}개의 이벤트 • 스크롤하여 더 많은 이벤트 확인
                             </p>
                           </div>
                         </div>
                       </div>
                     ) : (
                       <div className="bg-slate-50 rounded-lg p-8 text-center">
                         <p className="text-slate-600">활동 타임라인이 여기에 표시됩니다.</p>
                         <p className="text-sm text-slate-500 mt-2">이벤트 데이터: {events.length}개</p>
                         <p className="text-xs text-slate-400 mt-1">
                           활동 이벤트가 기록되지 않았습니다.
                         </p>
                       </div>
                     )}
                   </div>
                 </TabsContent>

                <TabsContent value="evidence" className="mt-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">증거 스냅샷</h3>
                                         <div className="bg-slate-50 rounded-lg p-8 text-center">
                       <p className="text-slate-600">증거 스냅샷이 여기에 표시됩니다.</p>
                       <p className="text-sm text-slate-500 mt-2">스냅샷 데이터: 0개</p>
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
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* 실제 집중 시간 */}
                 <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                   <div className="flex items-center justify-center mb-3">
                     <Clock className="w-6 h-6 text-blue-600 mr-2" />
                     <h3 className="text-lg font-semibold text-blue-900">실제 집중 시간</h3>
                   </div>
                   <div className="text-center">
                     <div className="text-3xl font-bold text-blue-700 mb-2">
                       {(() => {
                         if (!session.ended_at) return '진행 중'
                         const startTime = new Date(session.started_at)
                         const endTime = new Date(session.ended_at)
                         const durationMs = endTime.getTime() - startTime.getTime()
                         const durationMinutes = Math.round(durationMs / (1000 * 60))
                         return `${durationMinutes}분`
                       })()}
                     </div>
                     <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
                       목표: {session.goal_min || 0}분
                     </div>
                   </div>
                 </div>
                 
                 {/* 집중 효율성 */}
                 <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-xl border border-emerald-200">
                   <div className="flex items-center justify-center mb-3">
                     <TrendingUp className="w-6 h-6 text-emerald-600 mr-2" />
                     <h3 className="text-lg font-semibold text-emerald-900">목표 달성률</h3>
                   </div>
                   <div className="text-center">
                     <div className="text-3xl font-bold text-emerald-700 mb-2">
                       {(() => {
                         if (!session.ended_at || !session.goal_min) return 'N/A'
                         const startTime = new Date(session.started_at)
                         const endTime = new Date(session.ended_at)
                         const actualMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                         const goalMinutes = session.goal_min
                         const efficiency = Math.round((actualMinutes / goalMinutes) * 100)
                         return `${efficiency}%`
                       })()}
                     </div>
                     <div className="text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block">
                       {session.goal_min ? `${session.goal_min}분 목표 대비` : '목표 미설정'}
                     </div>
                   </div>
                 </div>
                 
                 {/* 집중 품질 */}
                 <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                   <div className="flex items-center justify-center mb-3">
                     <BarChart3 className="w-6 h-6 text-purple-600 mr-2" />
                     <h3 className="text-lg font-semibold text-purple-900">고품질 집중률</h3>
                   </div>
                   <div className="text-center">
                     <div className="text-3xl font-bold text-purple-700 mb-2">
                       {(() => {
                         if (samples.length === 0) return 'N/A'
                         const highQualityCount = samples.filter(s => 
                           (s.focus_score || s.score || 0) >= 85
                         ).length
                         const qualityRate = Math.round((highQualityCount / samples.length) * 100)
                         return `${qualityRate}%`
                       })()}
                     </div>
                     <div className="text-sm text-purple-600 bg-purple-50 px-3 py-1 rounded-full inline-block">
                       85점 이상 비율
                     </div>
                   </div>
                 </div>
               </div>
              
                             {/* AI 피드백 */}
               <div className="mt-6 pt-6 border-t border-slate-200">
                 <h4 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                   <TrendingUp className="w-5 h-5 text-slate-600 mr-2" />
                   AI 집중 코치 피드백
                 </h4>
                 <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 p-6">
                   <div className="flex items-start gap-4">
                     <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                       <span className="text-white font-bold text-sm">AI</span>
                     </div>
                     <div className="flex-1 space-y-4">
                                               <div className="text-slate-800 leading-relaxed">
                          {(() => {
                            if (samples.length === 0) {
                              return (
                                <div className="space-y-2">
                                  <p>안녕하세요! 아직 집중 세션 데이터가 충분하지 않네요.</p>
                                  <p>첫 번째 집중 세션을 완료하면 더 구체적인 피드백을 드릴 수 있습니다.</p>
                                  <p>지금 바로 집중 세션을 시작해보세요! 💪</p>
                                </div>
                              )
                            }
                            
                            const avgScore = samples.reduce((sum, s) => 
                              sum + (s.focus_score || s.score || 0), 0
                            ) / samples.length
                            
                            const duration = session.ended_at 
                              ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)
                              : 0
                            
                            const highFocusCount = samples.filter(s => (s.focus_score || s.score || 0) >= 80).length
                            const highFocusRatio = Math.round((highFocusCount / samples.length) * 100)
                            
                            if (avgScore >= 85) {
                              return (
                                <div className="space-y-2">
                                  <p>와! 정말 훌륭한 집중 세션이었네요! 🎉</p>
                                  <p>평균 집중도 <span className="font-semibold text-emerald-600">{Math.round(avgScore)}점</span>으로 매우 높은 수준을 보여주셨습니다.</p>
                                  <p>{Math.round(duration)}분 동안 <span className="font-semibold text-blue-600">{highFocusRatio}%</span>의 시간을 고집중 상태로 유지하셨는데, 이는 정말 놀라운 성과입니다.</p>
                                </div>
                              )
                            } else if (avgScore >= 70) {
                              return (
                                <div className="space-y-2">
                                  <p>좋은 집중 세션이었습니다! 👍</p>
                                  <p>평균 집중도 <span className="font-semibold text-emerald-600">{Math.round(avgScore)}점</span>으로 안정적인 집중력을 보여주셨네요.</p>
                                  <p>{Math.round(duration)}분 동안 <span className="font-semibold text-blue-600">{highFocusRatio}%</span>의 시간을 고집중 상태로 유지하셨습니다.</p>
                                </div>
                              )
                            } else if (avgScore >= 50) {
                              return (
                                <div className="space-y-2">
                                  <p>집중 세션을 완료하셨네요! 💪</p>
                                  <p>평균 집중도 <span className="font-semibold text-orange-600">{Math.round(avgScore)}점</span>으로 개선의 여지가 있습니다.</p>
                                  <p>{Math.round(duration)}분 동안 <span className="font-semibold text-blue-600">{highFocusRatio}%</span>의 시간을 고집중 상태로 유지하셨는데, 더 나은 결과를 위해 몇 가지 제안을 드릴게요.</p>
                                </div>
                              )
                            } else {
                              return (
                                <div className="space-y-2">
                                  <p>집중 세션을 완료하셨습니다! 🌱</p>
                                  <p>평균 집중도 <span className="font-semibold text-red-600">{Math.round(avgScore)}점</span>으로 기본적인 집중력을 보여주셨네요.</p>
                                  <p>{Math.round(duration)}분 동안 <span className="font-semibold text-blue-600">{highFocusRatio}%</span>의 시간을 고집중 상태로 유지하셨습니다.</p>
                                  <p>집중력 향상을 위한 구체적인 방법을 제안해드릴게요.</p>
                                </div>
                              )
                            }
                          })()}
                        </div>
                       
                       {samples.length > 0 && (
                         <div className="space-y-3">
                           <div className="bg-white rounded-lg p-4 border border-slate-200">
                             <h5 className="font-semibold text-slate-900 mb-2">💡 주요 인사이트</h5>
                             <ul className="text-sm text-slate-700 space-y-1">
                               {(() => {
                                 const insights = []
                                 const avgScore = samples.reduce((sum, s) => 
                                   sum + (s.focus_score || s.score || 0), 0
                                 ) / samples.length
                                 
                                 if (avgScore >= 80) {
                                   insights.push("• 매우 높은 집중도로 일관된 성과를 보여주셨습니다")
                                   insights.push("• 현재의 학습 환경과 방법이 매우 효과적입니다")
                                 } else if (avgScore >= 70) {
                                   insights.push("• 안정적인 집중력을 유지하고 계십니다")
                                   insights.push("• 약간의 개선으로 더 나은 결과를 얻을 수 있습니다")
                                 } else {
                                   insights.push("• 집중력 향상의 여지가 있습니다")
                                   insights.push("• 학습 환경과 방법을 점검해보시는 것을 권장합니다")
                                 }
                                 
                                 const duration = session.ended_at 
                                   ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)
                                   : 0
                                 
                                 if (duration >= 60) {
                                   insights.push("• 장시간 집중 세션을 성공적으로 완료하셨습니다")
                                 } else if (duration >= 30) {
                                   insights.push("• 적당한 길이의 집중 세션을 완료하셨습니다")
                                 } else {
                                   insights.push("• 짧은 집중 세션으로 시작하셨네요")
                                 }
                                 
                                 return insights
                               })()}
                             </ul>
                           </div>
                           
                           <div className="bg-white rounded-lg p-4 border border-slate-200">
                             <h5 className="font-semibold text-slate-900 mb-2">🚀 개선 제안</h5>
                             <ul className="text-sm text-slate-700 space-y-1">
                               {(() => {
                                 const suggestions = []
                                 const avgScore = samples.reduce((sum, s) => 
                                   sum + (s.focus_score || s.score || 0), 0
                                 ) / samples.length
                                 
                                 if (avgScore >= 85) {
                                   suggestions.push("• 현재의 뛰어난 집중력을 유지하세요")
                                   suggestions.push("• 더 긴 세션에 도전해보세요 (90-120분)")
                                   suggestions.push("• 다른 학습 주제에도 이 방법을 적용해보세요")
                                 } else if (avgScore >= 70) {
                                   suggestions.push("• 휴식 시간을 30분마다 5분씩 가져보세요")
                                   suggestions.push("• 학습 환경의 소음을 줄여보세요")
                                   suggestions.push("• 다음 세션은 현재보다 10분 더 길게 시도해보세요")
                                 } else {
                                   suggestions.push("• 25분 집중 + 5분 휴식의 뽀모도로 기법을 시도해보세요")
                                   suggestions.push("• 학습 전 5분 명상으로 마음을 정리해보세요")
                                   suggestions.push("• 스마트폰을 다른 방에 두고 학습해보세요")
                                 }
                                 
                                 return suggestions
                               })()}
                             </ul>
                           </div>
                           
                           <div className="bg-white rounded-lg p-4 border border-slate-200">
                             <h5 className="font-semibold text-slate-900 mb-2">📈 다음 목표</h5>
                             <div className="text-sm text-slate-700">
                               {(() => {
                                 const avgScore = samples.reduce((sum, s) => 
                                   sum + (s.focus_score || s.score || 0), 0
                                 ) / samples.length
                                 
                                 if (avgScore >= 85) {
                                   return "현재의 뛰어난 집중력을 바탕으로 더 도전적인 학습 목표를 설정해보세요. 새로운 분야에 도전하거나 더 깊이 있는 학습을 시도해보는 것을 권장합니다."
                                 } else if (avgScore >= 70) {
                                   return "현재 집중도를 80점 이상으로 향상시키는 것을 목표로 해보세요. 휴식 타이밍과 학습 환경을 최적화하면 충분히 가능합니다."
                                 } else {
                                   return "먼저 70점 이상의 안정적인 집중도를 달성하는 것을 목표로 해보세요. 작은 개선부터 시작해서 점진적으로 향상시켜 나가세요."
                                 }
                               })()}
                             </div>
                           </div>
                         </div>
                       )}
                       
                       <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                         💡 이 피드백은 AI가 분석한 데이터를 바탕으로 제공됩니다. 개인적인 학습 스타일에 맞게 조정해서 사용하세요.
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
} 