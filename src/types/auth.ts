// Supabase 인증 관련 타입
export interface AuthError {
  message: string
  status?: number
}

// 회원가입 옵션
export interface SignUpOptions {
  emailRedirectTo?: string
  data?: {
    name?: string
    [key: string]: any
  }
}

// 로그인 옵션
export interface SignInOptions {
  captchaToken?: string
}

// 비밀번호 재설정 옵션
export interface ResetPasswordOptions {
  redirectTo?: string
}

// 세션 정보
export interface SessionInfo {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: {
    id: string
    email: string
    [key: string]: any
  }
}

// 인증 컨텍스트 타입
export interface AuthContextType {
  user: any
  signUp: (email: string, password: string, options?: SignUpOptions) => Promise<any>
  signIn: (email: string, password: string, options?: SignInOptions) => Promise<any>
  signOut: () => Promise<void>
  resetPassword: (email: string, options?: ResetPasswordOptions) => Promise<any>
  loading: boolean
  error: string | null
}
