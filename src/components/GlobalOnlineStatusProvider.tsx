'use client'

import { useGlobalOnlineStatus } from '@/hooks/useGlobalOnlineStatus'

interface GlobalOnlineStatusProviderProps {
  children: React.ReactNode
}

export function GlobalOnlineStatusProvider({ children }: GlobalOnlineStatusProviderProps) {
  // 전역 온라인 상태 초기화
  useGlobalOnlineStatus({
    autoInitialize: true,
    checkInterval: 10000, // 10초마다 체크
    offlineThreshold: 30000 // 30초
  })

  return <>{children}</>
}

