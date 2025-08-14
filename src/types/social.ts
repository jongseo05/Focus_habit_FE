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
  linked_challenge_id?: UUID
  linked_challenge?: GroupChallenge
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
// 3. 친구 시스템 관련 타입 (업데이트됨)
// =====================================================

// 친구 요청
export interface FriendRequest {
  request_id: UUID
  from_user_id: UUID
  to_user_id: UUID
  message?: string
  status: 'pending' | 'accepted' | 'rejected' | 'blocked'
  created_at: Timestamp
  updated_at: Timestamp
}

// 친구 요청 생성 데이터
export interface CreateFriendRequestData {
  to_user_id: UUID
  message?: string
}

// 친구 요청 응답 데이터
export interface FriendRequestResponse {
  request_id: UUID
  status: 'accepted' | 'rejected'
}

// 친구 관계
export interface UserFriend {
  friendship_id: UUID
  user_id: UUID
  friend_id: UUID
  status: 'active' | 'blocked'
  created_at: Timestamp
  updated_at: Timestamp
}

// 친구 활동 상태
export interface FriendActivityStatus {
  status_id: UUID
  user_id: UUID
  status: 'online' | 'offline' | 'focusing' | 'break' | 'away'
  current_focus_score: number
  last_activity: Timestamp
  current_session_id?: UUID
  updated_at: Timestamp
}

// 친구 격려 메시지
export interface FriendEncouragementMessage {
  message_id: UUID
  from_user_id: UUID
  to_user_id: UUID
  message_type: 'text' | 'emoji' | 'sticker' | 'ai_generated'
  content: string
  is_read: boolean
  created_at: Timestamp
}

// 친구 비교 통계
export interface FriendComparisonStats {
  stat_id: UUID
  user_id: UUID
  friend_id: UUID
  period_type: 'daily' | 'weekly' | 'monthly'
  period_start: string // DATE
  period_end: string // DATE
  total_focus_time: number // 분 단위
  average_focus_score: number
  total_sessions: number
  rank_position?: number
  created_at: Timestamp
}

// 친구 목록 뷰 (사용자 정보 포함)
export interface FriendsListView {
  friendship_id: UUID
  user_id: UUID
  friend_id: UUID
  friendship_status: string
  friendship_created_at: Timestamp
  friend_name: string
  friend_avatar?: string
  friend_handle: string
  activity_status?: string
  current_focus_score?: number
  last_activity?: Timestamp
  request_id?: UUID
  request_message?: string
}

// 친구 요청 뷰 (요청자 정보 포함)
export interface FriendRequestsView {
  request_id: UUID
  from_user_id: UUID
  to_user_id: UUID
  message?: string
  status: string
  created_at: Timestamp
  from_user_name: string
  from_user_avatar?: string
  from_user_handle: string
}

// 친구 비교 뷰
export interface FriendComparisonView {
  stat_id: UUID
  user_id: UUID
  friend_id: UUID
  period_type: string
  period_start: string
  period_end: string
  total_focus_time: number
  average_focus_score: number
  total_sessions: number
  rank_position?: number
  user_name: string
  user_avatar?: string
  friend_name: string
  friend_avatar?: string
}

// 친구 검색 결과
export interface FriendSearchResult {
  user_id: UUID
  display_name: string
  avatar_url?: string
  handle: string
  bio?: string
  is_friend: boolean
  has_pending_request: boolean
  current_focus_score?: number
  last_activity?: Timestamp
}

// 친구 랭킹 정보
export interface FriendRanking {
  user_id: UUID
  display_name: string
  avatar_url?: string
  handle: string
  total_focus_time: number
  average_focus_score: number
  rank: number
  period: 'daily' | 'weekly' | 'monthly'
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
// 5. 격려 메시지 관련 타입 (메시지 기능 제외로 주석 처리)
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
  achievement_type: string
  title: string
  description: string
  icon_url?: string
  max_progress?: number
  reward_coins?: number
}

// =====================================================
// 7. 챌린지 관련 타입 (기존 대결 시스템과 통합)
// =====================================================

export interface Challenge {
  challenge_id: UUID
  room_id: UUID
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
  state: 'pending' | 'active' | 'ended'
  start_at: Timestamp
  end_at?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ChallengeConfig {
  work?: number // 뽀모도로 공부 시간 (분)
  break?: number // 뽀모도로 휴식 시간 (분)
  durationMin?: number // 커스텀 총 시간 (분)
}

export interface ChallengeParticipant {
  participant_id: UUID
  challenge_id: UUID
  user_id: UUID
  joined_at: Timestamp
  current_progress: number
  final_score?: number
  user?: {
    name: string
    avatar_url?: string
  }
}

export interface ChallengeTick {
  tick_id: UUID
  challenge_id: UUID
  scores: { [key: string]: number }
  rankings: { [key: string]: number }
  ts: Timestamp
}

// =====================================================
// 8. WebSocket 메시지 타입
// =====================================================

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
    user_name: string
    avatar_url?: string
    room_id: UUID
    timestamp: Timestamp
  }
}

