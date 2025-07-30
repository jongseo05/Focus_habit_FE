import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'

// 대시보드 통계 타입 정의
export interface DashboardStats {
  today: {
    focusTime: number // 분 단위
    sessions: number
    avgScore: number
    distractions: number
    breaks: number
  }
  weekly: {
    totalTime: number
    avgScore: number
    bestDay: string
    improvementRate: number
  }
  insights: string[]
  achievements: Array<{
    id: string
    name: string
    progress: number
    completed: boolean
  }>
}

export interface WeeklyDetailedData {
  day: string
  date: string
  score: number
  sessions: number
  totalTime: string
  peak: number
  low: number
}

export interface FocusSessionRecord {
  id: string
  user_id: string
  start_time: string
  end_time: string
  focus_score: number
  distractions: number
  session_type: 'study' | 'work' | 'reading'
  created_at: string
}

// Query Keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  todayStats: () => [...dashboardKeys.stats(), 'today'] as const,
  weeklyStats: () => [...dashboardKeys.stats(), 'weekly'] as const,
  weeklyDetailed: (startDate: string) => [...dashboardKeys.stats(), 'weekly-detailed', startDate] as const,
  insights: () => [...dashboardKeys.all, 'insights'] as const,
  achievements: () => [...dashboardKeys.all, 'achievements'] as const,
  sessions: () => [...dashboardKeys.all, 'sessions'] as const,
  recentSessions: (limit: number) => [...dashboardKeys.sessions(), 'recent', limit] as const,
}

// 오늘의 통계 조회
export function useTodayStats() {
  return useQuery({
    queryKey: dashboardKeys.todayStats(),
    queryFn: async (): Promise<DashboardStats['today']> => {
      const supabase = supabaseBrowser()
      const today = new Date().toISOString().split('T')[0]
      
      // 오늘의 집중 세션 데이터 조회
      const { data: sessions, error } = await supabase
        .from('focus_session')
        .select('*')
        .gte('started_at', `${today}T00:00:00`)
        .lt('started_at', `${today}T23:59:59`)
        .order('started_at', { ascending: false })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // 통계 계산
      const totalSessions = sessions?.length || 0
      const totalFocusTime = sessions?.reduce((sum, session) => {
        const start = new Date(session.started_at)
        const end = new Date(session.ended_at || new Date())
        return sum + (end.getTime() - start.getTime()) / (1000 * 60) // 분 단위
      }, 0) || 0
      
      const avgScore = sessions?.length 
        ? sessions.reduce((sum, s) => sum + (s.focus_score || 0), 0) / sessions.length 
        : 0
      
      const totalDistractions = sessions?.reduce((sum, s) => sum + (s.distractions || 0), 0) || 0
      
      return {
        focusTime: Math.round(totalFocusTime),
        sessions: totalSessions,
        avgScore: Math.round(avgScore),
        distractions: totalDistractions,
        breaks: Math.floor(totalSessions * 0.8) // 예시 계산
      }
    },
    staleTime: 2 * 60 * 1000, // 2분
    refetchInterval: 5 * 60 * 1000, // 5분마다 자동 갱신
  })
}

