'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, useEffect } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 기본 쿼리 설정 최적화
            staleTime: 5 * 60 * 1000, // 5분
            gcTime: 10 * 60 * 1000, // 10분
            refetchOnWindowFocus: false, // 윈도우 포커스 시 자동 새로고침 비활성화
            refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
            refetchOnMount: true, // 마운트 시 새로고침
            retry: (failureCount, error: any) => {
              // 네트워크 오류가 아닌 경우 재시도하지 않음
              if (error?.status >= 400 && error?.status < 500) {
                return false
              }
              return failureCount < 2
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // 뮤테이션 설정 최적화
            retry: 1,
            retryDelay: 1000,
          },
        },

      })
  )

  // 페이지 가시성 변경 시 쿼리 관리 최적화
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨질 때 불필요한 쿼리 중단
        queryClient.cancelQueries()
      } else {
        // 페이지가 다시 보일 때 모든 쿼리 새로고침
        queryClient.invalidateQueries()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  // 메모리 사용량 모니터링 및 최적화
  useEffect(() => {
    const interval = setInterval(() => {
      // 캐시 크기 모니터링
      const cacheSize = queryClient.getQueryCache().getAll().length
      const mutationSize = queryClient.getMutationCache().getAll().length
      
      // 캐시가 너무 커지면 오래된 쿼리 정리
      if (cacheSize > 100) {
        queryClient.getQueryCache().clear()
        console.log('React Query 캐시 정리됨 (크기:', cacheSize, ')')
      }
      
      // 뮤테이션 캐시도 정리
      if (mutationSize > 50) {
        queryClient.getMutationCache().clear()
        console.log('React Query 뮤테이션 캐시 정리됨 (크기:', mutationSize, ')')
      }
    }, 60000) // 1분마다 체크

    return () => clearInterval(interval)
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
