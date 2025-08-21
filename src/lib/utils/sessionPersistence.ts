// =====================================================
// 스터디룸 세션 및 경쟁 상태 영속화 유틸리티
// =====================================================

import type { StudyRoom, ParticipantWithUser } from '@/types/social'

// 스토리지 키 상수
const STORAGE_KEYS = {
  STUDY_ROOM_SESSION: 'study_room_session_state',
  COMPETITION_STATE: 'competition_state',
  FOCUS_SESSION: 'focus_session_state',
  ROOM_PRESENCE: 'room_presence_state',
  PARTICIPANT_CAMERA: 'participant_camera_states'
} as const

// 세션 상태 타입 정의
interface StudyRoomSessionState {
  roomId: string
  roomData: StudyRoom | null
  participants: ParticipantWithUser[]
  isHost: boolean
  isConnected: boolean
  currentSessionId: string | null
  isSessionRunning: boolean
  sessionStartTime: number | null
  currentFocusScore: number
  averageFocusScore: number
  activeTab: 'session' | 'challenges' | 'chat'
  lastActivity: number
  savedAt: string
}

// 경쟁 상태 타입 정의
interface CompetitionState {
  roomId: string
  competitionId: string | null
  isActive: boolean
  timeLeft: number
  duration: number
  startedAt: string | null
  endedAt: string | null
  participants: Array<{
    userId: string
    totalFocusScore: number
    averageFocusScore: number
  }>
  hostId: string | null
  winnerId: string | null
  rankings: Array<{
    userId: string
    score: number
    rank: number
  }>
  lastUpdated: string | null
  savedAt: string
}

// 집중 세션 상태 타입 정의
interface FocusSessionState {
  sessionId: string | null
  isRunning: boolean
  isPaused: boolean
  elapsed: number
  focusScore: number
  startTime: number | null
  goalMinutes: number | null
  sessionType: 'study' | 'work' | 'reading' | 'study_room'
  roomId: string | null
  savedAt: string
}

// 룸 입장 상태 타입 정의
interface RoomPresenceState {
  roomId: string
  userId: string
  isPresent: boolean
  joinedAt: string | null
  lastActivity: number
  savedAt: string
}

// 카메라 상태 타입 정의
interface ParticipantCameraStates {
  roomId: string
  states: Map<string, {
    isVideoEnabled: boolean
    isAudioEnabled: boolean
    updatedAt: string
  }>
  savedAt: string
}

/**
 * 스터디룸 세션 상태 저장
 */
export const saveStudyRoomSession = (state: Omit<StudyRoomSessionState, 'savedAt'>): void => {
  if (typeof window === 'undefined') return

  try {
    const sessionState: StudyRoomSessionState = {
      ...state,
      savedAt: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.STUDY_ROOM_SESSION, JSON.stringify(sessionState))
    console.log('스터디룸 세션 상태 저장 완료:', { roomId: state.roomId, savedAt: sessionState.savedAt })
  } catch (error) {
    console.warn('스터디룸 세션 상태 저장 실패:', error)
  }
}

/**
 * 스터디룸 세션 상태 복원
 */
export const loadStudyRoomSession = (): StudyRoomSessionState | null => {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.STUDY_ROOM_SESSION)
    if (!stored) return null

    const sessionState: StudyRoomSessionState = JSON.parse(stored)
    
    // 저장된 지 30분 이상 지났으면 무효화
    const savedTime = new Date(sessionState.savedAt).getTime()
    const now = Date.now()
    if (now - savedTime > 30 * 60 * 1000) {
      console.log('스터디룸 세션 상태 만료 (30분 초과)')
      clearStudyRoomSession()
      return null
    }

    console.log('스터디룸 세션 상태 복원 완료:', { roomId: sessionState.roomId, savedAt: sessionState.savedAt })
    return sessionState
  } catch (error) {
    console.warn('스터디룸 세션 상태 복원 실패:', error)
    return null
  }
}

