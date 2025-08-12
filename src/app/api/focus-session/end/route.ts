import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ReportService } from '@/lib/database/reportService'

// 세션 종료 및 리포트 생성 API
export async function POST(request: NextRequest) {
  try {
    const { sessionId, finalFocusScore } = await request.json()
    
    console.log('🔧 세션 종료 API 호출:', { sessionId, finalFocusScore })
    
    // 요청 데이터 검증
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ 인증 오류:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ 사용자 인증 성공:', user.id)

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('❌ 세션 조회 오류:', sessionError)
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    console.log('✅ 세션 확인 성공:', { 
      sessionId: session.session_id, 
      startedAt: session.started_at,
      endedAt: session.ended_at 
    })

    // 1. 세션 종료 처리
    const { error: endError } = await supabase
      .from('focus_session')
      .update({
        ended_at: new Date().toISOString(),
        focus_score: finalFocusScore || null,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    if (endError) {
      console.error('❌ 세션 종료 실패:', endError)
      return NextResponse.json(
        { error: `세션 종료 실패: ${endError.message}` },
        { status: 500 }
      )
    }

    console.log('✅ 세션 종료 성공')

    // 2. 세션 데이터 검증
    const { data: updatedSession, error: sessionUpdateError } = await supabase
      .from('focus_session')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (sessionUpdateError || !updatedSession) {
      console.error('❌ 업데이트된 세션 데이터 조회 실패:', sessionUpdateError)
      return NextResponse.json(
        { error: '세션 데이터를 찾을 수 없습니다.' },
        { status: 500 }
      )
    }

    // 3. 샘플 데이터 수 확인
    const { data: samples, error: samplesError } = await supabase
      .from('focus_sample')
      .select('ts, score')
      .eq('session_id', sessionId)

    if (samplesError) {
      console.error('❌ 샘플 데이터 조회 실패:', samplesError)
    } else {
      console.log('📊 샘플 데이터 수:', samples?.length || 0)
    }

    // 4. 이벤트 데이터 수 확인
    const { data: events, error: eventsError } = await supabase
      .from('focus_event')
      .select('ts, event_type')
      .eq('session_id', sessionId)

    if (eventsError) {
      console.error('❌ 이벤트 데이터 조회 실패:', eventsError)
    } else {
      console.log('📊 이벤트 데이터 수:', events?.length || 0)
    }

    // 4.1. ML 피쳐 데이터 수 확인 (집중 상태 포함)
    const { data: mlFeatures, error: mlFeaturesError } = await supabase
      .from('ml_features')
      .select('ts, focus_status, focus_score, focus_confidence')
      .eq('session_id', sessionId)

    if (mlFeaturesError) {
      console.error('❌ ML 피쳐 데이터 조회 실패:', mlFeaturesError)
    } else {
      console.log('📊 ML 피쳐 데이터 수:', mlFeatures?.length || 0)
      
      // 집중 상태별 통계
      if (mlFeatures && mlFeatures.length > 0) {
        const focusStats = mlFeatures.reduce((acc, feature) => {
          const status = feature.focus_status || 'unknown'
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        console.log('📈 집중 상태 통계:', focusStats)
        
        // 평균 집중 점수
        const avgFocusScore = mlFeatures.reduce((sum, feature) => sum + (feature.focus_score || 0), 0) / mlFeatures.length
        console.log('📊 평균 집중 점수:', Math.round(avgFocusScore))
      }
    }

    // 5. 일일 요약 데이터 생성/업데이트
    try {
      const today = new Date().toISOString().split('T')[0]
      const summaryResult = await ReportService.upsertDailySummaryServer(user.id, today, supabase)
      
      if (summaryResult.success) {
        console.log('✅ 일일 요약 업데이트 성공')
      } else {
        console.error('❌ 일일 요약 업데이트 실패:', summaryResult.error)
      }
    } catch (summaryError) {
      console.error('❌ 일일 요약 처리 중 오류:', summaryError)
    }

    // 6. 세션 리포트 데이터 반환
    const reportData = {
      session: updatedSession,
      samples: samples || [],
      events: events || [],
      mlFeatures: mlFeatures || [],
      summary: {
        sampleCount: samples?.length || 0,
        eventCount: events?.length || 0,
        mlFeatureCount: mlFeatures?.length || 0,
        duration: updatedSession.ended_at && updatedSession.started_at 
          ? Math.floor((new Date(updatedSession.ended_at).getTime() - new Date(updatedSession.started_at).getTime()) / (1000 * 60))
          : 0,
        averageFocusScore: mlFeatures && mlFeatures.length > 0
          ? Math.round(mlFeatures.reduce((sum, feature) => sum + (feature.focus_score || 0), 0) / mlFeatures.length)
          : 0
      }
    }

    console.log('✅ 세션 종료 및 리포트 생성 완료:', reportData)

    return NextResponse.json({
      success: true,
      data: reportData,
      message: '세션이 성공적으로 종료되고 리포트가 생성되었습니다.'
    })

  } catch (error) {
    console.error('❌ 세션 종료 API 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
