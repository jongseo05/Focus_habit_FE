import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Query Keys
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: (userId: string) => [...authKeys.all, 'profile', userId] as const,
}

// 현재 사용자 정보 조회
export function useUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async () => {
      const supabase = supabaseBrowser()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return user
    },
    staleTime: 5 * 60 * 1000, // 5분
    retry: false, // 인증 실패 시 재시도하지 않음
  })
}

// useAuth 훅 (기존 훅들과 호환성을 위해)
export function useAuth() {
  const { data: user, isLoading, error } = useUser()
  
  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user
  }
}

// 사용자 프로필 조회
export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: authKeys.profile(userId || ''),
    queryFn: async () => {
      if (!userId) return null
      
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data
    },
    enabled: !!userId, // userId가 있을 때만 실행
    staleTime: 10 * 60 * 1000, // 10분
  })
}

// 사용자 프로필 업데이트
export function useUpdateUserProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (profileData: {
      user_id: string
      name?: string
      avatar_url?: string
      bio?: string
    }) => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData)
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data
    },
    onSuccess: (data) => {
      // 캐시 업데이트
      queryClient.setQueryData(authKeys.profile(data.user_id), data)
      // 사용자 목록 쿼리가 있다면 무효화
      queryClient.invalidateQueries({ queryKey: authKeys.all })
    },
  })
}

// 비밀번호 변경
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (newPassword: string) => {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { success: true }
    },
  })
}

// 이메일 변경
export function useUpdateEmail() {
  return useMutation({
    mutationFn: async (newEmail: string) => {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { success: true }
    },
  })
}

// 로그아웃
export function useSignOut() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { success: true }
    },
    onSuccess: () => {
      // 모든 인증 관련 캐시 삭제
      queryClient.removeQueries({ queryKey: authKeys.all })
      // 다른 사용자별 캐시도 삭제할 수 있음
      queryClient.clear()
    },
  })
}
