import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabaseBrowser } from '@/lib/supabase/client'

// 습관 타입 정의 (기본적인 구조)
export interface Habit {
  id: string
  user_id: string
  name: string
  description?: string
  category: string
  color: string
  icon?: string
  frequency_type: 'daily' | 'weekly' | 'custom'
  frequency_value: number
  target_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HabitRecord {
  id: string
  habit_id: string
  date: string
  completed_count: number
  notes?: string
  created_at: string
}

// Query Keys
export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  list: (filters: any) => [...habitKeys.lists(), filters] as const,
  details: () => [...habitKeys.all, 'detail'] as const,
  detail: (id: string) => [...habitKeys.details(), id] as const,
  records: () => [...habitKeys.all, 'records'] as const,
  record: (habitId: string, date: string) => [...habitKeys.records(), habitId, date] as const,
  stats: () => [...habitKeys.all, 'stats'] as const,
}

// 사용자의 모든 습관 조회
export function useHabits(filters?: {
  status?: 'active' | 'inactive' | 'all'
  category?: string
}) {
  return useQuery({
    queryKey: habitKeys.list(filters),
    queryFn: async () => {
      const supabase = supabaseBrowser()
      let query = supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: false })
      
      // 필터 적용
      if (filters?.status === 'active') {
        query = query.eq('is_active', true)
      } else if (filters?.status === 'inactive') {
        query = query.eq('is_active', false)
      }
      
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }
      
      const { data, error } = await query
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as Habit[]
    },
    staleTime: 2 * 60 * 1000, // 2분
  })
}

// 특정 습관 상세 조회
export function useHabit(habitId: string) {
  return useQuery({
    queryKey: habitKeys.detail(habitId),
    queryFn: async () => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('id', habitId)
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as Habit
    },
    enabled: !!habitId,
    staleTime: 5 * 60 * 1000,
  })
}

// 습관 기록 조회 (특정 날짜 범위)
export function useHabitRecords(habitId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: habitKeys.record(habitId, `${startDate}_${endDate}`),
    queryFn: async () => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('habit_records')
        .select('*')
        .eq('habit_id', habitId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as HabitRecord[]
    },
    enabled: !!habitId && !!startDate && !!endDate,
    staleTime: 1 * 60 * 1000, // 1분
  })
}

// 습관 생성
export function useCreateHabit() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (habitData: Omit<Habit, 'id' | 'created_at' | 'updated_at'>) => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('habits')
        .insert(habitData)
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as Habit
    },
    onSuccess: () => {
      // 습관 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() })
    },
  })
}

// 습관 업데이트
export function useUpdateHabit() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ habitId, updates }: {
      habitId: string
      updates: Partial<Habit>
    }) => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', habitId)
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as Habit
    },
    onSuccess: (data) => {
      // 특정 습관 캐시 업데이트
      queryClient.setQueryData(habitKeys.detail(data.id), data)
      // 습관 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() })
    },
  })
}

// 습관 삭제
export function useDeleteHabit() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (habitId: string) => {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
      
      if (error) {
        throw new Error(error.message)
      }
      
      return { habitId }
    },
    onSuccess: (data) => {
      // 삭제된 습관 캐시 제거
      queryClient.removeQueries({ queryKey: habitKeys.detail(data.habitId) })
      // 습관 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: habitKeys.lists() })
    },
  })
}

// 습관 완료 기록
export function useCompleteHabit() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ habitId, date, count = 1, notes }: {
      habitId: string
      date: string
      count?: number
      notes?: string
    }) => {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('habit_records')
        .upsert({
          habit_id: habitId,
          date,
          completed_count: count,
          notes,
        })
        .select()
        .single()
      
      if (error) {
        throw new Error(error.message)
      }
      
      return data as HabitRecord
    },
    onSuccess: (data) => {
      // 해당 습관의 기록 캐시 무효화
      queryClient.invalidateQueries({ 
        queryKey: habitKeys.records(), 
        predicate: (query) => 
          query.queryKey.includes(data.habit_id)
      })
    },
  })
}
