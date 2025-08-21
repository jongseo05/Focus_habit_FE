// =====================================================
// 스터디룸 상태 복원 훅
// =====================================================

import { useEffect, useRef, useCallback } from 'react'
import { useStudyRoomStore } from '@/stores/studyRoomStore'
import { useFocusSessionStore } from '@/stores/focusSessionStore'
import { useCompetitionStore } from '@/stores/competitionStore'
import { useUser } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface UseStudyRoomStateRestorationProps {
  roomId?: string
  autoRestore?: boolean
}

export function useStudyRoomStateRestoration({ 
  roomId, 
  autoRestore = true 
}: UseStudyRoomStateRestorationProps) {
  const { data: user } = useUser()
  const isInitialMount = useRef(true)
  const hasRestored = useRef(false)
  
  // 스토어 액션들
  const {
    restoreSessionState,
    saveSessionState,
    clearSessionState,
    hasRestorableState,
    currentRoom,
    isSessionRunning,
    currentSessionId
  } = useStudyRoomStore()
  
  const {
    restoreSessionState: restoreFocusSession,
    saveSessionState: saveFocusSession,
    clearSessionState: clearFocusSession,
    isRunning: isFocusSessionRunning
  } = useFocusSessionStore()
  
  const {
    restoreCompetitionState,
    saveCompetitionState,
    clearCompetitionState,
    isActive: isCompetitionActive
  } = useCompetitionStore()

  // 상태 복원 함수
  const restoreState = useCallback(async () => {
    if (!roomId || !user?.id || hasRestored.current) {
      return false
    }

    console.log('스터디룸 상태 복원 시도:', { roomId, userId: user.id })
    
    let restored = false
    
    try {
      // 1. 스터디룸 세션 상태 복원
      if (restoreSessionState()) {
        console.log('스터디룸 세션 상태 복원 성공')
        restored = true
      }
      
      // 2. 집중 세션 상태 복원
      if (restoreFocusSession()) {
        console.log('집중 세션 상태 복원 성공')
        restored = true
      }
      
      // 3. 경쟁 상태 복원
      if (restoreCompetitionState(roomId)) {
        console.log('경쟁 상태 복원 성공')
        restored = true
      }
      
      if (restored) {
        hasRestored.current = true
        toast.success('세션이 성공적으로 복원되었습니다. 계속해서 학습을 진행하세요.')
        console.log('모든 상태 복원 완료')
        return true
      }
      
      return false
    } catch (error) {
      console.error('상태 복원 중 오류:', error)
      toast.error('상태 복원에 실패했습니다')
      return false
    }
  }, [roomId, user?.id, restoreSessionState, restoreFocusSession, restoreCompetitionState])

  // 상태 저장 함수
  const saveState = useCallback(() => {
    if (!roomId) return
    
    try {
      // 1. 스터디룸 세션 상태 저장
      saveSessionState()
      
      // 2. 집중 세션 상태 저장 (세션이 실행 중일 때만)
      if (isFocusSessionRunning) {
        saveFocusSession()
      }
      
      // 3. 경쟁 상태 저장 (경쟁이 활성화되어 있을 때만)
      if (isCompetitionActive) {
        saveCompetitionState()
      }
      
      console.log('스터디룸 상태 저장 완료')
    } catch (error) {
      console.error('상태 저장 중 오류:', error)
    }
  }, [
    roomId, 
    saveSessionState, 
    saveFocusSession, 
    saveCompetitionState,
    isFocusSessionRunning,
    isCompetitionActive
  ])

  // 상태 정리 함수 (복원 거부 시 호출)
  const clearState = useCallback(async () => {
    if (!roomId) return
    
    try {
      console.log('📄 복원 거부 - 저장된 상태들 정리 시작')
      
      // 1. 스터디룸 세션 상태 정리 (localStorage + 스토어)
      clearSessionState()
      
      // 2. 집중 세션 상태 정리 (localStorage + 스토어)
      clearFocusSession()
      
      // 3. 경쟁 상태 정리 (localStorage + 스토어 초기화)
      clearCompetitionState()
      
      // 4. 서버의 활성 경쟁도 강제 종료 (409 Conflict 방지)
      try {
        console.log('🛑 서버의 활성 경쟁 강제 종료 요청')
        const response = await fetch(`/api/social/study-room/${roomId}/competition/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (response.ok) {
          console.log('✅ 서버 경쟁 종료 성공')
        } else if (response.status === 404) {
          console.log('ℹ️ 활성 경쟁 없음 (이미 종료됨)')
        } else {
          console.warn('⚠️ 서버 경쟁 종료 실패:', await response.text())
        }
      } catch (apiError) {
        console.warn('⚠️ 경쟁 종료 API 호출 실패:', apiError)
      }
      
      // 5. 전역 상태 초기화 추가 (새 경쟁 시작 시 충돌 방지)
      hasRestored.current = false
      
      console.log('✅ 클라이언트+서버 상태 정리 완료 - 새 경쟁 생성 가능')
    } catch (error) {
      console.error('❌ 상태 정리 중 오류:', error)
    }
  }, [roomId, clearSessionState, clearFocusSession, clearCompetitionState])

  // 복원 가능한 상태가 있는지 확인
  const canRestore = useCallback(() => {
    if (!roomId) return false
    return hasRestorableState()
  }, [roomId, hasRestorableState])

  // 초기 마운트 시 상태 확인 (자동 복원 비활성화)
  useEffect(() => {
    if (isInitialMount.current && roomId && user?.id) {
      isInitialMount.current = false
      
      // 복원 가능한 상태가 있는지만 확인 (자동 복원하지 않음)
      if (canRestore()) {
        console.log('복원 가능한 상태 발견 - 사용자 선택 대기')
      } else {
        console.log('복원 가능한 상태 없음')
      }
    }
  }, [roomId, user?.id, canRestore])

  // 페이지 언로드 시 상태 저장
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (roomId && (isSessionRunning || isFocusSessionRunning || isCompetitionActive)) {
        saveState()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && roomId) {
        saveState()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [roomId, isSessionRunning, isFocusSessionRunning, isCompetitionActive, saveState])

  // 주기적 상태 저장 (활성 세션이 있을 때만)
  useEffect(() => {
    if (!roomId || (!isSessionRunning && !isFocusSessionRunning && !isCompetitionActive)) {
      return
    }

    const interval = setInterval(() => {
      saveState()
    }, 30 * 1000) // 30초마다 저장

    return () => clearInterval(interval)
  }, [roomId, isSessionRunning, isFocusSessionRunning, isCompetitionActive, saveState])

  return {
    restoreState,
    saveState,
    clearState,
    canRestore: canRestore(),
    hasRestored: hasRestored.current,
    isSessionActive: isSessionRunning || isFocusSessionRunning || isCompetitionActive
  }
}
