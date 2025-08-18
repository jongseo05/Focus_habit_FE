import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ReportService } from '@/lib/database/reportService'

// 세션 종료 및 리포트 생성 API
export async function POST(request: NextRequest) {
  try {
    const { sessionId, finalFocusScore } = await request.json()
    

    
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
      console.error('❌ 인증 오류:', authError?.message)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('❌ 세션 조회 오류:', sessionError?.message)
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // 🚀 최적화: 세션 종료와 관련 데이터 조회를 병렬로 처리
    const [
      endResult,
      samplesResult,
      eventsResult
    ] = await Promise.allSettled([
      // 1. 세션 종료 처리 (업데이트된 데이터 함께 반환)
      supabase
        .from('focus_session')
        .update({
          ended_at: new Date().toISOString(),
          focus_score: finalFocusScore || null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .select('*')
        .single(),
      
      // 2. 샘플 데이터 조회 (count와 score 평균 계산)
      supabase
        .from('focus_sample')
        .select('score')
        .eq('session_id', sessionId),
      
      // 3. 이벤트 데이터 조회 (count만)
      supabase
        .from('focus_event')
        .select('event_type', { count: 'exact' })
        .eq('session_id', sessionId)
    ])

    // 세션 종료 결과 확인
    if (endResult.status === 'rejected' || endResult.value.error) {
      const error = endResult.status === 'rejected' ? endResult.reason : endResult.value.error
      console.error('❌ 세션 종료 실패:', error)
      return NextResponse.json(
        { error: `세션 종료 실패: ${error.message || error}` },
        { status: 500 }
      )
    }

    const updatedSession = endResult.value.data

    // 샘플 데이터 처리
    const samples = samplesResult.status === 'fulfilled' && !samplesResult.value.error 
      ? samplesResult.value.data || []
      : []
    
    if (samplesResult.status === 'rejected' || samplesResult.value.error) {
      console.error('❌ 샘플 데이터 조회 실패')
    }

    // 이벤트 데이터 처리
    const events = eventsResult.status === 'fulfilled' && !eventsResult.value.error 
      ? eventsResult.value.data || []
      : []
    
    if (eventsResult.status === 'rejected' || eventsResult.value.error) {
      console.error('❌ 이벤트 데이터 조회 실패')
    }

    // 🚀 최적화: 일일 요약 업데이트를 백그라운드에서 비동기 처리
    const today = new Date().toISOString().split('T')[0]
    ReportService.upsertDailySummaryServer(user.id, today, supabase)
      .catch(summaryError => {
        console.error('❌ 일일 요약 처리 중 오류:', summaryError)
      })

    // 🚀 최적화: 평균 점수 계산 개선
    const averageFocusScore = samples.length > 0
      ? Math.round(samples.reduce((sum, sample) => sum + (sample.score || 0), 0) / samples.length)
      : finalFocusScore || 0

    // 6. 세션 리포트 데이터 반환
    const reportData = {
      session: updatedSession,
      samples: samples,
      events: events,
      summary: {
        sampleCount: samples.length,
        eventCount: events.length,
        duration: updatedSession.ended_at && updatedSession.started_at 
          ? Math.floor((new Date(updatedSession.ended_at).getTime() - new Date(updatedSession.started_at).getTime()) / (1000 * 60))
          : 0,
        averageFocusScore
      }
    }



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
