// 새로운 DB 스키마에 맞는 타입 정의

import type { 
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

// 기본 타입들 re-export
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
}

// 사용자 관련 타입들은 profile.ts에서 가져옴
export type { User, UserProfile } from './profile'

// =====================================================
// 2. 데이터베이스 전용 타입
// =====================================================

// 데이터베이스 전용 사용자 확장 타입 (필요시)
export interface DatabaseUser {
  user_id: UUID
  email: string
  created_at: Timestamp
  name?: string
  avatar_url?: string
  bio?: string
  time_zone?: string
  prefs?: Record<string, any>
}

// =====================================================
// 3. 집중 세션 관련 타입
// =====================================================

export interface FocusSession {
  session_id: UUID
  user_id: UUID
  room_id?: UUID
  started_at: Timestamp
  ended_at?: Timestamp
  goal_min?: number
  context_tag?: string
  session_type: 'study' | 'work' | 'reading' | 'other' | 'study_room'
  focus_score?: number
  distractions: number
  notes?: string
  created_at: Timestamp
  updated_at?: Timestamp
}

export interface CreateFocusSessionData {
  user_id: UUID
  room_id?: UUID
  started_at: Timestamp
  goal_min?: number
  context_tag?: string
  session_type?: 'study' | 'work' | 'reading' | 'other' | 'study_room'
  notes?: string
}

export interface UpdateFocusSessionData {
  ended_at?: Timestamp
  focus_score?: number
  distractions?: number
  notes?: string
}

// =====================================================
// 4. 집중 샘플 데이터 타입
// =====================================================

export interface FocusSample {
  session_id: UUID
  ts: Timestamp
  raw_score?: number
  score_conf?: number
  score: number
  p_eye?: number
  pose_dev?: number
  topic_tag?: string
  rms_db?: number
  created_at: Timestamp
}

export interface CreateFocusSampleData {
  session_id: UUID
  ts: Timestamp
  raw_score?: number
  score_conf?: number
  score: number
  p_eye?: number
  pose_dev?: number
  topic_tag?: string
  rms_db?: number
}

// =====================================================
// 5. 집중 이벤트 타입
// =====================================================

export type EventType = 'phone' | 'distraction' | 'break' | 'focus' | 'posture' | 'audio_analysis'

export interface FocusEvent {
  event_id: UUID
  session_id: UUID
  ts: Timestamp
  event_type: EventType
  payload?: Record<string, any>
  created_at: Timestamp
}

export interface CreateFocusEventData {
  session_id: UUID
  ts: Timestamp
  event_type: EventType
  payload?: Record<string, any>
}

// =====================================================
// 6. 스냅샷 타입
// =====================================================

export interface Snapshot {
  snapshot_id: UUID
  session_id: UUID
  ts: Timestamp
  s3_url?: string
  thumb_url?: string
  focus_score?: number
  created_at: Timestamp
}

export interface CreateSnapshotData {
  session_id: UUID
  ts: Timestamp
  s3_url?: string
  thumb_url?: string
  focus_score?: number
}

// =====================================================
// 7. 노트 타입
// =====================================================

export interface Note {
  note_id: UUID
  session_id: UUID
  ts_ref: Timestamp
  content: string
  created_at: Timestamp
}

export interface CreateNoteData {
  session_id: UUID
  ts_ref: Timestamp
  content: string
}

// =====================================================
// 8. 요약 데이터 타입
// =====================================================

