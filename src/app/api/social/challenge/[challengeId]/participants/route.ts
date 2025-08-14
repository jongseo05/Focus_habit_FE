import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
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

    // 챌린지 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select('room_id')
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // 참가자 목록 조회
    const { data: participants, error: participantsError } = await supabase
      .from('challenge_participant')
      .select(`
        participant_id,
        user_id,
        joined_at,
        left_at,
        current_score,
        final_score,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
      .eq('challenge_id', challengeId)
      .order('joined_at', { ascending: true })

    if (participantsError) {
      console.error('Participants fetch error:', participantsError)
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      participants: participants || [] 
    })

  } catch (error) {
    console.error('Participants fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
