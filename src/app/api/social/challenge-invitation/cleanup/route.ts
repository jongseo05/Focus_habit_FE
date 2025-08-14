import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 만료된 대결 초대 자동 정리
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { room_id } = body

    if (!room_id) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // 호스트 권한 확인
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('host_id')
      .eq('room_id', room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    if (room.host_id !== user.id) {
      return NextResponse.json({ error: 'Only room host can cleanup invitations' }, { status: 403 })
    }

    // 만료된 초대를 expired로 변경
    const { data: expiredInvitations, error } = await supabase
      .from('challenge_invitation')
      .update({ 
        status: 'expired'
      })
      .eq('room_id', room_id)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
      .select()

    if (error) {
      console.error('Challenge invitation cleanup error:', error)
      return NextResponse.json({ 
        error: 'Failed to cleanup expired invitations', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    // Realtime으로 정리 알림 전송
    if (expiredInvitations && expiredInvitations.length > 0) {
      try {
        await supabase
          .channel('challenge_invitations')
          .send({
            type: 'broadcast',
            event: 'challenge_invitation_cleaned',
            payload: {
              room_id: room_id,
              cleaned_count: expiredInvitations.length,
              timestamp: new Date().toISOString()
            }
          })
      } catch (realtimeError) {
        console.warn('Realtime 알림 전송 실패:', realtimeError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      cleaned_count: expiredInvitations?.length || 0,
      message: 'Expired invitations cleaned successfully' 
    })
  } catch (error) {
    console.error('Challenge invitation cleanup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
