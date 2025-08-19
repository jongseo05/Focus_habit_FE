// =====================================================
// 스터디룸 전역 상태 관리 스토어
// =====================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface StudyRoomState {
  // 현재 스터디룸 정보
  currentRoom: StudyRoom | null
  participants: ParticipantWithUser[]
  isHost: boolean
  
  // 연결 상태
  isConnected: boolean
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  lastActivity: number
  
  // 세션 상태
  currentSessionId: string | null
  isSessionRunning: boolean
  sessionStartTime: number | null
  currentFocusScore: number
  averageFocusScore: number
  
  // UI 상태
  activeTab: 'session' | 'challenges' | 'chat'
  showNotifications: boolean
  unreadNotifications: number
  
  // 설정
  preferences: {
    autoJoinSession: boolean
    showFocusScore: boolean
    enableEncouragement: boolean
    soundEnabled: boolean
  }
}

interface StudyRoomActions {
  // 방 관리
  setCurrentRoom: (room: StudyRoom | null) => void
  updateRoomInfo: (updates: Partial<StudyRoom>) => void
  
  // 참가자 관리
  setParticipants: (participants: ParticipantWithUser[]) => void
  addParticipant: (participant: ParticipantWithUser) => void
  removeParticipant: (userId: string) => void
  updateParticipant: (userId: string, updates: Partial<ParticipantWithUser>) => void
  
  // 연결 상태
  setConnectionStatus: (status: StudyRoomState['connectionStatus']) => void
  updateLastActivity: () => void
  
  // 세션 관리
  startSession: (sessionId: string) => void
  endSession: () => void
  updateFocusScore: (current: number, average: number) => void
  
  // UI 상태
  setActiveTab: (tab: StudyRoomState['activeTab']) => void
  setShowNotifications: (show: boolean) => void
  incrementUnreadNotifications: () => void
  clearUnreadNotifications: () => void
  
  // 설정
  updatePreferences: (updates: Partial<StudyRoomState['preferences']>) => void
  
  // 초기화
  reset: () => void
}

type StudyRoomStore = StudyRoomState & StudyRoomActions

const initialState: StudyRoomState = {
  // 현재 스터디룸 정보
  currentRoom: null,
  participants: [],
  isHost: false,
  
  // 연결 상태
  isConnected: false,
  connectionStatus: 'disconnected',
  lastActivity: 0,
  
  // 세션 상태
  currentSessionId: null,
  isSessionRunning: false,
  sessionStartTime: null,
  currentFocusScore: 0,
  averageFocusScore: 0,
  
  // UI 상태
  activeTab: 'session',
  showNotifications: true,
  unreadNotifications: 0,
  
  // 설정
  preferences: {
    autoJoinSession: false,
    showFocusScore: true,
    enableEncouragement: true,
    soundEnabled: true
  }
}

export const useStudyRoomStore = create<StudyRoomStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 방 관리
      setCurrentRoom: (room) => set((state) => ({ 
        currentRoom: room,
        isHost: room ? room.host_id === state.currentRoom?.host_id : false,
        participants: room ? state.participants : []
      })),
      
      updateRoomInfo: (updates) => set((state) => ({
        currentRoom: state.currentRoom ? { ...state.currentRoom, ...updates } : null
      })),
      
      // 참가자 관리
      setParticipants: (participants) => set({ participants }),
      
      addParticipant: (participant) => set((state) => {
        const existingIndex = state.participants.findIndex(p => p.user_id === participant.user_id)
        if (existingIndex >= 0) {
          // 기존 참가자 업데이트
          const updatedParticipants = [...state.participants]
          updatedParticipants[existingIndex] = participant
          return { participants: updatedParticipants }
        } else {
          // 새 참가자 추가
          return { participants: [...state.participants, participant] }
        }
      }),
      
      removeParticipant: (userId) => set((state) => ({
        participants: state.participants.filter(p => p.user_id !== userId)
      })),
      
      updateParticipant: (userId, updates) => set((state) => ({
        participants: state.participants.map(p => 
          p.user_id === userId ? { ...p, ...updates } : p
        )
      })),
      
      // 연결 상태
      setConnectionStatus: (status) => set({ 
        connectionStatus: status,
        isConnected: status === 'connected'
      }),
      
      updateLastActivity: () => set({ lastActivity: Date.now() }),
      
      // 세션 관리
      startSession: (sessionId) => set({
        currentSessionId: sessionId,
        isSessionRunning: true,
        sessionStartTime: Date.now(),
        currentFocusScore: 0,
        averageFocusScore: 0
      }),
      
      endSession: () => set({
        currentSessionId: null,
        isSessionRunning: false,
        sessionStartTime: null
      }),
      
      updateFocusScore: (current, average) => set({
        currentFocusScore: current,
        averageFocusScore: average
      }),
      
      // UI 상태
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setShowNotifications: (show) => set({ showNotifications: show }),
      
      incrementUnreadNotifications: () => set((state) => ({
        unreadNotifications: state.unreadNotifications + 1
      })),
      
      clearUnreadNotifications: () => set({ unreadNotifications: 0 }),
      
      // 설정
      updatePreferences: (updates) => set((state) => ({
        preferences: { ...state.preferences, ...updates }
      })),
      
      // 초기화
      reset: () => set(initialState)
    }),
    {
      name: 'study-room-store',
      partialize: (state) => ({
        // 영속화할 상태만 선택 (연결 상태나 임시 데이터는 제외)
        activeTab: state.activeTab,
        showNotifications: state.showNotifications,
        preferences: state.preferences
      })
    }
  )
)

// 선택적 훅들 (성능 최적화)
export const useCurrentRoom = () => useStudyRoomStore(state => state.currentRoom)
export const useParticipants = () => useStudyRoomStore(state => state.participants)
export const useConnectionStatus = () => useStudyRoomStore(state => state.connectionStatus)
export const useSessionState = () => useStudyRoomStore(state => ({
  currentSessionId: state.currentSessionId,
  isSessionRunning: state.isSessionRunning,
  sessionStartTime: state.sessionStartTime,
  currentFocusScore: state.currentFocusScore,
  averageFocusScore: state.averageFocusScore
}))
export const useStudyRoomPreferences = () => useStudyRoomStore(state => state.preferences)

// 액션만 가져오는 훅
export const useStudyRoomActions = () => useStudyRoomStore(state => ({
  setCurrentRoom: state.setCurrentRoom,
  updateRoomInfo: state.updateRoomInfo,
  setParticipants: state.setParticipants,
  addParticipant: state.addParticipant,
  removeParticipant: state.removeParticipant,
  updateParticipant: state.updateParticipant,
  setConnectionStatus: state.setConnectionStatus,
  updateLastActivity: state.updateLastActivity,
  startSession: state.startSession,
  endSession: state.endSession,
  updateFocusScore: state.updateFocusScore,
  setActiveTab: state.setActiveTab,
  setShowNotifications: state.setShowNotifications,
  incrementUnreadNotifications: state.incrementUnreadNotifications,
  clearUnreadNotifications: state.clearUnreadNotifications,
  updatePreferences: state.updatePreferences,
  reset: state.reset
}))
