import type { User as SupabaseUser } from '@supabase/supabase-js'

// 사용자 기본 정보 타입
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

// 사용자 프로필 타입
export interface UserProfile {
  id: string
  user_id: string
  name: string
  avatar_url?: string
  bio?: string
  created_at: string
  updated_at: string
}

// 인증 상태 타입
export interface AuthState {
  user: SupabaseUser | null
  loading: boolean
  error: string | null
}

// 인증 응답 타입
export interface AuthResponse {
  success: boolean
  user?: SupabaseUser | null
  error?: string
  message?: string
}