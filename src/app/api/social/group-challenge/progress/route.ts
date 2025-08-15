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

    // 사용자가 해당 룸의 참가자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('room_participant')
      .select('participant_id')
      .eq('room_id', challenge.room_id)
      .eq('user_id', user.id)
      .is('left_at', null)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: '해당 룸의 참가자가 아닙니다.' }, { status: 403 })
    }

    // 기존 기여도 조회
    const { data: existingContribution, error: existingError } = await supabase
      .from('group_challenge_participant')
      .select('contribution')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('기존 기여도 조회 실패:', existingError)
      return NextResponse.json({ error: '기여도 조회에 실패했습니다.' }, { status: 500 })
    }

    // 기여도 업데이트 또는 새로 생성
    let newContribution = contribution
    if (existingContribution) {
      newContribution = existingContribution.contribution + contribution
    }

    const { data: updatedParticipant, error: updateError } = await supabase
      .from('group_challenge_participant')
      .upsert({
        challenge_id,
        user_id: user.id,
        contribution: newContribution,
        last_contribution_at: new Date().toISOString()
      })
      .select()
      .single()

    if (updateError) {
      console.error('기여도 업데이트 실패:', updateError)
      return NextResponse.json({ error: '기여도 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // 전체 진행률 계산
    const { data: allParticipants, error: allParticipantsError } = await supabase
      .from('group_challenge_participant')
      .select('contribution')
      .eq('challenge_id', challenge_id)

    if (allParticipantsError) {
      console.error('전체 참가자 조회 실패:', allParticipantsError)
      return NextResponse.json({ error: '진행률 계산에 실패했습니다.' }, { status: 500 })
    }

    const totalContribution = allParticipants.reduce((sum, p) => sum + (p.contribution || 0), 0)
    const completionPercentage = Math.min((totalContribution / challenge.target_value) * 100, 100)

    // 챌린지 진행률 업데이트
    const { error: challengeUpdateError } = await supabase
      .from('group_challenge')
      .update({
        current_value: totalContribution,
        is_completed: completionPercentage >= 100
      })
      .eq('challenge_id', challenge_id)

    if (challengeUpdateError) {
      console.error('챌린지 진행률 업데이트 실패:', challengeUpdateError)
      return NextResponse.json({ error: '챌린지 진행률 업데이트에 실패했습니다.' }, { status: 500 })
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
            current_value: totalContribution,
            completion_percentage: completionPercentage,
            updated_by: user.id,
            timestamp: new Date().toISOString()
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    // 챌린지 완료 시 완료 이벤트도 전송
    if (completionPercentage >= 100) {
      try {
        supabase
          .channel(`social_room:${challenge.room_id}`)
          .send({
            type: 'broadcast',
            event: 'group_challenge_completed',
            payload: {
              challenge_id,
              room_id: challenge.room_id,
              completed_by: user.id,
              final_value: totalContribution,
              timestamp: new Date().toISOString()
            }
          })
      } catch (realtimeError) {
        console.warn('챌린지 완료 Realtime 이벤트 전송 실패:', realtimeError)
      }
    }

    return NextResponse.json({ 
      participant: updatedParticipant,
      total_contribution: totalContribution,
      completion_percentage: completionPercentage,
      is_completed: completionPercentage >= 100,
      message: '기여도가 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('그룹 챌린지 진행률 업데이트 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET: 챌린지 진행 상황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const challenge_id = searchParams.get('challenge_id')

    if (!challenge_id) {
      console.error('challenge_id 파라미터 누락')
      return NextResponse.json({ error: 'Challenge ID is required' }, { status: 400 })
    }

    console.log('챌린지 진행 상황 조회 시작:', { challenge_id, user_id: user.id })

    // 챌린지 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('challenge_id', challenge_id)
      .single()

    if (challengeError) {
      console.error('챌린지 조회 실패:', challengeError)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (!challenge) {
      console.error('챌린지를 찾을 수 없음:', challenge_id)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    console.log('챌린지 정보 조회 성공:', challenge)

    // 참가자들의 진행 상황 조회 (조인 없이)
    const { data: participants, error: participantsError } = await supabase
      .from('group_challenge_participant')
      .select('*')
      .eq('challenge_id', challenge_id)

    if (participantsError) {
      console.error('참가자 진행 상황 조회 실패:', participantsError)
      return NextResponse.json({ error: 'Failed to fetch participants progress' }, { status: 500 })
    }

    console.log('참가자 정보 조회 성공:', { count: participants?.length || 0 })

    // 목표 타입에 따른 진행 상황 계산
    let totalProgress = 0
    let averageProgress = 0
    let progressPercentage = 0
    let userProgress = 0

    if (participants && participants.length > 0) {
      const totalParticipants = participants.length
      
      if (challenge.type === 'focus_time') {
        totalProgress = participants.reduce((sum, p) => sum + (p.contribution || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.target_value) * 100, 100)
      } else if (challenge.type === 'study_sessions') {
        totalProgress = participants.reduce((sum, p) => sum + (p.contribution || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.target_value) * 100, 100)
      } else if (challenge.type === 'focus_score') {
        totalProgress = participants.reduce((sum, p) => sum + (p.contribution || 0), 0)
        averageProgress = totalProgress / totalParticipants
        progressPercentage = Math.min((averageProgress / challenge.target_value) * 100, 100)
      } else if (challenge.type === 'streak_days') {
        totalProgress = participants.reduce((sum, p) => sum + (p.contribution || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.target_value) * 100, 100)
      }

      // 현재 사용자의 진행 상황 찾기
      const currentUserParticipant = participants.find(p => p.user_id === user.id)
      if (currentUserParticipant) {
        userProgress = currentUserParticipant.contribution || 0
      }

      console.log('진행 상황 계산 완료:', {
        totalProgress,
        averageProgress,
        progressPercentage,
        userProgress,
        totalParticipants
      })
    }

    const challengeProgress = {
      challenge_id,
      goal_type: challenge.type,
      goal_value: challenge.target_value,
      total_progress: totalProgress,
      average_progress: averageProgress,
      progress_percentage: progressPercentage,
      user_progress: userProgress,
      participants_count: participants?.length || 0,
      participants: participants?.map(p => ({
        user_id: p.user_id,
        name: 'Unknown', // 사용자 이름은 별도로 조회 필요
        avatar_url: undefined, // 아바타는 별도로 조회 필요
        current_progress: p.contribution || 0,
        joined_at: p.joined_at
      })) || []
    }

    console.log('응답 데이터 준비 완료:', challengeProgress)

    return NextResponse.json({ 
      success: true, 
      challenge_progress: challengeProgress
    })

  } catch (error) {
    console.error('진행 상황 조회 오류:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
