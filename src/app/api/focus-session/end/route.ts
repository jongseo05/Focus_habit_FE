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
      await updatePersonalChallenges(supabase, user.id, sessionDurationMinutes, averageFocusScore)
      console.log('개인 챌린지 업데이트 완료')
    } catch (challengeError) {
      console.error('개인 챌린지 업데이트 실패:', challengeError)
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

    // 각 개인 챌린지 업데이트
    for (const challenge of personalChallenges) {
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

        await supabase
          .from('personal_challenge')
          .update({
            current_progress: newProgress,
            completion_percentage: completionPercentage,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
            last_updated: new Date().toISOString()
          })
          .eq('challenge_id', challenge.challenge_id)

        console.log(`개인 챌린지 업데이트: ${challenge.title}`, {
          type: challenge.type,
          progress,
          newProgress,
          completionPercentage,
          isCompleted
        })
      }
    }
  } catch (error) {
    console.error('개인 챌린지 업데이트 실패:', error)
  }
}
