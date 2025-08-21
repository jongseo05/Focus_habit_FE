// =====================================================
// 집중도 경쟁 상태 관리 스토어
// =====================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  saveCompetitionState, 
  loadCompetitionState, 
  clearCompetitionState as clearCompetitionStateFromStorage
} from '@/lib/utils/sessionPersistence'

// 경쟁 참가자 타입
interface CompetitionParticipant {
  userId: string
  totalFocusScore: number
  averageFocusScore: number
  lastUpdated: string
}

// 경쟁 순위 타입
interface CompetitionRanking {
  userId: string
  score: number
  rank: number
  userName?: string
  avatarUrl?: string
}

// 경쟁 상태 타입
interface CompetitionState {
  // 기본 정보
  roomId: string | null
  competitionId: string | null
  isActive: boolean
  timeLeft: number // 남은 시간 (초)
  duration: number // 총 시간 (분)
  
  // 시간 정보
  startedAt: string | null
  endedAt: string | null
  
  // 참가자 정보
  participants: CompetitionParticipant[]
  hostId: string | null
  winnerId: string | null
  rankings: CompetitionRanking[]
  
  // UI 상태
  showSettings: boolean
  activeTab: 'pomodoro' | 'custom'
  customHours: number
  customMinutes: number
  breakDuration: number
  
  // 로딩 상태
  isLoading: boolean
  error: string | null
  
  // 마지막 업데이트
  lastUpdated: string | null
}

// 경쟁 액션 타입
interface CompetitionActions {
  // 경쟁 제어
  startCompetition: (roomId: string, duration: number) => Promise<boolean>
  endCompetition: () => Promise<boolean>
  updateTimeLeft: (timeLeft: number) => void
  
  // 참가자 관리
  addParticipant: (participant: CompetitionParticipant) => void
  updateParticipant: (userId: string, updates: Partial<CompetitionParticipant>) => void
  removeParticipant: (userId: string) => void
  setParticipants: (participants: CompetitionParticipant[]) => void
  
  // 순위 관리
  updateRankings: (rankings: CompetitionRanking[]) => void
  setWinner: (userId: string) => void
  
  // UI 상태
  setShowSettings: (show: boolean) => void
  setActiveTab: (tab: 'pomodoro' | 'custom') => void
  setCustomHours: (hours: number) => void
  setCustomMinutes: (minutes: number) => void
  setBreakDuration: (duration: number) => void
  
  // 로딩 상태
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // 상태 복원 관리
  restoreCompetitionState: (roomId: string) => boolean
  saveCompetitionState: () => void
  clearCompetitionState: () => void
  
  // 초기화
  reset: () => void
}

type CompetitionStore = CompetitionState & CompetitionActions

const initialState: CompetitionState = {
  // 기본 정보
  roomId: null,
  competitionId: null,
  isActive: false,
  timeLeft: 0,
  duration: 25,
  
  // 시간 정보
  startedAt: null,
  endedAt: null,
  
  // 참가자 정보
  participants: [],
  hostId: null,
  winnerId: null,
  rankings: [],
  
  // UI 상태
  showSettings: false,
  activeTab: 'pomodoro',
  customHours: 0,
  customMinutes: 30,
  breakDuration: 5,
  
  // 로딩 상태
  isLoading: false,
  error: null,
  
  // 마지막 업데이트
  lastUpdated: null
}