export interface RoomLeaveMessage {
  type: 'room_leave'
  data: {
    user_id: UUID
    user_name: string
    avatar_url?: string
    room_id: UUID
    timestamp: Timestamp
  }
}

export interface EncouragementMessageWS {
  type: 'encouragement'
  data: {
    from_user_id: UUID
    to_user_id: UUID
    room_id?: UUID
    message_type: string
    content: string
    timestamp: Timestamp
  }
}

// 친구 관련 WebSocket 메시지
export interface FriendActivityUpdateMessage {
  type: 'friend_activity_update'
  data: {
    user_id: UUID
    status: string
    current_focus_score: number
    timestamp: Timestamp
  }
}

export interface FriendRequestMessage {
  type: 'friend_request'
  data: {
    request_id: UUID
    from_user_id: UUID
    to_user_id: UUID
    message?: string
    timestamp: Timestamp
  }
}

export interface FriendRequestResponseMessage {
  type: 'friend_request_response'
  data: {
    request_id: UUID
    status: 'accepted' | 'rejected'
    timestamp: Timestamp
  }
}

export interface FriendEncouragementMessageWS {
  type: 'friend_encouragement'
  data: {
    message_id: UUID
    from_user_id: UUID
    to_user_id: UUID
    content: string
    message_type: string
    timestamp: Timestamp
  }
}

// =====================================================
// 9. API 응답 타입
// =====================================================

export interface FriendsListResponse {
  friends: FriendsListView[]
  total_count: number
}

export interface FriendRequestsResponse {
  requests: FriendRequestsView[]
  total_count: number
}

export interface FriendSearchResponse {
  results: FriendSearchResult[]
  total_count: number
}

export interface FriendRankingResponse {
  rankings: FriendRanking[]
  user_rank?: number
  period: string
}

export interface FriendComparisonResponse {
  comparisons: FriendComparisonView[]
  period: string
}

export interface SocialStats {
  total_friends: number
  total_study_sessions: number
  total_focus_time: number
  average_focus_score: number
  weekly_rank: number
  monthly_rank: number
}

export interface FriendComparison {
  friend_id: UUID
  friend_name: string
  friend_avatar?: string
  comparison_data: {
    daily_average_hours: number
    weekly_average_hours: number
    best_focus_score: number
    average_focus_score: number
    total_study_sessions: number
    rank: number
    study_pattern?: string
    focus_style?: string
  }
}

// =====================================================
// 11. WebSocket 메시지 통합 타입
// =====================================================

export type SocialWebSocketMessage = 
  | FocusUpdateMessage
  | RoomJoinMessage
  | RoomLeaveMessage
  | EncouragementMessageWS
  | FriendActivityUpdateMessage
  | FriendRequestMessage
  | FriendRequestResponseMessage
  | FriendEncouragementMessageWS
  | ChallengeEvent

// =====================================================
// 12. API 요청/응답 타입
// =====================================================

export interface CreateEncouragementMessageData {
  to_user_id: UUID
  room_id?: UUID
  message_type: 'text' | 'emoji' | 'sticker' | 'ai_generated'
  content: string
}

export interface UpdateEncouragementMessageData {
  message_id: UUID
  is_read: boolean
}

export interface CreateChallengeData {
  room_id: UUID
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
}

export interface JoinChallengeData {
  challenge_id: UUID
  user_id: UUID
}

export interface UpdateChallengeData {
  challenge_id: UUID
  state?: 'pending' | 'active' | 'ended'
  end_at?: string
}

export interface ChallengeParticipantData {
  challenge_id: UUID
  user_id: UUID
  current_progress: number
  final_score?: number
}

// =====================================================
// 10. 챌린지 이벤트 타입
// =====================================================

export interface ChallengeEvent {
  type: 'challenge_created' | 'challenge_started' | 'challenge_tick' | 'challenge_ended'
  data: ChallengeCreatedPayload | ChallengeStartedPayload | ChallengeTickPayload | ChallengeEndedPayload
}

export interface ChallengeCreatedPayload {
  challenge_id: UUID
  room_id: UUID
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
  created_by: UUID
  timestamp: Timestamp
}

export interface ChallengeStartedPayload {
  challenge_id: UUID
  room_id: UUID
  start_at: Timestamp
  timestamp: Timestamp
}

export interface ChallengeTickPayload {
  challenge_id: UUID
  room_id: UUID
  scores: { [key: string]: number }
  rankings: { [key: string]: number }
  timestamp: Timestamp
}

export interface ChallengeEndedPayload {
  challenge_id: UUID
  room_id: UUID
  final_scores: { [key: string]: number }
  final_rankings: { [key: string]: number }
  winner_id?: UUID
  timestamp: Timestamp
}
