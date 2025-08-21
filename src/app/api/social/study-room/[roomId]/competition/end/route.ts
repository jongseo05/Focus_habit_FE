import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api/standardResponse'

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

    // 🔍 현재 활성 경쟁 조회 (새로고침 후에도 안정적으로)
    const { data: competitions, error: competitionError } = await supabase
      .from('focus_competitions')
      .select('competition_id, host_id, started_at, duration_minutes, ended_at, is_active')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('started_at', { ascending: false }) // 최신 경쟁 우선

    if (competitionError) {
      console.error('❌ 경쟁 조회 오류:', competitionError)
      return createErrorResponse('Failed to query competition', 500)
    }

    // 경쟁이 없으면 종료 불가
    if (!competitions || competitions.length === 0) {
      return createErrorResponse('No active competition found', 404)
    }

    const competition = competitions[0]

    // 방장 권한 확인
    if (competition.host_id !== user.id) {
      return createErrorResponse('Only host can end competition', 403)
    }

    const now = new Date()

    // 모든 참가자 목록
    const { data: participants } = await supabase
      .from('competition_participants')
      .select('user_id, competition_id')
      .eq('competition_id', competition.competition_id)

    const endedSessions: any[] = []

    if (participants && participants.length > 0) {
      // 활성 세션 일괄 조회
      const userIds = participants.map(p => p.user_id)
      const { data: activeSessions } = await supabase
        .from('focus_session')
        .select('session_id, user_id, started_at, focus_score')
        .in('user_id', userIds)
        .eq('room_id', roomId)
        .is('ended_at', null)

      // 세션 종료 & 참가자 점수 업데이트 처리
      if (activeSessions && activeSessions.length > 0) {
        for (const session of activeSessions) {
          // 세션 종료
          await supabase
            .from('focus_session')
            .update({ ended_at: now.toISOString(), updated_at: now.toISOString() })
            .eq('session_id', session.session_id)

          const finalScore = session.focus_score || 0

          // 참가자 점수 업데이트
          await supabase
            .from('competition_participants')
            .update({
              total_focus_score: finalScore,
              average_focus_score: finalScore,
              focus_time_minutes: session.started_at ? Math.round((now.getTime() - new Date(session.started_at).getTime()) / 60000) : 0
            })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', session.user_id)

          endedSessions.push({
            session_id: session.session_id,
            user_id: session.user_id,
            final_focus_score: finalScore
          })
        }
      }

      // 순위 계산
      const { data: scored } = await supabase
        .from('competition_participants')
        .select('user_id, total_focus_score')
        .eq('competition_id', competition.competition_id)
        .order('total_focus_score', { ascending: false })

      if (scored && scored.length > 0) {
        for (let i = 0; i < scored.length; i++) {
          await supabase
            .from('competition_participants')
            .update({ rank: i + 1 })
            .eq('competition_id', competition.competition_id)
            .eq('user_id', scored[i].user_id)
        }
        const winner = scored[0]
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
      return createErrorResponse('Failed to end competition', 500)
    }

    // 🚀 경쟁 종료 후 참가자 활동 시간 업데이트 (재경쟁 시작을 위해)
    if (participants && participants.length > 0) {
      const userIds = participants.map(p => p.user_id)
      await supabase
        .from('room_participants')
        .update({ 
          last_activity: now.toISOString(),
          // is_connected는 유지 (경쟁 종료해도 연결 상태 유지)
        })
        .in('user_id', userIds)
        .eq('room_id', roomId)
        .is('left_at', null)
      
      console.log('🔄 경쟁 종료 후 참가자 활동 시간 업데이트 완료:', userIds.length, '명')
    }

    // 🔄 실시간 경쟁 종료 브로드캐스트 (중복 방지 + 순서 보장)
    const broadcastPayload = {
      competition_id: competition.competition_id,
      ended_at: now.toISOString(),
      sessions: endedSessions,
      sequence_id: Date.now(), // 이벤트 순서 식별용
      room_id: roomId
    }

    // 병렬 브로드캐스트로 성능 향상, 하지만 실패 시 fallback 제공
    const broadcastPromises = [
      supabase
        .channel(`social_room:${roomId}`)
        .send({
          type: 'broadcast',
          event: 'competition_ended',
          payload: broadcastPayload
        }),
      // 호환성: 기존 경쟁 시작 채널에도 종료 이벤트 송신
      supabase
        .channel(`room-participants-${roomId}`)
        .send({
          type: 'broadcast',
          event: 'competition_ended',
          payload: broadcastPayload
        })
    ]

    try {
      const results = await Promise.allSettled(broadcastPromises)
      
      let successCount = 0
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          console.error(`브로드캐스트 실패 (채널 ${index}):`, result.reason)
        }
      })
      
      console.log(`📡 경쟁 종료 브로드캐스트 완료: ${successCount}/${results.length} 채널 성공`)
      
      // 최소 1개 채널이라도 성공해야 함
      if (successCount === 0) {
        console.error('❌ 모든 브로드캐스트 채널 실패 - 클라이언트에서 polling으로 상태 확인 필요')
      }
    } catch (e) {
      console.error('❌ competition_ended broadcast failed:', e)
    }

    return createSuccessResponse({
      competition_id: competition.competition_id,
      ended_at: now.toISOString(),
      ended_sessions: endedSessions
    }, 'Competition ended successfully')

  } catch (error) {
    console.error('End competition error:', error)
    return createErrorResponse('Internal server error', 500)
  }
}