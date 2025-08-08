"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, ArrowLeft, Calendar, Loader2, AlertCircle, TrendingUp, Target, Clock, Zap, Activity } from "lucide-react"
import Link from "next/link"
import { useWeeklyReport, useWeeklyStats, useWeeklyPatterns } from "@/hooks/useWeeklyReport"
import { useState, useRef, useEffect } from "react"
import { mockWeeklyFocusChartData } from "@/lib/mockData"
import { AnimatePresence } from "framer-motion"

// 통합된 주간 집중도 분석 컴포넌트
const WeeklyFocusAnalysis = ({ data }: { data: Array<{ dayOfWeek: string; focusScore: number }> }) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number } | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [activeTab, setActiveTab] = useState<'chart' | 'heatmap'>('chart')
  const containerRef = useRef<HTMLDivElement>(null)

  // 요일 라벨
  const days = ['월', '화', '수', '목', '금', '토', '일']
  
  // 시간대 라벨 (24시간)
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Mock 데이터: 각 요일·시간대별 집중도 (0-100)
  const generateMockData = () => {
    const data: number[][] = []
    for (let day = 0; day < 7; day++) {
      const dayData: number[] = []
      for (let hour = 0; hour < 24; hour++) {
        // 주중(월-금)은 업무시간대에 높은 집중도
        if (day < 5) {
          if (hour >= 9 && hour <= 17) {
            dayData.push(Math.floor(Math.random() * 30) + 70) // 70-100
          } else if (hour >= 7 && hour <= 22) {
            dayData.push(Math.floor(Math.random() * 40) + 30) // 30-70
          } else {
            dayData.push(Math.floor(Math.random() * 20) + 10) // 10-30
          }
        } else {
          // 주말은 오후에 높은 집중도
          if (hour >= 13 && hour <= 18) {
            dayData.push(Math.floor(Math.random() * 30) + 60) // 60-90
          } else if (hour >= 10 && hour <= 22) {
            dayData.push(Math.floor(Math.random() * 40) + 20) // 20-60
          } else {
            dayData.push(Math.floor(Math.random() * 15) + 5) // 5-20
          }
        }
      }
      data.push(dayData)
    }
    return data
  }

  const heatmapData = generateMockData()

  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100">
        <div className="text-center text-slate-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>데이터가 없습니다</p>
        </div>
      </div>
    )
  }

  const maxScore = Math.max(...data.map(d => d.focusScore))
  const minScore = Math.min(...data.map(d => d.focusScore))
  const scoreRange = maxScore - minScore || 1

  const chartHeight = 240
  const barWidth = 70
  const barGap = 25
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
    if (value >= 80) return 'bg-gradient-to-br from-emerald-500 to-emerald-600' // 매우 높음
    if (value >= 60) return 'bg-gradient-to-br from-emerald-400 to-emerald-500' // 높음
    if (value >= 40) return 'bg-gradient-to-br from-blue-400 to-blue-500'    // 보통
    if (value >= 20) return 'bg-gradient-to-br from-orange-400 to-orange-500'  // 낮음
    return 'bg-gradient-to-br from-slate-300 to-slate-400'                    // 매우 낮음
  }

  const getCellOpacity = (value: number) => {
    if (value >= 80) return 'opacity-90'
    if (value >= 60) return 'opacity-80'
    if (value >= 40) return 'opacity-70'
    if (value >= 20) return 'opacity-60'
    return 'opacity-40'
  }

  const handleCellHover = (e: React.MouseEvent, day: number, hour: number) => {
    setHoveredCell({ day, hour })
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
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
                  viewBox={`0 0 ${totalWidth + 100} ${chartHeight + 60}`}
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
                   </defs>
                  
                  {/* Y축 라벨 */}
                  {[100, 80, 60, 40, 20].map((value, index) => (
                    <g key={value}>
                      <text 
                        x="30" 
                        y={20 + (index * chartHeight) / 4 + 5} 
                        textAnchor="end" 
                        className="text-xs fill-slate-400 font-medium"
                      >
                        {value}
                      </text>
                      <line
                        x1="35"
                        y1={20 + (index * chartHeight) / 4}
                        x2={totalWidth + 40}
                        y2={20 + (index * chartHeight) / 4}
                        stroke="#E2E8F0"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                        opacity="0.5"
                      />
                    </g>
                  ))}

                  {/* 바 차트 */}
                  <g transform="translate(40, 20)">
                    {data.map((day, index) => {
                      const barHeight = getBarHeight(day.focusScore)
                      const barY = chartHeight - barHeight
                      const barX = index * (barWidth + barGap)
                      const isHovered = hoveredDay === day.dayOfWeek

                      return (
                                                 <g key={day.dayOfWeek}>
                                                      {/* 바 */}
                           <rect
                             x={barX}
                             y={barY}
                             width={barWidth}
                             height={barHeight}
                             fill={getBarGradient(day.focusScore)}
                             rx="8"
                             className="transition-all duration-300"
                             onMouseEnter={() => setHoveredDay(day.dayOfWeek)}
                             onMouseLeave={() => setHoveredDay(null)}
                             style={{
                               transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                               filter: isHovered ? 'brightness(1.1)' : 'brightness(1)',
                             }}
                           />
                          
                          {/* 점수 라벨 */}
                          <text
                            x={barX + barWidth / 2}
                            y={barY - 15}
                            textAnchor="middle"
                            className="text-sm font-bold fill-slate-700"
                            style={{ opacity: isHovered ? 1 : 0.7 }}
                          >
                            {day.focusScore}점
                          </text>

                          {/* X축 라벨 */}
                          <text
                            x={barX + barWidth / 2}
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

                {/* 툴팁 */}
                {hoveredDay && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 -top-20 left-1/2 transform -translate-x-1/2 z-10"
                  >
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-900">
                        {hoveredDay}요일
                      </div>
                      <div className="text-2xl font-bold text-blue-600">
                        {data.find(d => d.dayOfWeek === hoveredDay)?.focusScore}점
                      </div>
                    </div>
                    {/* 툴팁 화살표 */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-white" />
                  </motion.div>
                )}
              </div>

              {/* 요약 통계 */}
              <div className="mt-8 grid grid-cols-3 gap-6">
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
                         const value = heatmapData[dayIndex][hourIndex]
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

              {/* 툴팁 */}
              {hoveredCell && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[140px] pointer-events-none"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                    transform: 'translateX(-50%) translateY(-100%)',
                  }}
                >
                  <div className="text-center">
                    <div className="font-semibold text-slate-900">
                      {days[hoveredCell.day]}요일 {hoveredCell.hour}시
                    </div>
                    <div className="text-xl font-bold text-emerald-600">
                      {heatmapData[hoveredCell.day][hoveredCell.hour]}점
                    </div>
                    <div className="text-xs text-slate-500">
                      집중도
                    </div>
                  </div>
                  
                  {/* 툴팁 화살표 */}
                  <div
                    className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-white"
                    style={{
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                    }}
                  />
                </motion.div>
              )}
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
const WeeklyLearningPatterns = ({ patterns }: { patterns: any }) => {
  if (!patterns) return null

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <h4 className="font-semibold text-slate-900">최고 집중 요일</h4>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {patterns.bestDay ? `${patterns.bestDay.dayOfWeek} (${patterns.bestDay.focusScore}점)` : '데이터 없음'}
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="font-semibold text-slate-900">평균 세션 시간</h4>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {patterns.avgSessionDuration ? `${Math.round(patterns.avgSessionDuration)}분` : '데이터 없음'}
            </p>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-600" />
              </div>
              <h4 className="font-semibold text-slate-900">연속 학습일</h4>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              {patterns.streak}일
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function WeeklyReportPage() {
  const { data: weeklyData, isLoading, error } = useWeeklyReport()
  const { patterns } = useWeeklyPatterns()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">주간 리포트를 불러오는 중...</p>
        </div>
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
                href="/report" 
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                종합 리포트
              </Link>
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
            <WeeklyFocusAnalysis data={mockWeeklyFocusChartData} />
          </motion.div>

          {/* 학습 패턴 분석 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <WeeklyLearningPatterns patterns={patterns} />
          </motion.div>
        </div>
      </main>
    </div>
  )
} 