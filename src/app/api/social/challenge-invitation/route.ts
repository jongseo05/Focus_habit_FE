import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 대결 초대 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { room_id, challenge_id, mode, config } = body

    // 필수 필드 검증
    if (!room_id || !challenge_id || !mode || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
      return NextResponse.json({ error: 'Only room host can create challenge invitations' }, { status: 403 })
    }

    // 기존 대결 초대가 있는지 확인
    const { data: existingInvitation, error: existingError } = await supabase
      .from('challenge_invitation')
      .select('invitation_id')
      .eq('room_id', room_id)
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      return NextResponse.json({ error: 'There is already a pending challenge invitation' }, { status: 409 })
    }

    // 대결 초대 생성
    const { data: invitation, error } = await supabase
      .from('challenge_invitation')
      .insert({
        room_id,
        challenge_id,
        proposed_by: user.id,
        mode,
        config,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5분 후 만료
      })
      .select()
      .single()

    if (error) {
      console.error('Challenge invitation create error:', error)
      return NextResponse.json({ 
        error: 'Failed to create challenge invitation', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    // Realtime으로 대결 초대 생성 알림 전송
    try {
      await supabase
        .channel('challenge_invitations')
        .send({
          type: 'broadcast',
          event: 'challenge_invitation_created',
          payload: {
            invitation_id: invitation.invitation_id,
            room_id: invitation.room_id,
            challenge_id: invitation.challenge_id,
            proposed_by: invitation.proposed_by,
            mode: invitation.mode,
            config: invitation.config,
            created_at: invitation.created_at,
            expires_at: invitation.expires_at
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 알림 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      success: true, 
      invitation,
      message: 'Challenge invitation created successfully' 
    })
  } catch (error) {
    console.error('Challenge invitation create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 대결 초대 조회
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

    // 대결 초대 조회
    const { data: invitation, error } = await supabase
      .from('challenge_invitation')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'pending')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116는 결과가 없는 경우
      console.error('Challenge invitation fetch error:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch challenge invitation', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      invitation: invitation || null,
      message: 'Challenge invitation fetched successfully' 
    })
  } catch (error) {
    console.error('Challenge invitation fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
