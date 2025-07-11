import { supabaseBrowser } from '@/lib/supabase/client'
import type { SignUpFormData, LoginFormData, AuthResponse } from '@/types/user'
import type { SignUpOptions, SignInOptions } from '@/types/auth'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// 회원가입 함수
export const signUp = async (
  formData: SignUpFormData,
  options?: SignUpOptions
): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: options?.emailRedirectTo || `${window.location.origin}/auth/confirm`,
        data: {
          name: formData.name,
          ...options?.data
        }
      }
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    // 사용자 프로필 테이블에 추가 정보 저장 (선택사항)
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          name: formData.name,
          email: formData.email
        })

      if (profileError) {
        console.warn('프로필 생성 중 오류:', profileError.message)
      }
    }

    return {
      success: true,
      user: data.user,
      message: '회원가입이 완료되었습니다. 이메일을 확인해주세요.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.'
    }
  }
}

// 로그인 함수
export const signIn = async (
  formData: LoginFormData,
  options?: SignInOptions
): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
      options: {
        captchaToken: options?.captchaToken
      }
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      user: data.user,
      message: '로그인이 완료되었습니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.'
    }
  }
}

// 로그아웃 함수
export const signOut = async (): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      message: '로그아웃이 완료되었습니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.'
    }
  }
}

// 현재 사용자 정보 가져오기
export const getCurrentUser = async () => {
  try {
    const supabase = supabaseBrowser()
    
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      throw error
    }

    return user
  } catch (error) {
    console.error('사용자 정보 가져오기 오류:', error)
    return null
  }
}

// 비밀번호 재설정 이메일 전송
export const resetPassword = async (email: string): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      message: '비밀번호 재설정 이메일이 전송되었습니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '비밀번호 재설정 중 오류가 발생했습니다.'
    }
  }
}

// 새 비밀번호 설정
export const updatePassword = async (newPassword: string): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '비밀번호 변경 중 오류가 발생했습니다.'
    }
  }
}

// 이메일 확인
export const confirmEmail = async (token: string): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email'
    })

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      user: data.user,
      message: '이메일 인증이 완료되었습니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '이메일 인증 중 오류가 발생했습니다.'
    }
  }
}
