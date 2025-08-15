import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 그룹 챌린지 참여
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id } = body

    if (!challenge_id) {
      return NextResponse.json({ error: 'challenge_id가 필요합니다.' }, { status: 400 })
    }

    // 챌린지 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('is_active', true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '활성 챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 이미 참여 중인지 확인
    const { data: existingParticipant, error: existingError } = await supabase
      .from('group_challenge_participant')
      .select('participant_id')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (existingParticipant) {
      return NextResponse.json({ error: '이미 참여 중인 챌린지입니다.' }, { status: 409 })
    }

    // 챌린지 참여
    const { data: newParticipant, error: joinError } = await supabase
      .from('group_challenge_participant')
      .insert({
        challenge_id,
        user_id: user.id,
        contribution: 0,
        joined_at: new Date().toISOString()
      })
      .select()
      .single()

    if (joinError) {
      console.error('챌린지 참여 실패:', joinError)
      return NextResponse.json({ error: '챌린지 참여에 실패했습니다.' }, { status: 500 })
    }

    // Realtime 이벤트 전송
    try {
      supabase
        .channel(`social_room:${challenge.room_id}`)
        .send({
          type: 'broadcast',
          event: 'group_challenge_joined',
          payload: {
            challenge_id,
            room_id: challenge.room_id,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      participant: newParticipant,
      message: '챌린지에 성공적으로 참여했습니다.'
    })

  } catch (error) {
    console.error('챌린지 참여 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 그룹 챌린지 탈퇴
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

    // 챌린지 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('is_active', true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '활성 챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 참여 중인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('group_challenge_participant')
      .select('participant_id')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: '참여 중인 챌린지가 아닙니다.' }, { status: 404 })
    }

    // 챌린지 탈퇴
    const { error: leaveError } = await supabase
      .from('group_challenge_participant')
      .delete()
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)

    if (leaveError) {
      console.error('챌린지 탈퇴 실패:', leaveError)
      return NextResponse.json({ error: '챌린지 탈퇴에 실패했습니다.' }, { status: 500 })
    }

    // Realtime 이벤트 전송
    try {
      supabase
        .channel(`social_room:${challenge.room_id}`)
        .send({
          type: 'broadcast',
          event: 'group_challenge_left',
          payload: {
            challenge_id,
            room_id: challenge.room_id,
            user_id: user.id,
            timestamp: new Date().toISOString()
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      message: '챌린지에서 성공적으로 탈퇴했습니다.'
    })

  } catch (error) {
    console.error('챌린지 탈퇴 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
