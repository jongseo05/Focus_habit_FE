import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'

// =====================================================
// 스터디룸 집중도 세션 API 라우트
// =====================================================

// POST: 스터디룸 집중도 세션 시작
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('스터디룸 세션 생성 요청:', body)
    
    const { 
      room_id, 
      goal_min, 
      context_tag = '스터디룸 집중 세션', 
      session_type = 'study_room',
      notes 
    } = body

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      console.log('인증 실패:', authResult.status, authResult.statusText)
      return authResult
    }
    
    const { user } = authResult
    console.log('인증된 사용자:', user.id)

    // 🚀 최적화: 병렬 처리로 참가자 확인과 기존 세션 종료를 동시에 실행
    const now = new Date().toISOString()
    
    const [participantResult, existingSessionResult] = await Promise.allSettled([
      // 스터디룸 참가자 확인
      supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', room_id)
        .eq('user_id', user.id)
        .is('left_at', null)
        .single(),
      
      // 기존 활성 세션 조회 (종료용)
      supabase
        .from('focus_session')
        .select('session_id')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()
    ])

    // 참가자 확인 결과 처리
    if (participantResult.status === 'rejected' || participantResult.value.error || !participantResult.value.data) {
      return createErrorResponse(
        '스터디룸에 참가하고 있지 않습니다.',
        403
      )
    }

    // 🚀 최적화: 기존 세션이 있는 경우에만 종료 처리
    if (existingSessionResult.status === 'fulfilled' && existingSessionResult.value.data) {
      await supabase
        .from('focus_session')
        .update({ ended_at: now, updated_at: now })
        .eq('session_id', existingSessionResult.value.data.session_id)
    }

    // 새 스터디룸 집중도 세션 생성
    const sessionData = {
      user_id: user.id,
      room_id: room_id, // 스터디룸 ID 추가
      started_at: now,
      goal_min: goal_min || null,
      context_tag: context_tag,
      session_type: session_type,
      notes: notes || null,
      created_at: now,
      updated_at: now,
      distractions: 0 // 기본값 추가
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('focus_session')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      console.error('스터디룸 세션 생성 실패:', sessionError)
      return createErrorResponse(
        '집중도 세션 생성에 실패했습니다.',
        500
      )
    }

    // 🚀 최적화: 실시간 이벤트 브로드캐스트를 비동기로 처리 (응답 지연 방지)
    supabase
      .channel(`social_room:${room_id}`)
      .send({
        type: 'broadcast',
        event: 'focus_session_started',
        payload: {
          session_id: newSession.session_id,
          room_id: room_id,
          started_by: user.id,
          user_name: user.user_metadata?.name || '사용자'
        }
      })
      .catch(error => {
        console.error('실시간 이벤트 브로드캐스트 실패:', error)
      })

    return createSuccessResponse(
      newSession,
      '스터디룸 집중도 세션이 시작되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, 'Study room focus session POST API')
  }
}

// PUT: 스터디룸 집중도 세션 업데이트 (집중도 점수, 프레임 데이터 등)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      session_id, 
      focus_score, 
      frame_data, 
      timestamp,
      room_id 
    } = body

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    // 🚀 최적화: 세션 소유자 확인과 업데이트를 병렬로 처리
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (focus_score !== undefined) {
      updateData.focus_score = focus_score
    }

    const [sessionResult, updateResult] = await Promise.allSettled([
      // 세션 소유자 확인
      supabase
        .from('focus_session')
        .select('session_id, user_id, room_id')
        .eq('session_id', session_id)
        .eq('user_id', user.id)
        .single(),
      
      // 집중도 점수 업데이트
      supabase
        .from('focus_session')
        .update(updateData)
        .eq('session_id', session_id)
    ])

    // 세션 확인 결과 처리
    if (sessionResult.status === 'rejected' || sessionResult.value.error || !sessionResult.value.data) {
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
      )
    }

    // 업데이트 결과 처리
    if (updateResult.status === 'rejected' || updateResult.value.error) {
      console.error('세션 업데이트 실패:', updateResult.status === 'rejected' ? updateResult.reason : updateResult.value.error)
      return createErrorResponse(
        '세션 업데이트에 실패했습니다.',
        500
      )
    }

    // 🚀 최적화: 프레임 데이터 저장을 비동기로 처리 (응답 지연 방지)
    if (frame_data) {
      const frameData = {
        session_id: session_id,
        user_id: user.id,
        room_id: room_id,
        frame_data: frame_data,
        focus_score: focus_score,
        timestamp: timestamp || new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      try {
        await supabase
          .from('focus_session_frames')
          .insert(frameData)
      } catch (frameError) {
        console.error('프레임 데이터 저장 실패:', frameError)
      }
    }

    // 🚀 최적화: 실시간 집중도 업데이트 브로드캐스트를 비동기로 처리
    if (focus_score !== undefined && room_id) {
      supabase
        .channel(`social_room:${room_id}`)
        .send({
          type: 'broadcast',
          event: 'focus_score_updated',
          payload: {
            user_id: user.id,
            user_name: user.user_metadata?.name || '사용자',
            focus_score: focus_score,
            session_id: session_id,
            timestamp: new Date().toISOString()
          }
        })
        .catch(error => {
          console.error('실시간 집중도 업데이트 브로드캐스트 실패:', error)
        })
    }

    return createSuccessResponse(
      { session_id, focus_score },
      '집중도 점수가 업데이트되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, 'Study room focus session PUT API')
  }
}

