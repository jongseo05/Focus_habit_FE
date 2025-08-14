import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 사용자 집중 통계 요약
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 이번 주 시작일과 종료일 계산
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay()) // 일요일
    startOfWeek.setHours(0, 0, 0, 0)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // 토요일
    endOfWeek.setHours(23, 59, 59, 999)

    // 지난 주 시작일과 종료일 계산
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfWeek.getDate() - 7)
    
    const endOfLastWeek = new Date(startOfLastWeek)
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6)
    endOfLastWeek.setHours(23, 59, 59, 999)

    // 이번 주 집중 세션 데이터 조회
    const { data: thisWeekSessions, error: thisWeekError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min
      `)
      .eq('user_id', user.id)
      .gte('started_at', startOfWeek.toISOString())
      .lte('started_at', endOfWeek.toISOString())
      .order('started_at', { ascending: true })

    if (thisWeekError) {
      console.error('이번 주 세션 조회 실패:', thisWeekError)
      return NextResponse.json(
        { error: '집중 세션 데이터를 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 지난 주 집중 세션 데이터 조회
    const { data: lastWeekSessions, error: lastWeekError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min
      `)
      .eq('user_id', user.id)
      .gte('started_at', startOfLastWeek.toISOString())
      .lte('started_at', endOfLastWeek.toISOString())
      .order('started_at', { ascending: true })

    if (lastWeekError) {
      console.error('지난 주 세션 조회 실패:', lastWeekError)
      return NextResponse.json(
        { error: '집중 세션 데이터를 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 이번 주 통계 계산
    const thisWeekStats = calculateWeekStats(thisWeekSessions || [])
    
    // 지난 주 통계 계산
    const lastWeekStats = calculateWeekStats(lastWeekSessions || [])

    // 주간 변화율 계산
    const weeklyChange = lastWeekStats.total_time > 0 
      ? ((thisWeekStats.total_time - lastWeekStats.total_time) / lastWeekStats.total_time) * 100
      : 0

    const summary = {
      weekly_total_time: thisWeekStats.total_time,
      average_focus_score: thisWeekStats.average_score,
      longest_streak: thisWeekStats.longest_streak,
      session_count: thisWeekStats.session_count,
      weekly_change: Math.round(weeklyChange * 10) / 10 // 소수점 첫째자리까지
    }

    return NextResponse.json(summary)

  } catch (error) {
    console.error('집중 요약 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 주간 통계 계산 함수
function calculateWeekStats(sessions: any[]) {
  if (sessions.length === 0) {
    return {
      total_time: 0,
      average_score: 0,
      longest_streak: 0,
      session_count: 0
    }
  }

  let totalTime = 0
  let totalScore = 0
  let longestStreak = 0
  let validScores = 0

  sessions.forEach(session => {
    // 세션 시간 계산 (분 단위)
    if (session.started_at && session.ended_at) {
      const startTime = new Date(session.started_at)
      const endTime = new Date(session.ended_at)
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
      totalTime += durationMinutes
      
      // 최장 스트릭 업데이트
      if (durationMinutes > longestStreak) {
        longestStreak = durationMinutes
      }
    }

    // 집중 점수 계산
    if (session.focus_score !== null && session.focus_score !== undefined) {
      totalScore += session.focus_score
      validScores++
    }
  })

  const averageScore = validScores > 0 ? Math.round(totalScore / validScores) : 0

  return {
    total_time: totalTime,
    average_score: averageScore,
    longest_streak: longestStreak,
    session_count: sessions.length
  }
}

