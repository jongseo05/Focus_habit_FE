"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWeeklyDetailedData } from "@/hooks/useDashboardData"
import { useRouter } from "next/navigation"

interface WeeklyData {
  day: string
  date: string
  score: number
  sessionStates: number
  totalTime: string
  peak: number
  low: number
}

export const EnhancedFocusTrendChart = () => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [chartType, setChartType] = useState<"area" | "line">("area")
  const router = useRouter()
  
  // DB에서 주간 데이터 가져오기
  const { data: weeklyData, isLoading, error } = useWeeklyDetailedData()

  // 데이터가 로딩 중이거나 에러가 있으면 기본 데이터 사용
  const weeklyDetailedData: WeeklyData[] = weeklyData?.map(item => ({
    day: item.day,
    date: item.date,
    score: item.score,
    sessionStates: item.sessions,
    totalTime: item.totalTime,
    peak: item.peak,
    low: item.low
  })) || [
    { day: "월", date: "12/16", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "화", date: "12/17", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "수", date: "12/18", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "목", date: "12/19", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "금", date: "12/20", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "토", date: "12/21", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
    { day: "일", date: "12/22", score: 0, sessionStates: 0, totalTime: "0:00", peak: 0, low: 0 },
  ]

  const handleViewDetails = () => {
    router.push('/report/weekly')
  }

  const maxScore = Math.max(...weeklyDetailedData.map((d) => d.score))
  const minScore = Math.min(...weeklyDetailedData.map((d) => d.score))
  const scoreRange = maxScore - minScore || 1 // 0으로 나누기 방지
  
  // 모든 점수가 0인 경우 처리
  const hasData = maxScore > 0

  // Generate smooth curve points for area/line chart
  const generateSmoothPath = (data: WeeklyData[], width: number, height: number) => {
    const points = data.map((item, index) => {
      const normalizedScore = (item.score - minScore) / scoreRange
      const y = height - (normalizedScore * height)
      
      return {
        x: (index / (data.length - 1)) * width,
        y: isNaN(y) ? height : Math.max(0, Math.min(height, y)), // NaN 방지 및 범위 제한
      }
    })

    // Create smooth curve using quadratic bezier curves
    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      path += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`
    }

    return { path, points }
  }

  const chartWidth = 400
  const chartHeight = 120
  const { path, points } = generateSmoothPath(weeklyDetailedData, chartWidth, chartHeight)

  // 로딩 상태 처리
  if (isLoading) {
    return (
      <div className="relative">
        {/* Chart Type Toggle Skeleton */}
        <div className="flex justify-end mb-4">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <div className="w-16 h-6 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="w-16 h-6 bg-slate-200 rounded-md animate-pulse ml-1"></div>
          </div>
        </div>

        {/* Chart Skeleton */}
        <div className="relative bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100">
          <div className="h-40 bg-slate-100 rounded-lg animate-pulse mb-4"></div>
          
          {/* Chart insights skeleton */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="h-6 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 bg-slate-200 rounded animate-pulse w-16 mx-auto"></div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="h-6 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 bg-slate-200 rounded animate-pulse w-16 mx-auto"></div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="h-6 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 bg-slate-200 rounded animate-pulse w-16 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 에러 상태 처리
  if (error) {
    return (
      <div className="flex justify-center items-center h-64 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
        <div className="text-center text-slate-500">
          <p>데이터를 불러오는 중 오류가 발생했습니다</p>
          <p className="text-sm mt-2">잠시 후 다시 시도해주세요</p>
        </div>
      </div>
    )
  }

  // 데이터가 없는 경우 처리
  if (!hasData) {
    return (
      <div className="flex justify-center items-center h-64 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100">
        <div className="text-center text-slate-500">
          <p>이번 주 집중 세션 데이터가 없습니다</p>
          <p className="text-sm mt-2">집중 세션을 시작하여 데이터를 생성해보세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Chart Type Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              chartType === "area" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            영역 차트
          </button>
          <button
            onClick={() => setChartType("line")}
            className={`px-3 py-1 text-xs rounded-md transition-all ${
              chartType === "line" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            선 차트
          </button>
        </div>
      </div>

      {/* Enhanced Chart */}
      <div className="relative bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-100">
        <svg
          width="100%"
          height="160"
          viewBox={`0 0 ${chartWidth + 80} ${chartHeight + 60}`}
          className="overflow-visible"
        >
          <defs>
            {/* Gradients for different score ranges */}
            <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
            </linearGradient>

            {/* Grid pattern */}
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.5" opacity="0.5" />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width={chartWidth} height={chartHeight} fill="url(#grid)" x="40" y="20" />

          {/* Y-axis labels */}
          {[100, 80, 60, 40].map((value, index) => (
            <g key={value}>
              <text x="30" y={20 + (index * chartHeight) / 3 + 5} textAnchor="end" className="text-xs fill-slate-400">
                {value}
              </text>
              <line
                x1="35"
                y1={20 + (index * chartHeight) / 3}
                x2={chartWidth + 40}
                y2={20 + (index * chartHeight) / 3}
                stroke="#E2E8F0"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </g>
          ))}

          {/* Chart area/line */}
          <g transform="translate(40, 20)">
            {chartType === "area" ? (
              <path
                d={`${path} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#blueGradient)"
                className="transition-all duration-500"
              />
            ) : null}

            <path
              d={path}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-500"
            />

            {/* Data points */}
            {points.map((point, index) => {
              const data = weeklyDetailedData[index]
              const isHovered = hoveredPoint === index

              // NaN 체크
              if (isNaN(point.x) || isNaN(point.y)) {
                return null
              }

              return (
                <g key={index}>
                  {/* Hover area */}
                  <rect
                    x={point.x - 20}
                    y={0}
                    width="40"
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Data point */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isHovered ? 6 : 4}
                    fill="white"
                    stroke={data.score >= 80 ? "#10B981" : data.score >= 60 ? "#3B82F6" : "#F59E0B"}
                    strokeWidth="3"
                    className="transition-all duration-200 drop-shadow-sm"
                  />

                  {/* Hover highlight */}
                  {isHovered && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="12"
                      fill={data.score >= 80 ? "#10B981" : data.score >= 60 ? "#3B82F6" : "#F59E0B"}
                      fillOpacity="0.1"
                      className="animate-pulse"
                    />
                  )}
                </g>
              )
            })}
          </g>

          {/* X-axis labels */}
          {weeklyDetailedData.map((data, index) => (
            <text
              key={index}
              x={40 + (index / (weeklyDetailedData.length - 1)) * chartWidth}
              y={chartHeight + 45}
              textAnchor="middle"
              className="text-xs fill-slate-600 font-medium"
            >
              {data.day}
            </text>
          ))}
        </svg>

        {/* Enhanced Tooltip */}
        <AnimatePresence>
          {hoveredPoint !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-4 min-w-[200px]"
              style={{
                left: `${40 + (hoveredPoint / (weeklyDetailedData.length - 1)) * (chartWidth * 0.8)}px`,
                top: "10px",
                transform: hoveredPoint > 3 ? "translateX(-100%)" : "translateX(0%)",
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{weeklyDetailedData[hoveredPoint].day}요일</span>
                  <span className="text-sm text-slate-500">{weeklyDetailedData[hoveredPoint].date}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">평균 집중도</span>
                    <span
                      className={`font-bold text-lg ${
                        weeklyDetailedData[hoveredPoint].score >= 80
                          ? "text-emerald-600"
                          : weeklyDetailedData[hoveredPoint].score >= 60
                            ? "text-blue-600"
                            : "text-orange-600"
                      }`}
                    >
                      {weeklyDetailedData[hoveredPoint].score}점
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">최고점</span>
                    <span className="font-medium text-emerald-600">{weeklyDetailedData[hoveredPoint].peak}점</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600">최저점</span>
                    <span className="font-medium text-orange-600">{weeklyDetailedData[hoveredPoint].low}점</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">세션 수</span>
                      <span className="font-medium">{weeklyDetailedData[hoveredPoint].sessionStates}회</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">총 시간</span>
                      <span className="font-medium">{weeklyDetailedData[hoveredPoint].totalTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tooltip arrow */}
              <div
                className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"
                style={{
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chart insights */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="text-lg font-bold text-emerald-600">
              {Math.max(...weeklyDetailedData.map((d) => d.score)) || 0}점
            </div>
            <div className="text-xs text-emerald-700">주간 최고점</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-600">
              {Math.round(weeklyDetailedData.reduce((sum, d) => sum + d.score, 0) / weeklyDetailedData.length) || 0}점
            </div>
            <div className="text-xs text-blue-700">주간 평균</div>
          </div>
                     <div className="bg-purple-50 rounded-lg p-3">
             <div className="text-lg font-bold text-purple-600">
               {(() => {
                 // 유효한 데이터가 있는 날짜들만 필터링
                 const validData = weeklyDetailedData.filter(d => d.score > 0)
                 
                 if (validData.length < 2) {
                   return "N/A"
                 }
                 
                 // 첫 번째와 마지막 유효한 데이터 비교
                 const firstValidScore = validData[0].score
                 const lastValidScore = validData[validData.length - 1].score
                 
                 // 첫 번째 점수가 너무 작으면 계산하지 않음
                 if (firstValidScore < 10) {
                   return "N/A"
                 }
                 
                 const improvement = ((lastValidScore - firstValidScore) / firstValidScore) * 100
                 const roundedImprovement = Math.round(improvement)
                 
                 // 부호에 따라 + 또는 - 표시
                 return roundedImprovement >= 0 ? `+${roundedImprovement}%` : `${roundedImprovement}%`
               })()}
             </div>
             <div className="text-xs text-purple-700">주간 개선율</div>
           </div>
        </div>
      </div>
    </div>
  )
}
