import { useQuery } from '@tanstack/react-query'

interface DailyStat {
  date: string
  sessions: number
  totalTime: number
  averageScore: number
  hasData: boolean
  phoneMin: number
  quietRatio: number
  longestStreak: number
}

interface TotalStats {
  totalDays: number
  activeDays: number
  totalSessions: number
  totalFocusTime: number
  averageScore: number
}

interface DailyStatsResponse {
  dailyStats: DailyStat[]
  totalStats: TotalStats
  success: boolean
}

const fetchDailyStats = async (days: number = 30): Promise<DailyStatsResponse> => {
  const response = await fetch(`/api/report/daily-stats?days=${days}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch daily stats')
  }
  
  const result = await response.json()
  
  // 표준 API 응답 구조 처리
  if (result.success && result.data) {
    return result.data
  }
  
  // 기존 응답 구조와의 호환성 유지
  return result
}

export const useDailyStats = (days: number = 30) => {
  return useQuery({
    queryKey: ['dailyStats', days],
    queryFn: () => fetchDailyStats(days),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export type { DailyStat, TotalStats, DailyStatsResponse } 