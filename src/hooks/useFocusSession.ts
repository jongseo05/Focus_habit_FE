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
      const supabase = supabaseBrowser()
      
      let query = supabase
        .from('focus_session')
        .select('*')
        .order('started_at', { ascending: false })

      // 필터 적용
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id)
      }
      
      if (filters.start_date) {
        query = query.gte('started_at', `${filters.start_date}T00:00:00`)
      }
      
      if (filters.end_date) {
        query = query.lte('started_at', `${filters.end_date}T23:59:59`)
      }
      
      if (filters.session_type) {
        query = query.eq('session_type', filters.session_type)
      }
      
      if (filters.context_tag) {
        query = query.eq('context_tag', filters.context_tag)
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message)
      }

      return data as FocusSession[]
    },
    staleTime: 2 * 60 * 1000, // 2분
  })
}

// 특정 집중 세션 조회
export function useFocusSession(sessionId: string) {
  return useQuery({
    queryKey: focusSessionKeys.detail(sessionId),
    queryFn: async (): Promise<FocusSession> => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error) {
        throw new Error(error.message)
      }

      return data as FocusSession
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