// DELETE: 스터디룸 집중도 세션 종료
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get('session_id')
    const room_id = searchParams.get('room_id')

    if (!session_id) {
      return createErrorResponse(
        '세션 ID가 필요합니다.',
        400
      )
    }

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    // 🚀 최적화: 세션 정보 조회와 종료를 병렬로 처리
    const now = new Date().toISOString()
    
    const [sessionResult, endResult] = await Promise.allSettled([
      // 세션 정보 조회
      supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', session_id)
        .eq('user_id', user.id)
        .single(),
      
      // 세션 종료
      supabase
        .from('focus_session')
        .update({ 
          ended_at: now, 
          updated_at: now 
        })
        .eq('session_id', session_id)
    ])

    // 세션 조회 결과 처리
    if (sessionResult.status === 'rejected' || sessionResult.value.error || !sessionResult.value.data) {
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
      )
    }

    const session = sessionResult.value.data

    // 세션 종료 결과 처리
    if (endResult.status === 'rejected' || endResult.value.error) {
      console.error('세션 종료 실패:', endResult.status === 'rejected' ? endResult.reason : endResult.value.error)
      return createErrorResponse(
        '세션 종료에 실패했습니다.',
        500
      )
    }

    // 세션 통계 계산
    const duration_min = session.started_at ? 
      Math.round((new Date(now).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)) : 
      0

    // 🚀 최적화: 챌린지 업데이트를 비동기로 처리 (응답 지연 방지)
    Promise.allSettled([
      // 1. 개인 챌린지 업데이트 (스터디룸 세션이어도 개인 챌린지에 반영)
      updatePersonalChallenges(supabase, user.id, duration_min, session.focus_score || 0),
      
      // 2. 그룹 챌린지 업데이트 (스터디룸에서만)
      room_id ? updateGroupChallenges(supabase, room_id, user.id, duration_min, session.focus_score || 0) : Promise.resolve()
    ]).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`챌린지 업데이트 실패 (${index === 0 ? '개인' : '그룹'}):`, result.reason)
        }
      })
    })

    // 🚀 최적화: 실시간 이벤트 브로드캐스트를 비동기로 처리
    if (room_id) {
      supabase
        .channel(`social_room:${room_id}`)
        .send({
          type: 'broadcast',
          event: 'focus_session_ended',
          payload: {
            session_id: session_id,
            room_id: room_id,
            ended_by: user.id,
            user_name: user.user_metadata?.name || '사용자',
            duration_min: duration_min,
            final_focus_score: session.focus_score || 0
          }
        })
        .catch(error => {
          console.error('실시간 세션 종료 브로드캐스트 실패:', error)
        })
    }

    return createSuccessResponse(
      { 
        session_id, 
        duration_min, 
        final_focus_score: session.focus_score || 0 
      },
      '집중도 세션이 종료되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, 'Study room focus session DELETE API')
  }
}

// 개인 챌린지 업데이트 함수
async function updatePersonalChallenges(supabase: any, userId: string, durationMin: number, focusScore: number) {
  try {
    console.log('개인 챌린지 업데이트 시작:', { userId, durationMin, focusScore })

    // 활성 개인 챌린지 조회
    const { data: personalChallenges, error: challengesError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('completed_at', null)

    if (challengesError) {
      console.error('개인 챌린지 조회 실패:', challengesError)
      return
    }

    if (!personalChallenges || personalChallenges.length === 0) {
      console.log('활성 개인 챌린지가 없음')
      return
    }

    // 🚀 최적화: 배치 업데이트로 성능 향상
    const updatePromises = personalChallenges.map(async (challenge: any) => {
      let progress = 0
      let shouldUpdate = false

      switch (challenge.type) {
        case 'focus_time':
          progress = durationMin
          shouldUpdate = true
          break
        case 'study_sessions':
          progress = 1
          shouldUpdate = true
          break
        case 'focus_score':
          if (focusScore > 0) {
            progress = focusScore
            shouldUpdate = true
          }
          break
        case 'streak_days':
          // 오늘 이미 업데이트했는지 확인
          const today = new Date().toISOString().split('T')[0]
          if (challenge.last_updated !== today) {
            progress = 1
            shouldUpdate = true
          }
          break
      }

      if (shouldUpdate) {
        const newProgress = (challenge.current_progress || 0) + progress
        const completionPercentage = Math.min((newProgress / challenge.target_value) * 100, 100)
        const isCompleted = newProgress >= challenge.target_value

        return supabase
          .from('personal_challenge')
          .update({
            current_progress: newProgress,
            completion_percentage: completionPercentage,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
            last_updated: new Date().toISOString()
          })
          .eq('challenge_id', challenge.challenge_id)
          .then(() => ({
            challenge_id: challenge.challenge_id,
            title: challenge.title,
            type: challenge.type,
            progress,
            newProgress,
            completionPercentage,
            isCompleted
          }))
      }
      
      return null
    })

    const results = await Promise.allSettled(updatePromises)
    const successfulUpdates = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value)

    console.log(`개인 챌린지 업데이트 완료: ${successfulUpdates.length}개`, successfulUpdates)

  } catch (error) {
    console.error('개인 챌린지 업데이트 실패:', error)
  }
}

