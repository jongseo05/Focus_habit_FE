import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params

    // 현재 활성 경쟁 조회
    const { data: competition, error: competitionError } = await supabase
      .from('focus_competitions')
      .select('competition_id, host_id')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single()

    if (competitionError || !competition) {
      return NextResponse.json({ error: 'No active competition found' }, { status: 404 })
    }

    // 방장 권한 확인
    if (competition.host_id !== user.id) {
      return NextResponse.json({ error: 'Only host can end competition' }, { status: 403 })
    }

    const now = new Date()

    // 모든 참가자의 현재 세션에서 최종 점수 수집
    const { data: participants } = await supabase
      .from('competition_participants')
      .select('user_id')
      .eq('competition_id', competition.competition_id)

    if (participants) {
      // 각 참가자의 최종 점수를 계산하고 업데이트
      for (const participant of participants) {
        const { data: session } = await supabase
          .from('focus_session')
          .select('focus_score, session_id')
          .eq('user_id', participant.user_id)
          .eq('room_id', roomId)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()

        if (session) {
          // 집중 세션 종료
          await supabase
            .from('focus_session')
            .update({ ended_at: now.toISOString() })
            .eq('session_id', session.session_id)

          // 참가자의 최종 점수 업데이트
          await supabase
            .from('competition_participants')
            .update({ 
              final_score: session.focus_score || 0,
              session_id: session.session_id 
            })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', participant.user_id)
        }
      }

      // 순위 계산 및 업데이트
      const { data: updatedParticipants } = await supabase
        .from('competition_participants')
        .select('user_id, final_score')
        .eq('competition_id', competition.competition_id)
        .order('final_score', { ascending: false })

      if (updatedParticipants) {
        for (let i = 0; i < updatedParticipants.length; i++) {
          await supabase
            .from('competition_participants')
            .update({ rank: i + 1 })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', updatedParticipants[i].user_id)
        }

        // 우승자 설정
        const winner = updatedParticipants[0]
        if (winner) {
          await supabase
            .from('focus_competitions')
            .update({ winner_id: winner.user_id })
            .eq('competition_id', competition.competition_id)
        }
      }
    }

    // 경쟁 종료
    const { error: endError } = await supabase
      .from('focus_competitions')
      .update({ 
        is_active: false,
        ended_at: now.toISOString()
      })
      .eq('competition_id', competition.competition_id)

    if (endError) {
      return NextResponse.json({ error: 'Failed to end competition' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Competition ended successfully',
      ended_at: now.toISOString()
    })

  } catch (error) {
    console.error('End competition error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