export const useCompetitionStore = create<CompetitionStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 경쟁 제어
      startCompetition: async (roomId: string, duration: number) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch(`/api/social/study-room/${roomId}/competition/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ duration })
          })
          
          const data = await response.json()
          
          if (response.ok) {
            const now = new Date().toISOString()
            set({
              roomId,
              competitionId: data.competition_id,
              isActive: true,
              timeLeft: duration * 60, // 분을 초로 변환
              duration,
              startedAt: now,
              endedAt: null,
              participants: data.participants || [],
              hostId: data.host_id,
              winnerId: null,
              rankings: [],
              lastUpdated: now,
              isLoading: false
            })
            
            // 상태 저장
            get().saveCompetitionState()
            
            console.log('경쟁 시작 완료:', { roomId, competitionId: data.competition_id })
            return true
          } else {
            set({ 
              error: data.error || '경쟁 시작에 실패했습니다.',
              isLoading: false 
            })
            return false
          }
        } catch (error) {
          console.error('경쟁 시작 중 오류:', error)
          set({ 
            error: '경쟁 시작 중 오류가 발생했습니다.',
            isLoading: false 
          })
          return false
        }
      },
      
      endCompetition: async () => {
        const state = get()
        if (!state.roomId || !state.isActive) return false
        
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch(`/api/social/study-room/${state.roomId}/competition/end`, {
            method: 'POST'
          })
          
          const data = await response.json()
          
          if (response.ok) {
            const now = new Date().toISOString()
            set({
              isActive: false,
              timeLeft: 0,
              endedAt: now,
              lastUpdated: now,
              isLoading: false
            })
            
            // 상태 정리
            get().clearCompetitionState()
            
            console.log('경쟁 종료 완료:', { roomId: state.roomId })
            return true
          } else {
            set({ 
              error: data.error || '경쟁 종료에 실패했습니다.',
              isLoading: false 
            })
            return false
          }
        } catch (error) {
          console.error('경쟁 종료 중 오류:', error)
          set({ 
            error: '경쟁 종료 중 오류가 발생했습니다.',
            isLoading: false 
          })
          return false
        }
      },
      
      updateTimeLeft: (timeLeft: number) => {
        set({ 
          timeLeft,
          lastUpdated: new Date().toISOString()
        })
      },
      
      // 참가자 관리
      addParticipant: (participant: CompetitionParticipant) => {
        set((state) => ({
          participants: [...state.participants, participant],
          lastUpdated: new Date().toISOString()
        }))
      },
      
      updateParticipant: (userId: string, updates: Partial<CompetitionParticipant>) => {
        set((state) => ({
          participants: state.participants.map(p => 
            p.userId === userId ? { ...p, ...updates } : p
          ),
          lastUpdated: new Date().toISOString()
        }))
      },
      
      removeParticipant: (userId: string) => {
        set((state) => ({
          participants: state.participants.filter(p => p.userId !== userId),
          lastUpdated: new Date().toISOString()
        }))
      },
      
      setParticipants: (participants: CompetitionParticipant[]) => {
        set({ 
          participants,
          lastUpdated: new Date().toISOString()
        })
      },
      
      // 순위 관리
      updateRankings: (rankings: CompetitionRanking[]) => {
        set({ 
          rankings,
          lastUpdated: new Date().toISOString()
        })
      },
      
      setWinner: (userId: string) => {
        set({ 
          winnerId: userId,
          lastUpdated: new Date().toISOString()
        })
      },
      
      // UI 상태
      setShowSettings: (show: boolean) => set({ showSettings: show }),
      setActiveTab: (tab: 'pomodoro' | 'custom') => set({ activeTab: tab }),
      setCustomHours: (hours: number) => set({ customHours: hours }),
      setCustomMinutes: (minutes: number) => set({ customMinutes: minutes }),
      setBreakDuration: (duration: number) => set({ breakDuration: duration }),
      
      // 로딩 상태
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      
      // 상태 복원 관리
      restoreCompetitionState: (roomId: string) => {
        const savedState = loadCompetitionState(roomId)
        if (savedState) {
          set({
            roomId: savedState.roomId,
            competitionId: savedState.competitionId,
            isActive: savedState.isActive,
            timeLeft: savedState.timeLeft,
            duration: savedState.duration,
            startedAt: savedState.startedAt,
            endedAt: savedState.endedAt,
            participants: (savedState.participants || []).map((p: any) => ({
              userId: p.userId,
              totalFocusScore: p.totalFocusScore || 0,
              averageFocusScore: p.averageFocusScore || 0,
              lastUpdated: (p as any).lastUpdated || new Date().toISOString()
            })),
            hostId: savedState.hostId,
            winnerId: savedState.winnerId,
            rankings: savedState.rankings,
            lastUpdated: savedState.lastUpdated
          })
          console.log('경쟁 상태 복원 완료:', { roomId })
          return true
        }
        return false
      },
      
      saveCompetitionState: () => {
        const state = get()
        if (state.roomId) {
          saveCompetitionState({
            roomId: state.roomId,
            competitionId: state.competitionId,
            isActive: state.isActive,
            timeLeft: state.timeLeft,
            duration: state.duration,
            startedAt: state.startedAt,
            endedAt: state.endedAt,
            participants: state.participants,
            hostId: state.hostId,
            winnerId: state.winnerId,
            rankings: state.rankings,
            lastUpdated: state.lastUpdated
          })
        }
      },
      
      clearCompetitionState: (roomId?: string) => {
        const state = get()
        const targetRoomId = roomId || state.roomId
        
        if (targetRoomId) {
          // 1. localStorage에서 경쟁 상태 제거
          clearCompetitionStateFromStorage(targetRoomId)
          
          // 2. 스토어 상태도 초기화 (새 경쟁 시작 시 충돌 방지)
          set({
            ...initialState,
            showSettings: state.showSettings,
            activeTab: state.activeTab,
            customHours: state.customHours,
            customMinutes: state.customMinutes,
            breakDuration: state.breakDuration
          })
          
          console.log('🧹 경쟁 상태 완전 정리 완료:', targetRoomId)
        }
      },
      
      // 초기화
      reset: () => set(initialState)
    }),
    {
      name: 'competition-store',
      partialize: (state) => ({
        // UI 설정만 영속화
        showSettings: state.showSettings,
        activeTab: state.activeTab,
        customHours: state.customHours,
        customMinutes: state.customMinutes,
        breakDuration: state.breakDuration
      })
    }
  )
)

// 선택자 훅들
export const useCompetitionState = () => ({
  roomId: useCompetitionStore((state) => state.roomId),
  competitionId: useCompetitionStore((state) => state.competitionId),
  isActive: useCompetitionStore((state) => state.isActive),
  timeLeft: useCompetitionStore((state) => state.timeLeft),
  duration: useCompetitionStore((state) => state.duration),
  startedAt: useCompetitionStore((state) => state.startedAt),
  endedAt: useCompetitionStore((state) => state.endedAt),
  participants: useCompetitionStore((state) => state.participants),
  hostId: useCompetitionStore((state) => state.hostId),
  winnerId: useCompetitionStore((state) => state.winnerId),
  rankings: useCompetitionStore((state) => state.rankings),
  isLoading: useCompetitionStore((state) => state.isLoading),
  error: useCompetitionStore((state) => state.error)
})

export const useCompetitionActions = () => ({
  startCompetition: useCompetitionStore((state) => state.startCompetition),
  endCompetition: useCompetitionStore((state) => state.endCompetition),
  updateTimeLeft: useCompetitionStore((state) => state.updateTimeLeft),
  addParticipant: useCompetitionStore((state) => state.addParticipant),
  updateParticipant: useCompetitionStore((state) => state.updateParticipant),
  removeParticipant: useCompetitionStore((state) => state.removeParticipant),
  setParticipants: useCompetitionStore((state) => state.setParticipants),
  updateRankings: useCompetitionStore((state) => state.updateRankings),
  setWinner: useCompetitionStore((state) => state.setWinner),
  restoreCompetitionState: useCompetitionStore((state) => state.restoreCompetitionState),
  saveCompetitionState: useCompetitionStore((state) => state.saveCompetitionState),
  clearCompetitionState: useCompetitionStore((state) => state.clearCompetitionState),
  reset: useCompetitionStore((state) => state.reset)
})

export const useCompetitionUI = () => ({
  showSettings: useCompetitionStore((state) => state.showSettings),
  activeTab: useCompetitionStore((state) => state.activeTab),
  customHours: useCompetitionStore((state) => state.customHours),
  customMinutes: useCompetitionStore((state) => state.customMinutes),
  breakDuration: useCompetitionStore((state) => state.breakDuration),
  setShowSettings: useCompetitionStore((state) => state.setShowSettings),
  setActiveTab: useCompetitionStore((state) => state.setActiveTab),
  setCustomHours: useCompetitionStore((state) => state.setCustomHours),
  setCustomMinutes: useCompetitionStore((state) => state.setCustomMinutes),
  setBreakDuration: useCompetitionStore((state) => state.setBreakDuration)
})
