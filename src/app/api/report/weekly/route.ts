import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Weekly report authentication failed:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const week = parseInt(searchParams.get('week') || '1')
    
    console.log(`📊 Weekly report request for year: ${year}, week: ${week}, userId: ${user.id}`)

    // 주간 시작일과 종료일 계산 (ISO 8601 기준)
    const weekStart = getWeekStart(year, week)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    console.log(`📅 Week period: ${weekStart.toISOString()} ~ ${weekEnd.toISOString()}`)

    // 1. 주간 세션 데이터 조회
    const { data: sessions, error: sessionsError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min,
        context_tag,
        distractions,
        notes
      `)
      .eq('user_id', user.id)
      .gte('started_at', weekStart.toISOString())
      .lte('started_at', weekEnd.toISOString())
      .order('started_at', { ascending: true })

    if (sessionsError) {
      console.error('❌ Sessions fetch error:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions data' },
        { status: 500 }
      )
    }

    // 2. 주간 일일 요약 데이터 조회
    const { data: dailySummaries, error: summariesError } = await supabase
      .from('daily_summary')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (summariesError) {
      console.error('❌ Daily summaries fetch error:', summariesError)
    }

    // 3. 주간 통계 계산
    const weeklyStats = calculateWeeklyStats(sessions || [], dailySummaries || [], weekStart, weekEnd)
    
    // 4. 시계열 데이터 생성
    const timeSeriesData = generateTimeSeriesData(sessions || [], weekStart, weekEnd)
    
    // 5. 시간대별 히트맵 데이터 생성
    const heatmapData = generateHeatmapData(sessions || [], weekStart, weekEnd)
    
    // 6. 활동 데이터 생성
    const activityData = generateActivityData(sessions || [])
    
    // 7. 성취도 데이터 생성
    const achievements = generateAchievements(weeklyStats)
    
    // 8. 피드백 데이터 생성
    const feedback = generateFeedback(weeklyStats)

    const weeklyReportData = {
      year,
      week,
      period: {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      },
      overview: weeklyStats.overview,
      breakdown: weeklyStats.breakdown,
      timeSeriesData,
      heatmapData,
      activityData,
      achievements,
      feedback
    }

    console.log('✅ Weekly report generated successfully:', {
      sessionsCount: sessions?.length || 0,
      totalFocusTime: weeklyStats.overview.totalFocusTime,
      avgScore: weeklyStats.overview.avgScore
    })

    return NextResponse.json(weeklyReportData)

  } catch (error) {
    console.error('❌ Weekly report API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// 주간 시작일 계산 (ISO 8601 기준)
function getWeekStart(year: number, week: number): Date {
  const januaryFirst = new Date(year, 0, 1)
  const daysToAdd = (week - 1) * 7
  const weekStart = new Date(januaryFirst)
  weekStart.setDate(januaryFirst.getDate() + daysToAdd)
  
  // 월요일로 조정
  const dayOfWeek = weekStart.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  weekStart.setDate(weekStart.getDate() - daysToMonday)
  weekStart.setHours(0, 0, 0, 0)
  
  return weekStart
}

// 주간 통계 계산
function calculateWeeklyStats(
  sessions: any[],
  dailySummaries: any[],
  weekStart: Date,
  weekEnd: Date
) {
  // 기본 통계 계산
  const totalSessions = sessions.length
  const totalFocusTime = sessions.reduce((sum, session) => {
    if (session.ended_at && session.started_at) {
      const duration = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60 * 60)
      return sum + duration
    }
    return sum
  }, 0)

  const focusScores = sessions.map(s => s.focus_score || 0).filter(score => score > 0)
  const avgScore = focusScores.length > 0 ? focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length : 0
  const peakScore = focusScores.length > 0 ? Math.max(...focusScores) : 0
  const lowestScore = focusScores.length > 0 ? Math.min(...focusScores) : 0

  // 트렌드 계산 (이전 주와 비교)
  const trend = calculateTrend(avgScore, dailySummaries)
  
  // 세부 분석 점수 계산
  const breakdown = calculateBreakdown(sessions, dailySummaries)

  return {
    overview: {
      totalSessions,
      totalFocusTime: Math.round(totalFocusTime * 10) / 10,
      avgScore: Math.round(avgScore * 10) / 10,
      peakScore,
      lowestScore,
      trend,
      change: 0 // 이전 주 대비 변화율 (추후 계산)
    },
    breakdown
  }
}

// 트렌드 계산
function calculateTrend(currentAvg: number, dailySummaries: any[]): "up" | "down" | "stable" {
  if (dailySummaries.length < 2) return "stable"
  
  const recentScores = dailySummaries.slice(-3).map(s => s.avg_score || 0)
  const olderScores = dailySummaries.slice(-6, -3).map(s => s.avg_score || 0)
  
  if (recentScores.length === 0 || olderScores.length === 0) return "stable"
  
  const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
  const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length
  
  if (recentAvg > olderAvg + 5) return "up"
  if (recentAvg < olderAvg - 5) return "down"
  return "stable"
}

// 세부 분석 점수 계산
function calculateBreakdown(sessions: any[], dailySummaries: any[]) {
  // 주의집중 점수 (평균 집중도)
  const attention = dailySummaries.length > 0 
    ? Math.round(dailySummaries.reduce((sum, s) => sum + (s.avg_score || 0), 0) / dailySummaries.length)
    : 0

  // 자세 점수 (세션 지속시간 기반 추정)
  const posture = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => {
        if (s.ended_at && s.started_at) {
          const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60)
          return sum + Math.min(duration / 10, 100) // 10분당 100점
        }
        return sum
      }, 0) / sessions.length)
    : 0

  // 휴대폰 사용 점수 (daily_summary의 phone_min 기반)
  const phoneUsage = dailySummaries.length > 0 
    ? Math.round(100 - Math.min(dailySummaries.reduce((sum, s) => sum + (s.phone_min || 0), 0) / dailySummaries.length, 100))
    : 0

  // 일관성 점수 (활동일 수 기반)
  const consistency = dailySummaries.length > 0 
    ? Math.round((dailySummaries.length / 7) * 100)
    : 0

  return {
    attention,
    posture,
    phoneUsage,
    consistency
  }
}

// 시계열 데이터 생성
function generateTimeSeriesData(sessions: any[], weekStart: Date, weekEnd: Date) {
  const timeSeriesData = []
  const days = ['월', '화', '수', '목', '금', '토', '일']
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart)
    currentDate.setDate(weekStart.getDate() + i)
    
    const daySessions = sessions.filter(s => {
      const sessionDate = new Date(s.started_at)
      return sessionDate.toDateString() === currentDate.toDateString()
    })
    
    const focusScore = daySessions.length > 0 
      ? Math.round(daySessions.reduce((sum, s) => sum + (s.focus_score || 0), 0) / daySessions.length)
      : 0
    
    const sessionDuration = daySessions.reduce((sum, s) => {
      if (s.ended_at && s.started_at) {
        return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / (1000 * 60 * 60)
      }
      return sum
    }, 0)
    
    const distractions = daySessions.reduce((sum, s) => sum + (s.distractions || 0), 0)
    
    timeSeriesData.push({
      timestamp: currentDate.toISOString(),
      focusScore,
      sessionDuration: Math.round(sessionDuration * 10) / 10,
      distractions,
      dayOfWeek: days[i]
    })
  }
  
  return timeSeriesData
}

// 시간대별 히트맵 데이터 생성
function generateHeatmapData(sessions: any[], weekStart: Date, weekEnd: Date) {
  // 7일 x 24시간 배열 초기화
  const heatmapData: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const sessionCounts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  
  sessions.forEach(session => {
    if (!session.started_at || !session.ended_at) return
    
    const startTime = new Date(session.started_at)
    const endTime = new Date(session.ended_at)
    
    // 주간 범위 내의 세션만 처리
    if (startTime < weekStart || startTime > weekEnd) return
    
    // 요일 인덱스 계산 (0: 월요일, 6: 일요일)
    const dayOfWeek = (startTime.getDay() + 6) % 7 // 일요일을 7로, 월요일을 1로 변환
    
    // 세션의 각 시간대별 집중도 계산
    const sessionDuration = endTime.getTime() - startTime.getTime()
    const focusScore = session.focus_score || 0
    
    // 세션이 걸친 모든 시간대에 집중도 분배
    let currentTime = new Date(startTime)
    while (currentTime < endTime) {
      const hour = currentTime.getHours()
      
      // 해당 시간대의 다음 시간까지의 지속시간 계산
      const nextHour = new Date(currentTime)
      nextHour.setHours(hour + 1, 0, 0, 0)
      const timeInThisHour = Math.min(nextHour.getTime() - currentTime.getTime(), endTime.getTime() - currentTime.getTime())
      
      // 시간대별 가중 평균 계산
      const weight = timeInThisHour / sessionDuration
      heatmapData[dayOfWeek][hour] += focusScore * weight
      sessionCounts[dayOfWeek][hour] += weight
      
      currentTime = nextHour
    }
  })
  
  // 평균 집중도 계산
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (sessionCounts[day][hour] > 0) {
        heatmapData[day][hour] = Math.round(heatmapData[day][hour] / sessionCounts[day][hour])
      }
    }
  }
  
  return heatmapData
}

// 활동 데이터 생성
function generateActivityData(sessions: any[]) {
  const activityData: Array<{
    timestamp: string;
    action: string;
    type: 'positive' | 'neutral' | 'negative';
    impact: number;
    description: string;
  }> = []
  
  sessions.forEach(session => {
    // 세션 시작 활동
    activityData.push({
      timestamp: session.started_at,
      action: '집중 세션 시작',
      type: 'positive' as const,
      impact: 10,
      description: `${session.context_tag || '학습'} 세션을 시작했습니다.`
    })
    
    // 세션 종료 활동
    if (session.ended_at) {
      const duration = (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)
      const score = session.focus_score || 0
      
      activityData.push({
        timestamp: session.ended_at,
        action: '집중 세션 완료',
        type: score > 80 ? 'positive' : score > 60 ? 'neutral' : 'negative',
        impact: Math.round(score / 10),
        description: `${Math.round(duration)}분간 ${score}점의 집중도를 기록했습니다.`
      })
    }
  })
  
  return activityData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

// 성취도 데이터 생성
function generateAchievements(stats: any) {
  const achievements = []
  
  // 세션 수 성취도
  if (stats.overview.totalSessions >= 10) {
    achievements.push({
      id: 'weekly-sessions-10',
      title: '주간 집중 마스터',
      description: '이번 주에 10회 이상의 집중 세션을 완료했습니다.',
      progress: Math.min(stats.overview.totalSessions, 10),
      target: 10,
      completed: stats.overview.totalSessions >= 10,
      badge: '🎯',
      category: 'consistency' as const
    })
  }
  
  // 집중 시간 성취도
  if (stats.overview.totalFocusTime >= 20) {
    achievements.push({
      id: 'weekly-time-20',
      title: '시간 투자왕',
      description: '이번 주에 20시간 이상 집중했습니다.',
      progress: Math.min(stats.overview.totalFocusTime, 20),
      target: 20,
      completed: stats.overview.totalFocusTime >= 20,
      badge: '⏰',
      category: 'focus' as const
    })
  }
  
  // 평균 점수 성취도
  if (stats.overview.avgScore >= 85) {
    achievements.push({
      id: 'weekly-score-85',
      title: '고집중 전문가',
      description: '이번 주 평균 집중도가 85점 이상입니다.',
      progress: Math.min(stats.overview.avgScore, 85),
      target: 85,
      completed: stats.overview.avgScore >= 85,
      badge: '🧠',
      category: 'focus' as const
    })
  }
  
  return achievements
}

// 피드백 데이터 생성
function generateFeedback(stats: any) {
  const feedback = []
  
  // 세션 수 피드백
  if (stats.overview.totalSessions < 5) {
    feedback.push({
      type: 'warning' as const,
      title: '세션 수 부족',
      message: '이번 주 세션 수가 적습니다. 더 자주 집중 시간을 가져보세요.',
      actionable: true,
      priority: 'medium' as const
    })
  }
  
  // 집중도 피드백
  if (stats.overview.avgScore < 70) {
    feedback.push({
      type: 'warning' as const,
      title: '집중도 개선 필요',
      message: '평균 집중도가 낮습니다. 방해 요소를 줄이고 집중 환경을 개선해보세요.',
      actionable: true,
      priority: 'high' as const
    })
  }
  
  // 긍정적 피드백
  if (stats.overview.totalSessions >= 7 && stats.overview.avgScore >= 80) {
    feedback.push({
      type: 'success' as const,
      title: '훌륭한 주간 성과',
      message: '이번 주 집중력이 매우 좋습니다! 계속해서 이 페이스를 유지하세요.',
      actionable: false,
      priority: 'low' as const
    })
  }
  
  return feedback
} 