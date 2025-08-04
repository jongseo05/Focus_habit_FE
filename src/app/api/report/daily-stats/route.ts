import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    
    // 최근 N일간의 daily_summary 데이터 가져오기
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: dailyStats, error } = await supabase
      .from('daily_summary')
      .select(`
        date,
        focus_min,
        avg_score,
        sessions_count,
        phone_min,
        quiet_ratio,
        longest_streak
      `)
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch daily stats' },
        { status: 500 }
      )
    }

    // focus_session 테이블에서도 추가 데이터 가져오기 (daily_summary가 없는 경우를 위해)
    const { data: sessionStats, error: sessionError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min,
        context_tag
      `)
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: false })

    if (sessionError) {
      console.error('Session fetch error:', sessionError)
    }

    // 날짜별로 데이터 정리
    const dateStatsMap = new Map()
    
    // daily_summary 데이터 처리
    dailyStats?.forEach(stat => {
      dateStatsMap.set(stat.date, {
        date: stat.date,
        sessions: stat.sessions_count || 0,
        totalTime: stat.focus_min || 0,
        averageScore: stat.avg_score || 0,
        hasData: true,
        phoneMin: stat.phone_min || 0,
        quietRatio: stat.quiet_ratio || 0,
        longestStreak: stat.longest_streak || 0
      })
    })

    // focus_session 데이터로 보완 (daily_summary에 없는 날짜들)
    sessionStats?.forEach(session => {
      const sessionDate = new Date(session.started_at).toISOString().split('T')[0]
      
      if (!dateStatsMap.has(sessionDate)) {
        const existing = dateStatsMap.get(sessionDate) || {
          date: sessionDate,
          sessions: 0,
          totalTime: 0,
          averageScore: 0,
          hasData: false,
          phoneMin: 0,
          quietRatio: 0,
          longestStreak: 0
        }
        
        existing.sessions += 1
        existing.totalTime += session.goal_min || 0
        existing.averageScore = session.focus_score || 0
        existing.hasData = true
        
        dateStatsMap.set(sessionDate, existing)
      }
    })

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
    const totalStats = {
      totalDays: allDates.length,
      activeDays: allDates.filter(d => d.hasData).length,
      totalSessions: allDates.reduce((sum, d) => sum + d.sessions, 0),
      totalFocusTime: allDates.reduce((sum, d) => sum + d.totalTime, 0),
      averageScore: allDates.length > 0 
        ? Math.round(allDates.reduce((sum, d) => sum + d.averageScore, 0) / allDates.length)
        : 0
    }

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