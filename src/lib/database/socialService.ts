import { supabaseBrowser } from '@/lib/supabase/client'
import { supabaseServer } from '@/lib/supabase/server'
import type {
  StudyRoom,
  RoomParticipant,
  CreateStudyRoomData,
  FocusCompetition,
  CompetitionParticipant,
  UserFriend,
  FriendRequest,
  GroupChallenge,
  ChallengeParticipant,
  EncouragementMessage,
  UserAchievement,
  SocialStats,
  FriendComparison
} from '@/types/social'
import type { UUID, Timestamp } from '@/types/database'

// =====================================================
// 1. 실시간 스터디룸 서비스
// =====================================================

export class StudyRoomService {
  // 스터디룸 생성
  static async createRoom(data: CreateStudyRoomData): Promise<StudyRoom | null> {
    try {
      const supabase = await supabaseServer()
      const { data: room, error } = await supabase
        .from('study_rooms')
        .insert({
          host_id: data.host_id,
          name: data.name,
          description: data.description,
          max_participants: data.max_participants,
          session_type: data.session_type,
          goal_minutes: data.goal_minutes
        })
        .select()
        .single()

      if (error) throw error

      // 방장을 참가자로 추가
      if (room) {
        await this.joinRoom(room.room_id, data.host_id, true)
      }

      return room
    } catch (error) {
      console.error('스터디룸 생성 실패:', error)
      return null
    }
  }

