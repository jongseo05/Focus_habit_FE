import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  saveFocusSessionState, 
  loadFocusSessionState, 
  clearFocusSessionState 
} from '@/lib/utils/sessionPersistence'

// =====================================================
// 집중세션 전용 Zustand 스토어
// =====================================================

export interface FocusSessionData {
  session_id: string
  started_at: string
  goal_min: number | null
  context_tag: string | null
  session_type: 'study' | 'work' | 'reading' | 'study_room'
  notes: string | null
  focus_score: number | null
}

interface FocusSessionState {
  // === 로컬 세션 상태 ===
  isRunning: boolean
  isPaused: boolean
  elapsed: number // 초 단위
  focusScore: number
  startTime: number | null
  
  // === 서버 세션 정보 ===
  currentSessionId: string | null
  serverSessionData: FocusSessionData | null
  
  // === 동기화 상태 ===
  isLoading: boolean
  lastSyncTime: number | null
  syncError: string | null
  
  // === 세션 통계 ===
  totalSessionsToday: number
  totalFocusTimeToday: number // 분 단위
}

interface FocusSessionActions {
  // === 로컬 세션 제어 ===
  startSession: () => void
  pauseSession: () => void
  resumeSession: () => void
  stopSession: () => void
  updateElapsed: () => void
  setElapsed: (seconds: number) => void
  updateFocusScore: (score: number) => void
  
  // === 서버 세션 관리 ===
  setCurrentSession: (sessionId: string, sessionData: FocusSessionData) => void
  clearCurrentSession: () => void
  syncWithServer: () => Promise<boolean>
  
  // === 상태 관리 ===
  setLoading: (loading: boolean) => void
  setSyncError: (error: string | null) => void
  updateLastSync: () => void
  
  // === 통계 업데이트 ===
  updateDailyStats: (sessions: number, focusTime: number) => void
  
  // === 유틸리티 ===
  formatTime: (seconds: number) => string
  getDuration: () => number // 현재 세션 지속 시간 (분)
  isSessionActive: () => boolean
  
  // === 상태 복원 관리 ===
  restoreSessionState: () => boolean
  saveSessionState: () => void
  clearSessionState: () => void
  
  reset: () => void
}

type FocusSessionStore = FocusSessionState & FocusSessionActions

const initialState: FocusSessionState = {
  // 로컬 세션 상태
  isRunning: false,
  isPaused: false,
  elapsed: 0,
  focusScore: 85,
  startTime: null,
  
  // 서버 세션 정보
  currentSessionId: null,
  serverSessionData: null,
  
  // 동기화 상태
  isLoading: false,
  lastSyncTime: null,
  syncError: null,
  
  // 세션 통계
  totalSessionsToday: 0,
  totalFocusTimeToday: 0
}

