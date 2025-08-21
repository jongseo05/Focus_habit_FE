import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { filterOnlineParticipants, logParticipantOnlineStatus } from '@/lib/utils/onlineStatus'

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

    // 🔒 기존 활성 경쟁 확인 (트랜잭션으로 동시성 문제 방지)
    const { data: existingCompetitions, error: existingCompError } = await supabase
      .from('focus_competitions')
      .select('competition_id, started_at, duration_minutes, host_id')
      .eq('room_id', roomId)
      .eq('is_active', true)

    if (existingCompError) {
      console.error('❌ 경쟁 확인 오류:', existingCompError)
      return NextResponse.json({ 
        error: '기존 경쟁 확인에 실패했습니다.',
        details: existingCompError.message 
      }, { status: 500 })
    }

    // 이미 활성화된 경쟁이 있다면 중복 시작 방지 + Race Condition 대응
    if (existingCompetitions && existingCompetitions.length > 0) {
      const existingCompetition = existingCompetitions[0]
      
      // 경쟁 종료 시간 계산
      const startedAt = new Date(existingCompetition.started_at)
      const endTime = new Date(startedAt.getTime() + existingCompetition.duration_minutes * 60 * 1000)
      const now = new Date()
      
      // 경쟁이 아직 유효한지 확인
      if (now < endTime) {
        const timeLeft = Math.ceil((endTime.getTime() - now.getTime()) / 1000 / 60) // 분 단위
        
        console.log('⚠️ 중복 경쟁 시작 시도 방지:', {
          existingCompetitionId: existingCompetition.competition_id,
          timeLeftMinutes: timeLeft,
          hostId: existingCompetition.host_id
        })
        
        return NextResponse.json({
          error: '이미 진행 중인 경쟁이 있습니다.',
          message: `현재 경쟁이 진행 중입니다. (남은 시간: 약 ${timeLeft}분)`,
          competition: existingCompetition,
          isExisting: true,
          timeLeft: timeLeft
        }, { status: 409 }) // 409 Conflict
      } else {
        // ⏱️ 만료된 경쟁 정리 + 타이밍 안전성 확보
        console.log('🔄 만료된 경쟁 자동 비활성화:', existingCompetition.competition_id)
        
        // 트랜잭션으로 안전하게 처리
        let cleanupError = null
        try {
          // RPC 함수 시도
          const rpcResult = await supabase.rpc('cleanup_expired_competition', {
            competition_id: existingCompetition.competition_id,
            room_id: roomId
          })
          cleanupError = rpcResult.error
        } catch (rpcError) {
          // RPC 함수가 없으면 수동으로 정리
          console.log('🔄 RPC 함수 없음, 수동 정리로 fallback')
          const manualResult = await supabase
            .from('focus_competitions')
            .update({ 
              is_active: false,
              ended_at: now.toISOString()
            })
            .eq('competition_id', existingCompetition.competition_id)
          cleanupError = manualResult.error
        }
        
        if (cleanupError) {
          console.error('❌ 만료된 경쟁 정리 실패:', cleanupError)
        }
        
        // 🛡️ 정리 후 잠시 대기 (Race Condition 방지)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // 현재 온라인이면서 룸에 실제로 있는 참가자들 조회 (presence 확인)
    const { data: roomParticipants, error: participantsError } = await supabase
      .from('room_participants')
      .select(`
        user_id,
        is_present,
        is_connected,
        last_activity,
        left_at
      `)
      .eq('room_id', roomId)
      .eq('is_present', true)  // 실제 룸에 있는지 확인
      // is_connected 조건 제거 - 경쟁 종료 후 일시적 연결 해제 문제 해결
      .is('left_at', null)

    if (participantsError) {
      console.error('📋 참가자 조회 실패:', participantsError)
      return NextResponse.json({ error: 'Failed to get participants' }, { status: 500 })
    }

    if (!roomParticipants || roomParticipants.length === 0) {
      return NextResponse.json({ error: 'No participants found' }, { status: 400 })
    }

    console.log('👥 전체 룸 참가자:', roomParticipants.length, '명')

    // 📡 온라인 상태 필터링 (표준 1분 기준 - 공통 유틸리티 사용)
    const realOnlineParticipants = filterOnlineParticipants(roomParticipants)
    
    // 로깅
    roomParticipants.forEach(participant => {
      logParticipantOnlineStatus(participant)
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
    
    // 🚀 트랜잭션으로 경쟁 생성 및 참가자 등록 (원자적 처리)
    const { data: competition, error: competitionError } = await supabase
      .from('focus_competitions')
      .insert({
        room_id: roomId,
        host_id: room.host_id, // 실제 스키마에 host_id 컬럼 존재
        name: '집중도 대결',
        duration_minutes: duration,
        started_at: now.toISOString(),
        ended_at: endTime.toISOString(),
        is_active: true
      })
      .select()
      .single()

    if (competitionError) {
      console.error('❌ 경쟁 생성 실패:', competitionError)
      console.error('❌ 상세 오류 정보:', {
        code: competitionError.code,
        message: competitionError.message,
        details: competitionError.details,
        hint: competitionError.hint
      })
      
      // 구체적인 오류 메시지 제공
      let errorMessage = '경쟁 생성에 실패했습니다.'
      if (competitionError.code === '23505') {
        errorMessage = '이미 동일한 경쟁이 진행 중입니다.'
      } else if (competitionError.code === '23503') {
        errorMessage = '스터디룸 정보가 유효하지 않습니다.'
      } else if (competitionError.code === '42703') {
        errorMessage = '데이터베이스 컬럼 오류입니다. 관리자에게 문의하세요.'
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: competitionError.message,
        code: competitionError.code,
        hint: competitionError.hint
      }, { status: 500 })
    }

    if (!competition) {
      return NextResponse.json({ 
        error: '경쟁 생성에 실패했습니다.',
        details: '생성된 경쟁 데이터가 없습니다.' 
      }, { status: 500 })
    }

    // 🧹 이전 경쟁 잔여 데이터 정리 (새 경쟁 시작 전)
    const participantUserIds = onlineParticipants.map((participant: any) => participant.user_id)
    
    // 이전 competition_participants에서 해당 사용자들의 미완료 데이터 정리
    const { error: participantCleanupError } = await supabase
      .from('competition_participants')
      .delete()
      .in('user_id', participantUserIds)
      .neq('competition_id', competition.competition_id) // 현재 경쟁 제외
      .is('ended_at', null) // 종료되지 않은 이전 경쟁만
    
    if (participantCleanupError) {
      console.warn('⚠️ 이전 경쟁 데이터 정리 실패:', participantCleanupError)
    } else {
      console.log('🧹 이전 경쟁 잔여 데이터 정리 완료')
    }

    // 경쟁 참가자 등록 (실제 DB 스키마에 맞춤)
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
      console.error('❌ 경쟁 참가자 등록 실패:', participantInsertError)
      
      // 🔄 경쟁 생성 롤백 (원자적 처리)
      try {
        await supabase
          .from('focus_competitions')
          .delete()
          .eq('competition_id', competition.competition_id)
        console.log('✅ 경쟁 데이터 롤백 완료')
      } catch (rollbackError) {
        console.error('❌ 경쟁 데이터 롤백 실패:', rollbackError)
      }
      
      return NextResponse.json({ 
        error: '참가자 등록에 실패했습니다.',
        details: participantInsertError.message,
        action: 'competition_rolled_back'
      }, { status: 500 })
    }

    // 🔥 실시간 알림을 통해 각 참가자가 자신의 세션을 시작하도록 안내
    if (onlineParticipants.length > 0) {
      console.log(`🎯 ${onlineParticipants.length}명의 온라인 참가자에게 세션 시작 알림 전송 중...`)
      console.log('📋 온라인 참가자 목록:', onlineParticipants.map(p => ({
        user_id: p.user_id,
        display_name: p.profiles?.display_name || 'Unknown'
      })))
      
      // 🔔 Supabase Realtime을 통해 모든 참가자에게 경쟁 시작 알림 전송
      const notificationPromises = []
      
      try {
        const channelName = `room-participants-${roomId}`
        const payload = {
          competition_id: competition.competition_id,
          duration: duration,
          started_at: now.toISOString(),
          name: '집중도 대결',
          message: '집중도 대결이 시작되었습니다! 세션이 자동으로 시작됩니다.',
          participants_count: onlineParticipants.length
        }
        
        console.log('📡 실시간 알림 전송 시도:')
        console.log('  - 채널:', channelName)
        console.log('  - 이벤트: competition_started')
        console.log('  - 참가자 수:', onlineParticipants.length)
        
        // 메인 채널 알림
        notificationPromises.push(
          supabase
            .channel(channelName)
            .send({
              type: 'broadcast',
              event: 'competition_started',
              payload: payload
            })
        )
        
        // 백업 채널 알림 (호환성)
        notificationPromises.push(
          supabase
            .channel(`social_room:${roomId}`)
            .send({
              type: 'broadcast',
              event: 'competition_started',
              payload: payload
            })
        )
        
        // 모든 알림 전송 대기
        const results = await Promise.allSettled(notificationPromises)
        
        let successCount = 0
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successCount++
            console.log(`✅ 채널 ${index + 1} 알림 전송 성공`)
          } else {
            console.error(`❌ 채널 ${index + 1} 알림 전송 실패:`, result.reason)
          }
        })
        
        console.log(`📡 알림 전송 완료: ${successCount}/${results.length} 채널 성공`)
        
      } catch (error) {
        console.error('❌ 경쟁 시작 알림 전송 중 오류:', error)
        // 알림 실패는 치명적이지 않으므로 계속 진행
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
