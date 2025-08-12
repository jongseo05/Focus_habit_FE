import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User auth check:', { user: !!user, error: userError })
    
    if (userError || !user) {
      console.error('Authentication failed:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    const { date } = await params
    
    // 해당 날짜의 모든 세션 가져오기
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const { data: sessions, error: sessionsError } = await supabase
      .from('focus_session')
      .select(`
        session_id,
        started_at,
        ended_at,
        focus_score,
        goal_min,
        context_tag,
        notes,
        distractions
      `)
      .eq('user_id', user.id)
      .gte('started_at', startOfDay.toISOString())
      .lte('started_at', endOfDay.toISOString())
      .order('started_at', { ascending: true })

    if (sessionsError) {
      console.error('Sessions fetch error:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    // daily_summary에서 해당 날짜 데이터 가져오기
    const { data: dailySummary, error: summaryError } = await supabase
      .from('daily_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .single()

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Daily summary fetch error:', summaryError)
    }

    // ML 피쳐 데이터 가져오기 (집중 상태 포함)
    const sessionIds = sessions?.map(s => s.session_id) || []
    let mlFeaturesData: any[] = []
    
    if (sessionIds.length > 0) {
      const { data: mlFeatures, error: mlFeaturesError } = await supabase
        .from('ml_features')
        .select('session_id, ts, focus_status, focus_score, focus_confidence')
        .in('session_id', sessionIds)
        .order('ts', { ascending: true })

      if (mlFeaturesError) {
        console.error('ML features fetch error:', mlFeaturesError)
      } else {
        mlFeaturesData = mlFeatures || []
      }
    }

    // 통계 계산
    let totalSessions = sessions?.length || 0
    let totalFocusTime = 0
    let totalScore = 0
    let peakScore = 0
    let totalDistractions = 0
    let validScores = 0

    // 집중 상태 통계
    let focusedCount = 0
    let normalCount = 0
    let distractedCount = 0
    let totalMlScore = 0
    let validMlScores = 0

    sessions?.forEach(session => {
      // 집중 시간 계산
      if (session.ended_at && session.started_at) {
        const duration = Math.round(
          (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)
        )
        totalFocusTime += duration
      } else if (session.goal_min) {
        totalFocusTime += session.goal_min
      }

      // 집중도 점수 계산
      if (session.focus_score) {
        totalScore += session.focus_score
        validScores++
        if (session.focus_score > peakScore) {
          peakScore = session.focus_score
        }
      }

      // 방해 요소 합계
      totalDistractions += session.distractions || 0
    })

    // ML 피쳐 데이터 통계 계산
    mlFeaturesData.forEach(feature => {
      if (feature.focus_status) {
        switch (feature.focus_status) {
          case 'focused':
            focusedCount++
            break
          case 'normal':
            normalCount++
            break
          case 'distracted':
            distractedCount++
            break
        }
      }
      
      if (feature.focus_score) {
        totalMlScore += feature.focus_score
        validMlScores++
      }
    })

    let averageScore = validScores > 0 ? totalScore / validScores : 0
    let averageMlScore = validMlScores > 0 ? totalMlScore / validMlScores : 0

    // daily_summary가 있으면 그 데이터를 우선 사용
    if (dailySummary) {
      totalFocusTime = dailySummary.focus_min || totalFocusTime
      averageScore = dailySummary.avg_score || averageScore
      totalSessions = dailySummary.sessions_count || totalSessions
    }

    const dailyReport = {
      date,
      totalSessions,
      totalFocusTime,
      averageScore,
      peakScore,
      totalDistractions,
      sessions: sessions || [],
      focusedCount,
      normalCount,
      distractedCount,
      averageMlScore
    }

    return NextResponse.json(dailyReport)

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 