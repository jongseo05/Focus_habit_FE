import { useMemo, useCallback } from 'react'
import { useDashboardStore, useChartState } from '@/stores/dashboardStore'
import { useTodayStats, useWeeklyDetailedData, useDashboardInsights } from '@/hooks/useDashboardData'

// 메모이제이션된 차트 데이터 처리
export function useOptimizedChartData() {
  const { data: weeklyData } = useWeeklyDetailedData()
  const { hoveredChartPoint, setHoveredChartPoint } = useChartState()
  
  // 차트 데이터 메모이제이션
  const chartData = useMemo(() => {
    if (!weeklyData) return null
    
    const maxScore = Math.max(...weeklyData.map(d => d.score))
    const minScore = Math.min(...weeklyData.map(d => d.score))
    const chartWidth = 400 // 기본 차트 너비
    
    // SVG 패스 생성 (성능 최적화)
    const generateSmoothPath = (data: typeof weeklyData) => {
      if (data.length < 2) return ''
      
      const points = data.map((d, i) => ({
        x: 40 + (i / (data.length - 1)) * (chartWidth * 0.8),
        y: 40 + ((maxScore - d.score) / (maxScore - minScore || 1)) * 160
      }))
      
      let path = `M ${points[0].x} ${points[0].y}`
      
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1]
        const currentPoint = points[i]
        const controlPoint1 = {
          x: prevPoint.x + (currentPoint.x - prevPoint.x) * 0.3,
          y: prevPoint.y
        }
        const controlPoint2 = {
          x: currentPoint.x - (currentPoint.x - prevPoint.x) * 0.3,
          y: currentPoint.y
        }
        
        path += ` C ${controlPoint1.x} ${controlPoint1.y}, ${controlPoint2.x} ${controlPoint2.y}, ${currentPoint.x} ${currentPoint.y}`
      }
      
      return path
    }
    
    return {
      path: generateSmoothPath(weeklyData),
      maxScore,
      minScore,
      chartWidth,
      points: weeklyData.map((d, i) => ({
        x: 40 + (i / (weeklyData.length - 1)) * (chartWidth * 0.8),
        y: 40 + ((maxScore - d.score) / (maxScore - minScore || 1)) * 160,
        data: d
      }))
    }
  }, [weeklyData])
  
  // 호버 핸들러 메모이제이션
  const handlePointHover = useCallback((index: number | null) => {
    setHoveredChartPoint(index)
  }, [setHoveredChartPoint])
  
  return {
    chartData,
    hoveredPoint: hoveredChartPoint,
    onPointHover: handlePointHover,
    rawData: weeklyData
  }
}

// 메모이제이션된 통계 계산
export function useOptimizedStats() {
  const { data: todayStats } = useTodayStats()
  const { data: weeklyData } = useWeeklyDetailedData()
  const { data: insights } = useDashboardInsights()
  
  // 주요 통계 메모이제이션
  const computedStats = useMemo(() => {
    if (!todayStats || !weeklyData) return null
    
    // 주간 통계 계산
    const weeklyTotalTime = weeklyData.reduce((sum, day) => {
      const [hours, minutes] = day.totalTime.split(':').map(Number)
      return sum + hours * 60 + minutes
    }, 0)
    
    const weeklyAvgScore = weeklyData.length 
      ? weeklyData.reduce((sum, day) => sum + day.score, 0) / weeklyData.length 
      : 0
    
    const weeklyTotalSessions = weeklyData.reduce((sum, day) => sum + day.sessions, 0)
    
    // 개선 추이 계산
    const firstHalf = weeklyData.slice(0, Math.ceil(weeklyData.length / 2))
    const secondHalf = weeklyData.slice(Math.ceil(weeklyData.length / 2))
    
    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / secondHalf.length
    
    const improvementRate = firstHalfAvg > 0 
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
      : 0
    
    // 최고 성과 분석
    const bestDay = weeklyData.reduce((best, current) => 
      current.score > best.score ? current : best
    )
    
    return {
      today: todayStats,
      weekly: {
        totalTimeMinutes: weeklyTotalTime,
        totalTimeFormatted: `${Math.floor(weeklyTotalTime / 60)}시간 ${weeklyTotalTime % 60}분`,
        avgScore: Math.round(weeklyAvgScore),
        totalSessions: weeklyTotalSessions,
        improvementRate: Math.round(improvementRate * 10) / 10,
        bestDay: bestDay.day,
        bestScore: bestDay.score
      },
      insights: insights || []
    }
  }, [todayStats, weeklyData, insights])
  
  return computedStats
}

// 성능 최적화된 애니메이션 훅
export function useOptimizedAnimations() {
  const { hoveredBarIndex, setHoveredBarIndex } = useChartState()
  
  // 애니메이션 핸들러들 메모이제이션
  const animationHandlers = useMemo(() => ({
    onBarHover: (index: number | null) => setHoveredBarIndex(index),
    onBarLeave: () => setHoveredBarIndex(null),
  }), [setHoveredBarIndex])
  
  // 애니메이션 설정 메모이제이션
  const animationConfig = useMemo(() => ({
    chart: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
    },
    bars: {
      initial: { height: 0 },
      animate: { height: "auto" },
      transition: { duration: 0.5, delay: 0.1 }
    },
    cards: {
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
      transition: { duration: 0.2 }
    }
  }), [])
  
  return {
    hoveredBarIndex,
    handlers: animationHandlers,
    config: animationConfig
  }
}

// 대시보드 전체 데이터를 위한 통합 훅
export function useDashboard() {
  const focusSession = useDashboardStore((state) => ({
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    elapsed: state.elapsed,
    focusScore: state.focusScore,
    startSession: state.startSession,
    pauseSession: state.pauseSession,
    stopSession: state.stopSession,
    formatTime: state.formatTime
  }))
  
  const uiState = useDashboardStore((state) => ({
    showWebcam: state.showWebcam,
    showPermissionLayer: state.showPermissionLayer,
    showErrorDisplay: state.showErrorDisplay,
    notifications: state.notifications,
    setShowWebcam: state.setShowWebcam,
    setShowPermissionLayer: state.setShowPermissionLayer,
    setShowErrorDisplay: state.setShowErrorDisplay,
    addNotification: state.addNotification,
    removeNotification: state.removeNotification
  }))
  
  const chartData = useOptimizedChartData()
  const stats = useOptimizedStats()
  const animations = useOptimizedAnimations()
  
  return {
    focusSession,
    uiState,
    chartData,
    stats,
    animations,
    isLoading: !stats || !chartData.rawData
  }
}