// 주간 상세 데이터 조회
export function useWeeklyDetailedData() {
  return useQuery({
    queryKey: dashboardKeys.weeklyDetailed(getWeekStartDate()),
    queryFn: async (): Promise<WeeklyDetailedData[]> => {
      const supabase = supabaseBrowser()
      const weekStart = getWeekStartDate()
      const weekEnd = getWeekEndDate()
      
      const { data: sessions, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .gte('start_time', `${weekStart}T00:00:00`)
        .lt('start_time', `${weekEnd}T23:59:59`)
        .order('start_time', { ascending: true })
      
      if (error) {
        throw new Error(error.message)
      }
      
      // 일별 데이터 집계
      const dailyData = groupSessionsByDay(sessions || [])
      
      return generateWeeklyData(dailyData)
    },
    staleTime: 10 * 60 * 1000, // 10분
  })
}

// 인사이트 및 개선 제안 조회
export function useDashboardInsights() {
  const { data: todayStats } = useTodayStats()
  const { data: weeklyData } = useWeeklyDetailedData()
  
  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<string[]> => {
      // AI 기반 인사이트 생성 (현재는 로컬 로직)
      const insights: string[] = []
      
      if (todayStats && weeklyData) {
        // 집중도 패턴 분석
        if (todayStats.avgScore < 70) {
          insights.push("오늘 집중도가 평소보다 낮습니다. 짧은 휴식을 더 자주 취해보세요.")
        }
        
        // 방해 요소 분석
        if (todayStats.distractions > 5) {
          insights.push("방해 요소가 많이 감지되었습니다. 휴대폰을 멀리 두거나 방해 금지 모드를 활용해보세요.")
        }
        
        // 최적 시간대 분석
        const bestTimeSlot = findBestFocusTime(weeklyData)
        if (bestTimeSlot) {
          insights.push(`${bestTimeSlot}에 집중도가 가장 높습니다. 중요한 작업을 이 시간에 배치해보세요.`)
        }
        
        // 개선 추이 분석
        const improvementTrend = calculateImprovementTrend(weeklyData)
        if (improvementTrend > 0) {
          insights.push(`이번 주 집중도가 ${improvementTrend.toFixed(1)}% 향상되었습니다! 꾸준히 발전하고 있어요.`)
        }
      }
      
      // 기본 인사이트 제공
      if (insights.length === 0) {
        insights.push("규칙적인 집중 세션으로 생산성을 높여보세요.")
      }
      
      return insights
    },
    enabled: !!todayStats && !!weeklyData,
    staleTime: 30 * 60 * 1000, // 30분
  })
}

// 집중 세션 기록 생성
export function useCreateFocusSession() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (sessionData: {
      start_time: string
      end_time: string
      focus_score: number
      distractions: number
      session_type: 'study' | 'work' | 'reading'
      notes?: string
    }) => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert(sessionData)
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as FocusSessionRecord
    },
    onSuccess: () => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats() })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.sessions() })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.insights() })
    },
  })
}

// 유틸리티 함수들
function getWeekStartDate(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  return monday.toISOString().split('T')[0]
}

function getWeekEndDate(): string {
  const start = new Date(getWeekStartDate())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end.toISOString().split('T')[0]
}

function groupSessionsByDay(sessions: FocusSessionRecord[]) {
  const grouped: Record<string, FocusSessionRecord[]> = {}
  
  sessions.forEach(session => {
    const date = session.start_time.split('T')[0]
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(session)
  })
  
  return grouped
}

function generateWeeklyData(dailyData: Record<string, FocusSessionRecord[]>): WeeklyDetailedData[] {
  const days = ['월', '화', '수', '목', '금', '토', '일']
  const weekStart = new Date(getWeekStartDate())
  
  return days.map((day, index) => {
    const currentDate = new Date(weekStart)
    currentDate.setDate(weekStart.getDate() + index)
    const dateStr = currentDate.toISOString().split('T')[0]
    const sessions = dailyData[dateStr] || []
    
    const scores = sessions.map(s => s.focus_score).filter(s => s > 0)
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const peak = scores.length ? Math.max(...scores) : 0
    const low = scores.length ? Math.min(...scores) : 0
    
    const totalMinutes = sessions.reduce((sum, session) => {
      const start = new Date(session.start_time)
      const end = new Date(session.end_time)
      return sum + (end.getTime() - start.getTime()) / (1000 * 60)
    }, 0)
    
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    const totalTime = `${hours}:${minutes.toString().padStart(2, '0')}`
    
    return {
      day,
      date: currentDate.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
      score: Math.round(avgScore),
      sessions: sessions.length,
      totalTime,
      peak,
      low
    }
  })
}

function findBestFocusTime(weeklyData: WeeklyDetailedData[]): string | null {
  // 간단한 예시 - 실제로는 시간대별 분석이 필요
  const bestDay = weeklyData.reduce((best, current) => 
    current.score > best.score ? current : best
  )
  
  if (bestDay.score > 80) {
    return `${bestDay.day}요일 오후`
  }
  
  return null
}

function calculateImprovementTrend(weeklyData: WeeklyDetailedData[]): number {
  if (weeklyData.length < 2) return 0
  
  const firstHalf = weeklyData.slice(0, Math.ceil(weeklyData.length / 2))
  const secondHalf = weeklyData.slice(Math.ceil(weeklyData.length / 2))
  
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.score, 0) / secondHalf.length
  
  return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
}
