import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId, sessionId, data } = body

    // 배치 저장 모드 (data 배열이 있는 경우)
    if (data && Array.isArray(data)) {
      console.log(`배치 프레임 데이터 저장 요청 - 사용자: ${userId}, 세션: ${sessionId}, 데이터 개수: ${data.length}`)

      // 사용자 ID 확인
      if (user.id !== userId) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }

      // 배치 데이터 준비
      const batchData = data.map(item => ({
        user_id: userId,
        session_id: sessionId,
        data_type: item.dataType,
        timestamp: item.timestamp,
        eye_status: item.eyeStatus || 'OPEN',
        ear_value: item.earValue || 0,
        head_pose_pitch: item.headPosePitch || 0,
        head_pose_yaw: item.headPoseYaw || 0,
        head_pose_roll: item.headPoseRoll || 0
      }))

      // 배치 저장
      const { data: savedData, error: insertError } = await supabase
        .from('personalization_data')
        .insert(batchData)
        .select()

      if (insertError) {
        console.error('배치 프레임 데이터 저장 오류:', insertError)
        throw new Error('프레임 데이터를 저장할 수 없습니다')
      }

      console.log(`배치 프레임 데이터 저장 완료 - ${savedData.length}개`)

      return NextResponse.json({
        success: true,
        message: `${savedData.length}개의 프레임 데이터가 저장되었습니다`,
        data: {
          savedCount: savedData.length,
          sessionId: sessionId
        }
      })
    }

    // 단일 저장 모드 (기존 방식)
    const {
      dataType,
      timestamp,
      eyeStatus,
      earValue,
      headPosePitch,
      headPoseYaw,
      headPoseRoll
    } = body

    // 필수 필드 검증
    if (!userId || !sessionId || !dataType || !timestamp) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다' },
        { status: 400 }
      )
    }

    // 사용자 ID 확인
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 데이터 타입 검증
    if (!['focus', 'nonfocus'].includes(dataType)) {
      return NextResponse.json(
        { error: '유효하지 않은 데이터 타입입니다' },
        { status: 400 }
      )
    }

    console.log(`단일 프레임 데이터 저장 요청 - 사용자: ${userId}, 세션: ${sessionId}, 타입: ${dataType}`)

    // 개인화 데이터 저장
    const { data: savedData, error: insertError } = await supabase
      .from('personalization_data')
      .insert({
        user_id: userId,
        session_id: sessionId,
        data_type: dataType,
        timestamp: timestamp,
        eye_status: eyeStatus || 'OPEN', // 문자열 상태 (OPEN/CLOSED)
        ear_value: earValue || 0,
        head_pose_pitch: headPosePitch || 0,
        head_pose_yaw: headPoseYaw || 0,
        head_pose_roll: headPoseRoll || 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('프레임 데이터 저장 오류:', insertError)
      throw new Error('프레임 데이터를 저장할 수 없습니다')
    }

    console.log(`프레임 데이터 저장 완료 - ID: ${savedData.id}`)

    return NextResponse.json({
      success: true,
      message: '프레임 데이터가 저장되었습니다',
      data: {
        id: savedData.id,
        timestamp: savedData.timestamp,
        dataType: savedData.data_type
      }
    })

  } catch (error) {
    console.error('프레임 데이터 저장 API 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '프레임 데이터 저장 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
