import { useQuery } from '@tanstack/react-query'

// 주간 리포트 데이터 타입
export interface WeeklyReportData {
  year: number
  week: number
  period: {
    startDate: string
    endDate: string
  }
  overview: {
    totalSessions: number
    totalFocusTime: number
    avgScore: number
    peakScore: number
    lowestScore: number
    trend: "up" | "down" | "stable"
    change: number
  }
  breakdown: {
    attention: number
    posture: number
    phoneUsage: number
    consistency: number
  }
  timeSeriesData: Array<{
    timestamp: string
    focusScore: number
    sessionDuration: number
    distractions: number
    dayOfWeek: string
  }>
  heatmapData: number[][]
  activityData: Array<{
    timestamp: string
    action: string
    type: "positive" | "negative" | "neutral"
    impact: number
    description: string
  }>
  achievements: Array<{
    id: string
    title: string
    description: string
    progress: number
    target: number
    completed: boolean
    badge: string
    category: "focus" | "consistency" | "improvement" | "milestone"
  }>
  feedback: Array<{
    type: "success" | "warning" | "info" | "tip"
    title: string
    message: string
    actionable: boolean
    priority: "high" | "medium" | "low"
  }>
}

// Query Keys
export const weeklyReportKeys = {
  all: ['weekly-report'] as const,
  weekly: (year: number, week: number) => [...weeklyReportKeys.all, year, week] as const,
}

