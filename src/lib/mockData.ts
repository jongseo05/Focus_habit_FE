// Mock Data for Reports
import { WeeklyReportData } from '@/hooks/useWeeklyReport'

// 현재 주차 계산
function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + start.getDay() + 1) / 7)
}

// 현재 연도와 주차
const currentYear = new Date().getFullYear()
const currentWeek = getCurrentWeek()

// 주간 리포트 Mock 데이터
export const mockWeeklyReportData: WeeklyReportData = {
  year: currentYear,
  week: currentWeek,
  period: {
    startDate: '2024-01-15', // 월요일
    endDate: '2024-01-21'    // 일요일
  },
  overview: {
    totalSessions: 12,
    totalFocusTime: 28.5, // 시간
    avgScore: 78.3,
    peakScore: 95,
    lowestScore: 62,
    trend: "up" as const,
    change: 5.2
  },
  breakdown: {
    attention: 82,
    posture: 75,
    phoneUsage: 68,
    consistency: 85
  },
  timeSeriesData: [
    {
      timestamp: '2024-01-15T09:00:00Z',
      focusScore: 85,
      sessionDuration: 2.5,
      distractions: 3,
      dayOfWeek: '월'
    },
    {
      timestamp: '2024-01-16T10:30:00Z',
      focusScore: 78,
      sessionDuration: 3.0,
      distractions: 5,
      dayOfWeek: '화'
    },
    {
      timestamp: '2024-01-17T14:00:00Z',
      focusScore: 92,
      sessionDuration: 4.2,
      distractions: 2,
      dayOfWeek: '수'
    },
    {
      timestamp: '2024-01-18T11:15:00Z',
      focusScore: 76,
      sessionDuration: 2.8,
      distractions: 4,
      dayOfWeek: '목'
    },
    {
      timestamp: '2024-01-19T15:30:00Z',
      focusScore: 88,
      sessionDuration: 3.5,
      distractions: 3,
      dayOfWeek: '금'
    },
    {
      timestamp: '2024-01-20T13:00:00Z',
      focusScore: 95,
      sessionDuration: 4.8,
      distractions: 1,
      dayOfWeek: '토'
    },
    {
      timestamp: '2024-01-21T16:00:00Z',
      focusScore: 62,
      sessionDuration: 1.5,
      distractions: 8,
      dayOfWeek: '일'
    }
  ],
  activityData: [
    {
      timestamp: '2024-01-15T09:30:00Z',
      action: 'phone_check',
      type: 'negative',
      impact: -5,
      description: '휴대폰 확인으로 인한 집중도 하락'
    },
    {
      timestamp: '2024-01-15T11:00:00Z',
      action: 'break_taken',
      type: 'positive',
      impact: 3,
      description: '적절한 휴식으로 집중도 회복'
    },
    {
      timestamp: '2024-01-16T10:45:00Z',
      action: 'posture_correction',
      type: 'positive',
      impact: 2,
      description: '자세 교정으로 집중도 향상'
    },
    {
      timestamp: '2024-01-16T12:30:00Z',
      action: 'distraction',
      type: 'negative',
      impact: -8,
      description: '외부 소음으로 인한 방해'
    },
    {
      timestamp: '2024-01-17T14:15:00Z',
      action: 'deep_focus',
      type: 'positive',
      impact: 10,
      description: '깊은 집중 상태 진입'
    },
    {
      timestamp: '2024-01-17T16:00:00Z',
      action: 'goal_achieved',
      type: 'positive',
      impact: 5,
      description: '학습 목표 달성'
    },
    {
      timestamp: '2024-01-18T11:30:00Z',
      action: 'phone_usage',
      type: 'negative',
      impact: -6,
      description: '과도한 휴대폰 사용'
    },
    {
      timestamp: '2024-01-18T13:00:00Z',
      action: 'environment_change',
      type: 'positive',
      impact: 4,
      description: '학습 환경 개선'
    },
    {
      timestamp: '2024-01-19T15:45:00Z',
      action: 'consistent_work',
      type: 'positive',
      impact: 7,
      description: '지속적인 학습 진행'
    },
    {
      timestamp: '2024-01-19T17:00:00Z',
      action: 'review_session',
      type: 'positive',
      impact: 3,
      description: '복습 세션 완료'
    },
    {
      timestamp: '2024-01-20T13:30:00Z',
      action: 'peak_performance',
      type: 'positive',
      impact: 12,
      description: '최고 성과 달성'
    },
    {
      timestamp: '2024-01-20T15:00:00Z',
      action: 'milestone_reached',
      type: 'positive',
      impact: 8,
      description: '중요한 마일스톤 달성'
    },
    {
      timestamp: '2024-01-21T16:30:00Z',
      action: 'fatigue',
      type: 'negative',
      impact: -10,
      description: '피로로 인한 집중도 저하'
    },
    {
      timestamp: '2024-01-21T17:00:00Z',
      action: 'early_finish',
      type: 'neutral',
      impact: 0,
      description: '일찍 종료'
    }
  ],
  achievements: [
    {
      id: 'streak_5',
      title: '5일 연속 학습',
      description: '5일 연속으로 학습을 완료했습니다',
      progress: 5,
      target: 7,
      completed: false,
      badge: '🔥',
      category: 'consistency'
    },
    {
      id: 'high_score',
      title: '높은 집중도 달성',
      description: '90점 이상의 집중도를 달성했습니다',
      progress: 2,
      target: 3,
      completed: false,
      badge: '⭐',
      category: 'focus'
    },
    {
      id: 'long_session',
      title: '장시간 집중',
      description: '4시간 이상 연속 학습을 완료했습니다',
      progress: 1,
      target: 1,
      completed: true,
      badge: '⏰',
      category: 'milestone'
    },
    {
      id: 'phone_reduction',
      title: '휴대폰 사용 감소',
      description: '휴대폰 사용을 50% 줄였습니다',
      progress: 45,
      target: 50,
      completed: false,
      badge: '📱',
      category: 'improvement'
    }
  ],
  feedback: [
    {
      type: 'success',
      title: '주간 성과 향상',
      message: '지난 주 대비 5.2점 향상된 집중도를 보여주고 있습니다. 특히 수요일과 토요일에 뛰어난 성과를 거두었네요.',
      actionable: true,
      priority: 'high'
    },
    {
      type: 'tip',
      title: '휴대폰 사용 최적화',
      message: '휴대폰 사용 시간을 더 줄이면 집중도를 더욱 향상시킬 수 있습니다. 방해 모드를 활용해보세요.',
      actionable: true,
      priority: 'medium'
    },
    {
      type: 'warning',
      title: '일요일 집중도 저하',
      message: '일요일의 집중도가 상당히 낮습니다. 주말에도 일정한 학습 습관을 유지하는 것이 좋겠습니다.',
      actionable: true,
      priority: 'medium'
    },
    {
      type: 'info',
      title: '자세 개선 효과',
      message: '자세 교정 활동이 집중도 향상에 긍정적인 영향을 미치고 있습니다. 정기적인 자세 점검을 권장합니다.',
      actionable: false,
      priority: 'low'
    }
  ]
}

