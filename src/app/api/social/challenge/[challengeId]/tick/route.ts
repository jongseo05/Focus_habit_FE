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
    const { scores, rankings } = body

    // 필수 필드 검증
    if (!scores || !rankings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 대결 윈도우 존재 및 활성 상태 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select('state, room_id')
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (challenge.state !== 'active') {
      return NextResponse.json({ error: 'Challenge is not active' }, { status: 400 })
    }

    // 참가자 권한 확인
    const { data: participant, error: participantError } = await supabase
      .from('challenge_participant')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Not a participant in this challenge' }, { status: 403 })
    }

    // 실시간 점수 스냅샷 저장
    const { data: tick, error: tickError } = await supabase
      .from('challenge_tick')
      .insert({
        challenge_id: challengeId,
        scores,
        rankings,
        ts: new Date().toISOString()
      })
      .select()
      .single()

    if (tickError) {
      console.error('Tick creation error:', tickError)
      return NextResponse.json({ error: 'Failed to create tick' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      tick,
      message: 'Tick created successfully' 
    })

  } catch (error) {
    console.error('Tick creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // 대결 윈도우 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select('room_id')
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // 참가자 권한 확인
    const { data: participant, error: participantError } = await supabase
      .from('challenge_participant')
      .select('user_id')
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Not a participant in this challenge' }, { status: 403 })
    }

    // 최근 점수 스냅샷 조회
    const { data: ticks, error: ticksError } = await supabase
      .from('challenge_tick')
      .select('*')
      .eq('challenge_id', challengeId)
      .order('ts', { ascending: false })
      .limit(limit)

    if (ticksError) {
      console.error('Ticks fetch error:', ticksError)
      return NextResponse.json({ error: 'Failed to fetch ticks' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      ticks 
    })

  } catch (error) {
    console.error('Ticks fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

