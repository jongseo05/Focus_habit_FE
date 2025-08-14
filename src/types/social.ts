// 소셜 기능 관련 타입 정의

import type { UUID, Timestamp } from './database'

// =====================================================
// 1. 실시간 스터디룸 관련 타입
// =====================================================

export interface StudyRoom {
  room_id: UUID
  host_id: UUID
  name: string
  description?: string
  max_participants: number
  current_participants: number
  is_active: boolean
  session_type: 'study' | 'work' | 'reading' | 'other'
  goal_minutes?: number
  started_at: Timestamp
  ended_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface RoomParticipant {
  participant_id: UUID
  room_id: UUID
  user_id: UUID
  joined_at: Timestamp
  left_at?: Timestamp
  current_focus_score?: number
  is_host: boolean
  is_connected: boolean
  last_activity: Timestamp
  is_video_on?: boolean
  is_mic_on?: boolean
}

export interface CreateStudyRoomData {
  host_id: UUID
  name: string
  description?: string
  max_participants: number
  session_type: 'study' | 'work' | 'reading' | 'other'
  goal_minutes?: number
}

// =====================================================
// 2. 집중도 대결 관련 타입
// =====================================================

export interface FocusCompetition {
  competition_id: UUID
  room_id: UUID
  name: string
  duration_minutes: number
  started_at: Timestamp
  ended_at?: Timestamp
  is_active: boolean
  created_at: Timestamp
}

export interface CompetitionParticipant {
  participant_id: UUID
  competition_id: UUID
  user_id: UUID
  total_focus_score: number
  average_focus_score: number
  focus_time_minutes: number
  rank?: number
  joined_at: Timestamp
}

export interface CompetitionResult {
  competition_id: UUID
  user_id: UUID
  rank: number
  total_score: number
  average_score: number
  focus_time: number
  reward_coins?: number
  reward_badges?: string[]
  completed_at: Timestamp
}

// =====================================================
// 3. 친구 시스템 관련 타입
// =====================================================

export interface UserFriend {
  friendship_id: UUID
  user_id: UUID
  friend_id: UUID
  status: 'pending' | 'accepted' | 'blocked'
  created_at: Timestamp
  updated_at: Timestamp
}

export interface FriendRequest {
  request_id: UUID
  from_user_id: UUID
  to_user_id: UUID
  message?: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: Timestamp
  updated_at: Timestamp
}

// =====================================================
// 4. 그룹 챌린지 관련 타입
// =====================================================

export interface GroupChallenge {
  challenge_id: UUID
  name: string
  description: string
  goal_type: 'total_hours' | 'total_sessions' | 'average_focus_score'
  goal_value: number
  duration_days: number
  reward_coins: number
  reward_badges?: string[]
  started_at: Timestamp
  ends_at: Timestamp
  is_active: boolean
  created_by: UUID
  created_at: Timestamp
}

export interface ChallengeParticipant {
  participant_id: UUID
  challenge_id: UUID
  user_id: UUID
  current_progress: number
  joined_at: Timestamp
  completed_at?: Timestamp
}

// =====================================================
// 5. 격려 메시지 관련 타입
// =====================================================

export interface EncouragementMessage {
  message_id: UUID
  from_user_id: UUID
  to_user_id: UUID
  room_id?: UUID
  message_type: 'text' | 'emoji' | 'sticker' | 'ai_generated'
  content: string
  is_read: boolean
  created_at: Timestamp
}

// =====================================================
// 6. 업적/배지 시스템 타입
// =====================================================

export interface UserAchievement {
  achievement_id: UUID
  user_id: UUID
  achievement_type: string
  title: string
  description: string
  icon_url?: string
  earned_at: Timestamp
  progress?: number
  max_progress?: number
}

export interface AchievementDefinition {
  type: string
  title: string
  description: string
  icon_url?: string
  criteria: {
    type: 'total_sessions' | 'total_hours' | 'focus_score' | 'streak' | 'social'
    value: number
    timeframe?: 'daily' | 'weekly' | 'monthly' | 'all_time'
  }
}

// =====================================================
// 7. 실시간 메시지 타입 (WebSocket)
// =====================================================

export interface SocialWebSocketMessage {
  type: 'room_join' | 'room_leave' | 'focus_update' | 'encouragement' | 'competition_start' | 'competition_end'
  data: any
  timestamp: Timestamp
}

export interface FocusUpdateMessage {
  type: 'focus_update'
  data: {
    user_id: UUID
    room_id: UUID
    focus_score: number
    timestamp: Timestamp
  }
}

export interface RoomJoinMessage {
  type: 'room_join'
  data: {
    user_id: UUID
    room_id: UUID
    user_name: string
    avatar_url?: string
    timestamp: Timestamp
  }
}

export interface RoomLeaveMessage {
  type: 'room_leave'
  data: {
    user_id: UUID
    room_id: UUID
    user_name: string
    avatar_url?: string
    timestamp: Timestamp
  }
}

export interface EncouragementMessageWS {
  type: 'encouragement'
  data: {
    from_user_id: UUID
    to_user_id: UUID
    room_id?: UUID
    message_type: 'text' | 'emoji' | 'sticker' | 'ai_generated'
    content: string
    timestamp: Timestamp
  }
}

// =====================================================
// 8. 소셜 통계 타입
// =====================================================

export interface SocialStats {
  user_id: UUID
  total_friends: number
  total_rooms_joined: number
  total_competitions_won: number
  total_challenges_completed: number
  total_encouragements_sent: number
  total_encouragements_received: number
  current_streak: number
  longest_streak: number
  total_coins: number
  total_badges: number
  updated_at: Timestamp
}

export interface FriendComparison {
  friend_id: UUID
  friend_name: string
  friend_avatar_url?: string
  comparison_data: {
    daily_average_hours: number
    weekly_average_hours: number
    best_focus_score: number
    average_focus_score: number
    study_pattern: 'morning' | 'afternoon' | 'evening' | 'night' | 'mixed'
    focus_style: 'short_intense' | 'long_steady' | 'mixed'
  }
}

// 대결 윈도우 관련 타입
export interface Challenge {
  challenge_id: string
  room_id: string
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
  state: 'pending' | 'active' | 'ended'
  start_at: string
  end_at?: string
  created_at: string
}

export interface ChallengeConfig {
  // 뽀모도로 모드
  work?: number // 공부 시간 (분)
  break?: number // 휴식 시간 (분)
  // 커스텀 모드
  durationMin?: number // 총 시간 (분)
}

export interface ChallengeParticipant {
  challenge_id: string
  user_id: string
  joined_at: string
  left_at?: string
  final_score?: number
}

export interface ChallengeTick {
  challenge_id: string
  ts: string
  scores: { [userId: string]: number }
}

// 실시간 이벤트 타입
export interface ChallengeEvent {
  type: 'CHALLENGE_CREATED' | 'CHALLENGE_STARTED' | 'CHALLENGE_TICK' | 'CHALLENGE_ENDED'
  payload: any
}

export interface ChallengeCreatedPayload {
  config: ChallengeConfig
  start_countdown_sec: number
}

export interface ChallengeStartedPayload {
  start_at: string
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
}

export interface ChallengeTickPayload {
  per_user_scores: { [userId: string]: number }
  rankings: Array<{ userId: string, score: number, rank: number }>
}

export interface ChallengeEndedPayload {
  end_at: string
  final_scores: { [userId: string]: number }
  badges: { [userId: string]: string[] }
}
