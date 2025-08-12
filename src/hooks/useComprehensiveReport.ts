import { useQuery } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'

// 종합 리포트 데이터 타입
export interface ComprehensiveReportData {
  focusScore: {
    overall: number
    trend: 'up' | 'down' | 'stable'
    change: number
    breakdown: {
      attention: number
      posture: number
      phoneUsage: number
      consistency: number
    }
  }
  timeSeries: Array<{
    timestamp: string
    focusScore: number
    sessionDuration: number
    distractions: number
    dayOfWeek: string
  }>
  activities: Array<{
    timestamp: string
    action: string
    type: 'positive' | 'negative' | 'neutral'
    impact: number
    description: string
  }>
  snapshots: Array<{
    id: string
    timestamp: string
    thumbnail: string
    focusScore: number
    notes: string
    type: 'high_focus' | 'distraction' | 'break'
  }>
  achievements: Array<{
    id: string
    title: string
    description: string
    progress: number
    target: number
    completed: boolean
    badge: string
    category: 'focus' | 'consistency' | 'improvement' | 'milestone'
  }>
  feedback: Array<{
    type: 'success' | 'warning' | 'info' | 'tip'
    title: string
    message: string
    actionable: boolean
    priority: 'high' | 'medium' | 'low'
  }>
}

// 종합 리포트 데이터 생성 훅
export function useComprehensiveReport(period: 'week' | 'month' = 'week') {
  return useQuery({
    queryKey: ['comprehensive-report', period],
    queryFn: async (): Promise<ComprehensiveReportData> => {
      const supabase = supabaseBrowser()
      
      // 사용자 인증 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('인증이 필요합니다')
      }

      // 기간 설정
      const now = new Date()
      const startDate = new Date()
      if (period === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else {
        startDate.setMonth(now.getMonth() - 1)
      }

      // 1. 집중 세션 데이터 조회
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', now.toISOString())
        .order('started_at', { ascending: true })

      if (sessionsError) {
        throw new Error(`세션 조회 실패: ${sessionsError.message}`)
      }

      // 2. 집중 샘플 데이터 조회
      const sessionIds = sessions?.map(s => s.session_id) || []
      let samples: any[] = []
      let events: any[] = []
      let mlFeatures: any[] = []
      
      if (sessionIds.length > 0) {
        const { data: samplesData, error: samplesError } = await supabase
          .from('focus_sample')
          .select('*')
          .in('session_id', sessionIds)
          .order('ts', { ascending: true })

        if (samplesError) {
          console.error('샘플 데이터 조회 실패:', samplesError)
        } else {
          samples = samplesData || []
        }

        // 집중 이벤트 데이터 조회
        const { data: eventsData, error: eventsError } = await supabase
          .from('focus_event')
          .select('*')
          .in('session_id', sessionIds)
          .order('ts', { ascending: true })

        if (eventsError) {
          console.error('이벤트 데이터 조회 실패:', eventsError)
        } else {
          events = eventsData || []
        }

        // ML 피쳐 데이터 조회 (집중 상태 포함)
        const { data: mlFeaturesData, error: mlFeaturesError } = await supabase
          .from('ml_features')
          .select('session_id, ts, focus_status, focus_score, focus_confidence, head_pose_pitch, head_pose_yaw, head_pose_roll, eye_status')
          .in('session_id', sessionIds)
          .order('ts', { ascending: true })

        if (mlFeaturesError) {
          console.error('ML 피쳐 데이터 조회 실패:', mlFeaturesError)
        } else {
          mlFeatures = mlFeaturesData || []
        }
      }

      // 3. 집중도 점수 분석
      const focusScore = calculateFocusScore(sessions || [], samples, events, mlFeatures, period)

      // 4. 시계열 데이터 생성
      const timeSeries = generateTimeSeriesData(sessions || [], samples, period)

      // 5. 활동 데이터 생성
      const activities = generateActivityData(events, period)

      // 6. 성취도 데이터 생성
      const achievements = generateAchievementData(sessions || [], samples, period)

      // 7. 피드백 데이터 생성
      const feedback = generateFeedbackData(sessions || [], samples, events, period)

      // 데이터가 없을 때 기본값 제공
      if (!sessions || sessions.length === 0) {
        return {
          focusScore: {
            overall: 0,
            trend: 'stable' as const,
            change: 0,
            breakdown: {
              attention: 0,
              posture: 0,
              phoneUsage: 0,
              consistency: 0
            }
          },
          timeSeries: [],
          activities: [],
          snapshots: [],
          achievements: [],
          feedback: [
            {
              type: 'info' as const,
              title: '데이터가 없습니다',
              message: '아직 집중 세션을 시작하지 않았습니다. 첫 번째 세션을 시작해보세요!',
              actionable: true,
              priority: 'medium' as const
            }
          ]
        }
      }

      return {
        focusScore,
        timeSeries,
        activities,
        snapshots: [], // 스냅샷은 별도 구현 필요
        achievements,
        feedback
      }
    },
    staleTime: 10 * 60 * 1000, // 10분
    refetchInterval: 5 * 60 * 1000, // 5분마다 갱신
  })
}

