import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개인 챌린지 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, type, target_value, unit, duration_days, min_session_duration } = body

    // 필수 필드 검증
    if (!title || !type || !target_value || !unit || !duration_days) {
      return NextResponse.json({ error: '모든 필수 필드를 입력해주세요.' }, { status: 400 })
    }

    // 종료 날짜 계산
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + duration_days)

    // target_value는 사용자가 입력한 단위 그대로 저장
    const convertedTargetValue = target_value
    const convertedUnit = unit

    // 개인 챌린지 생성
    const { data: newChallenge, error: createError } = await supabase
      .from('personal_challenge')
      .insert({
        user_id: user.id,
        title,
        description: description || '',
        type,
        target_value: convertedTargetValue,
        current_value: 0,
        unit: convertedUnit,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        is_active: true,
        is_completed: false,
        min_session_duration: type === 'study_sessions' ? min_session_duration : null
      })
      .select()
      .single()

    if (createError) {
      console.error('개인 챌린지 생성 실패:', createError)
      return NextResponse.json({ 
        error: '개인 챌린지 생성에 실패했습니다.',
        details: createError.message
      }, { status: 500 })
    }

    // 챌린지 생성 시점 이후의 세션 데이터로 초기 진행사항 계산
    try {
      const challengeCreatedAt = newChallenge.created_at
      
      // 챌린지 생성 시간 이후의 모든 완료된 세션 데이터 조회
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', challengeCreatedAt)
        .not('ended_at', 'is', null)
        .not('focus_score', 'is', null)

      if (!sessionsError && sessions && sessions.length > 0) {
        let initialProgress = 0

        // 챌린지 타입별로 초기 진행률 계산
        switch (newChallenge.type) {
          case 'focus_time':
            // 집중 시간 합계 (분 단위)
            initialProgress = sessions.reduce((total, session) => {
              const startedAt = new Date(session.started_at)
              const endedAt = new Date(session.ended_at)
              const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))
              return total + durationMinutes
            }, 0)
            break

          case 'study_sessions':
            // 세션 개수 (최소 지속시간 조건 확인)
            const minDuration = newChallenge.min_session_duration || 30
            initialProgress = sessions.filter(session => {
              const startedAt = new Date(session.started_at)
              const endedAt = new Date(session.ended_at)
              const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60))
              return durationMinutes >= minDuration
            }).length
            break

          case 'focus_score':
            // 평균 집중도 점수
            const totalScore = sessions.reduce((sum, session) => sum + (session.focus_score || 0), 0)
            initialProgress = sessions.length > 0 ? Math.round(totalScore / sessions.length) : 0
            break

          default:
            initialProgress = 0
        }

        // 초기 진행사항이 0보다 크면 DB 업데이트
        if (initialProgress > 0) {
          const { error: updateError } = await supabase
            .from('personal_challenge')
            .update({ 
              current_value: initialProgress,
              completion_percentage: Math.min((initialProgress / newChallenge.target_value) * 100, 100)
            })
            .eq('id', newChallenge.id)

          if (!updateError) {
            newChallenge.current_value = initialProgress
            console.log(`✅ 챌린지 초기 진행사항 설정 완료: ${newChallenge.title} (${initialProgress})`)
          }
        }
      }
    } catch (initError) {
      console.error('초기 진행사항 계산 중 오류 (생성은 성공):', initError)
    }

    return NextResponse.json({ 
      data: newChallenge,
      message: '개인 챌린지가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 생성 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 개인 챌린지 조회
export async function GET(request: NextRequest) {
  console.log('=== 개인 챌린지 조회 시작 ===')
  try {
    const supabase = await supabaseServer()
    console.log('Supabase 서버 클라이언트 생성 완료')
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증 확인 결과:', { user_id: user?.id, authError })
    
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // personal_challenge 테이블에서 개인 챌린지 조회 (활성 챌린지만)
    console.log('데이터베이스 쿼리 시작:', { user_id: user.id })
    const { data: rawChallenges, error: challengeError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    console.log('데이터베이스 쿼리 결과:', { 
      rawChallenges, 
      challengeError,
      challenges_count: rawChallenges?.length 
    })

    if (challengeError) {
      console.error('개인 챌린지 조회 실패:', challengeError)
      return NextResponse.json({ 
        error: '개인 챌린지 조회에 실패했습니다.',
        details: challengeError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      data: rawChallenges || [],
      message: '개인 챌린지 조회가 완료되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 조회 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 개인 챌린지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const challengeId = searchParams.get('id')

    if (!challengeId) {
      return NextResponse.json({ error: '챌린지 ID가 필요합니다.' }, { status: 400 })
    }

    // 먼저 해당 챌린지가 현재 사용자의 것인지 확인
    const { data: existingChallenge, error: checkError } = await supabase
      .from('personal_challenge')
      .select('id, user_id')
      .eq('id', challengeId)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existingChallenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 챌린지 삭제
    const { error: deleteError } = await supabase
      .from('personal_challenge')
      .delete()
      .eq('id', challengeId)

    if (deleteError) {
      console.error('개인 챌린지 삭제 실패:', deleteError)
      return NextResponse.json({ 
        error: '개인 챌린지 삭제에 실패했습니다.',
        details: deleteError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: '개인 챌린지가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 삭제 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
