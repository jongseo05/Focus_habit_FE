import { useEffect, useRef } from 'react'
import { useOnlineStatusStore } from '@/stores/onlineStatusStore'

interface UseGlobalOnlineStatusOptions {
  autoInitialize?: boolean
  checkInterval?: number
  offlineThreshold?: number
}

export function useGlobalOnlineStatus(options: UseGlobalOnlineStatusOptions = {}) {
  const {
    autoInitialize = true,
    checkInterval = 10000,
    offlineThreshold = 30000
  } = options

  const store = useOnlineStatusStore()
  const cleanupRef = useRef<(() => void) | null>(null)

  // 온라인 상태 초기화
  const initialize = () => {
    // 기존 클린업 함수 실행
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    // 설정 업데이트
    store.setCheckInterval(checkInterval)
    store.setOfflineThreshold(offlineThreshold)

    // 온라인 상태 초기화
    const cleanup = store.initialize()
    cleanupRef.current = typeof cleanup === 'function' ? cleanup : null

    // 사용자 활동 이벤트 리스너 추가
    const updateActivity = () => store.updateLastActivity()

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true })
    })

    // 페이지 가시성 변경 이벤트
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 추가 클린업 함수 반환
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }

  // 자동 초기화
  useEffect(() => {
    if (autoInitialize && !store.isInitialized) {
      const cleanup = initialize()
      return cleanup
    }
  }, [autoInitialize, store.isInitialized, checkInterval, offlineThreshold])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return {
    currentUserStatus: store.currentUserStatus,
    isCurrentUserOnline: store.currentUserStatus === 'online',
    updateLastActivity: store.updateLastActivity,
    checkCurrentUserOnline: store.checkCurrentUserOnline,
    initialize,
    reset: store.reset
  }
}

