import { NextRequest, NextResponse } from 'next/server'
import { determineFocusStatus } from '@/lib/focusScoreEngine'
import { supabaseServer } from '@/lib/supabase/server'

// 집중 상태 계산 테스트 API
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

    // 집중 상태 계산
    const focusStatusResult = determineFocusStatus(features)

    // ML 피쳐 데이터 저장 (집중 상태 포함)
    const { data: savedFeature, error: insertError } = await supabase
      .from('ml_features')
      .insert({
        session_id: sessionId,
        ts: new Date().toISOString(),
        head_pose_pitch: features.visual?.headPose?.pitch,
        head_pose_yaw: features.visual?.headPose?.yaw,
        head_pose_roll: features.visual?.headPose?.roll,
        eye_status: features.visual?.eyeStatus,
        ear_value: features.visual?.earValue,
        frame_number: features.frameNumber || 0,
        focus_status: focusStatusResult.status,
        focus_confidence: focusStatusResult.confidence,
        focus_score: focusStatusResult.score
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

    console.log('✅ 집중 상태 테스트 성공:', {
      sessionId,
      focusStatus: focusStatusResult.status,
      focusScore: focusStatusResult.score,
      focusConfidence: focusStatusResult.confidence
    })

    return NextResponse.json({
      success: true,
      data: {
        savedFeature,
        focusStatus: focusStatusResult,
        message: '집중 상태가 성공적으로 계산되고 저장되었습니다.'
      }
    })

  } catch (error) {
    console.error('❌ 집중 상태 테스트 API 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: 집중 상태 계산만 테스트 (저장하지 않음)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const featuresJson = searchParams.get('features')
    
    if (!featuresJson) {
      return NextResponse.json(
        { error: 'features parameter is required' },
        { status: 400 }
      )
    }

    const features = JSON.parse(featuresJson)
    
    // 집중 상태 계산만 수행
    const focusStatusResult = determineFocusStatus(features)

    return NextResponse.json({
      success: true,
      data: {
        focusStatus: focusStatusResult,
        message: '집중 상태 계산 완료'
      }
    })

  } catch (error) {
    console.error('❌ 집중 상태 계산 테스트 중 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
