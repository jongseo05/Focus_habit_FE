import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 제스처 피쳐 및 집중 상태 저장 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      sessionId, 
      features 
    } = body

    // 요청 데이터 검증
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    if (!features) {
      return NextResponse.json(
        { error: 'features is required' },
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

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, user_id')
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

    // ML 피쳐 데이터 저장
    const { data: savedFeature, error: insertError } = await supabase
      .from('ml_features')
      .insert({
        session_id: sessionId,
        ts: new Date().toISOString(),
        head_pose_pitch: features.headPose?.pitch,
        head_pose_yaw: features.headPose?.yaw,
        head_pose_roll: features.headPose?.roll,
        eye_status: features.eyeStatus,
        ear_value: features.earValue,
        frame_number: features.frameNumber,
        focus_status: features.focusStatus,
        focus_confidence: features.focusConfidence,
        focus_score: features.focusScore
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ ML 피쳐 저장 실패:', insertError)
      return NextResponse.json(
        { error: `ML 피쳐 저장 실패: ${insertError.message}` },
        { status: 500 }
      )
    }

    // 집중 상태가 변경되었으면 이벤트도 저장
    if (features.focusStatus) {
      await supabase
        .from('focus_event')
        .insert({
          session_id: sessionId,
          ts: new Date().toISOString(),
          event_type: 'focus',
          payload: {
            focus_status: features.focusStatus,
            focus_score: features.focusScore,
            focus_confidence: features.focusConfidence,
            frame_number: features.frameNumber
          }
        })
    }

    console.log('✅ 제스처 피쳐 저장 성공:', {
      sessionId,
      frameNumber: features.frameNumber,
      focusStatus: features.focusStatus,
      focusScore: features.focusScore
    })

    return NextResponse.json({
      success: true,
      data: savedFeature,
      message: '제스처 피쳐가 성공적으로 저장되었습니다.'
    })

  } catch (error) {
    console.error('❌ 제스처 피쳐 API 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
