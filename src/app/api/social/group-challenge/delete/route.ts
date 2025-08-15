import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 그룹 챌린지 삭제 (호스트만 가능)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const challenge_id = searchParams.get('challenge_id')

    if (!challenge_id) {
      return NextResponse.json({ error: 'challenge_id가 필요합니다.' }, { status: 400 })
    }

    // 챌린지 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenge')
      .select('challenge_id, room_id, title, type')
      .eq('challenge_id', challenge_id)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 룸 정보 조회하여 호스트 권한 확인
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('room_id, host_id')
      .eq('room_id', challenge.room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: '스터디룸을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 호스트 권한 확인
    if (room.host_id !== user.id) {
      return NextResponse.json({ error: '호스트만 챌린지를 삭제할 수 있습니다.' }, { status: 403 })
    }

    // 챌린지 참가자들 먼저 삭제
    const { error: participantDeleteError } = await supabase
      .from('group_challenge_participant')
      .delete()
      .eq('challenge_id', challenge_id)

    if (participantDeleteError) {
      console.error('참가자 삭제 실패:', participantDeleteError)
      return NextResponse.json({ error: '챌린지 삭제에 실패했습니다.' }, { status: 500 })
    }

    // 챌린지 삭제
    const { error: deleteError } = await supabase
      .from('group_challenge')
      .delete()
      .eq('challenge_id', challenge_id)

    if (deleteError) {
      console.error('챌린지 삭제 실패:', deleteError)
      return NextResponse.json({ error: '챌린지 삭제에 실패했습니다.' }, { status: 500 })
    }

    // Realtime 이벤트 전송
    try {
      supabase
        .channel('group_challenges')
        .send({
          type: 'broadcast',
          event: 'group_challenge_deleted',
          payload: {
            challenge_id: challenge_id,
            room_id: challenge.room_id,
            title: challenge.title,
            type: challenge.type,
            deleted_by: user.id,
            timestamp: new Date().toISOString()
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      message: '챌린지가 성공적으로 삭제되었습니다.',
      challenge_id: challenge_id
    })

  } catch (error) {
    console.error('챌린지 삭제 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
