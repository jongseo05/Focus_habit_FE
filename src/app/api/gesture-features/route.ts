import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '../../../lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError
} from '../../../lib/api/standardResponse'

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
      return createErrorResponse(
        'sessionId는 필수 항목입니다.',
        400
      )
    }

    if (!features) {
      return createErrorResponse(
        'features는 필수 항목입니다.',
        400
      )
    }

    // 표준 인증 확인
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('❌ 세션 조회 오류:', sessionError)
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
      )
    }

    // ML 피쳐 데이터 저장 (ml_features 테이블 사용)
    const currentTimestamp = new Date().toISOString()
    const { data: savedFeature, error: insertError } = await supabase
      .from('ml_features')
      .insert({
        session_id: sessionId,
        ts: currentTimestamp,
        head_pose_pitch: features.headPose?.pitch || null,
        head_pose_yaw: features.headPose?.yaw || null,
        head_pose_roll: features.headPose?.roll || null,
        eye_status: features.eyeStatus || null,
        ear_value: features.earValue || null,
        frame_number: features.frameNumber || 0,
        focus_status: features.focusStatus || null,
        focus_confidence: features.focusConfidence || null,
        focus_score: features.focusScore || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ ML 피쳐 저장 실패:', insertError)
      return createErrorResponse(
        `ML 피쳐 저장에 실패했습니다: ${insertError.message}`,
        500
      )
    }

    // 집중 상태가 변경되었으면 이벤트도 저장 (에러 처리 포함)
    if (features.focusStatus) {
      const { error: eventError } = await supabase
        .from('focus_event')
        .insert({
          session_id: sessionId,
          ts: currentTimestamp, // 동일한 타임스탬프 사용
          event_type: 'focus',
          payload: {
            focus_status: features.focusStatus,
            focus_score: features.focusScore,
            focus_confidence: features.focusConfidence,
            frame_number: features.frameNumber
          }
        })
      
      if (eventError) {
        console.error('⚠️ 집중도 이벤트 저장 실패 (계속 진행):', eventError.message)
        // 이벤트 저장 실패는 치명적이지 않으므로 경고만 로그
      }
    }

    console.log('✅ 제스처 피쳐 저장 성공:', {
      sessionId,
      frameNumber: features.frameNumber,
      focusStatus: features.focusStatus,
      focusScore: features.focusScore
    })

    return createSuccessResponse(
      savedFeature,
      '제스처 피쳐가 성공적으로 저장되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '제스처 피쳐 저장')
  }
}