/**
 * 스터디룸 세션 상태 삭제
 */
export const clearStudyRoomSession = (): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEYS.STUDY_ROOM_SESSION)
    console.log('스터디룸 세션 상태 삭제 완료')
  } catch (error) {
    console.warn('스터디룸 세션 상태 삭제 실패:', error)
  }
}

/**
 * 경쟁 상태 저장
 */
export const saveCompetitionState = (state: Omit<CompetitionState, 'savedAt'>): void => {
  if (typeof window === 'undefined') return

  try {
    const competitionState: CompetitionState = {
      ...state,
      savedAt: new Date().toISOString()
    }
    
    const key = `${STORAGE_KEYS.COMPETITION_STATE}_${state.roomId}`
    localStorage.setItem(key, JSON.stringify(competitionState))
    console.log('경쟁 상태 저장 완료:', { roomId: state.roomId, savedAt: competitionState.savedAt })
  } catch (error) {
    console.warn('경쟁 상태 저장 실패:', error)
  }
}

/**
 * 경쟁 상태 복원
 */
export const loadCompetitionState = (roomId: string): CompetitionState | null => {
  if (typeof window === 'undefined') return null

  try {
    const key = `${STORAGE_KEYS.COMPETITION_STATE}_${roomId}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const competitionState: CompetitionState = JSON.parse(stored)
    
    // 저장된 지 2시간 이상 지났으면 무효화
    const savedTime = new Date(competitionState.savedAt).getTime()
    const now = Date.now()
    if (now - savedTime > 2 * 60 * 60 * 1000) {
      console.log('경쟁 상태 만료 (2시간 초과)')
      clearCompetitionState(roomId)
      return null
    }

    console.log('경쟁 상태 복원 완료:', { roomId: competitionState.roomId, savedAt: competitionState.savedAt })
    return competitionState
  } catch (error) {
    console.warn('경쟁 상태 복원 실패:', error)
    return null
  }
}

/**
 * 경쟁 상태 삭제
 */
export const clearCompetitionState = (roomId: string): void => {
  if (typeof window === 'undefined') return

  try {
    const key = `${STORAGE_KEYS.COMPETITION_STATE}_${roomId}`
    localStorage.removeItem(key)
    console.log('경쟁 상태 삭제 완료:', { roomId })
  } catch (error) {
    console.warn('경쟁 상태 삭제 실패:', error)
  }
}

/**
 * 집중 세션 상태 저장
 */
export const saveFocusSessionState = (state: Omit<FocusSessionState, 'savedAt'>): void => {
  if (typeof window === 'undefined') return

  try {
    const focusSessionState: FocusSessionState = {
      ...state,
      savedAt: new Date().toISOString()
    }
    
    localStorage.setItem(STORAGE_KEYS.FOCUS_SESSION, JSON.stringify(focusSessionState))
    console.log('집중 세션 상태 저장 완료:', { sessionId: state.sessionId, savedAt: focusSessionState.savedAt })
  } catch (error) {
    console.warn('집중 세션 상태 저장 실패:', error)
  }
}

/**
 * 집중 세션 상태 복원
 */
export const loadFocusSessionState = (): FocusSessionState | null => {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FOCUS_SESSION)
    if (!stored) return null

    const focusSessionState: FocusSessionState = JSON.parse(stored)
    
    // 저장된 지 1시간 이상 지났으면 무효화
    const savedTime = new Date(focusSessionState.savedAt).getTime()
    const now = Date.now()
    if (now - savedTime > 60 * 60 * 1000) {
      console.log('집중 세션 상태 만료 (1시간 초과)')
      clearFocusSessionState()
      return null
    }

    console.log('집중 세션 상태 복원 완료:', { sessionId: focusSessionState.sessionId, savedAt: focusSessionState.savedAt })
    return focusSessionState
  } catch (error) {
    console.warn('집중 세션 상태 복원 실패:', error)
    return null
  }
}

/**
 * 집중 세션 상태 삭제
 */
export const clearFocusSessionState = (): void => {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(STORAGE_KEYS.FOCUS_SESSION)
    console.log('집중 세션 상태 삭제 완료')
  } catch (error) {
    console.warn('집중 세션 상태 삭제 실패:', error)
  }
}

/**
 * 룸 입장 상태 저장
 */
export const saveRoomPresenceState = (state: Omit<RoomPresenceState, 'savedAt'>): void => {
  if (typeof window === 'undefined') return

  try {
    const presenceState: RoomPresenceState = {
      ...state,
      savedAt: new Date().toISOString()
    }
    
    const key = `${STORAGE_KEYS.ROOM_PRESENCE}_${state.roomId}_${state.userId}`
    localStorage.setItem(key, JSON.stringify(presenceState))
    console.log('룸 입장 상태 저장 완료:', { roomId: state.roomId, userId: state.userId })
  } catch (error) {
    console.warn('룸 입장 상태 저장 실패:', error)
  }
}

/**
 * 룸 입장 상태 복원
 */
export const loadRoomPresenceState = (roomId: string, userId: string): RoomPresenceState | null => {
  if (typeof window === 'undefined') return null

  try {
    const key = `${STORAGE_KEYS.ROOM_PRESENCE}_${roomId}_${userId}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const presenceState: RoomPresenceState = JSON.parse(stored)
    
    // 저장된 지 10분 이상 지났으면 무효화
    const savedTime = new Date(presenceState.savedAt).getTime()
    const now = Date.now()
    if (now - savedTime > 10 * 60 * 1000) {
      console.log('룸 입장 상태 만료 (10분 초과)')
      clearRoomPresenceState(roomId, userId)
      return null
    }

    console.log('룸 입장 상태 복원 완료:', { roomId: presenceState.roomId, userId: presenceState.userId })
    return presenceState
  } catch (error) {
    console.warn('룸 입장 상태 복원 실패:', error)
    return null
  }
}

