import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('Daily stats auth check:', { user: !!user, error: userError })
    
    if (userError || !user) {
      console.error('Daily stats authentication failed:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    
    // 최근 N일간의 focus_session 데이터 가져오기
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    console.log('📅 Daily stats 조회 범위:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days
    })

    // focus_session 테이블에서 데이터 가져오기
    const { data: sessionStats, error: sessionError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min,
        context_tag,
        distractions
      `)
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: false })

    if (sessionError) {
      console.error('Session fetch error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      )
    }

    console.log('✅ Session data 조회 성공:', {
      sessionsCount: sessionStats?.length || 0
    })

    // 날짜별로 데이터 정리
    const dateStatsMap = new Map()
    
    // focus_session 데이터를 날짜별로 그룹화하여 통계 계산
    sessionStats?.forEach(session => {
      const sessionDate = new Date(session.started_at).toISOString().split('T')[0]
      
      let existing = dateStatsMap.get(sessionDate)
      if (!existing) {
        existing = {
          date: sessionDate,
          sessions: 0,
          totalTime: 0,
          averageScore: 0,
          hasData: false,
          phoneMin: 0,
          quietRatio: 0,
          longestStreak: 0,
          totalScores: 0,
          validScores: 0
        }
        dateStatsMap.set(sessionDate, existing)
      }
      
      // 세션 수 증가
      existing.sessions += 1
      existing.hasData = true
      
      // 실제 세션 시간 계산 (목표 시간 대신 실제 경과 시간)
      if (session.ended_at) {
        const startTime = new Date(session.started_at)
        const endTime = new Date(session.ended_at)
        const actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) // 분 단위
        existing.totalTime += actualDuration
      } else if (session.goal_min) {
        // 진행 중인 세션은 목표 시간으로 계산
        existing.totalTime += session.goal_min
      }
      
      // 집중도 점수 계산
      if (session.focus_score && session.focus_score > 0) {
        existing.totalScores += session.focus_score
        existing.validScores += 1
      }
    })

    // 각 날짜별 평균 점수 계산
    for (const [date, stats] of dateStatsMap.entries()) {
      if (stats.validScores > 0) {
        stats.averageScore = Math.round(stats.totalScores / stats.validScores)
      }
    }

    // 최근 N일간의 모든 날짜에 대해 데이터 생성
    const allDates = []
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      const stats = dateStatsMap.get(dateStr) || {
        date: dateStr,
        sessions: 0,
        totalTime: 0,
        averageScore: 0,
        hasData: false,
        phoneMin: 0,
        quietRatio: 0,
        longestStreak: 0
      }
      
      allDates.push(stats)
    }

    // 전체 통계 계산
    const activeDates = allDates.filter(d => d.hasData)
    const totalStats = {
      totalDays: allDates.length,
      activeDays: activeDates.length,
      totalSessions: activeDates.reduce((sum, d) => sum + d.sessions, 0),
      totalFocusTime: activeDates.reduce((sum, d) => sum + d.totalTime, 0),
      averageScore: activeDates.length > 0 
        ? Math.round(activeDates.reduce((sum, d) => sum + d.averageScore, 0) / activeDates.length)
        : 0
    }

    console.log('📊 Daily stats 계산 완료:', {
      totalDays: totalStats.totalDays,
      activeDays: totalStats.activeDays,
      totalSessions: totalStats.totalSessions,
      averageScore: totalStats.averageScore
    })

    return NextResponse.json({
      dailyStats: allDates,
      totalStats,
      success: true
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 