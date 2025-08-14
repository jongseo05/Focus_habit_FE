import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 스터디룸에 챌린지 연동
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
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
    const { challenge_id } = body

    // 호스트 권한 확인
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('host_id, is_active')
      .eq('room_id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (room.host_id !== user.id) {
      return NextResponse.json(
        { error: '호스트만 챌린지를 연동할 수 있습니다.' },
        { status: 403 }
      )
    }

    if (!room.is_active) {
      return NextResponse.json(
        { error: '종료된 스터디룸에는 챌린지를 연동할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 챌린지 존재 및 활성 상태 확인
    if (challenge_id) {
      const { data: challenge, error: challengeError } = await supabase
        .from('group_challenges')
        .select('challenge_id, name')
        .eq('challenge_id', challenge_id)
        .eq('is_active', true)
        .single()

      if (challengeError || !challenge) {
        return NextResponse.json(
          { error: '유효하지 않은 챌린지입니다.' },
          { status: 400 }
        )
      }
    }

    // 스터디룸에 챌린지 연동
    const { data: updatedRoom, error: updateError } = await supabase
      .from('study_rooms')
      .update({
        linked_challenge_id: challenge_id,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .select(`
        *,
        linked_challenge:linked_challenge_id (
          challenge_id,
          name,
          description,
          goal_type,
          goal_value,
          duration_days,
          ends_at,
          is_active
        )
      `)
      .single()

    if (updateError) {
      console.error('챌린지 연동 실패:', updateError)
      return NextResponse.json(
        { error: '챌린지 연동에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      room: updatedRoom,
      message: challenge_id 
        ? '챌린지가 성공적으로 연동되었습니다.' 
        : '챌린지 연동이 해제되었습니다.'
    })

  } catch (error) {
    console.error('챌린지 연동 오류:', error)
    return NextResponse.json(
      { error: '챌린지 연동에 실패했습니다.' },
      { status: 500 }
    )
  }
}
