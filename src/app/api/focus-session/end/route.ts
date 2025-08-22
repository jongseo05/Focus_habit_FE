import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabase/server'
import { ReportService } from '../../../../lib/database/reportService'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError
} from '../../../../lib/api/standardResponse'

// 세션 종료 및 리포트 생성 API
export async function POST(request: NextRequest) {
  try {
    const { sessionId, finalFocusScore } = await request.json()
    

    
    // 요청 데이터 검증
    if (!sessionId) {
      return createErrorResponse(
        'sessionId는 필수 항목입니다.',
        400
      )
    }

    // 표준 인증 확인
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, user_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('❌ 세션 조회 오류:', sessionError?.message)
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
      )
    }

    //  최적화: 세션 종료와 관련 데이터 조회를 병렬로 처리
    const [
      endResult,
      samplesResult,
      eventsResult
    ] = await Promise.allSettled([
      // 1. 세션 종료 처리 (업데이트된 데이터 함께 반환)
      supabase
        .from('focus_session')
        .update({
          ended_at: new Date().toISOString(),
          focus_score: finalFocusScore || null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .select('*')
        .single(),
      
      // 2. 샘플 데이터 조회 (count와 score 평균 계산)
      supabase
        .from('focus_sample')
        .select('score')
        .eq('session_id', sessionId),
      
      // 3. 이벤트 데이터 조회 (count만)
      supabase
        .from('focus_event')
        .select('event_type', { count: 'exact' })
        .eq('session_id', sessionId)
    ])

    // 세션 종료 결과 확인
    if (endResult.status === 'rejected' || endResult.value.error) {
      const error = endResult.status === 'rejected' ? endResult.reason : endResult.value.error
      console.error('❌ 세션 종료 실패:', error)
      return createErrorResponse(
        `세션 종료에 실패했습니다: ${error.message || error}`,
        500
      )
    }

    const updatedSession = endResult.value.data

    console.log('✅ 세션 종료 완료:', {
      sessionId: updatedSession.session_id,
      started_at: updatedSession.started_at,
      ended_at: updatedSession.ended_at,
      final_focus_score: updatedSession.focus_score
    })

    // 세션 지속 시간 계산 (분 단위)
    const startTime = new Date(updatedSession.started_at)
    const endTime = new Date(updatedSession.ended_at)
    const sessionDurationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // 스터디룸 자동 챌린지 업데이트를 위한 이벤트 데이터 준비
    const sessionCompleteData = {
      duration: sessionDurationMinutes,
      focusScore: updatedSession.focus_score,
      sessionType: 'focus',
      sessionId: updatedSession.session_id,
      userId: user.id
    }

    // 샘플 데이터 처리
    const samples = samplesResult.status === 'fulfilled' && !samplesResult.value.error 
      ? samplesResult.value.data || []
      : []
    
    if (samplesResult.status === 'rejected' || samplesResult.value.error) {
      console.error('❌ 샘플 데이터 조회 실패')
    }

    // 이벤트 데이터 처리
    const events = eventsResult.status === 'fulfilled' && !eventsResult.value.error 
      ? eventsResult.value.data || []
      : []
    
    if (eventsResult.status === 'rejected' || eventsResult.value.error) {
      console.error('❌ 이벤트 데이터 조회 실패')
    }

    // 🚀 최적화: 일일 요약 업데이트를 백그라운드에서 비동기 처리
    const today = new Date().toISOString().split('T')[0]
    ReportService.upsertDailySummaryServer(user.id, today, supabase)
      .catch(summaryError => {
        console.error('❌ 일일 요약 처리 중 오류:', summaryError)
      })

    // 🚀 최적화: 평균 점수 계산 개선
    const averageFocusScore = samples.length > 0
      ? Math.round(samples.reduce((sum, sample) => sum + (sample.score || 0), 0) / samples.length)
      : finalFocusScore || 0

    // 개인 챌린지 업데이트 (개인 세션에서도 챌린지 진행률 반영)
    try {
      // 개인 챌린지 전체 진행사항 동기화
      await syncPersonalChallengesProgress(supabase, user.id, sessionDurationMinutes, averageFocusScore)
      console.log('개인 챌린지 동기화 완료')
    } catch (challengeError) {
      console.error('개인 챌린지 동기화 중 오류:', challengeError)
    }

    // 6. 세션 리포트 데이터 반환
    const reportData = {
      session: updatedSession,
      samples: samples,
      events: events,
      summary: {
        sampleCount: samples.length,
        eventCount: events.length,
        duration: updatedSession.ended_at && updatedSession.started_at 
          ? Math.floor((new Date(updatedSession.ended_at).getTime() - new Date(updatedSession.started_at).getTime()) / (1000 * 60))
          : 0,
        averageFocusScore
      }
    }



    return createSuccessResponse(
      reportData,
      '세션이 성공적으로 종료되고 리포트가 생성되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '세션 종료')
  }
}

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