export const useFocusSessionStore = create<FocusSessionStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // === 로컬 세션 제어 ===
      startSession: () => {
        const now = Date.now()
        
        // 디버깅용 로그 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development') {
          console.log('🎯 세션 시작:', {
            startTime: now,
            formattedTime: new Date(now).toLocaleTimeString(),
            timestamp: new Date(now).toISOString()
          })
        }
        
        set((prevState) => {
          const newState = {
            ...prevState,
            isRunning: true,
            isPaused: false,
            startTime: now,
            elapsed: 0,
            syncError: null
          }
          
          // 상태 변경 확인용 로그
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 세션 상태 변경:', {
              before: {
                isRunning: prevState.isRunning,
                startTime: prevState.startTime,
                elapsed: prevState.elapsed
              },
              after: {
                isRunning: newState.isRunning,
                startTime: newState.startTime,
                elapsed: newState.elapsed
              }
            })
          }
          
          return newState
        })
      },
      
      pauseSession: () => {
        set((state) => ({
          isPaused: !state.isPaused
        }))
      },
      
      resumeSession: () => {
        set({ isPaused: false })
      },
      
      stopSession: () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🛑 세션 종료')
        }
        
        set((prevState) => {
          const newState = {
            ...prevState,
            isRunning: false,
            isPaused: false,
            elapsed: 0,
            startTime: null
          }
          
          // 상태 변경 확인용 로그
          if (process.env.NODE_ENV === 'development') {
            console.log('🔄 세션 종료 상태 변경:', {
              before: {
                isRunning: prevState.isRunning,
                startTime: prevState.startTime,
                elapsed: prevState.elapsed
              },
              after: {
                isRunning: newState.isRunning,
                startTime: newState.startTime,
                elapsed: newState.elapsed
              }
            })
          }
          
          return newState
        })
      },
      
      updateElapsed: () => {
        set((state) => {
          if (state.isRunning && !state.isPaused && state.startTime) {
            const now = Date.now()
            const elapsed = Math.floor((now - state.startTime) / 1000)
            
            // 디버깅용 로그 (매번 출력하도록 변경)
            if (process.env.NODE_ENV === 'development') {
              console.log('⏱️ 타이머 업데이트:', {
                isRunning: state.isRunning,
                isPaused: state.isPaused,
                startTime: state.startTime,
                currentTime: now,
                elapsed: elapsed,
                previousElapsed: state.elapsed,
                formattedTime: `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
              })
            }
            
            // elapsed가 실제로 변경되었는지 확인
            if (elapsed !== state.elapsed) {
              return { elapsed }
            } else {
              return state
            }
          }
          
          // 조건을 만족하지 않는 경우 디버깅 로그
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ 타이머 업데이트 조건 불만족:', {
              isRunning: state.isRunning,
              isPaused: state.isPaused,
              hasStartTime: !!state.startTime,
              startTime: state.startTime,
              currentElapsed: state.elapsed
            })
          }
          
          return state
        })
      },
      
      setElapsed: (seconds: number) => {
        set((state) => ({
          ...state,
          elapsed: seconds
        }))
      },
      
      updateFocusScore: (score: number) => {
        set({ focusScore: Math.max(0, Math.min(100, score)) })
      },
      
      // === 서버 세션 관리 ===
      setCurrentSession: (sessionId: string, sessionData: FocusSessionData) => {
        set({
          currentSessionId: sessionId,
          serverSessionData: sessionData,
          syncError: null
        })
        get().updateLastSync()
      },
      
      clearCurrentSession: () => {
        set({
          currentSessionId: null,
          serverSessionData: null
        })
      },
      
      syncWithServer: async (): Promise<boolean> => {
        const state = get()
        if (!state.currentSessionId) return false
        
        set({ isLoading: true, syncError: null })
        
        try {
          // 활성 세션 조회
          const response = await fetch('/api/focus-session?active=true')
          
          if (!response.ok) {
            throw new Error(`서버 동기화 실패: ${response.status}`)
          }
          
          const result = await response.json()
          
          if (result.success && result.data) {
            set({
              serverSessionData: result.data,
              isLoading: false,
              syncError: null
            })
            get().updateLastSync()
            return true
          } else {
            // 서버에 활성 세션이 없으면 로컬 상태도 정리
            get().clearCurrentSession()
            get().stopSession()
            set({ isLoading: false })
            return false
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
          set({
            isLoading: false,
            syncError: errorMessage
          })
          return false
        }
      },
      
      // === 상태 관리 ===
      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
      
      setSyncError: (error: string | null) => {
        set({ syncError: error })
      },
      
      updateLastSync: () => {
        set({ lastSyncTime: Date.now() })
      },
      
      // === 통계 업데이트 ===
      updateDailyStats: (sessions: number, focusTime: number) => {
        set({
          totalSessionsToday: sessions,
          totalFocusTimeToday: focusTime
        })
      },
      
      // === 유틸리티 ===
      formatTime: (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      },
      
      getDuration: () => {
        const state = get()
        return Math.floor(state.elapsed / 60)
      },
      
      isSessionActive: () => {
        const state = get()
        return state.isRunning && !!state.currentSessionId
      },
      
      // === 상태 복원 관리 ===
      restoreSessionState: () => {
        const savedState = loadFocusSessionState()
        if (savedState) {
          set({
            isRunning: savedState.isRunning,
            isPaused: savedState.isPaused,
            elapsed: savedState.elapsed,
            focusScore: savedState.focusScore,
            startTime: savedState.startTime,
            currentSessionId: savedState.sessionId
          })
          console.log('집중 세션 상태 복원 완료')
          return true
        }
        return false
      },
      
      saveSessionState: () => {
        const state = get()
        saveFocusSessionState({
          sessionId: state.currentSessionId,
          isRunning: state.isRunning,
          isPaused: state.isPaused,
          elapsed: state.elapsed,
          focusScore: state.focusScore,
          startTime: state.startTime,
          goalMinutes: null,
          sessionType: 'study_room',
          roomId: null
        })
      },
      
      clearSessionState: () => {
        clearFocusSessionState()
      },
      
      reset: () => {
        set(initialState)
      }
    }),
    {
      name: 'focus-session-storage',
      // 중요한 상태만 지속화
      partialize: (state) => ({
        currentSessionId: state.currentSessionId,
        serverSessionData: state.serverSessionData,
        totalSessionsToday: state.totalSessionsToday,
        totalFocusTimeToday: state.totalFocusTimeToday,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
)

// =====================================================
// 선택자 훅들 (성능 최적화) - getSnapshot 캐싱 문제 해결
// =====================================================

// 개별 상태 선택자들 (무한 루프 방지)
export const useFocusSessionState = () => ({
  isRunning: useFocusSessionStore((state) => state.isRunning),
  isPaused: useFocusSessionStore((state) => state.isPaused),
  elapsed: useFocusSessionStore((state) => state.elapsed),
  focusScore: useFocusSessionStore((state) => state.focusScore),
  startTime: useFocusSessionStore((state) => state.startTime),
  currentSessionId: useFocusSessionStore((state) => state.currentSessionId),
  formatTime: useFocusSessionStore((state) => state.formatTime),
  getDuration: useFocusSessionStore((state) => state.getDuration),
  isSessionActive: useFocusSessionStore((state) => state.isSessionActive)
})

export const useFocusSessionActions = () => ({
  startSession: useFocusSessionStore((state) => state.startSession),
  pauseSession: useFocusSessionStore((state) => state.pauseSession),
  resumeSession: useFocusSessionStore((state) => state.resumeSession),
  stopSession: useFocusSessionStore((state) => state.stopSession),
  updateElapsed: useFocusSessionStore((state) => state.updateElapsed),
  setElapsed: useFocusSessionStore((state) => state.setElapsed),
  updateFocusScore: useFocusSessionStore((state) => state.updateFocusScore)
})

export const useFocusSessionSync = () => ({
  currentSessionId: useFocusSessionStore((state) => state.currentSessionId),
  serverSessionData: useFocusSessionStore((state) => state.serverSessionData),
  isLoading: useFocusSessionStore((state) => state.isLoading),
  syncError: useFocusSessionStore((state) => state.syncError),
  lastSyncTime: useFocusSessionStore((state) => state.lastSyncTime),
  setCurrentSession: useFocusSessionStore((state) => state.setCurrentSession),
  clearCurrentSession: useFocusSessionStore((state) => state.clearCurrentSession),
  syncWithServer: useFocusSessionStore((state) => state.syncWithServer),
  setLoading: useFocusSessionStore((state) => state.setLoading),
  setSyncError: useFocusSessionStore((state) => state.setSyncError)
})

export const useFocusSessionStats = () => ({
  totalSessionsToday: useFocusSessionStore((state) => state.totalSessionsToday),
  totalFocusTimeToday: useFocusSessionStore((state) => state.totalFocusTimeToday),
  updateDailyStats: useFocusSessionStore((state) => state.updateDailyStats)
})

// =====================================================
// 자동 동기화 및 정리
// =====================================================

// 페이지 로드 시 서버와 동기화
if (typeof window !== 'undefined') {
  const store = useFocusSessionStore.getState()
  
  // 저장된 세션이 있으면 서버와 동기화 시도
  if (store.currentSessionId) {
    store.syncWithServer().then((success) => {
      if (!success) {
        console.log('🔄 서버 동기화 실패, 로컬 상태 정리됨')
      }
    })
  }
  
  // 5분마다 자동 동기화 (활성 세션이 있을 때만)
  setInterval(() => {
    const currentState = useFocusSessionStore.getState()
    if (currentState.isSessionActive()) {
      currentState.syncWithServer()
    }
  }, 5 * 60 * 1000) // 5분
}