// 집중도 점수 계산
function calculateFocusScore(sessions: any[], samples: any[], events: any[], mlFeatures: any[], period: string) {
  if (sessions.length === 0) {
    return {
      overall: 0,
      trend: 'stable' as const,
      change: 0,
      breakdown: {
        attention: 0,
        posture: 0,
        phoneUsage: 0,
        consistency: 0
      }
    }
  }

  // ML 피쳐 데이터에서 집중 점수 우선 사용
  const validMlScores = mlFeatures.filter(f => f.focus_score !== null && f.focus_score !== undefined)
  const overall = validMlScores.length > 0 
    ? Math.round(validMlScores.reduce((sum, f) => sum + f.focus_score, 0) / validMlScores.length)
    : (samples.filter(s => s.score !== null && s.score !== undefined).length > 0 
        ? Math.round(samples.filter(s => s.score !== null && s.score !== undefined)
            .reduce((sum, s) => sum + s.score, 0) / samples.filter(s => s.score !== null && s.score !== undefined).length)
        : 0)

  // 트렌드 계산 (첫 주 vs 마지막 주)
  const trend = calculateTrend(sessions, samples, mlFeatures, period)

  // 세부 분석 (ML 피쳐 데이터 활용)
  const breakdown = {
    attention: calculateAttentionScore(samples, mlFeatures),
    posture: calculatePostureScore(samples, mlFeatures),
    phoneUsage: calculatePhoneUsageScore(events),
    consistency: calculateConsistencyScore(sessions, samples, mlFeatures)
  }

  return {
    overall,
    trend: trend.direction,
    change: trend.change,
    breakdown
  }
}

// 트렌드 계산
function calculateTrend(sessions: any[], samples: any[], mlFeatures: any[], period: string) {
  if (sessions.length < 2) {
    return { direction: 'stable' as const, change: 0 }
  }

  // 기간을 두 부분으로 나누기
  const midPoint = new Date()
  if (period === 'week') {
    midPoint.setDate(midPoint.getDate() - 3.5)
  } else {
    midPoint.setDate(midPoint.getDate() - 15)
  }

  const firstHalfSamples = samples.filter(s => new Date(s.ts) < midPoint)
  const secondHalfSamples = samples.filter(s => new Date(s.ts) >= midPoint)

  const firstHalfAvg = firstHalfSamples.length > 0
    ? firstHalfSamples.reduce((sum, s) => sum + s.score, 0) / firstHalfSamples.length
    : 0

  const secondHalfAvg = secondHalfSamples.length > 0
    ? secondHalfSamples.reduce((sum, s) => sum + s.score, 0) / secondHalfSamples.length
    : 0

  const change = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100)

  let direction: 'up' | 'down' | 'stable' = 'stable'
  if (change > 5) direction = 'up'
  else if (change < -5) direction = 'down'

  return { direction, change }
}