// 주간 집중도 차트용 데이터 (월~일)
export const mockWeeklyFocusChartData = [
  { dayOfWeek: '월', focusScore: 85 },
  { dayOfWeek: '화', focusScore: 78 },
  { dayOfWeek: '수', focusScore: 92 },
  { dayOfWeek: '목', focusScore: 76 },
  { dayOfWeek: '금', focusScore: 88 },
  { dayOfWeek: '토', focusScore: 95 },
  { dayOfWeek: '일', focusScore: 62 }
]

// Comprehensive Report용 Mock 데이터
export const mockComprehensiveReportData = {
  focusScore: {
    overall: 78.3,
    trend: "up" as const,
    change: 5.2,
    breakdown: {
      attention: 82,
      posture: 75,
      phoneUsage: 68,
      consistency: 85
    }
  },
  timeSeriesData: [
    { timestamp: '2024-01-15T09:00:00Z', focusScore: 85, sessionDuration: 2.5, distractions: 3, dayOfWeek: '월' },
    { timestamp: '2024-01-15T10:00:00Z', focusScore: 82, sessionDuration: 2.0, distractions: 2, dayOfWeek: '월' },
    { timestamp: '2024-01-15T11:00:00Z', focusScore: 88, sessionDuration: 2.8, distractions: 1, dayOfWeek: '월' },
    { timestamp: '2024-01-15T12:00:00Z', focusScore: 90, sessionDuration: 3.0, distractions: 0, dayOfWeek: '월' },
    { timestamp: '2024-01-15T13:00:00Z', focusScore: 87, sessionDuration: 2.7, distractions: 2, dayOfWeek: '월' },
    { timestamp: '2024-01-15T14:00:00Z', focusScore: 92, sessionDuration: 3.2, distractions: 1, dayOfWeek: '월' },
    { timestamp: '2024-01-15T15:00:00Z', focusScore: 89, sessionDuration: 2.9, distractions: 2, dayOfWeek: '월' },
    { timestamp: '2024-01-15T16:00:00Z', focusScore: 85, sessionDuration: 2.4, distractions: 3, dayOfWeek: '월' },
    { timestamp: '2024-01-16T09:00:00Z', focusScore: 78, sessionDuration: 2.1, distractions: 4, dayOfWeek: '화' },
    { timestamp: '2024-01-16T10:00:00Z', focusScore: 75, sessionDuration: 1.8, distractions: 5, dayOfWeek: '화' },
    { timestamp: '2024-01-16T11:00:00Z', focusScore: 80, sessionDuration: 2.3, distractions: 3, dayOfWeek: '화' },
    { timestamp: '2024-01-16T12:00:00Z', focusScore: 82, sessionDuration: 2.5, distractions: 2, dayOfWeek: '화' },
    { timestamp: '2024-01-16T13:00:00Z', focusScore: 79, sessionDuration: 2.0, distractions: 4, dayOfWeek: '화' },
    { timestamp: '2024-01-16T14:00:00Z', focusScore: 85, sessionDuration: 2.8, distractions: 2, dayOfWeek: '화' },
    { timestamp: '2024-01-16T15:00:00Z', focusScore: 83, sessionDuration: 2.6, distractions: 3, dayOfWeek: '화' },
    { timestamp: '2024-01-17T09:00:00Z', focusScore: 92, sessionDuration: 3.5, distractions: 1, dayOfWeek: '수' },
    { timestamp: '2024-01-17T10:00:00Z', focusScore: 89, sessionDuration: 3.2, distractions: 2, dayOfWeek: '수' },
    { timestamp: '2024-01-17T11:00:00Z', focusScore: 94, sessionDuration: 3.8, distractions: 0, dayOfWeek: '수' },
    { timestamp: '2024-01-17T12:00:00Z', focusScore: 96, sessionDuration: 4.0, distractions: 0, dayOfWeek: '수' },
    { timestamp: '2024-01-17T13:00:00Z', focusScore: 93, sessionDuration: 3.6, distractions: 1, dayOfWeek: '수' },
    { timestamp: '2024-01-17T14:00:00Z', focusScore: 95, sessionDuration: 3.9, distractions: 0, dayOfWeek: '수' },
    { timestamp: '2024-01-17T15:00:00Z', focusScore: 91, sessionDuration: 3.4, distractions: 1, dayOfWeek: '수' },
    { timestamp: '2024-01-18T09:00:00Z', focusScore: 76, sessionDuration: 2.2, distractions: 4, dayOfWeek: '목' },
    { timestamp: '2024-01-18T10:00:00Z', focusScore: 73, sessionDuration: 1.9, distractions: 5, dayOfWeek: '목' },
    { timestamp: '2024-01-18T11:00:00Z', focusScore: 78, sessionDuration: 2.4, distractions: 3, dayOfWeek: '목' },
    { timestamp: '2024-01-18T12:00:00Z', focusScore: 75, sessionDuration: 2.1, distractions: 4, dayOfWeek: '목' },
    { timestamp: '2024-01-18T13:00:00Z', focusScore: 80, sessionDuration: 2.6, distractions: 2, dayOfWeek: '목' },
    { timestamp: '2024-01-18T14:00:00Z', focusScore: 77, sessionDuration: 2.3, distractions: 3, dayOfWeek: '목' },
    { timestamp: '2024-01-18T15:00:00Z', focusScore: 82, sessionDuration: 2.7, distractions: 2, dayOfWeek: '목' },
    { timestamp: '2024-01-19T09:00:00Z', focusScore: 88, sessionDuration: 3.1, distractions: 2, dayOfWeek: '금' },
    { timestamp: '2024-01-19T10:00:00Z', focusScore: 85, sessionDuration: 2.9, distractions: 3, dayOfWeek: '금' },
    { timestamp: '2024-01-19T11:00:00Z', focusScore: 90, sessionDuration: 3.3, distractions: 1, dayOfWeek: '금' },
    { timestamp: '2024-01-19T12:00:00Z', focusScore: 87, sessionDuration: 3.0, distractions: 2, dayOfWeek: '금' },
    { timestamp: '2024-01-19T13:00:00Z', focusScore: 92, sessionDuration: 3.5, distractions: 1, dayOfWeek: '금' },
    { timestamp: '2024-01-19T14:00:00Z', focusScore: 89, sessionDuration: 3.2, distractions: 2, dayOfWeek: '금' },
    { timestamp: '2024-01-19T15:00:00Z', focusScore: 86, sessionDuration: 2.8, distractions: 3, dayOfWeek: '금' },
    { timestamp: '2024-01-20T09:00:00Z', focusScore: 95, sessionDuration: 4.2, distractions: 0, dayOfWeek: '토' },
    { timestamp: '2024-01-20T10:00:00Z', focusScore: 92, sessionDuration: 3.9, distractions: 1, dayOfWeek: '토' },
    { timestamp: '2024-01-20T11:00:00Z', focusScore: 97, sessionDuration: 4.5, distractions: 0, dayOfWeek: '토' },
    { timestamp: '2024-01-20T12:00:00Z', focusScore: 94, sessionDuration: 4.1, distractions: 1, dayOfWeek: '토' },
    { timestamp: '2024-01-20T13:00:00Z', focusScore: 96, sessionDuration: 4.3, distractions: 0, dayOfWeek: '토' },
    { timestamp: '2024-01-20T14:00:00Z', focusScore: 93, sessionDuration: 4.0, distractions: 1, dayOfWeek: '토' },
    { timestamp: '2024-01-20T15:00:00Z', focusScore: 98, sessionDuration: 4.6, distractions: 0, dayOfWeek: '토' },
    { timestamp: '2024-01-21T09:00:00Z', focusScore: 62, sessionDuration: 1.5, distractions: 6, dayOfWeek: '일' },
    { timestamp: '2024-01-21T10:00:00Z', focusScore: 58, sessionDuration: 1.2, distractions: 7, dayOfWeek: '일' },
    { timestamp: '2024-01-21T11:00:00Z', focusScore: 65, sessionDuration: 1.8, distractions: 5, dayOfWeek: '일' },
    { timestamp: '2024-01-21T12:00:00Z', focusScore: 60, sessionDuration: 1.4, distractions: 6, dayOfWeek: '일' },
    { timestamp: '2024-01-21T13:00:00Z', focusScore: 68, sessionDuration: 2.0, distractions: 4, dayOfWeek: '일' },
    { timestamp: '2024-01-21T14:00:00Z', focusScore: 64, sessionDuration: 1.6, distractions: 5, dayOfWeek: '일' },
    { timestamp: '2024-01-21T15:00:00Z', focusScore: 70, sessionDuration: 2.2, distractions: 3, dayOfWeek: '일' }
  ],
  activityData: mockWeeklyReportData.activityData,
  evidenceSnapshots: [],
  achievements: mockWeeklyReportData.achievements,
  feedback: mockWeeklyReportData.feedback
} 