import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 주간 상세 통계
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

    // 이번 주 집중 세션 데이터 조회
    const { data: sessions, error: sessionsError } = await supabase
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
      .gte('started_at', startOfWeek.toISOString())
      .lte('started_at', endOfWeek.toISOString())
      .order('started_at', { ascending: true })

    if (sessionsError) {
      console.error('주간 세션 조회 실패:', sessionsError)
      return NextResponse.json(
        { error: '집중 세션 데이터를 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 요일별 데이터 계산
    const dailyStats = calculateDailyStats(sessions || [], startOfWeek)

    return NextResponse.json({
      daily_stats: dailyStats,
      total_sessions: sessions?.length || 0
    })

  } catch (error) {
    console.error('주간 통계 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 요일별 통계 계산 함수
function calculateDailyStats(sessions: any[], startOfWeek: Date) {
  const dailyStats = []
  
  // 일주일 데이터 초기화
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    
    dailyStats.push({
      date: date.toISOString().split('T')[0],
      day_of_week: i,
      day_name: ['일', '월', '화', '수', '목', '금', '토'][i],
      total_time: 0,
      average_score: 0,
      session_count: 0,
      goal_time: 120, // 기본 목표: 2시간
      achieved_goal: false
    })
  }

  // 세션 데이터를 요일별로 분류
  sessions.forEach(session => {
    if (session.started_at) {
      const sessionDate = new Date(session.started_at)
      const dayIndex = sessionDate.getDay()
      
      // 세션 시간 계산
      let sessionDuration = 0
      if (session.started_at && session.ended_at) {
        const startTime = new Date(session.started_at)
        const endTime = new Date(session.ended_at)
        sessionDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
      }

      // 해당 요일 통계 업데이트
      const dayStat = dailyStats[dayIndex]
      dayStat.total_time += sessionDuration
      dayStat.session_count += 1
      
      // 평균 점수 계산
      if (session.focus_score !== null && session.focus_score !== undefined) {
        const currentTotal = dayStat.average_score * (dayStat.session_count - 1)
        dayStat.average_score = Math.round((currentTotal + session.focus_score) / dayStat.session_count)
      }
    }
  })

  // 목표 달성 여부 확인
  dailyStats.forEach(dayStat => {
    dayStat.achieved_goal = dayStat.total_time >= dayStat.goal_time
  })

  return dailyStats
}

