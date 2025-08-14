import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // 룸 정보 조회
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 참가자 정보 조회
    const { data: participants, error: participantError } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        type: typeof user.id
      },
      room: {
        room_id: room.room_id,
        host_id: room.host_id,
        host_id_type: typeof room.host_id,
        name: room.name
      },
      participants: participants || [],
      isHost: String(room.host_id) === String(user.id),
      comparison: {
        roomHostId: room.host_id,
        userId: user.id,
        roomHostIdString: String(room.host_id),
        userIdString: String(user.id),
        directComparison: room.host_id === user.id,
        stringComparison: String(room.host_id) === String(user.id)
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
