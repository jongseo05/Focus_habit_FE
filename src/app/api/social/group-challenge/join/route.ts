import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 챌린지 참가
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id } = body

    if (!challenge_id) {
      return NextResponse.json({ error: 'Challenge ID is required' }, { status: 400 })
    }

    // 챌린지 존재 및 활성 상태 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenges')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('is_active', true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found or inactive' }, { status: 404 })
    }

    // 이미 참가했는지 확인
    const { data: existingParticipant, error: checkError } = await supabase
      .from('challenge_participants')
      .select('participant_id')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (existingParticipant) {
      return NextResponse.json({ error: 'Already joined this challenge' }, { status: 400 })
    }

    // 챌린지 참가
    const { data: participant, error: joinError } = await supabase
      .from('challenge_participants')
      .insert({
        challenge_id,
        user_id: user.id,
        current_progress: 0
      })
      .select()
      .single()

    if (joinError) {
      console.error('챌린지 참가 실패:', joinError)
      return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      participant 
    })

  } catch (error) {
    console.error('챌린지 참가 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
