// =====================================================
// 스터디룸 집중세션 동기화 훅
// =====================================================

import { useEffect, useCallback, useRef } from 'react'
import { useStudyRoomStore, useStudyRoomActions } from '@/stores/studyRoomStore'

interface UseStudyRoomFocusSessionSyncOptions {
  sessionId: string | null
  currentScore: number
  averageScore: number
  isRunning: boolean
  onSyncError?: (error: string) => void
}

export function useStudyRoomFocusSessionSync({
  sessionId,
  currentScore,
  averageScore,
  isRunning,
  onSyncError
}: UseStudyRoomFocusSessionSyncOptions) {
  
  const { 
    currentSessionId: storeSessionId,
    isSessionRunning: storeIsRunning,
    currentFocusScore: storeCurrentScore,
    averageFocusScore: storeAverageScore
  } = useStudyRoomStore()
  
  const { 
    startSession, 
    endSession, 
    updateFocusScore 
  } = useStudyRoomActions()

  const lastSyncTime = useRef(0)
  const syncThrottle = useRef<NodeJS.Timeout | null>(null)

  // 세션 시작 동기화
  useEffect(() => {
    if (isRunning && sessionId && !storeIsRunning) {
      startSession(sessionId)
    }
  }, [isRunning, sessionId, storeIsRunning, startSession])

  // 세션 종료 동기화
  useEffect(() => {
    if (!isRunning && storeIsRunning) {
      endSession()
    }
  }, [isRunning, storeIsRunning, endSession])

  // 집중도 점수 동기화 (스로틀링 적용)
  useEffect(() => {
    if (!isRunning || !sessionId) return
    
    const now = Date.now()
    if (now - lastSyncTime.current < 2000) { // 2초 제한
      return
    }

    if (syncThrottle.current) {
      clearTimeout(syncThrottle.current)
    }

    syncThrottle.current = setTimeout(() => {
      updateFocusScore(currentScore, averageScore)
      lastSyncTime.current = Date.now()
    }, 500)

  }, [currentScore, averageScore, isRunning, sessionId, updateFocusScore])

  // 스토어와 로컬 상태 불일치 감지 및 복구
  const syncStateWithStore = useCallback(() => {
    if (sessionId !== storeSessionId) {
      console.warn('세션 ID 불일치 감지:', { local: sessionId, store: storeSessionId })
      if (onSyncError) {
        onSyncError('세션 상태가 동기화되지 않았습니다.')
      }
    }

    if (isRunning !== storeIsRunning) {
      console.warn('세션 실행 상태 불일치 감지:', { local: isRunning, store: storeIsRunning })
      if (isRunning && sessionId) {
        startSession(sessionId)
      } else if (!isRunning) {
        endSession()
      }
    }
  }, [sessionId, storeSessionId, isRunning, storeIsRunning, startSession, endSession, onSyncError])

  // 주기적 동기화 체크 (30초마다)
  useEffect(() => {
    const interval = setInterval(syncStateWithStore, 30000)
    return () => clearInterval(interval)
  }, [syncStateWithStore])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (syncThrottle.current) {
        clearTimeout(syncThrottle.current)
      }
    }
  }, [])

  return {
    // 동기화 상태 정보
    isInSync: sessionId === storeSessionId && isRunning === storeIsRunning,
    storeState: {
      sessionId: storeSessionId,
      isRunning: storeIsRunning,
      currentScore: storeCurrentScore,
      averageScore: storeAverageScore
    },
    
    // 수동 동기화 함수
    forcSync: syncStateWithStore
  }
}