// Mock 데이터 생성 함수
const generateMockWeeklyData = (year: number, week: number): WeeklyReportData => {
  const startDate = getWeekStartDate(year, week)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)

  // 현실적인 히트맵 데이터 생성 (7일 x 24시간)
  const heatmapData = Array.from({ length: 7 }, (_, day) => 
    Array.from({ length: 24 }, (_, hour) => {
      // 주말(토요일=5, 일요일=6)과 평일 구분
      const isWeekend = day >= 5
      
      // 시간대별 패턴 생성 - 더 현실적이고 예쁜 그라데이션
      if (hour >= 9 && hour <= 11) {
        // 오전 집중 시간 (최고 집중도)
        return isWeekend ? 
          Math.floor(Math.random() * 20) + 60 : // 주말: 60-80
          Math.floor(Math.random() * 15) + 85   // 평일: 85-100
      } else if (hour >= 14 && hour <= 16) {
        // 오후 첫 집중 시간
        return isWeekend ? 
          Math.floor(Math.random() * 25) + 55 : // 주말: 55-80
          Math.floor(Math.random() * 20) + 75   // 평일: 75-95
      } else if (hour >= 19 && hour <= 21) {
        // 저녁 집중 시간
        return isWeekend ? 
          Math.floor(Math.random() * 30) + 50 : // 주말: 50-80
          Math.floor(Math.random() * 25) + 70   // 평일: 70-95
      } else if (hour >= 22 && hour <= 23) {
        // 늦은 저녁
        return Math.floor(Math.random() * 20) + 40 // 40-60
      } else if (hour >= 6 && hour <= 8) {
        // 이른 아침
        return Math.floor(Math.random() * 25) + 35 // 35-60
      } else if (hour >= 12 && hour <= 13) {
        // 점심시간 (매우 낮은 집중도)
        return Math.floor(Math.random() * 15) + 10 // 10-25
      } else if (hour >= 0 && hour <= 5) {
        // 새벽 시간 (거의 없음)
        return Math.floor(Math.random() * 8) // 0-8
      } else {
        // 기타 시간
        return Math.floor(Math.random() * 20) + 20 // 20-40
      }
    })
  )

  return {
    year,
    week,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    },
    overview: {
      totalSessions: 42,
      totalFocusTime: 1890, // 31.5시간 (하루 평균 4.5시간)
      avgScore: 86.7,
      peakScore: 98,
      lowestScore: 74,
      trend: "up",
      change: 9.3
    },
    breakdown: {
      attention: 89,
      posture: 84,
      phoneUsage: 93,
      consistency: 87
    },
    timeSeriesData: [
      { timestamp: '2024-12-16', focusScore: 89, sessionDuration: 285, distractions: 1, dayOfWeek: '월' },
      { timestamp: '2024-12-17', focusScore: 94, sessionDuration: 315, distractions: 0, dayOfWeek: '화' },
      { timestamp: '2024-12-18', focusScore: 82, sessionDuration: 255, distractions: 3, dayOfWeek: '수' },
      { timestamp: '2024-12-19', focusScore: 91, sessionDuration: 300, distractions: 1, dayOfWeek: '목' },
      { timestamp: '2024-12-20', focusScore: 98, sessionDuration: 360, distractions: 0, dayOfWeek: '금' },
      { timestamp: '2024-12-21', focusScore: 85, sessionDuration: 240, distractions: 2, dayOfWeek: '토' },
      { timestamp: '2024-12-22', focusScore: 78, sessionDuration: 195, distractions: 4, dayOfWeek: '일' }
    ],
    heatmapData,
    activityData: [
      { timestamp: '2024-12-16T09:00:00Z', action: '완벽한 월요일 시작', type: 'positive', impact: 9, description: '주간 첫 세션을 최고 컨디션으로 시작' },
      { timestamp: '2024-12-16T11:30:00Z', action: '플로우 상태 달성', type: 'positive', impact: 12, description: '150분 연속 깊은 집중 상태 유지' },
      { timestamp: '2024-12-17T10:15:00Z', action: '개인 최고 기록', type: 'positive', impact: 15, description: '집중도 98점으로 신기록 달성!' },
      { timestamp: '2024-12-17T14:45:00Z', action: '환경 최적화', type: 'positive', impact: 8, description: '조명, 온도, 소음을 완벽하게 조절' },
      { timestamp: '2024-12-18T11:30:00Z', action: '중간 슬럼프', type: 'negative', impact: -4, description: '수요일 오전 집중력 저하' },
      { timestamp: '2024-12-18T15:20:00Z', action: '빠른 회복', type: 'positive', impact: 7, description: '오후에 집중력 완전 회복' },
      { timestamp: '2024-12-19T09:30:00Z', action: '루틴 완성', type: 'positive', impact: 10, description: '완벽한 아침 루틴으로 최적 컨디션' },
      { timestamp: '2024-12-19T20:00:00Z', action: '야간 집중', type: 'positive', impact: 8, description: '저녁 시간 고품질 집중 세션' },
      { timestamp: '2024-12-20T09:00:00Z', action: '주간 정점', type: 'positive', impact: 18, description: '금요일 최고 성과 - 6시간 연속 고집중' },
      { timestamp: '2024-12-21T10:30:00Z', action: '주말 꾸준함', type: 'positive', impact: 6, description: '토요일에도 높은 집중도 유지' },
      { timestamp: '2024-12-22T11:00:00Z', action: '주간 마무리', type: 'neutral', impact: 3, description: '일요일 가벼운 정리 및 복습' }
    ],
    achievements: [
      {
        id: 'weekly-champion',
        title: '주간 집중력 챔피언 🏆',
        description: '이번 주 평균 집중도 84점 달성! 목표치를 4점 초과했어요',
        progress: 84.2,
        target: 80,
        completed: true,
        badge: '🏆',
        category: 'focus'
      },
      {
        id: 'consistency-master',
        title: '꾸준함의 달인 👑',
        description: '7일 연속 집중 세션 완료! 완벽한 루틴을 만들어가고 있어요',
        progress: 7,
        target: 7,
        completed: true,
        badge: '👑',
        category: 'consistency'
      },
      {
        id: 'distraction-warrior',
        title: '방해요소 정복자 🛡️',
        description: '일일 평균 방해요소 2.6개로 목표치 달성!',
        progress: 2.6,
        target: 3,
        completed: true,
        badge: '🛡️',
        category: 'improvement'
      },
      {
        id: 'time-master',
        title: '시간 관리 마스터 ⏰',
        description: '주간 총 집중시간 28시간 달성! 계획보다 8시간 초과',
        progress: 28,
        target: 20,
        completed: true,
        badge: '⏰',
        category: 'milestone'
      },
      {
        id: 'peak-performer',
        title: '최고 성능 달성자 🚀',
        description: '개인 최고 집중도 96점 달성! 새로운 기록을 세웠어요',
        progress: 96,
        target: 90,
        completed: true,
        badge: '🚀',
        category: 'milestone'
      },
      {
        id: 'posture-guardian',
        title: '자세 관리자 💪',
        description: '올바른 자세 유지율 82%로 건강한 학습 습관 형성',
        progress: 82,
        target: 75,
        completed: true,
        badge: '💪',
        category: 'improvement'
      }
    ],
    feedback: [
      {
        type: 'success',
        title: '🎉 놀라운 성장세!',
        message: '이번 주 평균 집중도가 지난 주 대비 7.8점 상승했습니다! 특히 금요일에 개인 최고 기록인 96점을 달성했어요. 꾸준한 노력의 결과가 정말 대단합니다!',
        actionable: false,
        priority: 'high'
      },
      {
        type: 'tip',
        title: '💡 더 나은 집중을 위한 스마트 팁',
        message: '수요일과 일요일의 집중도가 다른 요일에 비해 낮았어요. 이 요일엔 25분 집중 + 5분 휴식의 포모도로 기법을 시도해보세요. 짧고 강한 집중이 더 효과적일 수 있어요!',
        actionable: true,
        priority: 'medium'
      },
      {
        type: 'info',
        title: '📊 개인 집중 패턴 분석',
        message: '당신의 골든타임은 오전 9-12시입니다! 이 시간대에 가장 높은 집중도를 보여요. 중요하고 어려운 작업은 이 시간에 배치하면 최고의 효율을 얻을 수 있습니다.',
        actionable: true,
        priority: 'medium'
      },
      {
        type: 'warning',
        title: '⚠️ 주의사항',
        message: '일요일에 피로 누적으로 집중력이 저하되었어요. 주말에는 적절한 휴식을 취하며 무리하지 마세요. 지속가능한 학습이 더 중요합니다!',
        actionable: true,
        priority: 'high'
      },
      {
        type: 'tip',
        title: '🔥 다음 주 목표',
        message: '이미 훌륭한 성과를 보이고 있어요! 다음 주는 평균 집중도 85점을 목표로 해보는 건 어떨까요? 현재 추세라면 충분히 달성 가능합니다!',
        actionable: true,
        priority: 'low'
      }
    ]
  }
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
      
      // 항상 Mock 데이터 사용 (데모용)
      console.log('📊 Mock 데이터 사용')
      return generateMockWeeklyData(currentYear, currentWeek)
      
      /* 실제 API 호출 코드 (주석 처리)
      try {
        const response = await fetch(`/api/report/weekly?year=${currentYear}&week=${currentWeek}`)
        
        if (!response.ok) {
          console.log('⚠️ API 실패, Mock 데이터 사용')
          return generateMockWeeklyData(currentYear, currentWeek)
        }
        
        const result = await response.json()
        console.log('✅ 주간 리포트 응답:', result)
        return result.data || result
      } catch (error) {
        console.log('⚠️ API 오류, Mock 데이터 사용:', error)
        return generateMockWeeklyData(currentYear, currentWeek)
      }
      */
    },
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
    retry: 1, // Mock 데이터를 사용하므로 재시도 줄임
    retryDelay: 1000,
    enabled: !!currentYear && !!currentWeek,
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
 * 주차의 시작일 계산
 */
function getWeekStartDate(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay() || 7 // 일요일을 7로 처리
  const daysToAdd = (week - 1) * 7 - dayOfWeek + 1
  const startDate = new Date(jan1)
  startDate.setDate(jan1.getDate() + daysToAdd)
  return startDate
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