// 그룹 챌린지 업데이트 함수
async function updateGroupChallenges(supabase: any, roomId: string, userId: string, durationMin: number, focusScore: number) {
  try {
    console.log('그룹 챌린지 업데이트 시작:', { roomId, userId, durationMin, focusScore })

    // 해당 룸의 활성 그룹 챌린지 조회
    const { data: groupChallenges, error: challengesError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .is('is_completed', false)

    if (challengesError) {
      console.error('그룹 챌린지 조회 실패:', challengesError)
      return
    }

    if (!groupChallenges || groupChallenges.length === 0) {
      console.log('활성 그룹 챌린지가 없음')
      return
    }

    // 🚀 최적화: 배치 업데이트로 성능 향상
    const updatePromises = groupChallenges.map(async (challenge: any) => {
      let contribution = 0
      let shouldUpdate = false

      switch (challenge.type) {
        case 'focus_time':
          contribution = durationMin
          shouldUpdate = true
          break
        case 'study_sessions':
          contribution = 1
          shouldUpdate = true
          break
        case 'focus_score':
          if (focusScore > 0) {
            contribution = focusScore
            shouldUpdate = true
          }
          break
        case 'streak_days':
          // 오늘 이미 기여했는지 확인
          const today = new Date().toISOString().split('T')[0]
          const { data: lastContribution } = await supabase
            .from('group_challenge_participant')
            .select('last_contribution_at')
            .eq('challenge_id', challenge.challenge_id)
            .eq('user_id', userId)
            .single()

          if (!lastContribution || !lastContribution.last_contribution_at?.startsWith(today)) {
            contribution = 1
            shouldUpdate = true
          }
          break
      }

      if (shouldUpdate) {
        // 기존 기여도 조회
        const { data: existingParticipant } = await supabase
          .from('group_challenge_participant')
          .select('contribution')
          .eq('challenge_id', challenge.challenge_id)
          .eq('user_id', userId)
          .single()

        const currentContribution = existingParticipant?.contribution || 0
        const newContribution = currentContribution + contribution

        // 참가자 정보 업데이트 (upsert)
        await supabase
          .from('group_challenge_participant')
          .upsert({
            challenge_id: challenge.challenge_id,
            user_id: userId,
            contribution: newContribution,
            last_contribution_at: new Date().toISOString()
          }, {
            onConflict: 'challenge_id,user_id'
          })

        // 전체 진행률 계산
        const { data: allParticipants } = await supabase
          .from('group_challenge_participant')
          .select('contribution')
          .eq('challenge_id', challenge.challenge_id)

        const totalContribution = allParticipants?.reduce((sum: number, p: any) => sum + (p.contribution || 0), 0) || 0
        const completionPercentage = Math.min((totalContribution / challenge.target_value) * 100, 100)
        const isCompleted = totalContribution >= challenge.target_value

        // 챌린지 진행률 업데이트
        await supabase
          .from('group_challenge')
          .update({
            current_value: totalContribution,
            completion_percentage: completionPercentage,
            is_completed: isCompleted,
            updated_at: new Date().toISOString()
          })
          .eq('challenge_id', challenge.challenge_id)

        return {
          challenge_id: challenge.challenge_id,
          title: challenge.title,
          type: challenge.type,
          contribution,
          newContribution,
          totalContribution,
          completionPercentage,
          isCompleted
        }
      }
      
      return null
    })

    const results = await Promise.allSettled(updatePromises)
    const successfulUpdates = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value)

    console.log(`그룹 챌린지 업데이트 완료: ${successfulUpdates.length}개`, successfulUpdates)

  } catch (error) {
    console.error('그룹 챌린지 업데이트 실패:', error)
  }
}
