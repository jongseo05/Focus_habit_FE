import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ challengeId: string }> }
) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { challengeId } = await params
    const body = await request.json()
    const { user_id } = body

    // 사용자 ID 검증
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 })
    }

    // 챌린지 존재 및 상태 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select('state, room_id')
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (challenge.state !== 'pending' && challenge.state !== 'active') {
      return NextResponse.json({ error: 'Challenge is not accepting participants' }, { status: 400 })
    }

    // 이미 참가했는지 확인
    const { data: existingParticipant, error: checkError } = await supabase
      .from('challenge_participant')
      .select('participant_id')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .single()

    if (existingParticipant) {
      return NextResponse.json({ error: 'Already joined this challenge' }, { status: 400 })
    }

    // 챌린지 참가
    const { data: participant, error: joinError } = await supabase
      .from('challenge_participant')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
        current_score: 0,
        final_score: 0
      })
      .select()
      .single()

    if (joinError) {
      console.error('Challenge join error:', joinError)
      return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      participant,
      message: 'Successfully joined challenge' 
    })

  } catch (error) {
    console.error('Challenge join error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
