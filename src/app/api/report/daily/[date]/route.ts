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
    
    // 해당 날짜의 모든 세션 가져오기 (시간대 보정)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    console.log('🔍 Daily Report 세션 조회 범위:', {
      date,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    })

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
      console.error('❌ Sessions fetch error:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    console.log('✅ Daily Report 세션 조회 결과:', {
      date,
      sessionsCount: sessions?.length || 0,
      sessions: sessions?.map(s => ({
        id: s.session_id,
        started_at: s.started_at,
        ended_at: s.ended_at,
        focus_score: s.focus_score
      }))
    })

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

    // 집중도 샘플 데이터 가져오기 (focus_sample 테이블)
    const sessionIds = sessions?.map(s => s.session_id) || []
    let focusSampleData: any[] = []
    
    if (sessionIds.length > 0) {
      const { data: focusSamples, error: focusSamplesError } = await supabase
        .from('focus_sample')
        .select('session_id, ts, score, score_conf, topic_tag')
        .in('session_id', sessionIds)
        .order('ts', { ascending: true })

      if (focusSamplesError) {
        console.error('Focus samples fetch error:', focusSamplesError)
      } else {
        focusSampleData = focusSamples || []
        console.log('📊 집중도 샘플 데이터 조회:', {
          sessionIds: sessionIds.length,
          samplesCount: focusSampleData.length
        })
      }
    }

    // 통계 계산
    let totalSessions = sessions?.length || 0
    let totalFocusTime = 0
    let totalScore = 0
    let peakScore = 0
    let totalDistractions = 0
    let validScores = 0

    // 집중도 샘플 데이터 통계
    let totalSampleScore = 0
    let validSampleScores = 0
    let highFocusCount = 0
    let mediumFocusCount = 0
    let lowFocusCount = 0

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

    // 집중도 샘플 데이터 통계 계산
    focusSampleData.forEach(sample => {
      if (sample.score) {
        totalSampleScore += sample.score
        validSampleScores++
        
        // 집중도 레벨 분류
        if (sample.score >= 80) {
          highFocusCount++
        } else if (sample.score >= 60) {
          mediumFocusCount++
        } else {
          lowFocusCount++
        }
      }
    })

    let averageScore = validScores > 0 ? totalScore / validScores : 0
    let averageSampleScore = validSampleScores > 0 ? totalSampleScore / validSampleScores : 0

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
      highFocusCount,
      mediumFocusCount,
      lowFocusCount,
      averageSampleScore,
      totalSampleCount: validSampleScores
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