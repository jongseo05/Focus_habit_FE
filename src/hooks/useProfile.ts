import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { UserProfile, FocusSummary } from '@/types/profile'

// Query Keys
export const profileKeys = {
  all: ['profile'] as const,
  profile: (userId: string) => [...profileKeys.all, 'profile', userId] as const,
  focusSummary: (userId: string) => [...profileKeys.all, 'focus-summary', userId] as const,
  weeklyStats: (userId: string) => [...profileKeys.all, 'weekly-stats', userId] as const,
}

// 사용자 프로필 조회
export function useProfile(userId?: string) {
  return useQuery({
    queryKey: profileKeys.profile(userId || ''),
    queryFn: async () => {
      if (!userId) return null
      
      const response = await fetch('/api/profile')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '프로필을 불러오는데 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data as UserProfile
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분
  })
}

// 프로필 업데이트
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (profileData: Partial<UserProfile>) => {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '프로필 업데이트에 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data
    },
    onSuccess: (data) => {
      // 캐시 업데이트
      queryClient.setQueryData(profileKeys.profile(data.user_id), data)
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
    },
  })
}

// 집중 요약 조회
export function useFocusSummary(userId?: string) {
  return useQuery({
    queryKey: profileKeys.focusSummary(userId || ''),
    queryFn: async () => {
      if (!userId) return null
      
      const response = await fetch('/api/profile/focus-summary')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '집중 요약을 불러오는데 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data as FocusSummary
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2분
  })
}

// 주간 통계 조회
export function useWeeklyStats(userId?: string) {
  return useQuery({
    queryKey: profileKeys.weeklyStats(userId || ''),
    queryFn: async () => {
      if (!userId) return null
      
      const response = await fetch('/api/profile/weekly-stats')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '주간 통계를 불러오는데 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5분
  })
}

