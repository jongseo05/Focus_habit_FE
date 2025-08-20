import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { CameraStateUpdateRequest, CameraStateResponse, ParticipantsCameraStateResponse } from '@/types/base'

// GET: 현재 참가자들의 카메라 상태 조회
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
): Promise<NextResponse> {
  try {
    const { roomId } = await context.params
    const supabase = await supabaseServer()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자가 해당 스터디룸에 참가하고 있는지 확인
    const { data: participantCheck, error: participantError } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (participantError) {
      console.error('참가자 확인 오류:', participantError)
      return NextResponse.json(
        { success: false, error: '참가자 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!participantCheck) {
      return NextResponse.json(
        { success: false, error: '해당 스터디룸에 참가하고 있지 않습니다.' },
        { status: 403 }
      )
    }

    // 현재 활성 참가자들의 카메라 상태 조회
    const { data: participants, error: participantsError } = await supabase
      .from('room_participants')
      .select(`
        user_id,
        is_video_enabled,
        is_audio_enabled,
        camera_updated_at
      `)
      .eq('room_id', roomId)
      .is('left_at', null)

    if (participantsError) {
      console.error('참가자 카메라 상태 조회 오류:', participantsError)
      return NextResponse.json(
        { success: false, error: '카메라 상태 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const response: ParticipantsCameraStateResponse = {
      participants: participants?.map((p: any) => ({
        user_id: p.user_id,
        is_video_enabled: p.is_video_enabled || false,
        is_audio_enabled: p.is_audio_enabled || false,
        camera_updated_at: p.camera_updated_at || new Date().toISOString()
      })) || []
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('GET /api/social/study-room/[roomId]/camera-state 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 카메라 상태 업데이트
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ roomId: string }> }
): Promise<NextResponse> {
  try {
    const { roomId } = await context.params
    const body: CameraStateUpdateRequest = await request.json()
    
    // 요청 데이터 검증
    if (typeof body.is_video_enabled !== 'boolean' || typeof body.is_audio_enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 카메라 상태 데이터입니다.' },
        { status: 400 }
      )
    }

    const supabase = await supabaseServer()

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자가 해당 스터디룸에 참가하고 있는지 확인
    const { data: participantCheck, error: participantError } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (participantError) {
      console.error('참가자 확인 오류:', participantError)
      return NextResponse.json(
        { success: false, error: '참가자 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!participantCheck) {
      return NextResponse.json(
        { success: false, error: '해당 스터디룸에 참가하고 있지 않습니다.' },
        { status: 403 }
      )
    }

    // 카메라 상태 업데이트
    const { data, error: updateError } = await supabase
      .from('room_participants')
      .update({
        is_video_enabled: body.is_video_enabled,
        is_audio_enabled: body.is_audio_enabled,
        camera_updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .select(`
        user_id,
        is_video_enabled,
        is_audio_enabled,
        camera_updated_at
      `)
      .single()

    if (updateError) {
      console.error('카메라 상태 업데이트 오류:', updateError)
      return NextResponse.json(
        { success: false, error: '카메라 상태 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    const response: CameraStateResponse = {
      user_id: data.user_id,
      room_id: roomId,
      is_video_enabled: data.is_video_enabled || false,
      is_audio_enabled: data.is_audio_enabled || false,
      camera_updated_at: data.camera_updated_at || new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('POST /api/social/study-room/[roomId]/camera-state 오류:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
