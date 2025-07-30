import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DailyReportData } from '@/types/dailyReport'

// =====================================================
// 1. Query Keys
// =====================================================

export const reportKeys = {
  all: ['report'] as const,
  daily: (date: string) => [...reportKeys.all, 'daily', date] as const,
  weekly: (year: number, week: number) => [...reportKeys.all, 'weekly', year, week] as const,
  summary: (date: string) => [...reportKeys.all, 'summary', date] as const,
}

// =====================================================
// 2. 일일 리포트 훅
// =====================================================

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: async (): Promise<DailyReportData> => {
      console.log('🚀 Supabase 직접 요청 시작:', date)
      
      try {
        // Supabase 클라이언트 직접 사용
        const { ReportService } = await import('@/lib/database/reportService')
        const { supabaseBrowser } = await import('@/lib/supabase/client')
        
        const supabase = supabaseBrowser()
        
        // 사용자 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          console.error('❌ 인증 오류:', authError)
          throw new Error('인증이 필요합니다')
        }
        
        console.log('✅ 인증 성공, 사용자 ID:', user.id)
        
        // ReportService 직접 호출
        const result = await ReportService.generateDailyReport(user.id, date)
        
        console.log('📊 리포트 생성 결과:', result)
        
        if (!result.success) {
          throw new Error(result.error || '리포트 생성에 실패했습니다')
        }
        
        console.log('✅ 리포트 데이터 반환:', result.data)
        if (!result.data) {
          throw new Error('리포트 데이터가 없습니다')
        }
        return result.data
      } catch (error) {
        console.error('❌ 리포트 요청 중 오류:', error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// =====================================================
// 3. 주간 리포트 훅
// =====================================================

export function useWeeklyReport(year: number, week: number) {
  return useQuery({
    queryKey: reportKeys.weekly(year, week),
    queryFn: async () => {
      const response = await fetch(`/api/report/weekly?year=${year}&week=${week}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '주간 리포트를 불러오는데 실패했습니다.')
      }
      
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
    retry: 2,
  })
}

// =====================================================
// 4. 일일 요약 훅
// =====================================================

export function useDailySummary(date: string) {
  return useQuery({
    queryKey: reportKeys.summary(date),
    queryFn: async () => {
      const response = await fetch(`/api/report/summary?date=${date}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '일일 요약을 불러오는데 실패했습니다.')
      }
      
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
  })
}

// =====================================================
// 5. 리포트 새로고침 뮤테이션
// =====================================================

export function useRefreshDailyReport() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      const response = await fetch(`/api/report/daily?date=${date}&refresh=true`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 새로고침에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (data, { date }) => {
      // 캐시 업데이트
      queryClient.setQueryData(reportKeys.daily(date), data)
      
      // 관련 쿼리들 무효화
      queryClient.invalidateQueries({
        queryKey: reportKeys.summary(date)
      })
    },
  })
}

// =====================================================
// 6. 리포트 내보내기 뮤테이션
// =====================================================

export function useExportReport() {
  return useMutation({
    mutationFn: async ({ 
      type, 
      date, 
      format = 'pdf' 
    }: { 
      type: 'daily' | 'weekly'
      date: string
      format?: 'pdf' | 'csv' | 'json'
    }) => {
      const response = await fetch(`/api/report/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, date, format }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 내보내기에 실패했습니다.')
      }
      
      return response.blob()
    },
    onSuccess: (blob, { type, date, format }) => {
      // 파일 다운로드
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `focus-report-${type}-${date}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
  })
}

// =====================================================
// 7. 리포트 공유 뮤테이션
// =====================================================

export function useShareReport() {
  return useMutation({
    mutationFn: async ({ 
      type, 
      date, 
      shareType = 'link' 
    }: { 
      type: 'daily' | 'weekly'
      date: string
      shareType?: 'link' | 'email' | 'social'
    }) => {
      const response = await fetch(`/api/report/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, date, shareType }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 공유에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      // 공유 성공 처리 (예: 토스트 메시지)
      console.log('리포트 공유 성공:', data)
    },
  })
}

// =====================================================
// 8. 리포트 프리페치 훅
// =====================================================

export function usePrefetchReport() {
  const queryClient = useQueryClient()
  
  return {
    prefetchDaily: (date: string) => {
      queryClient.prefetchQuery({
        queryKey: reportKeys.daily(date),
        queryFn: async () => {
          const response = await fetch(`/api/report/daily?date=${date}`)
          if (!response.ok) throw new Error('Prefetch failed')
          return response.json()
        },
        staleTime: 5 * 60 * 1000,
      })
    },
    
    prefetchWeekly: (year: number, week: number) => {
      queryClient.prefetchQuery({
        queryKey: reportKeys.weekly(year, week),
        queryFn: async () => {
          const response = await fetch(`/api/report/weekly?year=${year}&week=${week}`)
          if (!response.ok) throw new Error('Prefetch failed')
          return response.json()
        },
        staleTime: 10 * 60 * 1000,
      })
    },
  }
} 