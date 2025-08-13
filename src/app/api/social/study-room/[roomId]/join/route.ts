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
      .select('current_participants, max_participants')
      .eq('room_id', params.roomId)
      .single()

    if (!room || room.current_participants >= room.max_participants) {
      return NextResponse.json(
        { error: '스터디룸이 가득 찼습니다.' },
        { status: 400 }
      )
    }

    // 참가자 추가
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: params.roomId,
        user_id: user.id,
        is_host: false
      })

    if (joinError) {
      return NextResponse.json(
        { error: '스터디룸 참가에 실패했습니다.' },
        { status: 500 }
      )
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
