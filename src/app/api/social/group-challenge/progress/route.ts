import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 챌린지 진행 상황 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id, progress_value } = body

    if (!challenge_id || typeof progress_value !== 'number') {
      return NextResponse.json({ error: 'Challenge ID and progress value are required' }, { status: 400 })
    }

    // 챌린지 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenges')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('is_active', true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found or inactive' }, { status: 404 })
    }

    // 참가자 확인
    const { data: participant, error: participantError } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Not a participant of this challenge' }, { status: 403 })
    }

    // 진행 상황 업데이트
    const newProgress = Math.max(0, participant.current_progress + progress_value)
    
    const { data: updatedParticipant, error: updateError } = await supabase
      .from('challenge_participants')
      .update({
        current_progress: newProgress
      })
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('진행 상황 업데이트 실패:', updateError)
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }

    // 그룹 전체 진행 상황 계산
    const { data: allParticipants, error: participantsError } = await supabase
      .from('challenge_participants')
      .select('current_progress')
      .eq('challenge_id', challenge_id)

    if (!participantsError && allParticipants) {
      const totalProgress = allParticipants.reduce((sum, p) => sum + p.current_progress, 0)
      const averageProgress = totalProgress / allParticipants.length

      return NextResponse.json({ 
        success: true, 
        participant: updatedParticipant,
        group_progress: {
          total: totalProgress,
          average: averageProgress,
          participants_count: allParticipants.length,
          goal_value: challenge.goal_value,
          progress_percentage: Math.min(100, (totalProgress / challenge.goal_value) * 100)
        }
      })
    }

    return NextResponse.json({ 
      success: true, 
      participant: updatedParticipant 
    })

  } catch (error) {
    console.error('진행 상황 업데이트 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
