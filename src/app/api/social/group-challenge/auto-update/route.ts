import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 스터디룸 세션 완료 시 자동으로 그룹 챌린지 진행사항 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      room_id, 
      session_duration_minutes, 
      focus_score, 
      session_type = 'focus' 
    } = body

    if (!room_id || session_duration_minutes === undefined) {
      return NextResponse.json({ error: 'room_id와 session_duration_minutes가 필요합니다.' }, { status: 400 })
    }

    console.log('자동 챌린지 업데이트 시작:', {
      room_id,
      user_id: user.id,
      session_duration_minutes,
      focus_score,
      session_type
    })

    // 해당 룸의 활성 그룹 챌린지 조회
    const { data: activeChallenges, error: challengesError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('room_id', room_id)
      .eq('is_active', true)

    if (challengesError) {
      console.error('활성 챌린지 조회 실패:', challengesError)
      return NextResponse.json({ error: '챌린지 조회에 실패했습니다.' }, { status: 500 })
    }

    if (!activeChallenges || activeChallenges.length === 0) {
      console.log('활성 챌린지가 없음')
      return NextResponse.json({ 
        message: '업데이트할 활성 챌린지가 없습니다.',
        updated_challenges: []
      })
    }

    const updatedChallenges = []

    // 각 챌린지 타입에 따라 진행사항 업데이트
    for (const challenge of activeChallenges) {
      let contribution = 0
      let shouldUpdate = false

      switch (challenge.type) {
        case 'focus_time':
          // 집중 시간 챌린지: 세션 시간을 분 단위로 추가
          contribution = session_duration_minutes
          shouldUpdate = true
          break

        case 'study_sessions':
          // 학습 세션 챌린지: 세션 수를 1씩 추가
          contribution = 1
          shouldUpdate = true
          break

        case 'focus_score':
          // 집중도 점수 챌린지: 평균 집중도 점수 추가
          if (focus_score !== undefined && focus_score > 0) {
            contribution = focus_score
            shouldUpdate = true
          }
          break

        case 'streak_days':
          // 연속 학습 챌린지: 오늘 학습했으면 1일 추가
          const today = new Date().toISOString().split('T')[0]
          const lastContribution = await getLastContributionDate(supabase, challenge.challenge_id, user.id)
          
          if (!lastContribution || lastContribution !== today) {
            contribution = 1
            shouldUpdate = true
          }
          break

        default:
          console.log(`지원하지 않는 챌린지 타입: ${challenge.type}`)
          continue
      }

      if (shouldUpdate) {
        try {
          // 기존 기여도 조회
          const { data: existingParticipant, error: participantError } = await supabase
            .from('group_challenge_participant')
            .select('contribution')
            .eq('challenge_id', challenge.challenge_id)
            .eq('user_id', user.id)
            .single()

          const currentContribution = existingParticipant?.contribution || 0
          const newContribution = currentContribution + contribution

          // 참가자 정보 업데이트 (upsert)
          const { data: updatedParticipant, error: updateError } = await supabase
            .from('group_challenge_participant')
            .upsert({
              challenge_id: challenge.challenge_id,
              user_id: user.id,
              contribution: newContribution,
              last_contribution_at: new Date().toISOString()
            }, {
              onConflict: 'challenge_id,user_id'
            })
            .select()
            .single()

          if (updateError) {
            console.error(`챌린지 ${challenge.challenge_id} 업데이트 실패:`, updateError)
            continue
          }

          // 전체 진행률 계산
          const { data: allParticipants, error: participantsError } = await supabase
            .from('group_challenge_participant')
            .select('contribution')
            .eq('challenge_id', challenge.challenge_id)

          if (participantsError) {
            console.error('참가자 정보 조회 실패:', participantsError)
            continue
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
            .eq('challenge_id', challenge.challenge_id)

          if (challengeUpdateError) {
            console.error('챌린지 진행률 업데이트 실패:', challengeUpdateError)
            continue
          }

          updatedChallenges.push({
            challenge_id: challenge.challenge_id,
            title: challenge.title,
            type: challenge.type,
            user_contribution: newContribution,
            total_contribution: totalContribution,
            completion_percentage: completionPercentage,
            is_completed: isCompleted
          })

          // Realtime 이벤트 전송
          try {
            supabase
              .channel(`social_room:${room_id}`)
              .send({
                type: 'broadcast',
                event: 'group_challenge_auto_updated',
                payload: {
                  challenge_id: challenge.challenge_id,
                  room_id: room_id,
                  user_id: user.id,
                  contribution: contribution,
                  total_contribution: totalContribution,
                  completion_percentage: completionPercentage,
                  is_completed: isCompleted,
                  timestamp: new Date().toISOString()
                }
              })

            // 챌린지 완료 시 추가 이벤트
            if (isCompleted) {
              supabase
                .channel(`social_room:${room_id}`)
                .send({
                  type: 'broadcast',
                  event: 'group_challenge_completed',
                  payload: {
                    challenge_id: challenge.challenge_id,
                    room_id: room_id,
                    total_contribution: totalContribution,
                    timestamp: new Date().toISOString()
                  }
                })
            }
          } catch (realtimeError) {
            console.warn('Realtime 이벤트 전송 실패:', realtimeError)
          }

        } catch (error) {
          console.error(`챌린지 ${challenge.challenge_id} 처리 중 오류:`, error)
          continue
        }
      }
    }

    return NextResponse.json({ 
      message: '챌린지 진행사항이 자동으로 업데이트되었습니다.',
      updated_challenges: updatedChallenges
    })

  } catch (error) {
    console.error('자동 챌린지 업데이트 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 마지막 기여 날짜 조회 함수
async function getLastContributionDate(supabase: any, challengeId: string, userId: string): Promise<string | null> {
  try {
    const { data: participant, error } = await supabase
      .from('group_challenge_participant')
      .select('last_contribution_at')
      .eq('challenge_id', challengeId)
      .eq('user_id', userId)
      .single()

    if (error || !participant?.last_contribution_at) {
      return null
    }

    return participant.last_contribution_at.split('T')[0]
  } catch (error) {
    console.error('마지막 기여 날짜 조회 실패:', error)
    return null
  }
}
