import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 스터디룸 참가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  console.log('=== 스터디룸 참가 시작 ===')
  const { roomId } = await params
  console.log('룸 ID:', roomId)
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증된 사용자:', user?.id)
    
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { user_id } = body
    console.log('요청된 사용자 ID:', user_id)

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
      .eq('room_id', roomId)
      .single()

    console.log('룸 정보:', room)

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
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    console.log('기존 참가자 정보:', existingParticipant)

    if (existingParticipant) {
      // 이미 참가 중인 경우 - 성공으로 처리 (재접속)
      if (!existingParticipant.left_at) {
        console.log('이미 참가 중인 사용자 - 연결 상태 업데이트')
        // 연결 상태만 업데이트
        const { error: updateError } = await supabase
          .from('room_participants')
          .update({ 
            is_connected: true,
            last_activity: new Date().toISOString()
          })
          .eq('room_id', roomId)
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
      console.log('재참가 - 기존 레코드 업데이트')
      const { error: updateError } = await supabase
        .from('room_participants')
        .update({ 
          left_at: null,
          joined_at: new Date().toISOString(),
          is_connected: true,
          last_activity: new Date().toISOString()
        })
        .eq('room_id', roomId)
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
      console.log('새 참가자 추가')
      const { error: joinError } = await supabase
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: user.id,
          is_host: false,
          joined_at: new Date().toISOString(),
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

    console.log('=== 스터디룸 참가 완료 ===')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('=== 스터디룸 참가 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '스터디룸 참가에 실패했습니다.' },
      { status: 500 }
    )
  }
}
