"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"

// API 함수
const fetchTrendData = async () => {
  const response = await fetch('/api/reports/trend')
  
  if (!response.ok) {
    throw new Error('트렌드 데이터를 가져오는데 실패했습니다')
  }
  
  const result = await response.json()
  
  if (!result.success) {
    throw new Error(result.message || '트렌드 데이터를 가져오는데 실패했습니다')
  }
  
  return result.data
}

// 툴팁 커스텀 컴포넌트
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.name === 'focusScore' && '점'}
            {entry.name === 'studyTime' && '분'}
            {entry.name === 'sessions' && '세션'}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// 스파크라인 컴포넌트
const SparklineChart = ({ data, metric, color, title, subtitle }: {
  data: any[]
  metric: string
  color: string
  title: string
  subtitle: string
}) => {
  const currentValue = data[data.length - 1]?.[metric] || 0
  const previousValue = data[data.length - 8]?.[metric] || 0
  const change = currentValue - previousValue
  const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0
  
  const getTrendIcon = () => {
    if (changePercent > 2) return <TrendingUp className="w-4 h-4 text-green-600" />
    if (changePercent < -2) return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-slate-400" />
  }

  const getTrendColor = () => {
    if (changePercent > 2) return 'text-green-600'
    if (changePercent < -2) return 'text-red-600'
    return 'text-slate-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/40 hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
          <p className="text-xs text-slate-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className={`text-xs font-medium ${getTrendColor()}`}>
            {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        </div>
      </div>
      
      <div className="text-2xl font-bold text-slate-900 mb-3">
        {currentValue}
        {metric === 'focusScore' && '점'}
        {metric === 'studyTime' && '분'}
        {metric === 'sessions' && '세션'}
      </div>
      
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <Line
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
            <Tooltip content={<CustomTooltip />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

// 메인 Trend Graph 컴포넌트
export const TrendGraph = () => {
  const { data: trendData, isLoading, error } = useQuery({
    queryKey: ['trend-data'],
    queryFn: fetchTrendData,
    staleTime: 5 * 60 * 1000, // 5분
    cacheTime: 10 * 60 * 1000, // 10분
  })

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            트렌드 그래프
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-red-50/30 to-red-50/20 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            트렌드 그래프
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600">
            데이터를 불러오는데 실패했습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!trendData || trendData.length === 0) {
    return (
      <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            트렌드 그래프
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500">
            데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 border-0 overflow-hidden relative">
      {/* 배경 장식 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5 rounded-2xl" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/10 to-transparent rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full blur-xl" />
      
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div>트렌드 그래프</div>
            <div className="text-sm font-normal text-slate-600 mt-1">최근 28일 집중도 및 학습 패턴</div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SparklineChart
            data={trendData}
            metric="focusScore"
            color="#10B981"
            title="집중도"
            subtitle="일일 평균 집중 점수"
          />
          
          <SparklineChart
            data={trendData}
            metric="studyTime"
            color="#3B82F6"
            title="학습 시간"
            subtitle="일일 총 학습 시간"
          />
          
          <SparklineChart
            data={trendData}
            metric="sessions"
            color="#8B5CF6"
            title="학습 세션"
            subtitle="일일 학습 세션 수"
          />
        </div>
        
        {/* 전체 트렌드 차트 */}
        <div className="mt-8 bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-white/40">
          <h4 className="font-semibold text-slate-900 mb-4">전체 트렌드 (28일)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="focusScore"
                  stroke="#10B981"
                  strokeWidth={3}
                  name="집중도"
                  dot={{ r: 3, fill: '#10B981' }}
                  activeDot={{ r: 6, fill: '#10B981' }}
                />
                <Line
                  type="monotone"
                  dataKey="studyTime"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  name="학습시간"
                  dot={{ r: 3, fill: '#3B82F6' }}
                  activeDot={{ r: 6, fill: '#3B82F6' }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  name="세션수"
                  dot={{ r: 3, fill: '#8B5CF6' }}
                  activeDot={{ r: 6, fill: '#8B5CF6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 