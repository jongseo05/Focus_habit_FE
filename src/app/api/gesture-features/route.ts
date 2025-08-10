import { NextRequest, NextResponse } from 'next/server'
import { supabaseBrowser } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, features } = await request.json()
    
    if (!sessionId || !features) {
      return NextResponse.json(
        { success: false, error: '세션 ID와 피쳐 데이터가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = supabaseBrowser()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 세션입니다.' },
        { status: 404 }
      )
    }

    // 피쳐 데이터를 ml_features 테이블에 저장
    const { data: insertedFeatures, error: insertError } = await supabase
      .from('ml_features')
      .insert([
        {
          session_id: sessionId,
          ts: new Date().toISOString(),
          head_pose_pitch: features.headPose?.pitch || null,
          head_pose_yaw: features.headPose?.yaw || null,
          head_pose_roll: features.headPose?.roll || null,
          eye_status: features.eyeStatus || null,
          ear_value: features.earValue || null,
          frame_number: features.frameNumber || 0
        }
      ])
      .select()

    if (insertError) {
      console.error('피쳐 데이터 저장 실패:', insertError)
      return NextResponse.json(
        { success: false, error: '피쳐 데이터 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ 제스처 피쳐 데이터 저장 성공:', {
      sessionId,
      frameNumber: features.frameNumber,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      data: insertedFeatures[0],
      message: '제스처 피쳐 데이터가 성공적으로 저장되었습니다.'
    })

  } catch (error) {
    console.error('제스처 피쳐 API 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
