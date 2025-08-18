import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { 
  FocusSession, 
  CreateFocusSessionData, 
  UpdateFocusSessionData,
  FocusSessionFilters 
} from '@/types/database'

// 쿼리 키 팩토리
const focusSessionKeys = {
  all: ['focus-sessions'] as const,
  lists: () => [...focusSessionKeys.all, 'list'] as const,
  list: (filters: FocusSessionFilters) => [...focusSessionKeys.lists(), filters] as const,
  details: () => [...focusSessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...focusSessionKeys.details(), id] as const,
  active: () => [...focusSessionKeys.all, 'active'] as const,
  today: () => [...focusSessionKeys.all, 'today'] as const,
}

// 집중 세션 목록 조회
export function useFocusSessions(filters: FocusSessionFilters = {}) {
  return useQuery({
    queryKey: focusSessionKeys.list(filters),
    queryFn: async (): Promise<FocusSession[]> => {
      // 쿼리 파라미터 생성
      const searchParams = new URLSearchParams()
      
      if (filters.user_id) searchParams.set('user_id', filters.user_id)
      if (filters.start_date) searchParams.set('start_date', filters.start_date)
      if (filters.end_date) searchParams.set('end_date', filters.end_date)
      if (filters.session_type) searchParams.set('session_type', filters.session_type)
      if (filters.context_tag) searchParams.set('context_tag', filters.context_tag)
      if (filters.limit) searchParams.set('limit', filters.limit.toString())
      if (filters.offset) searchParams.set('offset', filters.offset.toString())
      
      const response = await fetch(`/api/focus-session?${searchParams.toString()}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '집중 세션 목록을 불러오는데 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data || []
    },
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
  })
}

// 특정 집중 세션 조회
export function useFocusSession(sessionId: string) {
  return useQuery({
    queryKey: focusSessionKeys.detail(sessionId),
    queryFn: async (): Promise<FocusSession> => {
      const response = await fetch(`/api/focus-session/${sessionId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '집중 세션을 불러오는데 실패했습니다.')
      }
      
      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      return result.data
    },
    enabled: !!sessionId,
    staleTime: 1 * 60 * 1000, // 1분
  })
}

// 활성 세션 조회 (종료되지 않은 세션)
export function useActiveFocusSession(userId?: string) {
  return useQuery({
    queryKey: focusSessionKeys.active(),
    queryFn: async (): Promise<FocusSession | null> => {
      if (!userId) return null
      
      try {
        // 우리가 만든 API 사용
        const response = await fetch('/api/focus-session?active=true')
        
        if (!response.ok) {
          throw new Error(`API 호출 실패: ${response.status}`)
        }
        
        const result = await response.json()
        
        if (!result.success) {
          throw new Error(result.error || '활성 세션 조회에 실패했습니다.')
        }
        
        return result.data as FocusSession | null
      } catch (error) {
        console.error('활성 세션 조회 오류:', error)
        throw error
      }
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30초
    refetchInterval: false, // 자동 갱신 비활성화
  })
}

// 오늘의 집중 세션 조회
export function useTodayFocusSessions(userId?: string) {
  const today = new Date().toISOString().split('T')[0]
  
  return useFocusSessions({
    user_id: userId,
    start_date: today,
    end_date: today
  })
}

// 집중 세션 생성
export function useCreateFocusSession() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (sessionData: CreateFocusSessionData): Promise<FocusSession> => {
      const response = await fetch('/api/focus-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '세션 생성에 실패했습니다.')
      }

      return result.data
    },
    onSuccess: () => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.today() })
    },
  })
}

// 집중 세션 업데이트
export function useUpdateFocusSession() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      sessionId, 
      updateData 
    }: { 
      sessionId: string
      updateData: UpdateFocusSessionData 
    }): Promise<FocusSession> => {
      const response = await fetch(`/api/focus-session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '세션 업데이트에 실패했습니다.')
      }

      return result.data
    },
    onSuccess: (data) => {
      // 캐시 업데이트
      queryClient.setQueryData(focusSessionKeys.detail(data.session_id), data)
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.today() })
    },
  })
}

// 집중 세션 종료
export function useEndFocusSession() {
  const updateSession = useUpdateFocusSession()
  
  return {
    ...updateSession,
    endSession: (sessionId: string) => {
      return updateSession.mutateAsync({
        sessionId,
        updateData: {
          ended_at: new Date().toISOString()
        }
      })
    }
  }
}

// 집중 세션 삭제
export function useDeleteFocusSession() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (sessionId: string): Promise<void> => {
      const response = await fetch(`/api/focus-session/${sessionId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '세션 삭제에 실패했습니다.')
      }
    },
    onSuccess: () => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active() })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.today() })
    },
  })
} 