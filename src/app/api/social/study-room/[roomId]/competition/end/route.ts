import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api/standardResponse'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params

  // 현재 활성 경쟁 조회
    const { data: competition, error: competitionError } = await supabase
      .from('focus_competitions')
      .select('competition_id, host_id')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single()

    if (competitionError || !competition) {
      return createErrorResponse('No active competition found', 404)
    }

    // 방장 권한 확인
    if (competition.host_id !== user.id) {
      return createErrorResponse('Only host can end competition', 403)
    }

    const now = new Date()

    // 모든 참가자 목록
    const { data: participants } = await supabase
      .from('competition_participants')
      .select('user_id, competition_id')
      .eq('competition_id', competition.competition_id)

    const endedSessions: any[] = []

    if (participants && participants.length > 0) {
      // 활성 세션 일괄 조회
      const userIds = participants.map(p => p.user_id)
      const { data: activeSessions } = await supabase
        .from('focus_session')
        .select('session_id, user_id, started_at, focus_score')
        .in('user_id', userIds)
        .eq('room_id', roomId)
        .is('ended_at', null)

      // 세션 종료 & 참가자 점수 업데이트 처리
      if (activeSessions && activeSessions.length > 0) {
        for (const session of activeSessions) {
          // 세션 종료
          await supabase
            .from('focus_session')
            .update({ ended_at: now.toISOString(), updated_at: now.toISOString() })
            .eq('session_id', session.session_id)

          const finalScore = session.focus_score || 0

            // 참가자 점수 업데이트
          await supabase
            .from('competition_participants')
            .update({
              final_score: finalScore,
              session_id: session.session_id
            })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', session.user_id)

          // 지속 시간 계산
          const durationMin = session.started_at ? Math.round((now.getTime() - new Date(session.started_at).getTime()) / 60000) : 0

          // 비동기 챌린지 업데이트 (에러는 로그)
          updatePersonalChallenges(supabase, session.user_id, durationMin, finalScore).catch(e => console.error('personal challenge update error', e))
          updateGroupChallenges(supabase, roomId, session.user_id, durationMin, finalScore).catch(e => console.error('group challenge update error', e))

          // 실시간 브로드캐스트 (참여자 개별 세션 종료)
          try {
            await supabase
              .channel(`social_room:${roomId}`)
              .send({
                type: 'broadcast',
                event: 'focus_session_ended',
                payload: {
                  session_id: session.session_id,
                  user_id: session.user_id,
                  final_focus_score: finalScore,
                  duration_min: durationMin,
                  ended_at: now.toISOString()
                }
              })
          } catch (e) {
            console.error('focus_session_ended broadcast failed', e)
          }

          endedSessions.push({
            session_id: session.session_id,
            user_id: session.user_id,
            final_focus_score: finalScore
          })
        }
      }

      // 순위 계산
      const { data: scored } = await supabase
        .from('competition_participants')
        .select('user_id, final_score')
        .eq('competition_id', competition.competition_id)
        .order('final_score', { ascending: false })

      if (scored && scored.length > 0) {
        for (let i = 0; i < scored.length; i++) {
          await supabase
            .from('competition_participants')
            .update({ rank: i + 1 })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', scored[i].user_id)
        }
        const winner = scored[0]
        if (winner) {
          await supabase
            .from('focus_competitions')
            .update({ winner_id: winner.user_id })
            .eq('competition_id', competition.competition_id)
        }
      }
    }

    // 경쟁 종료
    const { error: endError } = await supabase
      .from('focus_competitions')
      .update({ 
        is_active: false,
        ended_at: now.toISOString()
      })
      .eq('competition_id', competition.competition_id)

    if (endError) {
      return createErrorResponse('Failed to end competition', 500)
    }

    // 실시간 경쟁 종료 브로드캐스트
    try {
      await supabase
        .channel(`social_room:${roomId}`)
        .send({
          type: 'broadcast',
          event: 'competition_ended',
          payload: {
            competition_id: competition.competition_id,
            ended_at: now.toISOString(),
            sessions: endedSessions
          }
        })
      // 호환성: 기존 경쟁 시작 채널에도 종료 이벤트 송신
      await supabase
        .channel(`room-participants-${roomId}`)
        .send({
          type: 'broadcast',
          event: 'competition_ended',
          payload: {
            competition_id: competition.competition_id,
            ended_at: now.toISOString(),
            sessions: endedSessions
          }
        })
    } catch (e) {
      console.error('competition_ended broadcast failed', e)
    }

    return createSuccessResponse({
      competition_id: competition.competition_id,
      ended_at: now.toISOString(),
      ended_sessions: endedSessions
    }, 'Competition ended successfully')

  } catch (error) {
    console.error('End competition error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}

// --- 재사용 (간단 버전) 개인 챌린지 업데이트 ---
async function updatePersonalChallenges(supabase: any, userId: string, durationMin: number, focusScore: number) {
  try {
    const { data: challenges } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('completed_at', null)
    if (!challenges) return
    for (const c of challenges) {
      let inc = 0
      switch (c.type) {
        case 'focus_time': inc = durationMin; break
        case 'study_sessions': inc = 1; break
        case 'focus_score': inc = focusScore > 0 ? focusScore : 0; break
        case 'streak_days': {
          const today = new Date().toISOString().split('T')[0]
          if (c.last_updated && c.last_updated.startsWith(today)) inc = 0; else inc = 1
          break
        }
      }
      if (inc === 0) continue
      const newProgress = (c.current_progress || 0) + inc
      const completionPercentage = Math.min((newProgress / c.target_value) * 100, 100)
      const isCompleted = newProgress >= c.target_value
      await supabase
        .from('personal_challenge')
        .update({
          current_progress: newProgress,
            completion_percentage: completionPercentage,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          last_updated: new Date().toISOString()
        })
        .eq('challenge_id', c.challenge_id)
    }
  } catch (e) {
    console.error('updatePersonalChallenges failed', e)
  }
}

// --- 재사용 (간단 버전) 그룹 챌린지 업데이트 ---
async function updateGroupChallenges(supabase: any, roomId: string, userId: string, durationMin: number, focusScore: number) {
  try {
    const { data: challenges } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .is('is_completed', false)
    if (!challenges) return
    for (const c of challenges) {
      let inc = 0
      switch (c.type) {
        case 'focus_time': inc = durationMin; break
        case 'study_sessions': inc = 1; break
        case 'focus_score': inc = focusScore > 0 ? focusScore : 0; break
        case 'streak_days': {
          const today = new Date().toISOString().split('T')[0]
          const { data: lastPart } = await supabase
            .from('group_challenge_participant')
            .select('last_contribution_at')
            .eq('challenge_id', c.challenge_id)
            .eq('user_id', userId)
            .single()
          if (!lastPart || !lastPart.last_contribution_at || !lastPart.last_contribution_at.startsWith(today)) inc = 1
          break
        }
      }
      if (inc === 0) continue
      const { data: existing } = await supabase
        .from('group_challenge_participant')
        .select('contribution')
        .eq('challenge_id', c.challenge_id)
        .eq('user_id', userId)
        .single()
      const newContribution = (existing?.contribution || 0) + inc
      await supabase
        .from('group_challenge_participant')
        .upsert({
          challenge_id: c.challenge_id,
          user_id: userId,
          contribution: newContribution,
          last_contribution_at: new Date().toISOString()
        }, { onConflict: 'challenge_id,user_id' })
      const { data: allParts } = await supabase
        .from('group_challenge_participant')
        .select('contribution')
        .eq('challenge_id', c.challenge_id)
      const total = allParts?.reduce((s: number, p: any) => s + (p.contribution || 0), 0) || 0
      const completionPercentage = Math.min((total / c.target_value) * 100, 100)
      const isCompleted = total >= c.target_value
      await supabase
        .from('group_challenge')
        .update({
          current_value: total,
          completion_percentage: completionPercentage,
          is_completed: isCompleted,
          updated_at: new Date().toISOString()
        })
        .eq('challenge_id', c.challenge_id)
    }
  } catch (e) {
    console.error('updateGroupChallenges failed', e)
  }
}
