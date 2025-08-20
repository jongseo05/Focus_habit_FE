// =====================================================
// 스터디룸 참가자 목록 API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'

// GET: 스터디룸 참가자 목록 조회
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
    
    // 1. 먼저 참가자 목록 조회 (카메라 상태 포함)
    const { data: roomParticipants, error: participantsError } = await supabase
      .from('room_participants')
      .select(`
        participant_id,
        user_id,
        room_id,
        is_host,
        joined_at,
        left_at,
        current_focus_score,
        is_connected,
        last_activity,
        is_video_enabled,
        is_audio_enabled,
        camera_updated_at
      `)
      .eq('room_id', roomId)
      .is('left_at', null) // 아직 나가지 않은 참가자만
      .order('joined_at', { ascending: true })
    
    if (participantsError) {
      console.error('참가자 목록 조회 실패:', participantsError)
      return createSimpleErrorResponse('참가자 목록 조회에 실패했습니다.', 500)
    }

    if (!roomParticipants || roomParticipants.length === 0) {
      return createSimpleSuccessResponse([], '참가자가 없습니다.')
    }

    // 2. 참가자들의 user_id로 프로필 정보 조회 (user_profile 테이블 시도)
    const userIds = roomParticipants.map(p => p.user_id)
    let profiles: any[] = []
    
    // 먼저 user_profile 테이블 시도
    const { data: userProfiles, error: userProfileError } = await supabase
      .from('user_profile')
      .select(`
        user_id,
        display_name,
        avatar_url,
        status
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
          avatar_url,
          status
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

    // 3. 데이터 병합 및 변환
    const formattedParticipants = roomParticipants.map(p => {
      const profile = profiles?.find(prof => prof.user_id === p.user_id)
      
      return {
        participant_id: p.participant_id,
        user_id: p.user_id,
        room_id: p.room_id,
        is_host: p.is_host || false,
        joined_at: p.joined_at,
        left_at: p.left_at,
        focus_score: p.current_focus_score,
        last_activity: p.last_activity || p.joined_at,
        is_connected: p.is_connected || true,
        // 카메라 상태 추가
        is_video_enabled: p.is_video_enabled || false,
        is_audio_enabled: p.is_audio_enabled || false,
        camera_updated_at: p.camera_updated_at || p.joined_at,
        user: {
          name: profile?.display_name || `사용자-${p.user_id.slice(-4)}`,
          avatar_url: profile?.avatar_url || null
        }
      }
    })
    
    return createSimpleSuccessResponse(
      formattedParticipants, 
      `${formattedParticipants.length}명의 참가자를 조회했습니다.`
    )
  } catch (error) {
    return handleAPIError(error, '참가자 목록 조회')
  }
}