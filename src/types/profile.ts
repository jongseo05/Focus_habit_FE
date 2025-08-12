// 프로필 페이지 관련 타입 정의

// 사용자 상태
export enum UserStatus {
  ONLINE = 'online',
  IN_SESSION = 'in_session',
  DO_NOT_DISTURB = 'do_not_disturb',
  OFFLINE = 'offline'
}

// 사용자 프로필 정보
export interface UserProfile {
  id: string
  user_id: string
  display_name: string
  handle: string
  avatar_url?: string
  bio?: string
  school?: string
  major?: string
  status: UserStatus
  created_at: string
  updated_at: string
}

// 집중 요약 정보
export interface FocusSummary {
  weekly_total_time: number // 분 단위
  average_focus_score: number
  longest_streak: number // 분 단위
  session_count: number
  weekly_change: number // 증감률 (%)
}

// 주간 집중도 데이터
export interface WeeklyFocusData {
  date: string
  average_score: number
  total_time: number
}

// 시간대별 집중 패턴
export interface TimePattern {
  morning: number // 6-12시
  afternoon: number // 12-18시
  evening: number // 18-24시
}

// 배지 정보
export interface Badge {
  id: string
  name: string
  description: string
  icon_url: string
  earned_at: string
  category: 'achievement' | 'streak' | 'milestone'
}

// 챌린지 정보
export interface Challenge {
  id: string
  name: string
  description: string
  type: 'personal' | 'one_on_one' | 'group'
  progress: number // 0-100
  target: number
  current: number
  end_date: string
}

// 친구 정보
export interface Friend {
  id: string
  user_id: string
  display_name: string
  handle: string
  avatar_url?: string
  status: UserStatus
  recent_focus_score?: number
  is_pinned: boolean
}

// 그룹 정보
export interface Group {
  id: string
  name: string
  description: string
  member_count: number
  avatar_url?: string
}

// 리포트 공유 설정
export interface ReportSharingSettings {
  allow_friends_view: boolean
  sharing_period: 'day' | 'week' | 'month' | 'all'
  sharing_scope: 'summary' | 'detailed' | 'full'
  real_time_score_sharing: boolean
}

// 개인화/모델 정보
export interface PersonalizationInfo {
  focus_samples_collected: number
  non_focus_samples_collected: number
  total_samples_needed: number
  completion_percentage: number
  model_version: string
  last_updated: string
}

// 웨어러블/알림 설정
export interface WearableSettings {
  device_connected: boolean
  device_name?: string
  vibration_threshold: number // 분 단위
  session_notifications: boolean
  ranking_notifications: boolean
  reward_notifications: boolean
}

// 보상 정보
export interface Reward {
  id: string
  name: string
  description: string
  image_url: string
  status: 'pending' | 'completed'
  earned_at: string
  claimed_at?: string
}

// 프로필 페이지 전체 상태
export interface ProfilePageState {
  profile: UserProfile | null
  focus_summary: FocusSummary | null
  weekly_focus_data: WeeklyFocusData[]
  time_pattern: TimePattern | null
  badges: Badge[]
  challenges: Challenge[]
  friends: Friend[]
  groups: Group[]
  sharing_settings: ReportSharingSettings
  personalization: PersonalizationInfo | null
  wearable_settings: WearableSettings
  rewards: Reward[]
  loading: boolean
  error: string | null
}
