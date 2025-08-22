import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 세션 데이터 수집 테스트 API
export async function POST(request: NextRequest) {
  try {
    const { sessionId, testData } = await request.json()
    
    console.log('🧪 세션 데이터 수집 테스트 시작:', { sessionId, testData })
    
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

    // 테스트 데이터 생성 및 저장
    const testResults = []

    // 1. 집중도 샘플 데이터 테스트
    try {
      const { data: sampleData, error: sampleError } = await supabase
        .from('focus_sample')
        .insert({
          session_id: sessionId,
          ts: new Date().toISOString(),
          score: testData?.score || 75,
          score_conf: 0.9,
          topic_tag: 'test_data',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (sampleError) {
        testResults.push({
          type: 'focus_sample',
          success: false,
          error: sampleError.message
        })
      } else {
        testResults.push({
          type: 'focus_sample',
          success: true,
          data: sampleData
        })
      }
    } catch (error) {
      testResults.push({
        type: 'focus_sample',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 2. 집중도 이벤트 데이터 테스트
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('focus_event')
        .insert({
          session_id: sessionId,
          ts: new Date().toISOString(),
          event_type: 'focus',
          payload: {
            test: true,
            timestamp: Date.now(),
            score: testData?.score || 75
          }
        })
        .select()
        .single()

      if (eventError) {
        testResults.push({
          type: 'focus_event',
          success: false,
          error: eventError.message
        })
      } else {
        testResults.push({
          type: 'focus_event',
          success: true,
          data: eventData
        })
      }
    } catch (error) {
      testResults.push({
        type: 'focus_event',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 3. ML 피처 데이터 테스트
    try {
      const { data: mlData, error: mlError } = await supabase
        .from('ml_features')
        .insert({
          session_id: sessionId,
          ts: new Date().toISOString(),
          head_pose_pitch: 0,
          head_pose_yaw: 0,
          head_pose_roll: 0,
          eye_status: 0.8, // 수치값 (0.0~1.0)
          ear_value: 0.8,
          frame_number: 1
        })
        .select()
        .single()

      if (mlError) {
        testResults.push({
          type: 'ml_features',
          success: false,
          error: mlError.message
        })
      } else {
        testResults.push({
          type: 'ml_features',
          success: true,
          data: mlData
        })
      }
    } catch (error) {
      testResults.push({
        type: 'ml_features',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 4. 현재 세션의 모든 데이터 수 확인
    const { data: sampleCount } = await supabase
      .from('focus_sample')
      .select('ts', { count: 'exact' })
      .eq('session_id', sessionId)

    const { data: eventCount } = await supabase
      .from('focus_event')
      .select('ts', { count: 'exact' })
      .eq('session_id', sessionId)

    const { data: mlCount } = await supabase
      .from('ml_features')
      .select('ts', { count: 'exact' })
      .eq('session_id', sessionId)

    const summary = {
      session_id: sessionId,
      sample_count: sampleCount?.length || 0,
      event_count: eventCount?.length || 0,
      ml_features_count: mlCount?.length || 0,
      test_results: testResults
    }

    console.log('✅ 세션 데이터 수집 테스트 완료:', summary)

    return NextResponse.json({
      success: true,
      data: summary,
      message: '세션 데이터 수집 테스트가 완료되었습니다.'
    })

  } catch (error) {
    console.error('❌ 세션 데이터 수집 테스트 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// 세션 데이터 상태 확인
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 세션 정보 조회
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // 각 테이블의 데이터 수 조회
    const { data: samples } = await supabase
      .from('focus_sample')
      .select('ts, score')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })

    const { data: events } = await supabase
      .from('focus_event')
      .select('ts, event_type')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })

    const { data: mlFeatures } = await supabase
      .from('ml_features')
      .select('ts, eye_status')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })

    const sessionStatus = {
      session: session,
      data_summary: {
        sample_count: samples?.length || 0,
        event_count: events?.length || 0,
        ml_features_count: mlFeatures?.length || 0
      },
      recent_samples: samples?.slice(-5) || [],
      recent_events: events?.slice(-5) || [],
      recent_ml_features: mlFeatures?.slice(-5) || []
    }

    return NextResponse.json({
      success: true,
      data: sessionStatus
    })

  } catch (error) {
    console.error('세션 상태 확인 중 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