/**
 * 룸 입장 상태 삭제
 */
export const clearRoomPresenceState = (roomId: string, userId: string): void => {
  if (typeof window === 'undefined') return

  try {
    const key = `${STORAGE_KEYS.ROOM_PRESENCE}_${roomId}_${userId}`
    localStorage.removeItem(key)
    console.log('룸 입장 상태 삭제 완료:', { roomId, userId })
  } catch (error) {
    console.warn('룸 입장 상태 삭제 실패:', error)
  }
}

/**
 * 카메라 상태 저장
 */
export const saveParticipantCameraStates = (roomId: string, states: Map<string, { isVideoEnabled: boolean; isAudioEnabled: boolean; updatedAt: string }>): void => {
  if (typeof window === 'undefined') return

  try {
    const cameraStates: ParticipantCameraStates = {
      roomId,
      states: states,
      savedAt: new Date().toISOString()
    }
    
    const key = `${STORAGE_KEYS.PARTICIPANT_CAMERA}_${roomId}`
    // Map을 객체로 변환하여 저장
    const statesObject = Object.fromEntries(states)
    const serializableState = {
      ...cameraStates,
      states: statesObject
    }
    
    localStorage.setItem(key, JSON.stringify(serializableState))
    console.log('카메라 상태 저장 완료:', { roomId, participantCount: states.size })
  } catch (error) {
    console.warn('카메라 상태 저장 실패:', error)
  }
}

/**
 * 카메라 상태 복원
 */
