import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개인 챌린지 진행 상황 업데이트 (challenge_type으로 구분)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { challenge_id, progress_value, completion_percentage, is_completed } = await request.json()
    
    if (!challenge_id || progress_value === undefined) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 })
    }

    // 챌린지 존재 여부 및 소유권 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 진행률 업데이트 데이터 준비
    const updateData: any = {
      current_value: progress_value
    }

    // completion_percentage가 제공된 경우 사용
    if (completion_percentage !== undefined) {
      updateData.completion_percentage = completion_percentage
    } else {
      // 자동 계산
      updateData.completion_percentage = Math.min((progress_value / challenge.target_value) * 100, 100)
    }

    // is_completed가 제공된 경우 사용
    if (is_completed !== undefined) {
      updateData.is_completed = is_completed
      if (is_completed) {
        updateData.completed_at = new Date().toISOString()
      }
    } else {
      // 자동 계산
      const autoCompleted = progress_value >= challenge.target_value
      updateData.is_completed = autoCompleted
      if (autoCompleted) {
        updateData.completed_at = new Date().toISOString()
      }
    }

    const { data: updatedChallenge, error: updateError } = await supabase
      .from('personal_challenge')
      .update(updateData)
      .eq('id', challenge_id)
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
