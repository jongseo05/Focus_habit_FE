// =====================================================
// 개선된 소셜 기능 데이터베이스 서비스
// =====================================================

import { BaseService } from './baseService'
import type { APIResponse, UUID } from '@/types/database'
import type {
  StudyRoom,
  RoomParticipant,
  CreateStudyRoomData,
  UserFriend,
  FriendRequest,
  GroupChallenge,
  ChallengeParticipant,
  PersonalChallenge,
  ChallengeInvitation,
  EncouragementMessage,
  UserAchievement
} from '@/types/social'

/**
 * 소셜 기능 관리 서비스
 * BaseService를 확장하여 소셜 관련 모든 작업을 처리합니다.
 */
export class SocialService extends BaseService {
  
  // =====================================================
  // 스터디룸 관리
  // =====================================================

  /**
   * 스터디룸 생성
   */
  static async createStudyRoom(data: CreateStudyRoomData): Promise<APIResponse<StudyRoom>> {
    const validation = this.validateRequiredFields(data, ['host_id', 'name'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    if (!this.isValidUUID(data.host_id)) {
      return this.createErrorResponse('유효하지 않은 호스트 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: room, error } = await client
        .from('study_rooms')
        .insert({
          host_id: data.host_id,
          name: data.name,
          description: data.description,
          max_participants: data.max_participants || 4,
          session_type: data.session_type || 'study',
          goal_minutes: data.goal_minutes || 25
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '스터디룸 생성')
      }

      // 호스트를 참가자로 자동 추가
      await this.joinStudyRoom(room.room_id, data.host_id, true)

      return this.createSuccessResponse(room as StudyRoom, '스터디룸이 성공적으로 생성되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '스터디룸 생성')
    }
  }

  /**
   * 활성 스터디룸 목록 조회
   */
  static async getActiveStudyRooms(limit: number = 20): Promise<APIResponse<StudyRoom[]>> {
    try {
      const client = this.getClient()
      const { limit: validLimit } = this.validatePagination(limit)
      
      const { data: rooms, error } = await client
        .from('study_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(validLimit)

      if (error) {
        return this.handleSupabaseError(error, '스터디룸 목록 조회')
      }

      return this.createSuccessResponse(rooms as StudyRoom[], `${rooms?.length || 0}개의 활성 스터디룸을 조회했습니다.`)
    } catch (error) {
      return this.handleSupabaseError(error, '스터디룸 목록 조회')
    }
  }

  /**
   * 스터디룸 참가
   */
  static async joinStudyRoom(
    roomId: UUID, 
    userId: UUID, 
    isHost: boolean = false
  ): Promise<APIResponse<RoomParticipant>> {
    if (!this.isValidUUID(roomId) || !this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      // 먼저 방이 존재하고 활성 상태인지 확인
      const { data: room, error: roomError } = await client
        .from('study_rooms')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single()

      if (roomError || !room) {
        return this.createErrorResponse('존재하지 않거나 비활성화된 스터디룸입니다.')
      }

      // 이미 참가했는지 확인
      const { data: existingParticipant } = await client
        .from('room_participants')
        .select('participant_id, left_at')
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existingParticipant) {
        // 이미 참가한 사용자인 경우
        if (!existingParticipant.left_at) {
          // 아직 나가지 않은 상태라면 이미 참가 중
          return this.createSuccessResponse(existingParticipant as RoomParticipant, '이미 해당 스터디룸에 참가하고 있습니다.')
        } else {
          // 이전에 나갔다가 다시 참가하는 경우 - left_at을 null로 업데이트
          const { data: rejoinedParticipant, error: rejoinError } = await client
            .from('room_participants')
            .update({ 
              left_at: null,
              is_connected: true,
              last_activity: new Date().toISOString()
            })
            .eq('participant_id', existingParticipant.participant_id)
            .select()
            .single()

          if (rejoinError) {
            return this.handleSupabaseError(rejoinError, '스터디룸 재참가')
          }

          return this.createSuccessResponse(rejoinedParticipant as RoomParticipant, '스터디룸에 다시 참가했습니다.')
        }
      }

      // 참가자 수 확인
      if (room.current_participants >= room.max_participants && !isHost) {
        return this.createErrorResponse('스터디룸이 가득 찼습니다.')
      }

      // 새로운 참가자 추가
      const { data: participant, error } = await client
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: userId,
          is_host: isHost
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '스터디룸 참가')
      }

      return this.createSuccessResponse(participant as RoomParticipant, '스터디룸에 성공적으로 참가했습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '스터디룸 참가')
    }
  }

  /**
   * 스터디룸 나가기
   */
  static async leaveStudyRoom(roomId: UUID, userId: UUID): Promise<APIResponse<boolean>> {
    if (!this.isValidUUID(roomId) || !this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { error } = await client
        .from('room_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)
        .is('left_at', null)

      if (error) {
        return this.handleSupabaseError(error, '스터디룸 나가기')
      }

      return this.createSuccessResponse(true, '스터디룸에서 성공적으로 나갔습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '스터디룸 나가기')
    }
  }

  // =====================================================
  // 친구 관리
  // =====================================================

  /**
   * 친구 요청 보내기
   */
  static async sendFriendRequest(
    requesterId: UUID, 
    requestedId: UUID, 
    message?: string
  ): Promise<APIResponse<FriendRequest>> {
    if (!this.isValidUUID(requesterId) || !this.isValidUUID(requestedId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    if (requesterId === requestedId) {
      return this.createErrorResponse('자기 자신에게 친구 요청을 보낼 수 없습니다.')
    }

    try {
      const client = this.getClient()
      
      // 이미 친구 요청이 있는지 확인
      const { data: existing } = await client
        .from('friend_requests')
        .select('*')
        .or(`and(requester_id.eq.${requesterId},requested_id.eq.${requestedId}),and(requester_id.eq.${requestedId},requested_id.eq.${requesterId})`)
        .eq('status', 'pending')
        .single()

      if (existing) {
        return this.createErrorResponse('이미 대기 중인 친구 요청이 있습니다.')
      }

      // 이미 친구인지 확인
      const { data: friendship } = await client
        .from('user_friends')
        .select('*')
        .or(`and(user_id.eq.${requesterId},friend_id.eq.${requestedId}),and(user_id.eq.${requestedId},friend_id.eq.${requesterId})`)
        .eq('status', 'active')
        .single()

      if (friendship) {
        return this.createErrorResponse('이미 친구 관계입니다.')
      }

      // 친구 요청 생성
      const { data: request, error } = await client
        .from('friend_requests')
        .insert({
          requester_id: requesterId,
          requested_id: requestedId,
          message: message,
          status: 'pending'
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '친구 요청 보내기')
      }

      return this.createSuccessResponse(request as FriendRequest, '친구 요청을 성공적으로 보냈습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '친구 요청 보내기')
    }
  }

  /**
   * 친구 요청 응답 (수락/거절)
   */
  static async respondToFriendRequest(
    requestId: UUID, 
    response: 'accepted' | 'rejected'
  ): Promise<APIResponse<boolean>> {
    if (!this.isValidUUID(requestId)) {
      return this.createErrorResponse('유효하지 않은 요청 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      // 친구 요청 업데이트
      const { data: request, error: updateError } = await client
        .from('friend_requests')
        .update({ 
          status: response,
          updated_at: new Date().toISOString()
        })
        .eq('request_id', requestId)
        .eq('status', 'pending')
        .select()
        .single()

      if (updateError || !request) {
        return this.handleSupabaseError(updateError, '친구 요청 응답')
      }

      // 수락한 경우 친구 관계 생성
      if (response === 'accepted') {
        const friendshipData = [
          {
            user_id: request.requester_id,
            friend_id: request.requested_id,
            status: 'active'
          },
          {
            user_id: request.requested_id,
            friend_id: request.requester_id,
            status: 'active'
          }
        ]

        const { error: friendshipError } = await client
          .from('user_friends')
          .insert(friendshipData)

        if (friendshipError) {
          return this.handleSupabaseError(friendshipError, '친구 관계 생성')
        }
      }

      const message = response === 'accepted' ? '친구 요청을 수락했습니다.' : '친구 요청을 거절했습니다.'
      return this.createSuccessResponse(true, message)
    } catch (error) {
      return this.handleSupabaseError(error, '친구 요청 응답')
    }
  }

  /**
   * 친구 목록 조회
   */
  static async getFriends(userId: UUID): Promise<APIResponse<UserFriend[]>> {
    if (!this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: friends, error } = await client
        .from('user_friends')
        .select(`
          *,
          profiles!user_friends_friend_id_fkey(
            user_id,
            display_name,
            avatar_url,
            status
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        return this.handleSupabaseError(error, '친구 목록 조회')
      }

      return this.createSuccessResponse(friends as UserFriend[], `${friends?.length || 0}명의 친구를 조회했습니다.`)
    } catch (error) {
      return this.handleSupabaseError(error, '친구 목록 조회')
    }
  }

  // =====================================================
  // 그룹 챌린지 관리
  // =====================================================

  /**
   * 그룹 챌린지 생성
   */
  static async createGroupChallenge(data: {
    host_id: UUID
    title: string
    description?: string
    type: string
    target_value: number
    unit: string
    end_date: string
    room_id?: UUID
    max_participants?: number
  }): Promise<APIResponse<GroupChallenge>> {
    const validation = this.validateRequiredFields(data, ['host_id', 'title', 'type', 'target_value', 'unit', 'end_date'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    if (!this.isValidUUID(data.host_id)) {
      return this.createErrorResponse('유효하지 않은 호스트 ID 형식입니다.')
    }

    if (data.room_id && !this.isValidUUID(data.room_id)) {
      return this.createErrorResponse('유효하지 않은 룸 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: challenge, error } = await client
        .from('group_challenges')
        .insert({
          host_id: data.host_id,
          room_id: data.room_id,
          title: data.title,
          description: data.description,
          type: data.type,
          target_value: data.target_value,
          unit: data.unit,
          end_date: data.end_date,
          max_participants: data.max_participants || 10
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '그룹 챌린지 생성')
      }

      // 호스트를 참가자로 자동 추가
      await this.joinGroupChallenge(challenge.challenge_id, data.host_id)

      return this.createSuccessResponse(challenge as GroupChallenge, '그룹 챌린지가 성공적으로 생성되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '그룹 챌린지 생성')
    }
  }

  /**
   * 그룹 챌린지 참가
   */
  static async joinGroupChallenge(challengeId: UUID, userId: UUID): Promise<APIResponse<ChallengeParticipant>> {
    if (!this.isValidUUID(challengeId) || !this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      // 챌린지가 존재하고 활성 상태인지 확인
      const { data: challenge, error: challengeError } = await client
        .from('group_challenges')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('is_active', true)
        .single()

      if (challengeError || !challenge) {
        return this.createErrorResponse('존재하지 않거나 비활성화된 챌린지입니다.')
      }

      // 참가자 수 확인
      if (challenge.current_participants >= challenge.max_participants) {
        return this.createErrorResponse('챌린지 참가자가 가득 찼습니다.')
      }

      // 참가자 추가
      const { data: participant, error } = await client
        .from('challenge_participants')
        .insert({
          challenge_id: challengeId,
          user_id: userId,
          current_progress: 0
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '챌린지 참가')
      }

      return this.createSuccessResponse(participant as ChallengeParticipant, '챌린지에 성공적으로 참가했습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '챌린지 참가')
    }
  }

  /**
   * 챌린지 진행도 업데이트
   */
  static async updateChallengeProgress(
    challengeId: UUID, 
    userId: UUID, 
    progress: number
  ): Promise<APIResponse<ChallengeParticipant>> {
    if (!this.isValidUUID(challengeId) || !this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 ID 형식입니다.')
    }

    if (progress < 0) {
      return this.createErrorResponse('진행도는 0 이상이어야 합니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: participant, error } = await client
        .from('challenge_participants')
        .update({ 
          current_progress: progress,
          is_completed: progress >= 100
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '챌린지 진행도 업데이트')
      }

      return this.createSuccessResponse(participant as ChallengeParticipant, '챌린지 진행도가 업데이트되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '챌린지 진행도 업데이트')
    }
  }

  // =====================================================
  // 개인 챌린지 관리
  // =====================================================

  /**
   * 개인 챌린지 생성
   */
  static async createPersonalChallenge(data: {
    user_id: UUID
    title: string
    description?: string
    type: string
    target_value: number
    unit: string
    end_date: string
  }): Promise<APIResponse<PersonalChallenge>> {
    const validation = this.validateRequiredFields(data, ['user_id', 'title', 'type', 'target_value', 'unit', 'end_date'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    if (!this.isValidUUID(data.user_id)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: challenge, error } = await client
        .from('personal_challenges')
        .insert(data)
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '개인 챌린지 생성')
      }

      return this.createSuccessResponse(challenge as PersonalChallenge, '개인 챌린지가 성공적으로 생성되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '개인 챌린지 생성')
    }
  }

  /**
   * 사용자의 개인 챌린지 목록 조회
   */
  static async getPersonalChallenges(userId: UUID): Promise<APIResponse<PersonalChallenge[]>> {
    if (!this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: challenges, error } = await client
        .from('personal_challenges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return this.handleSupabaseError(error, '개인 챌린지 목록 조회')
      }

      return this.createSuccessResponse(challenges as PersonalChallenge[], `${challenges?.length || 0}개의 개인 챌린지를 조회했습니다.`)
    } catch (error) {
      return this.handleSupabaseError(error, '개인 챌린지 목록 조회')
    }
  }

  // =====================================================
  // 격려 메시지
  // =====================================================

  /**
   * 격려 메시지 보내기
   */
  static async sendEncouragementMessage(data: {
    sender_id: UUID
    receiver_id: UUID
    message: string
    message_type?: string
    room_id?: UUID
    challenge_id?: UUID
  }): Promise<APIResponse<EncouragementMessage>> {
    const validation = this.validateRequiredFields(data, ['sender_id', 'receiver_id', 'message'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    if (!this.isValidUUID(data.sender_id) || !this.isValidUUID(data.receiver_id)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    if (data.sender_id === data.receiver_id) {
      return this.createErrorResponse('자기 자신에게 메시지를 보낼 수 없습니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: message, error } = await client
        .from('encouragement_messages')
        .insert({
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          message: data.message,
          message_type: data.message_type || 'encouragement',
          room_id: data.room_id,
          challenge_id: data.challenge_id
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '격려 메시지 전송')
      }

      return this.createSuccessResponse(message as EncouragementMessage, '격려 메시지를 성공적으로 보냈습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '격려 메시지 전송')
    }
  }

  /**
   * 받은 메시지 조회
   */
  static async getReceivedMessages(
    userId: UUID, 
    unreadOnly: boolean = false
  ): Promise<APIResponse<EncouragementMessage[]>> {
    if (!this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      let query = client
        .from('encouragement_messages')
        .select(`
          *,
          profiles!encouragement_messages_from_user_id_fkey(
            display_name,
            avatar_url
          )
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })

      if (unreadOnly) {
        query = query.eq('is_read', false)
      }

      const { data: messages, error } = await query

      if (error) {
        return this.handleSupabaseError(error, '메시지 조회')
      }

      return this.createSuccessResponse(messages as EncouragementMessage[], `${messages?.length || 0}개의 메시지를 조회했습니다.`)
    } catch (error) {
      return this.handleSupabaseError(error, '메시지 조회')
    }
  }
}
