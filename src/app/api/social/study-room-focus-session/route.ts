import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'
import { filterSessionEligibleParticipants } from '@/lib/utils/onlineStatus'

// =====================================================
// 스터디룸 집중도 세션 API 라우트
// =====================================================

// POST: 스터디룸 집중도 세션 시작
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('🔥 스터디룸 세션 생성 요청:', JSON.stringify(body, null, 2))
    
    const { 
      room_id, 
      goal_min, 
      context_tag = '스터디룸 집중 세션', 
      session_type = 'study_room',
      notes 
    } = body

    console.log('📋 요청 파라미터 파싱:', {
      room_id,
      goal_min,
      context_tag,
      session_type,
      notes
    })

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      console.log('❌ 인증 실패:', authResult.status, authResult.statusText)
      return authResult
    }
    
    const { user } = authResult
    console.log('✅ 인증된 사용자:', user.id)

    // 🚀 최적화: 병렬 처리로 참가자 확인, 기존 세션 종료, 활성 경쟁 확인을 동시에 실행
    const now = new Date().toISOString()
    console.log('🔍 병렬 검증 시작:', { timestamp: now })
    
    const [participantResult, existingSessionResult, eligibleParticipantsResult, activeCompetitionResult] = await Promise.allSettled([
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
        .maybeSingle(),
      
      // ✨ 새로 추가: 세션 시작 자격이 있는 참가자들 확인
      supabase
        .from('room_participants')
        .select(`
          participant_id,
          user_id,
          is_present,
          last_activity,
          is_connected
        `)
        .eq('room_id', room_id)
        .eq('is_present', true)  // 실제 룸에 있는 사람만
        .is('left_at', null),
      
      // 4. 활성 경쟁 확인
      supabase
        .from('focus_competitions')
        .select('competition_id, room_id, is_active')
        .eq('room_id', room_id)
        .eq('is_active', true)
        .maybeSingle()
    ])

    // 참가자 확인 결과 처리
    if (participantResult.status === 'rejected' || participantResult.value.error || !participantResult.value.data) {
      return createErrorResponse(
        '스터디룸에 참가하고 있지 않습니다.',
        403
      )
    }

    // ✨ 세션 시작 자격 확인 (표준 1분 기준 - 공통 유틸리티 사용)
    if (eligibleParticipantsResult.status === 'fulfilled' && eligibleParticipantsResult.value.data) {
      const presentParticipants = eligibleParticipantsResult.value.data
      
      // left_at 속성 추가하여 ParticipantOnlineCheck 타입에 맞춤
      const participantsWithLeftAt = presentParticipants.map(p => ({
        ...p,
        left_at: null // 현재 참가자들은 left_at이 null (아직 나가지 않음)
      }))
      
      // 온라인이면서 룸에 있는 참가자 필터링 (공통 유틸리티 사용)
      const eligibleParticipants = filterSessionEligibleParticipants(participantsWithLeftAt)
      
      // 최소 1명의 자격 있는 참가자가 필요
      if (eligibleParticipants.length < 1) {
        return createErrorResponse(
          '세션을 시작하려면 온라인 상태이면서 룸에 있는 참가자가 최소 1명 이상 필요합니다. 현재 자격 있는 참가자: 0명',
          400
        )
      }
      
      console.log(`✅ 세션 시작 자격 확인 완료: ${eligibleParticipants.length}명의 참가자가 참여 가능`)
    }

    // 🏆 활성 경쟁 확인 결과 처리
    let activeCompetition = null
    if (activeCompetitionResult.status === 'fulfilled' && !activeCompetitionResult.value.error && activeCompetitionResult.value.data) {
      activeCompetition = activeCompetitionResult.value.data
      console.log('🏆 활성 경쟁 발견:', activeCompetition)
    } else {
      console.log('📝 활성 경쟁이 없음 (일반 세션)')
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

    console.log('✅ 스터디룸 세션 생성 성공:', newSession.session_id)

    // 🏆 활성 경쟁이 있는 경우 로깅 (실제 스키마에는 session_id 컬럼 없음)
    if (activeCompetition) {
      console.log('✅ 활성 경쟁에서 세션 시작:', {
        competition_id: activeCompetition.competition_id,
        session_id: newSession.session_id,
        user_id: user.id
      })
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
      // 집중도 점수 반올림 (소수점 제거)
      updateData.focus_score = Math.round(Math.max(0, Math.min(100, focus_score)))
    }

    const [sessionResult, updateResult, competitionResult] = await Promise.allSettled([
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
        .eq('session_id', session_id),
      
      // 활성 경쟁 확인 (경쟁 참가자 점수 업데이트용)
      room_id ? supabase
        .from('focus_competitions')
        .select('competition_id, room_id')
        .eq('room_id', room_id)
        .eq('is_active', true)
        .maybeSingle() : Promise.resolve({ data: null, error: null })
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

    // 🏆 경쟁 참가자 점수 업데이트 (활성 경쟁이 있는 경우)
    if (focus_score !== undefined && competitionResult.status === 'fulfilled' && competitionResult.value.data) {
      const activeCompetition = competitionResult.value.data
      try {
        // 실제 스키마에 맞는 점수 업데이트
        const { error: competitionUpdateError } = await supabase
          .from('competition_participants')
          .update({
            total_focus_score: focus_score, // 실제 스키마는 total_focus_score 사용
            average_focus_score: focus_score // 현재 점수로 평균도 설정
          })
          .eq('competition_id', activeCompetition.competition_id)
          .eq('user_id', user.id)

        if (competitionUpdateError) {
          console.error('경쟁 참가자 점수 업데이트 실패:', competitionUpdateError)
        } else {
          console.log('✅ 경쟁 참가자 점수 업데이트 성공:', {
            competition_id: activeCompetition.competition_id,
            user_id: user.id,
            total_focus_score: focus_score
          })
        }
      } catch (error) {
        console.error('경쟁 참가자 점수 업데이트 중 오류:', error)
      }
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
      // 그룹 챌린지 업데이트
      room_id ? updateGroupChallenges(supabase, room_id, user.id, duration_min, session.focus_score || 0) : Promise.resolve(),
      // 개인 챌린지 업데이트 (스터디룸에서도 개인 챌린지 진행사항 반영)
      syncPersonalChallengesProgress(supabase, user.id, duration_min, session.focus_score || 0)
    ]).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const challengeType = index === 0 ? '그룹 챌린지' : '개인 챌린지'
          console.error(`${challengeType} 업데이트 실패:`, result.reason)
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



// 그룹 챌린지 업데이트 함수
// 개인 챌린지 전체 진행사항 동기화 함수
async function syncPersonalChallengesProgress(supabase: any, userId: string, sessionDuration: number, focusScore: number) {
  try {
    console.log('개인 챌린지 전체 진행사항 동기화 시작:', { userId, sessionDuration, focusScore })

    // 활성 개인 챌린지 조회
    const { data: personalChallenges, error: challengesError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('is_completed', false)

    if (challengesError) {
      console.error('개인 챌린지 조회 실패:', challengesError)
      return
    }

    if (!personalChallenges || personalChallenges.length === 0) {
      console.log('활성 개인 챌린지가 없음')
      return
    }

    // 각 개인 챌린지에 대해 생성 시간 이후의 모든 세션 데이터 집계
    for (const challenge of personalChallenges) {
      try {
        const challengeCreatedAt = challenge.created_at
        
        // 챌린지 생성 시간 이후의 모든 완료된 세션 데이터 조회
        const { data: sessions, error: sessionsError } = await supabase
          .from('focus_session')
          .select(`
            session_id,
            started_at,
            ended_at,
            focus_score,
            session_type
          `)
          .eq('user_id', userId)
          .gte('started_at', challengeCreatedAt) // 챌린지 생성 이후 시작된 세션
          .not('ended_at', 'is', null) // 완료된 세션만
          .order('started_at', { ascending: true })

        if (sessionsError) {
          console.error(`세션 데이터 조회 실패 (챌린지: ${challenge.title}):`, sessionsError)
          continue
        }

        if (!sessions || sessions.length === 0) {
          console.log(`챌린지 생성 이후 완료된 세션이 없음: ${challenge.title}`)
          continue
        }

        console.log(`챌린지 "${challenge.title}" 데이터 집계: ${sessions.length}개 세션`)

        let totalProgress = 0
        const processedDates = new Set<string>()

        // 각 세션 데이터를 챌린지 타입에 맞게 집계
        for (const session of sessions) {
          const sessionDate = session.started_at.split('T')[0]
          const sessionDuration = session.started_at && session.ended_at ? 
            Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60)) : 0

          switch (challenge.type) {
            case 'focus_time':
              // 집중 시간 누적 (분 단위)
              totalProgress += sessionDuration
              break
              
            case 'study_sessions':
              // 스터디 세션 수 누적
              totalProgress += 1
              break
              
            case 'focus_score':
              // 집중도 점수 - 최고점수로 업데이트
              if (session.focus_score && session.focus_score > totalProgress) {
                totalProgress = session.focus_score
              }
              break
              
            case 'streak_days':
              // 연속 학습 일수 계산 (중복 날짜 제거)
              if (!processedDates.has(sessionDate)) {
                processedDates.add(sessionDate)
                totalProgress += 1
              }
              break
          }
        }

        // 진행률 계산 및 업데이트
        const completionPercentage = Math.min((totalProgress / challenge.target_value) * 100, 100)
        const isCompleted = totalProgress >= challenge.target_value

        const updateData = {
          current_value: totalProgress,
          is_completed: isCompleted
        }

        const { error: updateError } = await supabase
          .from('personal_challenge')
          .update(updateData)
          .eq('id', challenge.id)

        if (updateError) {
          console.error(`챌린지 업데이트 실패 (${challenge.title}):`, updateError)
        } else {
          console.log(`✅ 챌린지 업데이트 완료: ${challenge.title}`, {
            type: challenge.type,
            totalProgress,
            targetValue: challenge.target_value,
            completionPercentage: Math.round(completionPercentage),
            isCompleted,
            sessionsCount: sessions.length
          })
        }

      } catch (challengeError) {
        console.error(`챌린지 "${challenge.title}" 처리 중 오류:`, challengeError)
        continue
      }
    }

    console.log(`개인 챌린지 전체 동기화 완료: ${personalChallenges.length}개 챌린지 처리`)

  } catch (error) {
    console.error('개인 챌린지 전체 동기화 실패:', error)
  }
}

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
