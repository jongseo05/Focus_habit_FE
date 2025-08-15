import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 그룹 챌린지 진행률 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id, contribution } = body

    if (!challenge_id || contribution === undefined) {
      return NextResponse.json({ error: 'challenge_id와 contribution이 필요합니다.' }, { status: 400 })
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

    // 사용자가 룸에 참여 중인지 확인 (기존 study_rooms 테이블 사용)
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('room_id')
      .eq('room_id', challenge.room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: '룸을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 참가자 정보 업데이트 (upsert)
    const { data: updatedParticipant, error: updateError } = await supabase
      .from('group_challenge_participant')
      .upsert({
        challenge_id,
        user_id: user.id,
        contribution,
        last_contribution_at: new Date().toISOString()
      }, {
        onConflict: 'challenge_id,user_id'
      })
      .select()
      .single()

    if (updateError) {
      console.error('진행률 업데이트 실패:', updateError)
      return NextResponse.json({ error: '진행률 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // 전체 진행률 계산
    const { data: allParticipants, error: participantsError } = await supabase
      .from('group_challenge_participant')
      .select('contribution')
      .eq('challenge_id', challenge_id)

    if (participantsError) {
      console.error('참가자 정보 조회 실패:', participantsError)
      return NextResponse.json({ error: '참가자 정보 조회에 실패했습니다.' }, { status: 500 })
    }

    const totalContribution = allParticipants.reduce((sum: number, p: any) => sum + (p.contribution || 0), 0)
    const completionPercentage = Math.min((totalContribution / challenge.target_value) * 100, 100)
    const isCompleted = totalContribution >= challenge.target_value

    // 챌린지 진행률 업데이트
    const { error: challengeUpdateError } = await supabase
      .from('group_challenge')
      .update({
        current_value: totalContribution,
        completion_percentage: completionPercentage,
        is_completed: isCompleted,
        updated_at: new Date().toISOString()
      })
      .eq('challenge_id', challenge_id)

    if (challengeUpdateError) {
      console.error('챌린지 업데이트 실패:', challengeUpdateError)
      return NextResponse.json({ error: '챌린지 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // Realtime 이벤트 전송
    try {
      supabase
        .channel(`social_room:${challenge.room_id}`)
        .send({
          type: 'broadcast',
          event: 'group_challenge_progress_updated',
          payload: {
            challenge_id,
            room_id: challenge.room_id,
            user_id: user.id,
            contribution,
            total_contribution: totalContribution,
            completion_percentage: completionPercentage,
            timestamp: new Date().toISOString()
          }
        })

      // 챌린지 완료 시 추가 이벤트
      if (isCompleted) {
        supabase
          .channel(`social_room:${challenge.room_id}`)
          .send({
            type: 'broadcast',
            event: 'group_challenge_completed',
            payload: {
              challenge_id,
              room_id: challenge.room_id,
              total_contribution: totalContribution,
              timestamp: new Date().toISOString()
            }
          })
      }
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      participant: updatedParticipant,
      total_contribution: totalContribution,
      completion_percentage: completionPercentage,
      is_completed: isCompleted,
      message: '진행률이 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('진행률 업데이트 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