// 주의력 점수 계산
function calculateAttentionScore(samples: any[], mlFeatures: any[]): number {
  // ML 피쳐 데이터에서 눈 상태와 집중 상태 활용
  if (mlFeatures.length > 0) {
    const eyeOpenCount = mlFeatures.filter(f => f.eye_status === 'OPEN').length
    const focusedCount = mlFeatures.filter(f => f.focus_status === 'focused').length
    const totalCount = mlFeatures.length
    
    if (totalCount > 0) {
      const eyeScore = (eyeOpenCount / totalCount) * 100
      const focusScore = (focusedCount / totalCount) * 100
      return Math.round((eyeScore + focusScore) / 2)
    }
  }
  
  // 기존 샘플 데이터 사용 (fallback)
  if (samples.length === 0) return 0
  
  const validScores = samples.filter(s => s.score !== null && s.score !== undefined)
  return validScores.length > 0 
    ? Math.round(validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length)
    : 0
}

// 자세 점수 계산
function calculatePostureScore(samples: any[], mlFeatures: any[]): number {
  if (samples.length === 0) return 0
  
  // EAR 값이 높을수록 좋은 자세 (눈이 잘 열려있음)
  const validEarSamples = samples.filter(s => s.ear_value && s.ear_value > 0)
  if (validEarSamples.length === 0) return 50

  const avgEar = validEarSamples.reduce((sum, s) => sum + s.ear_value, 0) / validEarSamples.length
  return Math.round(Math.min(100, (avgEar / 0.5) * 100)) // 0.5를 최대값으로 가정
}

// 휴대폰 사용 점수 계산
function calculatePhoneUsageScore(events: any[]): number {
  const phoneEvents = events.filter(e => e.event_type === 'phone')
  const totalEvents = events.length

  if (totalEvents === 0) return 100

  const phoneUsageRatio = phoneEvents.length / totalEvents
  return Math.round((1 - phoneUsageRatio) * 100) // 휴대폰 사용이 적을수록 높은 점수
}

// 일관성 점수 계산
function calculateConsistencyScore(sessions: any[], samples: any[], mlFeatures: any[]): number {
  if (sessions.length < 2) return 100

  // 세션 간 점수 변동성 계산
  const sessionScores = sessions.map(session => {
    const sessionSamples = samples.filter(s => s.session_id === session.session_id)
    if (sessionSamples.length === 0) return 0
    
    return sessionSamples.reduce((sum, s) => sum + s.score, 0) / sessionSamples.length
  })

  const avgScore = sessionScores.reduce((sum, score) => sum + score, 0) / sessionScores.length
  const variance = sessionScores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / sessionScores.length
  const standardDeviation = Math.sqrt(variance)

  // 표준편차가 작을수록 일관성 높음
  const consistency = Math.max(0, 100 - (standardDeviation * 2))
  return Math.round(consistency)
}

// 시계열 데이터 생성
function generateTimeSeriesData(sessions: any[], samples: any[], period: string) {
  const timeSeries: any[] = []
  
  if (!sessions || sessions.length === 0) {
    return timeSeries
  }
  
  // 날짜별로 데이터 그룹화
  const dailyData = new Map()
  
  sessions.forEach(session => {
    if (!session.started_at) return
    
    const date = new Date(session.started_at).toISOString().split('T')[0]
    const dayOfWeek = new Date(session.started_at).toLocaleDateString('ko-KR', { weekday: 'short' })
    
    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date,
        dayOfWeek,
        sessions: [],
        samples: [],
        totalDuration: 0,
        totalDistractions: 0
      })
    }
    
    const dayData = dailyData.get(date)
    dayData.sessions.push(session)
    
    // 해당 날짜의 샘플 데이터 추가
    const daySamples = samples.filter(s => {
      if (!s.ts) return false
      const sampleDate = new Date(s.ts).toISOString().split('T')[0]
      return sampleDate === date
    })
    dayData.samples.push(...daySamples)
    
    // 세션 지속시간 계산
    if (session.ended_at && session.started_at) {
      const duration = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)
      if (!isNaN(duration) && duration > 0) {
        dayData.totalDuration += duration
      }
    }
    
    const distractions = session.distractions || 0
    if (!isNaN(distractions) && distractions >= 0) {
      dayData.totalDistractions += distractions
    }
  })

  // 시계열 데이터 생성
  dailyData.forEach((dayData, date) => {
    const avgScore = dayData.samples.length > 0
      ? dayData.samples.reduce((sum: number, s: any) => {
          const score = s.score || 0
          return sum + (isNaN(score) ? 0 : score)
        }, 0) / dayData.samples.length
      : 0

    const focusScore = Math.round(avgScore)
    const sessionDuration = Math.round(dayData.totalDuration)
    const distractions = dayData.totalDistractions

    // 유효한 값만 추가
    if (!isNaN(focusScore) && !isNaN(sessionDuration) && !isNaN(distractions)) {
      timeSeries.push({
        timestamp: date,
        focusScore: Math.max(0, Math.min(100, focusScore)), // 0-100 범위로 제한
        sessionDuration: Math.max(0, sessionDuration),
        distractions: Math.max(0, distractions),
        dayOfWeek: dayData.dayOfWeek
      })
    }
  })

  return timeSeries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

