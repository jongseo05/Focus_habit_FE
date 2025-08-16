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

    // 챌린지 존재 확인 및 권한 확인 (개인 챌린지만 - challenge_type이 'personal')
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenge')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('created_by', user.id) // created_by로 권한 확인
      .eq('challenge_type', 'personal') // 개인 챌린지만 (challenge_type으로 구분)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없거나 권한이 없습니다.' }, { status: 404 })
    }

    // 진행 상황 업데이트
    const newCurrentValue = (challenge.current_value || 0) + progress_value
    const isCompleted = newCurrentValue >= challenge.target_value

    const { data: updatedChallenge, error: updateError } = await supabase
      .from('group_challenge')
      .update({
        current_value: newCurrentValue,
        is_completed: isCompleted,
        is_active: !isCompleted
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
