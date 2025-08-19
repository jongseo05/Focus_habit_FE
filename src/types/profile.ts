// 프로필 페이지 관련 타입 정의 - 메인 타입 정의 파일
// 이 파일이 프로필 관련 타입들의 Single Source of Truth 입니다.

// =====================================================
// 1. 기본 타입들 - base.ts에서 re-export
// =====================================================

export type { 
  UUID, 
  Timestamp, 
  DateString,
  APIResponse,
  PaginatedResponse,
  Insertable,
  Updatable,
  ValidationError,
  ApiError
} from './base'

// =====================================================
// 2. 사용자 상태 및 기본 정보
// =====================================================

// 사용자 상태
export enum UserStatus {
  ONLINE = 'online',
  IN_SESSION = 'in_session',
  DO_NOT_DISTURB = 'do_not_disturb',
  OFFLINE = 'offline'
}

// 기본 사용자 정보 (인증용)
export interface User {
  id: string
  email: string
  name: string
  created_at: string
  updated_at: string
  email_confirmed_at?: string
  last_sign_in_at?: string
}

// 회원가입 폼 데이터 타입
export interface SignUpFormData {
  name: string
  email: string
  password: string
  confirmPassword: string
  agreeTerms: boolean
}

// 로그인 폼 데이터 타입
export interface LoginFormData {
  email: string
  password: string
  rememberMe?: boolean
}

// 인증 상태 타입 (Supabase User는 외부 라이브러리이므로 별도 import 필요)
export interface AuthState {
  user: any | null // SupabaseUser 타입은 사용하는 곳에서 import
  loading: boolean
  error: string | null
}

// 인증 응답 타입
export interface AuthResponse {
  success: boolean
  user?: any | null
  error?: string
  message?: string
}

// =====================================================
// 3. 프로필 관련 타입
// =====================================================

// 사용자 프로필 정보 (확장된 프로필 데이터)
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

// =====================================================
// 4. 집중 및 성과 관련 타입
// =====================================================

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

// =====================================================
// 5. 소셜 관련 타입
// =====================================================

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

// =====================================================
// 6. 설정 및 개인화 관련 타입
// =====================================================

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

// =====================================================
// 7. 복합 상태 및 API 응답 타입
// =====================================================

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

// =====================================================
// 8. 유틸리티 타입들
// =====================================================

// 데이터베이스 테이블 타입
export type DatabaseTable = 
  | 'profiles'
  | 'focus_session'
  | 'focus_sample'
  | 'focus_event'
  | 'daily_summary'
  | 'weekly_summary'
