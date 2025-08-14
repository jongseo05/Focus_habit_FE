import { useQuery } from '@tanstack/react-query'
import { WeeklyReportData } from '@/types/database'

// Query Keys
export const weeklyReportKeys = {
  all: ['weekly-report'] as const,
  weekly: (year: number, week: number) => [...weeklyReportKeys.all, year, week] as const,
  insights: (year: number, week: number) => [...weeklyReportKeys.all, 'insights', year, week] as const,
}

/**
 * 주간 리포트 데이터 조회 훅
 */
export function useWeeklyReport(year?: number, week?: number) {
  const currentYear = year || new Date().getFullYear()
  const currentWeek = week || getCurrentWeek()

  return useQuery({
    queryKey: weeklyReportKeys.weekly(currentYear, currentWeek),
    queryFn: async (): Promise<WeeklyReportData> => {
      console.log('🚀 주간 리포트 요청 시작:', { year: currentYear, week: currentWeek })
      
      const response = await fetch(`/api/report/weekly?year=${currentYear}&week=${currentWeek}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '주간 리포트를 불러오는데 실패했습니다.')
      }
      
      const data = await response.json()
      console.log('✅ 주간 리포트 데이터 반환:', data)
      return data
    },
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: !!currentYear && !!currentWeek,
  })
}

/**
 * GPT 기반 주간 인사이트 조회 훅
 */
export function useWeeklyInsights(weeklyData?: WeeklyReportData, year?: number, week?: number) {
  const currentYear = year || new Date().getFullYear()
  const currentWeek = week || getCurrentWeek()

  return useQuery({
    queryKey: weeklyReportKeys.insights(currentYear, currentWeek),
    queryFn: async () => {
      console.log('🤖 GPT 주간 인사이트 요청 시작')
      
      const response = await fetch('/api/weekly-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weeklyData }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'GPT 인사이트를 불러오는데 실패했습니다.')
      }
      
      const data = await response.json()
      console.log('✅ GPT 인사이트 반환:', data)
      return data.insights
    },
    staleTime: 30 * 60 * 1000, // 30분 (인사이트는 더 길게 캐시)
    gcTime: 60 * 60 * 1000, // 1시간
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
    enabled: !!weeklyData && !!weeklyData.overview, // 주간 데이터가 있을 때만 실행
  })
}

/**
 * 현재 주차 계산
 */
function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + start.getDay() + 1) / 7)
}

/**
 * 주간 리포트 데이터를 Comprehensive Report 형식으로 변환
 */
export function useWeeklyReportForComprehensive(year?: number, week?: number) {
  const { data: weeklyData, isLoading, error } = useWeeklyReport(year, week)

  // Comprehensive Report 형식으로 변환
  const comprehensiveData = weeklyData ? {
    // Focus Score Data
    focusScore: {
      overall: weeklyData.overview.avgScore,
      trend: weeklyData.overview.trend,
      change: weeklyData.overview.change,
      breakdown: weeklyData.breakdown
    },
    // Time Series Data
    timeSeriesData: weeklyData.timeSeriesData || [],
    // Activity Data
    activityData: weeklyData.activityData || [],
    // Evidence Snapshots (빈 배열로 설정 - 필요시 추가)
    evidenceSnapshots: [],
    // Achievements
    achievements: weeklyData.achievements || [],
    // Feedback
    feedback: weeklyData.feedback || []
  } : null

  return {
    data: comprehensiveData,
    isLoading,
    error,
    rawData: weeklyData
  }
}

/**
 * 주간 통계 요약 훅
 */
export function useWeeklyStats(year?: number, week?: number) {
  const { data, isLoading, error } = useWeeklyReport(year, week)

  const stats = data ? {
    totalSessions: data.overview.totalSessions,
    totalFocusTime: data.overview.totalFocusTime,
    avgScore: data.overview.avgScore,
    peakScore: data.overview.peakScore,
    trend: data.overview.trend,
    change: data.overview.change,
    activeDays: data.timeSeriesData?.filter(day => day.sessionDuration > 0).length || 0,
    totalDays: data.timeSeriesData?.length || 0
  } : null

  return {
    stats,
    isLoading,
    error
  }
}

/**
 * 주간 패턴 분석 훅
 */
export function useWeeklyPatterns(year?: number, week?: number) {
  const { data, isLoading, error } = useWeeklyReport(year, week)

  const patterns = data && data.timeSeriesData.length > 0 ? {
    // 가장 집중도가 높은 요일
    bestDay: data.timeSeriesData.reduce((best, current) => 
      current.focusScore > best.focusScore ? current : best
    ),
    // 가장 집중도가 낮은 요일
    worstDay: data.timeSeriesData.reduce((worst, current) => 
      current.focusScore < worst.focusScore ? current : worst
    ),
    // 평균 집중 시간
    avgSessionDuration: data.timeSeriesData.reduce((sum, day) => sum + day.sessionDuration, 0) / data.timeSeriesData.length,
    // 연속 학습일
    streak: data.achievements.find(a => a.id === 'streak')?.progress || 0,
    // 주요 방해 요소
    mainDistractions: data.activityData
      .filter(activity => activity.type === 'negative')
      .reduce((acc, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)
  } : null

  return {
    patterns,
    isLoading,
    error
  }
} 