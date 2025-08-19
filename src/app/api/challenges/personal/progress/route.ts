import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개인 챌린지 진행 상황 업데이트 (challenge_type으로 구분)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id, progress_value } = body

    // 필수 필드 검증
    if (!challenge_id || progress_value === undefined) {
      return NextResponse.json({ error: '챌린지 ID와 진행 상황 값이 필요합니다.' }, { status: 400 })
    }

    // 챌린지 존재 확인 및 권한 확인 (개인 챌린지 테이블에서 조회)
    const { data: challenge, error: challengeError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id) // user_id로 권한 확인
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 })
    }

    // 진행 상황 업데이트
    const newProgress = (challenge.current_progress || 0) + progress_value
    const completionPercentage = Math.min((newProgress / challenge.target_value) * 100, 100)
    const isCompleted = newProgress >= challenge.target_value

    const { data: updatedChallenge, error: updateError } = await supabase
      .from('personal_challenge')
      .update({
        current_progress: newProgress,
        completion_percentage: completionPercentage,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
        last_updated: new Date().toISOString()
      })
      .eq('challenge_id', challenge_id)
      .select()
      .single()

    if (updateError) {
      console.error('개인 챌린지 진행 상황 업데이트 실패:', updateError)
      return NextResponse.json({ error: '진행 상황 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      challenge: updatedChallenge,
      message: '진행 상황이 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 진행 상황 업데이트 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
