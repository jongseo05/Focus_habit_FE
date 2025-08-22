import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개인 챌린지 전체 진행사항 동기화 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { session_duration, focus_score } = await request.json()
    
    console.log('개인 챌린지 전체 진행사항 동기화 시작:', { userId: user.id, session_duration, focus_score })

    // 활성 개인 챌린지 조회
    const { data: personalChallenges, error: challengesError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_completed', false)

    if (challengesError) {
      console.error('개인 챌린지 조회 실패:', challengesError)
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
    }

    if (!personalChallenges || personalChallenges.length === 0) {
      console.log('활성 개인 챌린지가 없음')
      return NextResponse.json({ 
        success: true, 
        message: '활성 개인 챌린지가 없습니다.',
        updatedChallenges: 0 
      })
    }

    let updatedChallenges = 0

    // 각 개인 챌린지에 대해 생성 시간 이후의 모든 세션 데이터 집계
    for (const challenge of personalChallenges) {
      try {
        const challengeCreatedAt = challenge.created_at
        
        // 챌린지 생성 시간 이후의 모든 완료된 세션 데이터 조회
        const { data: sessions, error: sessionsError } = await supabase
          .from('focus_session')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', challengeCreatedAt)
          .not('ended_at', 'is', null)
          .not('focus_score', 'is', null)

        if (sessionsError) {
          console.error('세션 데이터 조회 실패:', sessionsError)
          continue
        }

        let totalProgress = 0

        // 챌린지 타입별로 진행률 계산
        switch (challenge.type) {
          case 'focus_time':
            // 집중 시간 (분 단위)
            totalProgress = sessions.reduce((sum, session) => {
              const startTime = new Date(session.started_at)
              const endTime = new Date(session.ended_at)
              const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
              return sum + durationMinutes
            }, 0)
            break

          case 'study_sessions':
            // 스터디 세션 수 (최소 세션 시간 조건 확인)
            const minDuration = challenge.min_session_duration || 30
            totalProgress = sessions.filter(session => {
              const startTime = new Date(session.started_at)
              const endTime = new Date(session.ended_at)
              const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
              return durationMinutes >= minDuration
            }).length
            break

          case 'focus_score':
            // 집중도 점수 - 최고점수로 업데이트
            totalProgress = sessions.reduce((max, session) => {
              return session.focus_score && session.focus_score > max ? session.focus_score : max
            }, 0)
            break

          case 'streak_days':
            // 연속 학습일 - 고유 날짜 수 계산
            const uniqueDates = new Set(
              sessions.map(session => session.started_at.split('T')[0])
            )
            totalProgress = uniqueDates.size
            break

          default:
            console.log(`알 수 없는 챌린지 타입: ${challenge.type}`)
            continue
        }

        // 진행률 계산 및 업데이트
        const isCompleted = totalProgress >= challenge.target_value

        const updateData = {
          current_value: totalProgress,
          is_completed: isCompleted
        }

        const { data: updatedChallenge, error: updateError } = await supabase
          .from('personal_challenge')
          .update(updateData)
          .eq('id', challenge.id)
          .select()
          .single()

        if (updateError) {
          console.error('챌린지 업데이트 실패:', updateError)
          continue
        }

        console.log(`✅ 챌린지 "${challenge.title}" 업데이트 완료:`, {
          type: challenge.type,
          previousValue: challenge.current_value,
          newValue: totalProgress,
          targetValue: challenge.target_value,
          isCompleted
        })

        updatedChallenges++

      } catch (error) {
        console.error(`챌린지 "${challenge.title}" 처리 중 오류:`, error)
        continue
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedChallenges}개의 개인 챌린지 진행사항이 업데이트되었습니다.`,
      updatedChallenges
    })

  } catch (error) {
    console.error('개인 챌린지 동기화 중 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}