  // 활성 스터디룸 목록 조회
  static async getActiveRooms(): Promise<StudyRoom[]> {
    try {
      const supabase = await supabaseServer()
      const { data: rooms, error } = await supabase
        .from('study_rooms')
        .select(`
          *,
          host:host_id(name, avatar_url),
          participants:room_participants(
            user_id,
            is_host,
            is_connected,
            current_focus_score
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return rooms || []
    } catch (error) {
      console.error('활성 스터디룸 조회 실패:', error)
      return []
    }
  }

  // 스터디룸 참가
  static async joinRoom(roomId: UUID, userId: UUID, isHost: boolean = false): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      // 룸 참가자 수 확인
      const { data: room } = await supabase
        .from('study_rooms')
        .select('current_participants, max_participants')
        .eq('room_id', roomId)
        .single()

      if (!room || room.current_participants >= room.max_participants) {
        return false
      }

      const { error } = await supabase
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: userId,
          is_host: isHost
        })

      if (error) throw error
      return true
    } catch (error) {
      console.error('스터디룸 참가 실패:', error)
      return false
    }
  }

  // 스터디룸 나가기
  static async leaveRoom(roomId: UUID, userId: UUID): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('room_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('스터디룸 나가기 실패:', error)
      return false
    }
  }

  // 집중도 업데이트
  static async updateFocusScore(roomId: UUID, userId: UUID, focusScore: number): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('room_participants')
        .update({
          current_focus_score: focusScore,
          last_activity: new Date().toISOString()
        })
        .eq('room_id', roomId)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
      return false
    }
  }

  // 룸 참가자 목록 조회
  static async getRoomParticipants(roomId: UUID): Promise<RoomParticipant[]> {
    try {
      const supabase = await supabaseServer()
      const { data: participants, error } = await supabase
        .from('room_participants')
        .select(`
          *,
          user:user_id(name, avatar_url)
        `)
        .eq('room_id', roomId)
        .is('left_at', null)
        .eq('is_connected', true)
        .order('joined_at', { ascending: true })

      if (error) throw error
      return participants || []
    } catch (error) {
      console.error('룸 참가자 조회 실패:', error)
      return []
    }
  }
}

// =====================================================
// 2. 집중도 대결 서비스
// =====================================================

export class FocusCompetitionService {
  // 대결 생성
  static async createCompetition(roomId: UUID, name: string, durationMinutes: number): Promise<FocusCompetition | null> {
    try {
      const supabase = await supabaseServer()
      const { data: competition, error } = await supabase
        .from('focus_competitions')
        .insert({
          room_id: roomId,
          name,
          duration_minutes: durationMinutes
        })
        .select()
        .single()

      if (error) throw error
      return competition
    } catch (error) {
      console.error('대결 생성 실패:', error)
      return null
    }
  }

  // 대결 참가
  static async joinCompetition(competitionId: UUID, userId: UUID): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('competition_participants')
        .insert({
          competition_id: competitionId,
          user_id: userId
        })

      if (error) throw error
      return true
    } catch (error) {
      console.error('대결 참가 실패:', error)
      return false
    }
  }

  // 대결 점수 업데이트
  static async updateCompetitionScore(competitionId: UUID, userId: UUID, focusScore: number, focusTime: number): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { data: participant, error: fetchError } = await supabase
        .from('competition_participants')
        .select('total_focus_score, focus_time_minutes')
        .eq('competition_id', competitionId)
        .eq('user_id', userId)
        .single()

      if (fetchError) throw fetchError

      const newTotalScore = (participant?.total_focus_score || 0) + focusScore
      const newFocusTime = (participant?.focus_time_minutes || 0) + focusTime
      const newAverageScore = newTotalScore / (newFocusTime / 60) // 시간당 평균

      const { error: updateError } = await supabase
        .from('competition_participants')
        .update({
          total_focus_score: newTotalScore,
          average_focus_score: newAverageScore,
          focus_time_minutes: newFocusTime
        })
        .eq('competition_id', competitionId)
        .eq('user_id', userId)

      if (updateError) throw updateError
      return true
    } catch (error) {
      console.error('대결 점수 업데이트 실패:', error)
      return false
    }
  }

  // 대결 결과 계산
  static async calculateCompetitionResults(competitionId: UUID): Promise<CompetitionParticipant[]> {
    try {
      const supabase = await supabaseServer()
      const { data: participants, error } = await supabase
        .from('competition_participants')
        .select(`
          *,
          user:user_id(name, avatar_url)
        `)
        .eq('competition_id', competitionId)
        .order('total_focus_score', { ascending: false })

      if (error) throw error

      // 순위 업데이트
      const rankedParticipants = participants?.map((participant: any, index: number) => ({
        ...participant,
        rank: index + 1
      })) || []

      // 순위를 데이터베이스에 저장
      for (const participant of rankedParticipants) {
        await supabase
          .from('competition_participants')
          .update({ rank: participant.rank })
          .eq('participant_id', participant.participant_id)
      }

      return rankedParticipants
    } catch (error) {
      console.error('대결 결과 계산 실패:', error)
      return []
    }
  }
}

// =====================================================
// 3. 친구 시스템 서비스
// =====================================================

export class FriendService {
  // 친구 요청 보내기
  static async sendFriendRequest(fromUserId: UUID, toUserId: UUID, message?: string): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          message
        })

      if (error) throw error
      return true
    } catch (error) {
      console.error('친구 요청 전송 실패:', error)
      return false
    }
  }

  // 친구 요청 수락/거절
  static async respondToFriendRequest(requestId: UUID, status: 'accepted' | 'rejected'): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('request_id', requestId)
        .single()

      if (fetchError) throw fetchError

      // 요청 상태 업데이트
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('request_id', requestId)

      if (updateError) throw updateError

      // 수락된 경우 친구 관계 생성
      if (status === 'accepted' && request) {
        await supabase
          .from('user_friends')
          .insert({
            user_id: request.from_user_id,
            friend_id: request.to_user_id,
            status: 'accepted'
          })

        await supabase
          .from('user_friends')
          .insert({
            user_id: request.to_user_id,
            friend_id: request.from_user_id,
            status: 'accepted'
          })
      }

      return true
    } catch (error) {
      console.error('친구 요청 응답 실패:', error)
      return false
    }
  }

  // 친구 목록 조회
  static async getFriends(userId: UUID): Promise<UserFriend[]> {
    try {
      const supabase = await supabaseServer()
      const { data: friendships, error } = await supabase
        .from('user_friends')
        .select(`
          *,
          friend:friend_id(name, avatar_url)
        `)
        .eq('user_id', userId)
        .eq('status', 'accepted')

      if (error) throw error
      return friendships || []
    } catch (error) {
      console.error('친구 목록 조회 실패:', error)
      return []
    }
  }

  // 친구 비교 데이터 조회
  static async getFriendComparison(userId: UUID, friendId: UUID): Promise<FriendComparison | null> {
    try {
      const supabase = await supabaseServer()
      // 사용자들의 집중 세션 데이터 조회
      const { data: userSessions } = await supabase
        .from('focus_sessions')
        .select('focus_score, started_at, ended_at')
        .eq('user_id', userId)
        .not('ended_at', 'is', null)

      const { data: friendSessions } = await supabase
        .from('focus_sessions')
        .select('focus_score, started_at, ended_at')
        .eq('user_id', friendId)
        .not('ended_at', 'is', null)

      // 친구 정보 조회
      const { data: friend } = await supabase
        .from('users')
        .select('name, avatar_url')
        .eq('user_id', friendId)
        .single()

      if (!friend) return null

      // 통계 계산
      const userStats = this.calculateUserStats(userSessions || [])
      const friendStats = this.calculateUserStats(friendSessions || [])

      return {
        friend_id: friendId,
        friend_name: friend.name || '',
        friend_avatar_url: friend.avatar_url,
        comparison_data: {
          daily_average_hours: friendStats.dailyAverageHours,
          weekly_average_hours: friendStats.weeklyAverageHours,
          best_focus_score: friendStats.bestFocusScore,
          average_focus_score: friendStats.averageFocusScore,
          study_pattern: friendStats.studyPattern,
          focus_style: friendStats.focusStyle
        }
      }
    } catch (error) {
      console.error('친구 비교 데이터 조회 실패:', error)
      return null
    }
  }

  private static calculateUserStats(sessions: any[]) {
    // 통계 계산 로직 구현
    const totalHours = sessions.reduce((sum, session) => {
      const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
      return sum + (duration / (1000 * 60 * 60))
    }, 0)

    const focusScores = sessions.map(s => s.focus_score || 0)
    const averageFocusScore = focusScores.length > 0 ? focusScores.reduce((a, b) => a + b, 0) / focusScores.length : 0
    const bestFocusScore = Math.max(...focusScores, 0)

    return {
      dailyAverageHours: totalHours / 7, // 간단한 계산
      weeklyAverageHours: totalHours,
      bestFocusScore,
      averageFocusScore,
      studyPattern: 'mixed' as const,
      focusStyle: 'mixed' as const
    }
  }
}

// =====================================================
// 4. 격려 메시지 서비스
// =====================================================

export class EncouragementService {
  // 격려 메시지 보내기
  static async sendEncouragement(data: {
    fromUserId: UUID
    toUserId: UUID
    roomId?: UUID
    messageType: 'text' | 'emoji' | 'sticker' | 'ai_generated'
    content: string
  }): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('encouragement_messages')
        .insert({
          from_user_id: data.fromUserId,
          to_user_id: data.toUserId,
          room_id: data.roomId,
          message_type: data.messageType,
          content: data.content
        })

      if (error) throw error
      return true
    } catch (error) {
      console.error('격려 메시지 전송 실패:', error)
      return false
    }
  }

  // 받은 격려 메시지 조회
  static async getReceivedMessages(userId: UUID): Promise<EncouragementMessage[]> {
    try {
      const supabase = await supabaseServer()
      const { data: messages, error } = await supabase
        .from('encouragement_messages')
        .select(`
          *,
          from_user:from_user_id(name, avatar_url)
        `)
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return messages || []
    } catch (error) {
      console.error('받은 메시지 조회 실패:', error)
      return []
    }
  }

  // 메시지 읽음 처리
  static async markAsRead(messageId: UUID): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('encouragement_messages')
        .update({ is_read: true })
        .eq('message_id', messageId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('메시지 읽음 처리 실패:', error)
      return false
    }
  }
}

// =====================================================
// 5. 소셜 통계 서비스
// =====================================================

export class SocialStatsService {
  // 사용자 소셜 통계 조회
  static async getUserStats(userId: UUID): Promise<SocialStats | null> {
    try {
      const supabase = await supabaseServer()
      const { data: stats, error } = await supabase
        .from('social_stats')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return stats
    } catch (error) {
      console.error('소셜 통계 조회 실패:', error)
      return null
    }
  }

  // 소셜 통계 업데이트
  static async updateStats(userId: UUID, updates: Partial<SocialStats>): Promise<boolean> {
    try {
      const supabase = await supabaseServer()
      const { error } = await supabase
        .from('social_stats')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('소셜 통계 업데이트 실패:', error)
      return false
    }
  }
}