export interface DailySummary {
  user_id: UUID
  date: DateString
  focus_min: number
  avg_score: number
  peak_ts?: Timestamp
  peak?: number
  drop_ts?: Timestamp
  drop?: number
  phone_min: number
  quiet_ratio: number
  longest_streak: number
  sessions_count: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface WeeklySummary {
  user_id: UUID
  iso_year: number
  iso_week: number
  avg_score: number
  quiet_ratio: number
  habit_idx: number
  total_focus_min: number
  total_sessions: number
  created_at: Timestamp
  updated_at: Timestamp
}

// =====================================================
// 9. 보상 관련 타입
// =====================================================

export interface RewardClaim {
  claim_id: UUID
  user_id: UUID
  date: DateString
  exp: number
  sticker_id?: string
  claimed_at: Timestamp
  created_at: Timestamp
}

export interface CreateRewardClaimData {
  user_id: UUID
  date: DateString
  exp: number
  sticker_id?: string
}

// =====================================================
// 10. 루틴 관련 타입
// =====================================================

export interface RoutineToggle {
  user_id: UUID
  routine_id: string
  enabled: boolean
  updated_at: Timestamp
  created_at: Timestamp
}

export interface CreateRoutineToggleData {
  user_id: UUID
  routine_id: string
  enabled: boolean
}

// =====================================================
// 11. 습관 관련 타입
// =====================================================

export interface Habit {
  id: UUID
  user_id: UUID
  name: string
  description?: string
  category?: string
  is_active: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CreateHabitData {
  user_id: UUID
  name: string
  description?: string
  category?: string
  is_active?: boolean
}

export interface HabitRecord {
  id: UUID
  habit_id: UUID
  date: DateString
  completed_count: number
  notes?: string
  created_at: Timestamp
}

export interface CreateHabitRecordData {
  habit_id: UUID
  date: DateString
  completed_count?: number
  notes?: string
}

// =====================================================
// 12. 뷰 타입들
// =====================================================

export interface TodayFocusSummary {
  user_id: UUID
  sessions_count: number
  total_minutes: number
  avg_score: number
  max_score: number
}

export interface WeeklyFocusStats {
  user_id: UUID
  week_start: Timestamp
  sessions_count: number
  total_minutes: number
  avg_score: number
}



// =====================================================
// 14. 쿼리 파라미터 타입들
// =====================================================

export interface FocusSessionFilters {
  user_id?: UUID
  start_date?: DateString
  end_date?: DateString
  session_type?: string
  context_tag?: string
  limit?: number
  offset?: number
}

export interface FocusSampleFilters {
  session_id?: UUID
  start_ts?: Timestamp
  end_ts?: Timestamp
  limit?: number
  offset?: number
}

export interface DailySummaryFilters {
  user_id?: UUID
  start_date?: DateString
  end_date?: DateString
}

export interface WeeklySummaryFilters {
  user_id?: UUID
  iso_year?: number
  iso_week?: number
}

// =====================================================
// 15. 통계 및 분석 타입들
// =====================================================

export interface FocusStats {
  total_sessions: number
  total_focus_time: number // 분 단위
  avg_focus_score: number
  best_session_score: number
  total_distractions: number
  longest_streak: number
}

export interface FocusTrend {
  date: DateString
  focus_min: number
  avg_score: number
  sessions_count: number
}

export interface FocusInsight {
  type: 'improvement' | 'decline' | 'consistency' | 'breakthrough'
  title: string
  description: string
  data: Record<string, any>
  timestamp: Timestamp
}

// =====================================================
// 16. 실시간 데이터 타입들
// =====================================================

export interface RealtimeFocusData {
  session_id: UUID
  current_score: number
  current_ts: Timestamp
  events: FocusEvent[]
  samples: FocusSample[]
}

export interface WebSocketMessage {
  type: 'focus_update' | 'event' | 'session_start' | 'session_end' | 'error'
  data: any
  timestamp: Timestamp
}

// =====================================================
// 17. 유틸리티 타입들
// =====================================================

export type DatabaseTable = 
  | 'focus_session'
  | 'focus_sample'
  | 'focus_event'
  | 'snapshot'
  | 'note'
  | 'daily_summary'
  | 'weekly_summary'
  | 'reward_claim'
  | 'routine_toggle'
  | 'habits'
  | 'habit_records'



// 데이터베이스 전용 에러 타입
export interface DatabaseError {
  code: string
  message: string
  details?: string
  hint?: string
} 

// =====================================================
// 4. ML 피쳐값 관련 타입
// =====================================================

export interface MLFeatures {
  feature_id: UUID
  session_id: UUID
  ts: Timestamp
  head_pose_pitch?: number
  head_pose_yaw?: number
  head_pose_roll?: number
  eye_status?: string
  ear_value?: number
  frame_number?: number
  focus_status?: 'focused' | 'normal' | 'distracted'
  focus_confidence?: number
  focus_score?: number
  created_at: Timestamp
} 