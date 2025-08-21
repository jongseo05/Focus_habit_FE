import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(
  request: Request,
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
    
    // 🛡️ 새로고침 복구 요청인지 확인
    const isRefreshRecovery = request.headers.get('X-Refresh-Recovery') === 'true'
    console.log('🔍 경쟁 상태 조회:', { roomId, isRefreshRecovery })

    // 현재 활성 경쟁 조회
    const { data: competitions, error: competitionError } = await supabase
      .from('focus_competitions')
      .select(`
        competition_id,
        name,
        duration_minutes,
        started_at,
        ended_at,
        is_active,
        host_id
      `)
      .eq('room_id', roomId)
      .eq('is_active', true)

    if (competitionError) {
      console.error('Competition query error:', competitionError)
      return NextResponse.json(
        { error: 'Failed to get competition', details: competitionError.message }, 
        { status: 500 }
      )
    }

    // 🔄 경쟁이 없으면 새로고침 복구 시도 (새로고침 시에만)
    let competition = competitions && competitions.length > 0 ? competitions[0] : null
    
    if (!competition && isRefreshRecovery) {
      console.log('⚠️ 새로고침 복구 모드: 활성 경쟁 없음, 최근 경쟁 확인...')
      
      // 최근 1시간 내 경쟁 확인
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: recentCompetitions } = await supabase
        .from('focus_competitions')
        .select('competition_id, host_id, started_at, duration_minutes, ended_at, is_active, name')
        .eq('room_id', roomId)
        .gte('started_at', oneHourAgo)
        .order('started_at', { ascending: false })
        .limit(1)

      if (recentCompetitions && recentCompetitions.length > 0) {
        const recentCompetition = recentCompetitions[0]
        const startedAt = new Date(recentCompetition.started_at)
        const expectedEndTime = new Date(startedAt.getTime() + recentCompetition.duration_minutes * 60 * 1000)
        const now = new Date()
        
        // 🛡️ 수동 종료된 경쟁은 복구하지 않음 (ended_at 확인)
        const wasManuallyEnded = recentCompetition.ended_at && 
                                new Date(recentCompetition.ended_at) < expectedEndTime
        
        // 아직 종료 시간이 지나지 않았고, 수동 종료가 아닌 경우에만 복구
        if (now <= expectedEndTime && !wasManuallyEnded) {
          console.log('🔄 새로고침 복구: 만료되지 않은 경쟁 발견, 활성화 복구:', recentCompetition.competition_id)
          
          // 경쟁 활성화 복구
          const { error: restoreError } = await supabase
            .from('focus_competitions')
            .update({ is_active: true })
            .eq('competition_id', recentCompetition.competition_id)
          
          if (!restoreError) {
            competition = { 
              ...recentCompetition, 
              is_active: true 
            }
            console.log('✅ 새로고침 복구: 경쟁 상태 복구 성공')
          }
        } else {
          console.log('🚫 새로고침 복구: 수동 종료된 경쟁은 복구하지 않음:', recentCompetition.competition_id, {
            ended_at: recentCompetition.ended_at,
            expected_end: expectedEndTime.toISOString(),
            wasManuallyEnded
          })
        }
      }
    }
    
    if (!competition) {
      return NextResponse.json({
        competition: null,
        participants: [],
        isHost: false
      })
    }

    // 참가자들 조회
    const { data: participants, error: participantsError } = await supabase
      .from('competition_participants')
      .select(`
        user_id,
        total_focus_score,
        average_focus_score,
        focus_time_minutes,
        rank,
        joined_at
      `)
      .eq('competition_id', competition.competition_id)

    if (participantsError) {
      console.error('Participants query error:', participantsError)
      return NextResponse.json({ error: 'Failed to get participants' }, { status: 500 })
    }

    // 참가자들의 프로필 정보 조회
    let profiles: any[] = []
    if (participants && participants.length > 0) {
      const userIds = participants.map(p => p.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          display_name,
          avatar_url
        `)
        .in('user_id', userIds)
      
      if (profilesError) {
        console.error('프로필 조회 실패:', profilesError)
        // 프로필 조회 실패해도 기본 정보로 진행
      } else {
        profiles = profilesData || []
      }
    }

    // 현재 점수를 위해 room_participants에서 실시간 점수 조회
    const { data: roomParticipants, error: roomError } = await supabase
      .from('room_participants')
      .select('user_id, current_focus_score')
      .eq('room_id', roomId)
      .eq('is_connected', true)

    if (roomError) {
      console.error('Room participants error:', roomError)
    }

    // 🔧 참가자들에 현재 점수와 프로필 정보 추가 (구조 통일)
    const participantsWithScore = participants?.map(participant => {
      const roomParticipant = roomParticipants?.find(rp => rp.user_id === participant.user_id)
      const profile = profiles?.find(p => p.user_id === participant.user_id)
      
      return {
        ...participant,
        final_score: participant.total_focus_score || roomParticipant?.current_focus_score || 0,
        user: {
          display_name: profile?.display_name || `사용자-${participant.user_id.slice(-4)}`,
          avatar_url: profile?.avatar_url || null
        }
      }
    }) || []

    // 호스트 여부 확인
    const isHost = competition.host_id === user.id

    return NextResponse.json({
      competition: {
        competition_id: competition.competition_id,
        name: competition.name,
        duration_minutes: competition.duration_minutes,
        started_at: competition.started_at,
        ended_at: competition.ended_at,
        is_active: competition.is_active,
        host_id: competition.host_id
      },
      participants: participantsWithScore.sort((a: any, b: any) => b.current_score - a.current_score),
      isHost
    })

  } catch (error) {
    console.error('Competition API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
