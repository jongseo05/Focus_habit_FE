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
        emailRedirectTo: options?.emailRedirectTo || process.env.NEXT_PUBLIC_EMAIL_CONFIRM_URL || `${window.location.origin}/auth/confirm`,
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
      try {
        // handle 생성 (이메일에서 @ 앞부분 사용, 중복 방지)
        let handle = formData.email.split('@')[0]
        let counter = 1
        
        // handle 중복 확인 및 수정 (더 안전한 방식)
        let isHandleUnique = false
        while (!isHandleUnique && counter <= 100) {
          try {
            const { data: existingProfile, error: checkError } = await supabase
              .from('profiles')
              .select('handle')
              .eq('handle', handle)
              .maybeSingle() // single() 대신 maybeSingle() 사용
            
            if (checkError) {
              console.warn('handle 중복 확인 중 오류:', checkError.message)
              break
            }
            
            if (!existingProfile) {
              isHandleUnique = true // 중복되지 않는 handle를 찾음
            } else {
              // 중복 시 숫자 추가
              handle = `${formData.email.split('@')[0]}${counter}`
              counter++
            }
          } catch (checkError) {
            console.warn('handle 중복 확인 중 예외:', checkError)
            break
          }
        }
        
        // 무한 루프 방지
        if (!isHandleUnique) {
          handle = `${formData.email.split('@')[0]}_${Date.now()}`
        }
        
        console.log('프로필 생성 시도:', { user_id: data.user.id, display_name: formData.name, handle })
        
        // 프로필 생성 전 테이블 존재 여부 확인
        const { data: tableInfo, error: tableError } = await supabase
          .from('profiles')
          .select('*')
          .limit(1)
        
        if (tableError) {
          console.error('profiles 테이블 접근 오류:', tableError)
          return {
            success: true,
            user: data.user,
            message: '회원가입이 완료되었습니다. 이메일을 확인해주세요. (프로필 설정은 나중에 완료할 수 있습니다.)',
            warning: `프로필 테이블 접근 오류: ${tableError.message}. 나중에 설정 페이지에서 완료해주세요.`
          }
        }
        
        console.log('profiles 테이블 접근 성공, 프로필 생성 시도...')
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            display_name: formData.name,
            handle: handle,
            status: 'offline'
          })

        if (profileError) {
          console.error('프로필 생성 중 오류:', profileError)
          console.error('프로필 생성 상세 정보:', {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code,
            fullError: JSON.stringify(profileError, null, 2)
          })
          
          // 프로필 생성 실패 시에도 회원가입은 성공이지만 사용자에게 알림
          return {
            success: true,
            user: data.user,
            message: '회원가입이 완료되었습니다. 이메일을 확인해주세요. (프로필 설정은 나중에 완료할 수 있습니다.)',
            warning: `프로필 설정에 실패했습니다: ${profileError.message}. 나중에 설정 페이지에서 완료해주세요.`
          }
        }
        
        console.log('프로필 생성 성공:', handle)
      } catch (profileError) {
        console.error('프로필 생성 중 예외 발생:', profileError)
        // 예외 발생 시에도 회원가입은 성공으로 처리
        return {
          success: true,
          user: data.user,
          message: '회원가입이 완료되었습니다. 이메일을 확인해주세요. (프로필 설정은 나중에 완료할 수 있습니다.)',
          warning: '프로필 설정에 실패했습니다. 나중에 설정 페이지에서 완료해주세요.'
        }
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
      redirectTo: process.env.NEXT_PUBLIC_PASSWORD_RESET_URL || `${window.location.origin}/auth/reset-password`
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

// Google 로그인
export const signInWithGoogle = async (): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    // 개발 환경과 프로덕션 환경에 따른 리디렉션 URL 설정
    const redirectTo = process.env.NEXT_PUBLIC_EMAIL_CONFIRM_URL?.replace('/auth/confirm', '/auth/callback') || `${window.location.origin}/auth/callback`
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
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
      message: 'Google 로그인을 진행합니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Google 로그인 중 오류가 발생했습니다.'
    }
  }
}

// Apple 로그인
export const signInWithApple = async (): Promise<AuthResponse> => {
  try {
    const supabase = supabaseBrowser()
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: process.env.NEXT_PUBLIC_EMAIL_CONFIRM_URL?.replace('/auth/confirm', '/auth/callback') || `${window.location.origin}/auth/callback`
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
      message: 'Apple 로그인을 진행합니다.'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Apple 로그인 중 오류가 발생했습니다.'
    }
  }
}