export const loadParticipantCameraStates = (roomId: string): Map<string, { isVideoEnabled: boolean; isAudioEnabled: boolean; updatedAt: string }> | null => {
  if (typeof window === 'undefined') return null

  try {
    const key = `${STORAGE_KEYS.PARTICIPANT_CAMERA}_${roomId}`
    const stored = localStorage.getItem(key)
    if (!stored) return null

    const cameraStates: ParticipantCameraStates & { states: Record<string, { isVideoEnabled: boolean; isAudioEnabled: boolean; updatedAt: string }> } = JSON.parse(stored)
    
    // 저장된 지 30분 이상 지났으면 무효화
    const savedTime = new Date(cameraStates.savedAt).getTime()
    const now = Date.now()
    if (now - savedTime > 30 * 60 * 1000) {
      console.log('카메라 상태 만료 (30분 초과)')
      clearParticipantCameraStates(roomId)
      return null
    }

    // 객체를 Map으로 변환
    const statesMap = new Map(Object.entries(cameraStates.states))
    console.log('카메라 상태 복원 완료:', { roomId, participantCount: statesMap.size })
    return statesMap
  } catch (error) {
    console.warn('카메라 상태 복원 실패:', error)
    return null
  }
}

/**
 * 카메라 상태 삭제
 */
export const clearParticipantCameraStates = (roomId: string): void => {
  if (typeof window === 'undefined') return

  try {
    const key = `${STORAGE_KEYS.PARTICIPANT_CAMERA}_${roomId}`
    localStorage.removeItem(key)
    console.log('카메라 상태 삭제 완료:', { roomId })
  } catch (error) {
    console.warn('카메라 상태 삭제 실패:', error)
  }
}

/**
 * 모든 스터디룸 관련 상태 정리
 */
export const clearAllStudyRoomStates = (roomId?: string): void => {
  if (typeof window === 'undefined') return

  try {
    if (roomId) {
      // 특정 룸의 상태만 정리
      clearCompetitionState(roomId)
      clearParticipantCameraStates(roomId)
      // 룸별 입장 상태는 모든 사용자에 대해 정리
      const keys = Object.keys(localStorage)
      const presenceKeys = keys.filter(key => key.startsWith(`${STORAGE_KEYS.ROOM_PRESENCE}_${roomId}_`))
      presenceKeys.forEach(key => localStorage.removeItem(key))
    } else {
      // 모든 스터디룸 관련 상태 정리
      Object.values(STORAGE_KEYS).forEach(key => {
        if (key === STORAGE_KEYS.COMPETITION_STATE || key === STORAGE_KEYS.ROOM_PRESENCE || key === STORAGE_KEYS.PARTICIPANT_CAMERA) {
          // 룸별 키는 패턴으로 삭제
          const keys = Object.keys(localStorage)
          const patternKeys = keys.filter(k => k.startsWith(key))
          patternKeys.forEach(k => localStorage.removeItem(k))
        } else {
          localStorage.removeItem(key)
        }
      })
    }
    console.log('스터디룸 상태 정리 완료:', { roomId: roomId || 'all' })
  } catch (error) {
    console.warn('스터디룸 상태 정리 실패:', error)
  }
}

/**
 * 상태 복원 가능 여부 확인
 */
export const hasRestorableState = (roomId?: string): boolean => {
  if (typeof window === 'undefined') return false

  try {
    const keys = Object.keys(localStorage)
    
    if (roomId) {
      // 특정 룸의 복원 가능한 상태 확인
      return keys.some(key => 
        key === STORAGE_KEYS.STUDY_ROOM_SESSION ||
        key === STORAGE_KEYS.FOCUS_SESSION ||
        key.startsWith(`${STORAGE_KEYS.COMPETITION_STATE}_${roomId}`) ||
        key.startsWith(`${STORAGE_KEYS.ROOM_PRESENCE}_${roomId}_`) ||
        key.startsWith(`${STORAGE_KEYS.PARTICIPANT_CAMERA}_${roomId}`)
      )
    } else {
      // 모든 스터디룸 관련 상태 확인
      return keys.some(key => 
        Object.values(STORAGE_KEYS).some(storageKey => 
          key === storageKey || key.startsWith(storageKey)
        )
      )
    }
  } catch (error) {
    console.warn('상태 복원 가능 여부 확인 실패:', error)
    return false
  }
}
