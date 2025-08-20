import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

interface StartCompetitionRequest {
  duration: number
  break_duration?: number
}

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

    const body = await request.json()
    const { duration, break_duration = 0 }: StartCompetitionRequest = body
    
    // 입력 검증
    if (!duration || duration < 5 || duration > 480) {
      return NextResponse.json({ error: 'Duration must be between 5 and 480 minutes' }, { status: 400 })
    }
    
    if (break_duration < 0 || break_duration > 60) {
      return NextResponse.json({ error: 'Break duration must be between 0 and 60 minutes' }, { status: 400 })
    }
    
    const { roomId } = await params

    // 스터디룸 존재 및 권한 확인
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('room_id, host_id')
      .eq('room_id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Study room not found' }, { status: 404 })
    }

    // 방장 권한 확인
    if (room.host_id !== user.id) {
      return NextResponse.json({ error: 'Only room host can start competitions' }, { status: 403 })
    }

    // 기존 활성 경쟁 확인
    const { data: existingCompetitions, error: existingCompError } = await supabase
      .from('focus_competitions')
      .select('competition_id')
      .eq('room_id', roomId)
      .eq('is_active', true)

    if (existingCompError) {
      console.error('Competition check error:', existingCompError)
      return NextResponse.json({ error: 'Failed to check existing competitions' }, { status: 500 })
    }

    // 이미 활성화된 경쟁이 있다면 해당 경쟁 정보 반환
    if (existingCompetitions && existingCompetitions.length > 0) {
      const existingCompetition = existingCompetitions[0]
      
      // 기존 경쟁의 상세 정보 조회
      const { data: competitionDetails, error: detailsError } = await supabase
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
        .eq('competition_id', existingCompetition.competition_id)

      if (detailsError || !competitionDetails || competitionDetails.length === 0) {
        console.error('Competition details error:', detailsError)
        return NextResponse.json({ error: 'Failed to get competition details' }, { status: 500 })
      }

      const competition = competitionDetails[0]
      return NextResponse.json({
        message: 'Competition already active',
        competition: competition,
        isExisting: true
      })
    }

    // 현재 온라인이면서 룸에 실제로 있는 참가자들 조회 (presence 확인)
    const { data: roomParticipants, error: participantsError } = await supabase
      .from('room_participants')
      .select(`
        user_id,
        is_present,
        is_connected,
        last_activity
      `)
      .eq('room_id', roomId)
      .eq('is_present', true)  // 실제 룸에 있는지 확인
      .eq('is_connected', true)  // 연결 상태 확인
      .is('left_at', null)

    if (participantsError) {
      console.error('📋 참가자 조회 실패:', participantsError)
      return NextResponse.json({ error: 'Failed to get participants' }, { status: 500 })
    }

    if (!roomParticipants || roomParticipants.length === 0) {
      return NextResponse.json({ error: 'No participants found' }, { status: 400 })
    }

    console.log('👥 전체 룸 참가자:', roomParticipants.length, '명')

    // 📡 진짜 온라인 상태 필터링 (최근 30초 내 활동한 사용자만)
    const ONLINE_THRESHOLD = 30 * 1000 // 30초
    const currentTime = new Date()
    
    const realOnlineParticipants = roomParticipants.filter(participant => {
      if (!participant.last_activity) return false
      
      const lastActivity = new Date(participant.last_activity)
      const timeDiff = currentTime.getTime() - lastActivity.getTime()
      const isReallyOnline = timeDiff <= ONLINE_THRESHOLD
      
      console.log(`👤 사용자 ${participant.user_id} 온라인 검증:`, {
        last_activity: participant.last_activity,
        timeDiff_seconds: Math.round(timeDiff / 1000),
        threshold_seconds: ONLINE_THRESHOLD / 1000,
        isReallyOnline: isReallyOnline
      })
      
      return isReallyOnline
    })

    console.log('🟢 실제 온라인 참가자:', realOnlineParticipants.length, '명')

    // 참가자들의 프로필 정보 조회
    const userIds = realOnlineParticipants.map(p => p.user_id)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        avatar_url
      `)
      .in('user_id', userIds)

    if (profilesError) {
      console.error('프로필 조회 실패:', profilesError)
      return NextResponse.json({ error: 'Failed to get profiles' }, { status: 500 })
    }

    // 참가자와 프로필 정보 병합
    const onlineParticipants = realOnlineParticipants.map(participant => {
      const profile = profiles?.find(p => p.user_id === participant.user_id)
      return {
        user_id: participant.user_id,
        profiles: profile ? {
          user_id: profile.user_id,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url
        } : null
      }
    })

    // 최소 참가자 수 확인 (테스트용: 1명 이상)
    if (!onlineParticipants || onlineParticipants.length < 1) {
      return NextResponse.json({ error: 'At least 1 online participant required' }, { status: 400 })
    }

    const now = new Date()
    const endTime = new Date(now.getTime() + duration * 60 * 1000)

    // 방장 권한 확인을 위해 study_rooms에서 host_id 확인
    // 나중에 focus_competitions 테이블에 host_id 컬럼을 추가하는 것을 고려
    
    // 트랜잭션으로 경쟁 생성 및 참가자 등록
    const { data: competition, error: competitionError } = await supabase
      .from('focus_competitions')
      .insert({
        room_id: roomId,
        host_id: room.host_id, // study_rooms의 host_id를 복사
        name: '집중도 대결',
        duration_minutes: duration,
        started_at: now.toISOString(),
        ended_at: endTime.toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (competitionError || !competition) {
      return NextResponse.json({ error: 'Failed to create competition' }, { status: 500 })
    }

    // 경쟁 참가자 등록
    const competitionParticipants = onlineParticipants.map((participant: any) => ({
      competition_id: competition.competition_id,
      user_id: participant.user_id,
      total_focus_score: 0,
      average_focus_score: 0,
      focus_time_minutes: 0,
      joined_at: now.toISOString()
    }))

    const { error: participantInsertError } = await supabase
      .from('competition_participants')
      .insert(competitionParticipants)

    if (participantInsertError) {
      // 경쟁 생성 롤백
      await supabase
        .from('focus_competitions')
        .delete()
        .eq('competition_id', competition.competition_id)
      
      return NextResponse.json({ error: 'Failed to add participants' }, { status: 500 })
    }

    // 🔥 실시간 알림을 통해 각 참가자가 자신의 세션을 시작하도록 안내
    if (onlineParticipants.length > 0) {
      console.log(`🎯 ${onlineParticipants.length}명의 온라인 참가자에게 세션 시작 알림 전송 중...`)
      console.log('📋 온라인 참가자 목록:', onlineParticipants.map(p => ({
        user_id: p.user_id,
        display_name: p.profiles?.display_name || 'Unknown'
      })))
      
      // Supabase Realtime을 통해 모든 참가자에게 경쟁 시작 알림 전송
      try {
        const channelName = `room-participants-${roomId}`
        const payload = {
          competition_id: competition.competition_id,
          duration: duration,
          started_at: now.toISOString(),
          title: '집중도 대결',
          message: '집중도 대결이 시작되었습니다! 세션이 자동으로 시작됩니다.'
        }
        
        console.log('📡 실시간 알림 전송 시도:')
        console.log('  - 채널:', channelName)
        console.log('  - 이벤트: competition_started')
        console.log('  - 페이로드:', payload)
        
        const sendResult = await supabase
          .channel(channelName)
          .send({
            type: 'broadcast',
            event: 'competition_started',
            payload: payload
          })

        console.log('📡 실시간 알림 전송 결과:', sendResult)
        console.log(`✅ ${onlineParticipants.length}명에게 경쟁 시작 알림 전송 완료`)
      } catch (error) {
        console.error('❌ 경쟁 시작 알림 전송 실패:', error)
      }
    }

    // WebSocket을 통해 룸 참가자들에게 알림 (나중에 구현)
    // await notifyRoomParticipants(roomId, 'competition_started', competition)

    return NextResponse.json({
      success: true,
      competition: {
        id: competition.competition_id,
        room_id: roomId,
        duration: duration,
        break_duration: break_duration,
        started_at: competition.started_at,
        ended_at: competition.ended_at,
        participants: onlineParticipants.length
      }
    })

  } catch (error) {
    console.error('Start competition error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
