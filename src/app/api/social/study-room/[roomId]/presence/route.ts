// =====================================================
// 스터디룸 실시간 입장/퇴장 상태 관리 API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'

// POST: 스터디룸 입장 (실시간 상태 업데이트)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // 스터디룸 참가자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('participant_id, is_present')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (participantError) {
      console.error('참가자 확인 오류:', participantError)
      return createSimpleErrorResponse('참가자 확인 중 오류가 발생했습니다.', 500)
    }

    if (!participant) {
      return createSimpleErrorResponse('해당 스터디룸에 참가하고 있지 않습니다.', 403)
    }

    // 이미 입장 상태인 경우 중복 처리 방지
    if (participant.is_present) {
      return createSimpleSuccessResponse({ is_present: true }, '이미 스터디룸에 입장해 있습니다.')
    }

    // 스터디룸 입장 상태 업데이트
    const { error: updateError } = await supabase
      .from('room_participants')
      .update({
        is_present: true,
        presence_updated_at: new Date().toISOString(),
        last_activity: new Date().toISOString() // 활동 시간도 업데이트
      })
      .eq('participant_id', participant.participant_id)

    if (updateError) {
      console.error('입장 상태 업데이트 실패:', updateError)
      return createSimpleErrorResponse('입장 상태 업데이트에 실패했습니다.', 500)
    }

    // 실시간 이벤트 브로드캐스트
    supabase
      .channel(`social_room:${roomId}`)
      .send({
        type: 'broadcast',
        event: 'participant_entered',
        payload: {
          room_id: roomId,
          user_id: user.id,
          user_name: user.user_metadata?.name || '사용자',
          timestamp: new Date().toISOString()
        }
      })
      .catch(error => {
        console.error('실시간 이벤트 브로드캐스트 실패:', error)
      })

    return createSimpleSuccessResponse({ is_present: true }, '스터디룸에 입장했습니다.')
  } catch (error) {
    return handleAPIError(error, '스터디룸 입장')
  }
}

// DELETE: 스터디룸 퇴장 (실시간 상태 업데이트)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // 스터디룸 참가자인지 확인
    const { data: participant, error: participantError } = await supabase
      .from('room_participants')
      .select('participant_id, is_present')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle()

    if (participantError) {
      console.error('참가자 확인 오류:', participantError)
      return createSimpleErrorResponse('참가자 확인 중 오류가 발생했습니다.', 500)
    }

    if (!participant) {
      return createSimpleErrorResponse('해당 스터디룸에 참가하고 있지 않습니다.', 403)
    }

    // 이미 퇴장 상태인 경우 중복 처리 방지
    if (!participant.is_present) {
      return createSimpleSuccessResponse({ is_present: false }, '이미 스터디룸에서 퇴장해 있습니다.')
    }

    // 스터디룸 퇴장 상태 업데이트
    const { error: updateError } = await supabase
      .from('room_participants')
      .update({
        is_present: false,
        presence_updated_at: new Date().toISOString()
      })
      .eq('participant_id', participant.participant_id)

    if (updateError) {
      console.error('퇴장 상태 업데이트 실패:', updateError)
      return createSimpleErrorResponse('퇴장 상태 업데이트에 실패했습니다.', 500)
    }

    // 실시간 이벤트 브로드캐스트
    supabase
      .channel(`social_room:${roomId}`)
      .send({
        type: 'broadcast',
        event: 'participant_left',
        payload: {
          room_id: roomId,
          user_id: user.id,
          user_name: user.user_metadata?.name || '사용자',
          timestamp: new Date().toISOString()
        }
      })
      .catch(error => {
        console.error('실시간 이벤트 브로드캐스트 실패:', error)
      })

    return createSimpleSuccessResponse({ is_present: false }, '스터디룸에서 퇴장했습니다.')
  } catch (error) {
    return handleAPIError(error, '스터디룸 퇴장')
  }
}

// GET: 현재 룸 내 실시간 참가자 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // 현재 룸에 실제로 있는 참가자들 조회
    const { data: presentParticipants, error } = await supabase
      .from('room_participants')
      .select(`
        participant_id,
        user_id,
        is_present,
        presence_updated_at,
        last_activity,
        is_connected,
        current_focus_score
      `)
      .eq('room_id', roomId)
      .eq('is_present', true)
      .is('left_at', null)
      .order('presence_updated_at', { ascending: false })

    if (error) {
      console.error('실시간 참가자 조회 실패:', error)
      return createSimpleErrorResponse('실시간 참가자 조회에 실패했습니다.', 500)
    }

    if (!presentParticipants || presentParticipants.length === 0) {
      return createSimpleSuccessResponse({
        participants: [],
        stats: {
          total_present: 0,
          online_and_present: 0,
          can_start_session: false
        }
      }, '현재 룸에 있는 참가자가 없습니다.')
    }

    // 참가자들의 프로필 정보 조회
    const userIds = presentParticipants.map(p => p.user_id)
    let profiles: any[] = []
    
    // 먼저 user_profile 테이블 시도
    const { data: userProfiles, error: userProfileError } = await supabase
      .from('user_profile')
      .select(`
        user_id,
        display_name,
        avatar_url
      `)
      .in('user_id', userIds)

    if (!userProfileError && userProfiles) {
      profiles = userProfiles
    } else {
      // user_profile 실패 시 profiles 테이블 시도
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          display_name,
          avatar_url
        `)
        .in('user_id', userIds)
      
      if (!profilesError && profilesData) {
        profiles = profilesData
      } else {
        console.error('프로필 조회 실패 (user_profile):', userProfileError)
        console.error('프로필 조회 실패 (profiles):', profilesError)
        // 프로필 조회 실패해도 기본 정보로 진행
      }
    }

    // 온라인 상태도 함께 계산하고 프로필 정보 병합
    const now = Date.now()
    const onlineThreshold = 30000 // 30초

    const participantsWithStatus = presentParticipants?.map(participant => {
      const lastActivity = new Date(participant.last_activity).getTime()
      const isOnline = (now - lastActivity) <= onlineThreshold
      
      // 프로필 정보 찾기
      const profile = profiles.find(p => p.user_id === participant.user_id)

      return {
        ...participant,
        is_online: isOnline,
        is_online_and_present: isOnline && participant.is_present,
        user: {
          name: profile?.display_name || '사용자',
          avatar_url: profile?.avatar_url || null
        }
      }
    }) || []

    const stats = {
      total_present: participantsWithStatus.length,
      online_and_present: participantsWithStatus.filter(p => p.is_online_and_present).length,
      can_start_session: participantsWithStatus.filter(p => p.is_online_and_present).length >= 1
    }

    return createSimpleSuccessResponse({
      participants: participantsWithStatus,
      stats
    }, '실시간 참가자 조회 성공')
  } catch (error) {
    return handleAPIError(error, '실시간 참가자 조회')
  }
}
