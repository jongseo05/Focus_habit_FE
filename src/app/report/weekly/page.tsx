"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, ArrowLeft, Calendar, Loader2, AlertCircle, TrendingUp, Target, Clock, Zap, Activity } from "lucide-react"
import Link from "next/link"
import { useWeeklyReport } from "@/hooks/useWeeklyReport"
import { useLearningInsights } from "@/hooks/useLearningInsights"
import { useState, useRef, useEffect } from "react"
import { AnimatePresence } from "framer-motion"

// 통합된 주간 집중도 분석 컴포넌트
const WeeklyFocusAnalysis = ({ 
  data, 
  heatmapData 
}: { 
  data: Array<{ dayOfWeek: string; focusScore: number; sessionDuration: number; distractions: number }>
  heatmapData: number[][]
}) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'chart' | 'heatmap'>('chart')
  const containerRef = useRef<HTMLDivElement>(null)

  // 요일 라벨
  const days = ['월', '화', '수', '목', '금', '토', '일']
  
  // 시간대 라벨 (24시간)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // 히트맵 데이터가 없으면 빈 배열로 초기화
  const safeHeatmapData = heatmapData || Array.from({ length: 7 }, () => Array(24).fill(0))

  // 데이터가 없을 때의 처리
  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>이번 주 집중 세션 데이터가 없습니다</p>
          <p className="text-sm mt-2">집중 세션을 시작하여 데이터를 생성해보세요</p>
        </div>
      </div>
    )
  }

  const maxScore = Math.max(...data.map(d => d.focusScore))
  const minScore = Math.min(...data.map(d => d.focusScore))
  const scoreRange = maxScore - minScore || 1

  const chartHeight = 240
  const barWidth = 140
  const barGap = 20
  const totalWidth = data.length * (barWidth + barGap) - barGap

  const getBarHeight = (score: number) => {
    const normalizedScore = (score - minScore) / scoreRange
    return normalizedScore * chartHeight
  }

  const getBarGradient = (score: number) => {
    if (score >= 80) return "url(#emeraldGradient)"
    if (score >= 60) return "url(#blueGradient)"
    return "url(#orangeGradient)"
  }

  const getCellColor = (value: number) => {
    if (value === 0) return 'bg-slate-100' // 데이터 없음
    if (value >= 80) return 'bg-gradient-to-br from-emerald-500 to-emerald-600' // 매우 높음
    if (value >= 60) return 'bg-gradient-to-br from-emerald-400 to-emerald-500' // 높음
    if (value >= 40) return 'bg-gradient-to-br from-blue-400 to-blue-500'    // 보통
    if (value >= 20) return 'bg-gradient-to-br from-orange-400 to-orange-500'  // 낮음
    return 'bg-gradient-to-br from-slate-300 to-slate-400'                    // 매우 낮음
  }

  const getCellOpacity = (value: number) => {
    if (value === 0) return 'opacity-30' // 데이터 없음
    if (value >= 80) return 'opacity-90'
    if (value >= 60) return 'opacity-80'
    if (value >= 40) return 'opacity-70'
    if (value >= 20) return 'opacity-60'
    return 'opacity-40'
  }

  const handleCellHover = (e: React.MouseEvent, day: number, hour: number) => {
    setHoveredCell({ day, hour })
  }

  const handleCellLeave = () => {
    setHoveredCell(null)
  }

  return (
    <Card className="rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0 overflow-hidden relative">
      {/* 배경 장식 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5 rounded-3xl" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full blur-2xl" />
      
      <CardHeader className="pb-6 relative z-10">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <div>주간 집중도 분석</div>
            <div className="text-sm font-normal text-slate-600 mt-1">요일별 및 시간대별 집중 패턴을 확인하세요</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        {/* 탭 네비게이션 */}
        <div className="flex justify-center mb-8 relative z-10">
          <div className="flex bg-white/60 backdrop-blur-sm rounded-2xl p-1 shadow-xl border border-white/40">
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-500 flex items-center gap-2 ${
                activeTab === 'chart' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              요일별 차트
            </button>
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`px-8 py-4 rounded-xl text-sm font-semibold transition-all duration-500 flex items-center gap-2 ${
                activeTab === 'heatmap' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg transform scale-105' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              시간대별 히트맵
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'chart' && (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <div ref={containerRef} className="relative bg-gradient-to-br from-slate-50/50 to-white/50 rounded-2xl p-6 border border-white/40 backdrop-blur-sm">
                                 <svg
                   width="100%"
                   height={chartHeight + 60}
                   viewBox={`0 0 ${totalWidth + 60} ${chartHeight + 60}`}
                   className="overflow-visible"
                 >
                                     <defs>
                     {/* 그라데이션 정의 */}
                     <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                       <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                       <stop offset="100%" stopColor="#059669" stopOpacity="1" />
                     </linearGradient>
                     <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                       <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                       <stop offset="100%" stopColor="#2563EB" stopOpacity="1" />
                     </linearGradient>
                                           <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#D97706" stopOpacity="1" />
                      </linearGradient>
                      
                      {/* 선 그래프용 그라데이션 */}
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="50%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#F59E0B" />
                      </linearGradient>
                      
                      <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
                      </linearGradient>
                   </defs>
                  
                                     {/* Y축 라벨 */}
                   {[100, 80, 60, 40, 20].map((value, index) => (
                     <g key={value}>
                       <text 
                         x="20" 
                         y={20 + (index * chartHeight) / 4 + 5} 
                         textAnchor="end" 
                         className="text-xs fill-slate-400 font-medium"
                       >
                         {value}
                       </text>
                       <line
                         x1="25"
                         y1={20 + (index * chartHeight) / 4}
                         x2={totalWidth + 30}
                         y2={20 + (index * chartHeight) / 4}
                         stroke="#E2E8F0"
                         strokeWidth="1"
                         strokeDasharray="4,4"
                         opacity="0.5"
                       />
                     </g>
                   ))}

                                     {/* 선 그래프 */}
                   <g transform="translate(30, 20)">
                     {/* 선 그래프 경로 */}
                     <motion.path
                       d={data.map((day, index) => {
                         const pointY = chartHeight - getBarHeight(day.focusScore)
                         const pointX = index * (barWidth + barGap) + barWidth / 2
                         return `${index === 0 ? 'M' : 'L'} ${pointX} ${pointY}`
                       }).join(' ')}
                       stroke="url(#lineGradient)"
                       strokeWidth="4"
                       fill="none"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       className="transition-all duration-300"
                       initial={{ pathLength: 0 }}
                       animate={{ pathLength: 1 }}
                       transition={{ duration: 1.5, ease: "easeInOut" }}
                     />
                     
                     {/* 영역 채우기 */}
                     <motion.path
                       d={`${data.map((day, index) => {
                         const pointY = chartHeight - getBarHeight(day.focusScore)
                         const pointX = index * (barWidth + barGap) + barWidth / 2
                         return `${index === 0 ? 'M' : 'L'} ${pointX} ${pointY}`
                       }).join(' ')} L ${data.length * (barWidth + barGap) - barGap + barWidth / 2} ${chartHeight} L ${barWidth / 2} ${chartHeight} Z`}
                       fill="url(#areaGradient)"
                       opacity="0.3"
                       className="transition-all duration-300"
                       initial={{ opacity: 0 }}
                       animate={{ opacity: 0.3 }}
                       transition={{ duration: 1, delay: 0.5 }}
                     />
                     
                     {/* 데이터 포인트 */}
                     {data.map((day, index) => {
                       const pointY = chartHeight - getBarHeight(day.focusScore)
                       const pointX = index * (barWidth + barGap) + barWidth / 2
                       const isHovered = hoveredDay === day.dayOfWeek

                       return (
                         <g key={day.dayOfWeek}>
                                                       {/* 포인트 배경 (호버 효과용) */}
                            <circle
                              cx={pointX}
                              cy={pointY}
                              r="12"
                              fill="transparent"
                              className="transition-all duration-300 cursor-pointer"
                              onMouseEnter={() => setHoveredDay(day.dayOfWeek)}
                              onMouseLeave={() => setHoveredDay(null)}
                            />
                           
                           {/* 포인트 */}
                           <motion.circle
                             cx={pointX}
                             cy={pointY}
                             r={isHovered ? "8" : "6"}
                             fill={day.focusScore >= 80 ? "#10B981" : day.focusScore >= 60 ? "#3B82F6" : "#F59E0B"}
                             stroke="white"
                             strokeWidth="3"
                             className="transition-all duration-300"
                             style={{
                               filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                             }}
                             initial={{ scale: 0, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             transition={{ duration: 0.5, delay: index * 0.1 }}
                           />
                           
                           {/* 점수 라벨 */}
                           <text
                             x={pointX}
                             y={pointY - 20}
                             textAnchor="middle"
                             className="text-sm font-bold fill-slate-700"
                             style={{ opacity: isHovered ? 1 : 0.7 }}
                           >
                             {day.focusScore}점
                           </text>

                           {/* X축 라벨 */}
                           <text
                             x={pointX}
                             y={chartHeight + 35}
                             textAnchor="middle"
                             className="text-sm fill-slate-600 font-medium"
                           >
                             {day.dayOfWeek}
                           </text>
                         </g>
                       )
                     })}
                   </g>
                </svg>

                                 
              </div>

                             {/* 요약 통계 */}
               <div className="mt-8 grid grid-cols-4 gap-4">
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.5 }}
                   className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 border border-emerald-200"
                 >
                   <div className="text-center">
                     <div className="text-2xl font-bold text-emerald-600">
                       {maxScore}점
                     </div>
                     <div className="text-sm text-emerald-700 font-medium">최고점</div>
                   </div>
                 </motion.div>
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.6 }}
                   className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200"
                 >
                   <div className="text-center">
                     <div className="text-2xl font-bold text-blue-600">
                       {Math.round(data.reduce((sum, d) => sum + d.focusScore, 0) / data.length)}점
                     </div>
                     <div className="text-sm text-blue-700 font-medium">평균</div>
                   </div>
                 </motion.div>
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.7 }}
                   className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 border border-orange-200"
                 >
                   <div className="text-center">
                     <div className="text-2xl font-bold text-orange-600">
                       {minScore}점
                     </div>
                     <div className="text-sm text-orange-700 font-medium">최저점</div>
                   </div>
                 </motion.div>
                 <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: 0.8 }}
                   className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200"
                 >
                   <div className="text-center">
                     <div className="text-2xl font-bold text-purple-600">
                       {Math.round(data.reduce((sum, d) => sum + d.sessionDuration, 0) * 10) / 10}시간
                     </div>
                     <div className="text-sm text-purple-700 font-medium">총 시간</div>
                   </div>
                 </motion.div>
               </div>
            </motion.div>
          )}

          {activeTab === 'heatmap' && (
            <motion.div
              key="heatmap"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
                             {/* Heatmap Grid */}
               <div className="bg-gradient-to-br from-slate-50/50 to-white/50 rounded-2xl p-6 border border-white/40 backdrop-blur-sm mb-6">
                 <div className="grid grid-cols-25 gap-1" style={{ gridTemplateColumns: '60px repeat(24, 1fr)' }}>
                   {/* 시간대 헤더 */}
                   <div className="h-8"></div> {/* 빈 셀 */}
                   {hours.map(hour => (
                     <div key={hour} className="text-xs text-slate-500 text-center py-2 font-medium">
                       {hour.toString().padStart(2, '0')}
                     </div>
                   ))}

                   {/* 요일별 데이터 */}
                   {days.map((day, dayIndex) => (
                     <div key={day} className="contents">
                       {/* 요일 라벨 */}
                       <div className="text-sm text-slate-700 font-medium text-right pr-3 py-2 flex items-center justify-end h-7">
                         {day}
                       </div>
                       
                                               {/* 시간대별 셀 */}
                        {hours.map((hour, hourIndex) => {
                          const value = safeHeatmapData[dayIndex][hourIndex]
                          return (
                            <motion.div
                              key={`${dayIndex}-${hourIndex}`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: (dayIndex * 24 + hourIndex) * 0.001 }}
                              className={`
                                w-full h-7 rounded-lg cursor-pointer transition-all duration-300
                                ${getCellColor(value)} ${getCellOpacity(value)}
                                hover:scale-110 hover:shadow-lg hover:z-10 relative
                                border border-white/20
                              `}
                              onMouseEnter={(e) => handleCellHover(e, dayIndex, hourIndex)}
                              onMouseLeave={handleCellLeave}
                              title={`${day}요일 ${hour}시: ${value}점`}
                            />
                          )
                        })}
                     </div>
                   ))}
                 </div>
               </div>

              {/* 범례 */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-white/40">
                                 <div className="flex items-center justify-center gap-6 flex-wrap">
                   {[
                     { color: 'bg-slate-100', label: '데이터 없음', opacity: 'opacity-30' },
                     { color: 'bg-gradient-to-r from-slate-300 to-slate-400', label: '매우 낮음 (0-19)', opacity: 'opacity-40' },
                     { color: 'bg-gradient-to-r from-orange-400 to-orange-500', label: '낮음 (20-39)', opacity: 'opacity-60' },
                     { color: 'bg-gradient-to-r from-blue-400 to-blue-500', label: '보통 (40-59)', opacity: 'opacity-70' },
                     { color: 'bg-gradient-to-r from-emerald-400 to-emerald-500', label: '높음 (60-79)', opacity: 'opacity-80' },
                     { color: 'bg-gradient-to-r from-emerald-500 to-emerald-600', label: '매우 높음 (80-100)', opacity: 'opacity-90' }
                   ].map((item, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="flex items-center gap-2 bg-white/50 rounded-lg px-3 py-2 shadow-sm"
                    >
                      <div className={`w-4 h-4 rounded-sm ${item.color} ${item.opacity}`}></div>
                      <span className="text-xs text-slate-700 font-medium">{item.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

                             
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

// 주간 목표 달성 컴포넌트
const WeeklyGoals = () => {
  const goals = [
    {
      id: 1,
      title: "5일 연속 학습",
      progress: 4,
      target: 5,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "from-green-500 to-emerald-600"
    },
    {
      id: 2,
      title: "평균 집중도 80점 이상",
      progress: 75,
      target: 80,
      icon: <Target className="w-5 h-5" />,
      color: "from-blue-500 to-blue-600"
    },
    {
      id: 3,
      title: "총 학습 시간 20시간",
      progress: 18,
      target: 20,
      icon: <Clock className="w-5 h-5" />,
      color: "from-purple-500 to-purple-600"
    }
  ]

  return (
    <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          이번 주 목표
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {goals.map((goal) => {
            const percentage = Math.min((goal.progress / goal.target) * 100, 100)
            const isCompleted = goal.progress >= goal.target

            return (
              <div key={goal.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${goal.color} rounded-lg flex items-center justify-center text-white`}>
                      {goal.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{goal.title}</h4>
                      <p className="text-sm text-slate-600">
                        {goal.progress} / {goal.target}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${isCompleted ? 'text-green-600' : 'text-slate-700'}`}>
                      {Math.round(percentage)}%
                    </div>
                    {isCompleted && (
                      <div className="text-xs text-green-600 font-medium">달성!</div>
                    )}
                  </div>
                </div>
                <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${goal.color} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, delay: 0.2 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// 주간 학습 패턴 분석
const WeeklyLearningPatterns = ({ weeklyData }: { weeklyData: any }) => {
  const { insights, isLoading, error, refetch } = useLearningInsights(weeklyData)

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/20 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            학습 패턴 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
              <p className="text-slate-600">AI가 학습 패턴을 분석하고 있습니다...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !insights) {
    return (
      <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/20 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            학습 패턴 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-red-600 mb-2">학습 인사이트를 불러오는데 실패했습니다</p>
              <Button onClick={refetch} variant="outline" size="sm">
                다시 시도
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/20 border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          학습 패턴 분석
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* AI 인사이트 섹션 */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">AI</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-indigo-900">개인화된 학습 인사이트</h3>
              <p className="text-sm text-indigo-700">당신의 데이터를 분석한 맞춤형 조언</p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* 1. 학습 스타일 분석 */}
            <div className="bg-white/60 rounded-xl p-6 border border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-indigo-900">학습 스타일 분석</h4>
              </div>
              <div className="space-y-3 text-sm text-indigo-800">
                <p className="font-medium text-base">당신은 &apos;{insights.learningStyle.type}&apos;입니다!</p>
                <p>{insights.learningStyle.description}</p>
                <p className="text-indigo-600">💡 {insights.learningStyle.recommendation}</p>
              </div>
            </div>
            
                         {/* 2. 집중력 패턴 */}
             <div className="bg-white/60 rounded-xl p-6 border border-indigo-200">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                   <TrendingUp className="w-5 h-5 text-white" />
                 </div>
                 <h4 className="text-lg font-semibold text-indigo-900">집중력 패턴</h4>
               </div>
               <div className="space-y-4 text-sm text-indigo-800">
                 <p className="font-medium text-base">최적 집중 시간대:</p>
                 <div className="flex flex-wrap gap-2">
                   {insights.focusPattern.peakHours.map((hour, index) => (
                     <span key={index} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                       {hour}
                     </span>
                   ))}
                 </div>
                 
                 {/* 집중력 저하 패턴 시각화 */}
                 <div className="space-y-2">
                   <p className="font-medium text-base">집중력 저하 패턴:</p>
                   <div className="bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500 h-3 rounded-full relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-yellow-500/20 to-red-500/20"></div>
                     <div className="absolute top-0 left-0 w-1/3 h-full bg-emerald-500/30"></div>
                     <div className="absolute top-0 left-1/3 w-1/3 h-full bg-yellow-500/30"></div>
                     <div className="absolute top-0 left-2/3 w-1/3 h-full bg-red-500/30"></div>
                   </div>
                   <div className="flex justify-between text-xs text-slate-600">
                     <span>시작</span>
                     <span>중간</span>
                     <span>후반</span>
                   </div>
                   <p className="text-sm">{insights.focusPattern.declinePattern}</p>
                 </div>
                 
                 {/* 시간대별 집중도 히트맵 */}
                 {insights.focusPattern.peakHours.length > 0 && insights.focusPattern.peakHours[0] !== '데이터 부족' && (
                   <div className="space-y-2">
                     <p className="font-medium text-base">24시간 집중도 분포:</p>
                     <div className="grid grid-cols-24 gap-1 h-8">
                       {Array.from({ length: 24 }, (_, hour) => {
                         const isPeakHour = insights.focusPattern.peakHours.some(peak => {
                           const [start, end] = peak.split('-').map(h => parseInt(h))
                           return hour >= start && hour < end
                         })
                         return (
                           <div
                             key={hour}
                             className={`rounded-sm transition-all duration-300 ${
                               isPeakHour 
                                 ? 'bg-emerald-500' 
                                 : hour >= 6 && hour <= 22 
                                   ? 'bg-yellow-400' 
                                   : 'bg-slate-200'
                             }`}
                             title={`${hour}시: ${isPeakHour ? '최적' : hour >= 6 && hour <= 22 ? '보통' : '낮음'}`}
                           />
                         )
                       })}
                     </div>
                     <div className="flex justify-between text-xs text-slate-600">
                       <span>0시</span>
                       <span>12시</span>
                       <span>23시</span>
                     </div>
                   </div>
                 )}
                 
                 <p className="text-indigo-600">💡 {insights.focusPattern.recommendation}</p>
               </div>
             </div>
            
                         {/* 3. 학습 효율성 분석 */}
             <div className="bg-white/60 rounded-xl p-6 border border-indigo-200">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                   <BarChart3 className="w-5 h-5 text-white" />
                 </div>
                 <h4 className="text-lg font-semibold text-indigo-900">학습 효율성 분석</h4>
               </div>
               <div className="space-y-4 text-sm text-indigo-800">
                 <p className="font-medium text-base">세션 길이별 평균 집중도:</p>
                 
                 {/* 세션 길이별 효율성 차트 */}
                 {insights.efficiencyAnalysis.sessionLengths.length > 0 && insights.efficiencyAnalysis.sessionLengths[0].duration !== '데이터 부족' && (
                   <div className="space-y-3">
                     {insights.efficiencyAnalysis.sessionLengths.map((session, index) => {
                       const percentage = session.averageScore
                       const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                       const bgColor = percentage >= 80 ? 'bg-green-100' : percentage >= 60 ? 'bg-yellow-100' : 'bg-red-100'
                       
                       return (
                         <div key={index} className="space-y-2">
                           <div className="flex justify-between items-center">
                             <span className="font-medium">{session.duration} 세션:</span>
                             <span className={`font-bold ${
                               percentage >= 80 ? 'text-green-600' : 
                               percentage >= 60 ? 'text-orange-600' : 'text-red-600'
                             }`}>
                               {session.averageScore}점
                             </span>
                           </div>
                           <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                             <div 
                               className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
                               style={{ width: `${percentage}%` }}
                             />
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                           </div>
                         </div>
                       )
                     })}
                   </div>
                 )}
                 
                 {/* 데이터 부족 시 안내 */}
                 {insights.efficiencyAnalysis.sessionLengths.length > 0 && insights.efficiencyAnalysis.sessionLengths[0].duration === '데이터 부족' && (
                   <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                     <div className="flex items-center gap-2 text-slate-600">
                       <div className="w-4 h-4 bg-slate-400 rounded-full"></div>
                       <span className="text-sm">데이터 부족</span>
                     </div>
                   </div>
                 )}
                 
                 <p className="text-indigo-600">💡 {insights.efficiencyAnalysis.recommendation}</p>
               </div>
             </div>

                         {/* 4. 주간 트렌드 */}
             <div className="bg-white/60 rounded-xl p-6 border border-indigo-200">
               <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                   <Target className="w-5 h-5 text-white" />
                 </div>
                 <h4 className="text-lg font-semibold text-indigo-900">주간 트렌드</h4>
               </div>
               <div className="space-y-4 text-sm text-indigo-800">
                 
                 {/* 요일별 성과 시각화 */}
                 {insights.weeklyTrends.bestDay !== '데이터 부족' && (
                   <div className="space-y-3">
                     <div className="flex gap-4">
                       <div className="flex-1">
                         <p className="font-medium mb-2">최고 효율:</p>
                         <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                             <p className="text-green-700 font-bold">{insights.weeklyTrends.bestDay}</p>
                           </div>
                         </div>
                       </div>
                       <div className="flex-1">
                         <p className="font-medium mb-2">개선 필요:</p>
                         <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                             <p className="text-orange-700 font-bold">{insights.weeklyTrends.worstDay}</p>
                           </div>
                         </div>
                       </div>
                     </div>
                     
                     {/* 요일별 성과 차트 */}
                     <div className="space-y-2">
                       <p className="font-medium text-base">요일별 성과 분포:</p>
                       <div className="grid grid-cols-7 gap-1 h-12">
                         {['월', '화', '수', '목', '금', '토', '일'].map((day, index) => {
                           const isBestDay = day === insights.weeklyTrends.bestDay
                           const isWorstDay = day === insights.weeklyTrends.worstDay
                           
                           return (
                             <div key={day} className="flex flex-col items-center">
                               <div 
                                 className={`w-full rounded-t-sm transition-all duration-300 ${
                                   isBestDay 
                                     ? 'bg-green-500 h-8' 
                                     : isWorstDay 
                                       ? 'bg-orange-500 h-4' 
                                       : 'bg-slate-300 h-6'
                                 }`}
                                 title={`${day}요일: ${isBestDay ? '최고' : isWorstDay ? '개선 필요' : '보통'}`}
                               />
                               <span className="text-xs text-slate-600 mt-1">{day}</span>
                             </div>
                           )
                         })}
                       </div>
                     </div>
                   </div>
                 )}
                 
                 {/* 데이터 부족 시 안내 */}
                 {insights.weeklyTrends.bestDay === '데이터 부족' && (
                   <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                     <div className="flex items-center gap-2 text-slate-600">
                       <div className="w-4 h-4 bg-slate-400 rounded-full"></div>
                       <span className="text-sm">주간 패턴 분석을 위한 데이터가 부족합니다</span>
                     </div>
                   </div>
                 )}
                 
                 <p className="text-indigo-600">💡 {insights.weeklyTrends.improvement}</p>
               </div>
             </div>

            {/* 5. 개인화된 팁 */}
            <div className="bg-white/60 rounded-xl p-6 border border-indigo-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-indigo-900">개인화된 학습 팁</h4>
              </div>
              <div className="space-y-2 text-sm text-indigo-800">
                {insights.personalizedTips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-pink-500 mt-1">•</span>
                    <p>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function WeeklyReportPage() {
  const { data: weeklyData, isLoading, error } = useWeeklyReport()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-500" />
          <p className="text-red-600 mb-2">주간 리포트를 불러오는데 실패했습니다</p>
          <p className="text-slate-500 text-sm">{error.message}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">FocusAI</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-slate-600">주간 리포트</span>
            </div>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                대시보드로 돌아가기
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Report Navigation */}
      <div className="border-b border-white/20 bg-white/60 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-semibold text-slate-900">리포트 종류</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/report/weekly" 
                className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
              >
                주간 리포트
              </Link>
              <Link 
                href="/report/daily" 
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                일일 리포트
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* 주간 목표 달성 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <WeeklyGoals />
          </motion.div>

          {/* 통합된 주간 집중도 분석 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <WeeklyFocusAnalysis 
              data={weeklyData?.timeSeriesData || []} 
              heatmapData={weeklyData?.heatmapData || []}
            />
          </motion.div>

                     {/* 학습 패턴 분석 */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.2 }}
           >
             <WeeklyLearningPatterns weeklyData={weeklyData} />
           </motion.div>
        </div>
      </main>
    </div>
  )
} 