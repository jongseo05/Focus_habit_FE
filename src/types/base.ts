// 기본 타입 정의 - 순환 참조 방지를 위한 베이스 타입들

export type UUID = string
export type Timestamp = string // ISO 8601 형식
export type DateString = string // YYYY-MM-DD 형식

// 표준 API 응답 형태
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 페이지네이션 응답
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

// 유틸리티 타입들
export type Insertable<T> = Omit<T, 'created_at' | 'updated_at'>
export type Updatable<T> = Partial<Omit<T, 'created_at' | 'updated_at'>>

// 에러 타입들
export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface ApiError {
  status: number
  message: string
  errors?: ValidationError[]
}

// 카메라 상태 API 응답 타입
export interface CameraStateUpdateRequest {
  is_video_enabled: boolean
  is_audio_enabled: boolean
}

export interface CameraStateResponse {
  user_id: UUID
  room_id: UUID
  is_video_enabled: boolean
  is_audio_enabled: boolean
  camera_updated_at: Timestamp
}

export interface ParticipantsCameraStateResponse {
  participants: Array<{
    user_id: UUID
    is_video_enabled: boolean
    is_audio_enabled: boolean
    camera_updated_at: Timestamp
  }>
}