// 활동 데이터 생성
function generateActivityData(events: any[], period: string) {
  if (!events || events.length === 0) {
    return []
  }
  
  return events
    .filter(event => event && event.ts && event.event_type) // 유효한 이벤트만 필터링
    .map(event => {
      let type: 'positive' | 'negative' | 'neutral' = 'neutral'
      let impact = 0
      let description = ''

      switch (event.event_type) {
        case 'focus':
          type = 'positive'
          impact = 80
          description = '집중 모드 활성화'
          break
        case 'phone':
          type = 'negative'
          impact = 60
          description = '휴대폰 사용으로 인한 방해'
          break
        case 'distraction':
          type = 'negative'
          impact = 70
          description = '주의력 분산'
          break
        case 'break':
          type = 'neutral'
          impact = 30
          description = '휴식 시간'
          break
        default:
          type = 'neutral'
          impact = 50
          description = '일반 활동'
      }

      try {
        const timestamp = new Date(event.ts).toLocaleTimeString('ko-KR')
        return {
          timestamp,
          action: getEventAction(event.event_type),
          type,
          impact,
          description
        }
      } catch (error) {
        // 날짜 파싱 오류 시 기본값 사용
        return {
          timestamp: '00:00:00',
          action: getEventAction(event.event_type),
          type,
          impact,
          description
        }
      }
    })
    .slice(-20) // 최근 20개 활동만 표시
}

// 이벤트 액션 설명
function getEventAction(eventType: string): string {
  switch (eventType) {
    case 'focus': return '집중 모드'
    case 'phone': return '휴대폰 사용'
    case 'distraction': return '주의력 분산'
    case 'break': return '휴식'
    case 'posture': return '자세 변화'
    case 'audio_analysis': return '음성 분석'
    default: return '기타 활동'
  }
}

// 성취도 데이터 생성
function generateAchievementData(sessions: any[], samples: any[], period: string) {
  const achievements: Array<{
    id: string
    title: string
    description: string
    progress: number
    target: number
    completed: boolean
    badge: string
    category: 'focus' | 'consistency' | 'improvement' | 'milestone'
  }> = []

  if (!sessions || sessions.length === 0) {
    return achievements
  }

  // 총 집중 시간 성취도
  const totalMinutes = sessions.reduce((sum, s) => {
    if (s.ended_at && s.started_at) {
      try {
        const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60)
        if (!isNaN(duration) && duration > 0) {
          return sum + duration
        }
      } catch (error) {
        // 날짜 파싱 오류 시 무시
      }
    }
    return sum
  }, 0)

  const timeTarget = period === 'week' ? 420 : 1680 // 주간 7시간, 월간 28시간
  const timeProgress = Math.min(100, Math.max(0, Math.round((totalMinutes / timeTarget) * 100)))

  achievements.push({
    id: 'total-focus-time',
    title: '집중 시간 달성',
    description: `${period === 'week' ? '주간' : '월간'} 목표 집중 시간 달성`,
    progress: timeProgress,
    target: 100,
    completed: timeProgress >= 100,
    badge: '⏰',
    category: 'milestone' as const
  })

  // 평균 집중도 성취도
  const validScores = samples.filter(s => s.score !== null && s.score !== undefined && !isNaN(s.score))
  const avgScore = validScores.length > 0
    ? validScores.reduce((sum, s) => sum + (s.score || 0), 0) / validScores.length
    : 0

  const scoreTarget = 80
  const scoreProgress = Math.min(100, Math.max(0, Math.round((avgScore / scoreTarget) * 100)))

  achievements.push({
    id: 'average-focus-score',
    title: '집중도 목표 달성',
    description: '평균 집중도 80점 이상 달성',
    progress: scoreProgress,
    target: 100,
    completed: scoreProgress >= 100,
    badge: '🎯',
    category: 'focus' as const
  })

  // 연속 세션 성취도
  const consecutiveSessions = calculateConsecutiveSessions(sessions)
  const consecutiveTarget = period === 'week' ? 5 : 20
  const consecutiveProgress = Math.min(100, Math.max(0, Math.round((consecutiveSessions / consecutiveTarget) * 100)))

  achievements.push({
    id: 'consecutive-sessions',
    title: '연속 학습 습관',
    description: `${period === 'week' ? '주간' : '월간'} 연속 세션 달성`,
    progress: consecutiveProgress,
    target: 100,
    completed: consecutiveProgress >= 100,
    badge: '🔥',
    category: 'consistency' as const
  })

  return achievements
}

