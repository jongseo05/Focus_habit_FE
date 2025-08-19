// 사용자 관련 타입들 - types/profile.ts에서 re-export
// 이 파일은 하위 호환성을 위해 유지되며, 실제 타입 정의는 types/profile.ts에 있습니다.

export type { 
  User,
  UserProfile,
  UserStatus,
  SignUpFormData,
  LoginFormData,
  AuthState,
  AuthResponse
} from './profile'

// Supabase 관련 타입은 여기서 직접 import (외부 라이브러리)
import type { User as SupabaseUser } from '@supabase/supabase-js'
export type { SupabaseUser }