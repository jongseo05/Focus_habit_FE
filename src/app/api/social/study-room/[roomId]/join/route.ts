import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 스터디룸 참가
export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { user_id } = body

    // 사용자 ID 검증
    if (user_id !== user.id) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 룸 참가자 수 확인
    const { data: room } = await supabase
      .from('study_rooms')
      .select('current_participants, max_participants, is_active')
      .eq('room_id', params.roomId)
      .single()

    if (!room) {
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!room.is_active) {
      return NextResponse.json(
        { error: '종료된 스터디룸입니다.' },
        { status: 400 }
      )
    }

    if (room.current_participants >= room.max_participants) {
      return NextResponse.json(
        { error: '스터디룸이 가득 찼습니다.' },
        { status: 400 }
      )
    }

    // 기존 참가 기록 확인
    const { data: existingParticipant } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', params.roomId)
      .eq('user_id', user.id)
      .single()

    if (existingParticipant) {
      // 이미 참가 중인 경우 - 성공으로 처리 (재접속)
      if (!existingParticipant.left_at) {
        // 연결 상태만 업데이트
        const { error: updateError } = await supabase
          .from('room_participants')
          .update({ 
            is_connected: true,
            last_activity: new Date().toISOString()
          })
          .eq('room_id', params.roomId)
          .eq('user_id', user.id)

        if (updateError) {
          console.error('참가자 연결 상태 업데이트 실패:', updateError)
          return NextResponse.json(
            { error: '스터디룸 참가에 실패했습니다.' },
            { status: 500 }
          )
        }

        return NextResponse.json({ 
          success: true, 
          message: '이미 참가 중인 세션에 재접속했습니다.' 
        })
      }
      
      // 나간 후 다시 참가하는 경우 - 기존 레코드 업데이트
      const { error: updateError } = await supabase
        .from('room_participants')
        .update({ 
          left_at: null,
          joined_at: new Date().toISOString(),
          is_connected: true,
          last_activity: new Date().toISOString()
        })
        .eq('room_id', params.roomId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('참가자 재참가 업데이트 실패:', updateError)
        return NextResponse.json(
          { error: '스터디룸 참가에 실패했습니다.' },
          { status: 500 }
        )
      }
    } else {
      // 새로운 참가자 추가
      const { error: joinError } = await supabase
        .from('room_participants')
        .insert({
          room_id: params.roomId,
          user_id: user.id,
          is_host: false,
          is_connected: true,
          last_activity: new Date().toISOString()
        })

      if (joinError) {
        console.error('새 참가자 추가 실패:', joinError)
        return NextResponse.json(
          { error: '스터디룸 참가에 실패했습니다.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('스터디룸 참가 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 참가에 실패했습니다.' },
      { status: 500 }
    )
  }
}
