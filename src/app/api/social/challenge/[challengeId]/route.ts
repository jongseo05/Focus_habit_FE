import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function PATCH(
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
    console.log('PATCH 요청 받음 - challengeId:', challengeId, '타입:', typeof challengeId)
    const body = await request.json()
    const { state, end_at } = body

    // 상태 검증
    if (state && !['pending', 'active', 'ended'].includes(state)) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    // 대결 윈도우 존재 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select('*, study_rooms(host_id)')
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // 호스트 권한 확인 (상태 변경은 호스트만 가능)
    if (challenge.study_rooms.host_id !== user.id) {
      return NextResponse.json({ error: 'Only room host can update challenge state' }, { status: 403 })
    }

    // 상태 업데이트
    const updateData: any = {}
    if (state) updateData.state = state
    if (end_at) updateData.end_at = end_at
    updateData.updated_at = new Date().toISOString()

    const { data: updatedChallenge, error: updateError } = await supabase
      .from('challenge')
      .update(updateData)
      .eq('challenge_id', challengeId)
      .select()
      .single()

    if (updateError) {
      console.error('Challenge update error:', updateError)
      return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 })
    }

    // 대결이 종료되면 최종 점수 계산
    if (state === 'ended') {
      const { error: scoreError } = await supabase.rpc('calculate_final_scores', {
        challenge_uuid: challengeId
      })
      
      if (scoreError) {
        console.error('Score calculation error:', scoreError)
        // 점수 계산 실패는 경고만 하고 계속 진행
      }
    }

    return NextResponse.json({ 
      success: true, 
      challenge: updatedChallenge,
      message: 'Challenge updated successfully' 
    })

  } catch (error) {
    console.error('Challenge update error:', error)
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

    // 대결 윈도우 상세 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .select(`
        *,
        challenge_participant (
          user_id,
          final_score,
          joined_at,
          left_at
        ),
        study_rooms (
          room_id,
          name,
          host_id
        )
      `)
      .eq('challenge_id', challengeId)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    // 참가자 정보 조회
    const { data: participants, error: participantsError } = await supabase
      .from('challenge_participant')
      .select(`
        user_id,
        final_score,
        joined_at,
        left_at,
        profiles:user_id (
          name,
          avatar_url
        )
      `)
      .eq('challenge_id', challengeId)

    if (participantsError) {
      console.error('Participants fetch error:', participantsError)
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      challenge,
      participants 
    })

  } catch (error) {
    console.error('Challenge fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