// 연속 세션 계산
function calculateConsecutiveSessions(sessions: any[]): number {
  if (!sessions || sessions.length === 0) return 0

  const validSessions = sessions.filter(s => s && s.started_at)
  if (validSessions.length === 0) return 0

  const sortedSessions = validSessions.sort((a, b) => {
    try {
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    } catch (error) {
      return 0
    }
  })

  let maxConsecutive = 1
  let currentConsecutive = 1

  for (let i = 1; i < sortedSessions.length; i++) {
    try {
      const prevDate = new Date(sortedSessions[i-1].started_at)
      const currDate = new Date(sortedSessions[i].started_at)
      
      if (isNaN(prevDate.getTime()) || isNaN(currDate.getTime())) continue
      
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (dayDiff <= 1) {
        currentConsecutive++
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
      } else {
        currentConsecutive = 1
      }
    } catch (error) {
      // 날짜 파싱 오류 시 무시하고 계속 진행
      continue
    }
  }

  return maxConsecutive
}

// 피드백 데이터 생성
function generateFeedbackData(sessions: any[], samples: any[], events: any[], period: string) {
  const feedback = []

  // 집중도 분석
  const validScores = samples.filter(s => s.score !== null && s.score !== undefined)
  const avgScore = validScores.length > 0
    ? validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length
    : 0

  if (avgScore >= 80) {
    feedback.push({
      type: 'success' as const,
      title: '우수한 집중력',
      message: '평균 집중도가 80점을 넘어 매우 좋은 상태입니다. 이대로 유지하세요!',
      actionable: false,
      priority: 'low' as const
    })
  } else if (avgScore < 60) {
    feedback.push({
      type: 'warning' as const,
      title: '집중력 개선 필요',
      message: '집중도가 낮습니다. 휴식 시간을 늘리고 작업 환경을 개선해보세요.',
      actionable: true,
      priority: 'high' as const
    })
  }

  // 휴대폰 사용 분석
  const phoneEvents = events.filter(e => e.event_type === 'phone')
  if (phoneEvents.length > sessions.length * 0.5) {
    feedback.push({
      type: 'warning' as const,
      title: '과도한 휴대폰 사용',
      message: '휴대폰 사용이 많아 집중을 방해하고 있습니다. 방해 요소를 줄여보세요.',
      actionable: true,
      priority: 'medium' as const
    })
  }

  // 학습 시간 분석
  const totalMinutes = sessions.reduce((sum, s) => {
    if (s.ended_at) {
      const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60)
      return sum + duration
    }
    return sum
  }, 0)

  const targetMinutes = period === 'week' ? 420 : 1680
  if (totalMinutes < targetMinutes * 0.7) {
    feedback.push({
      type: 'info' as const,
      title: '학습 시간 부족',
      message: '목표 학습 시간에 비해 부족합니다. 조금씩 늘려가보세요.',
      actionable: true,
      priority: 'medium' as const
    })
  }

  // 긍정적인 피드백
  if (feedback.length === 0) {
    feedback.push({
      type: 'tip' as const,
      title: '안정적인 학습 패턴',
      message: '현재 학습 패턴이 안정적입니다. 꾸준히 유지하세요.',
      actionable: false,
      priority: 'low' as const
    })
  }

  return feedback
}
