// =====================================================
// 스터디룸 컨텍스트 프로바이더
// =====================================================

'use client'

import React, { createContext, useContext, useCallback } from 'react'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'
import { useStudyRoomCore } from '@/hooks/useStudyRoomCore'
import { useStudyRoomRealtime } from '@/hooks/useStudyRoomRealtimeV2'

interface StudyRoomContextValue {
  // 기본 정보
  room?: StudyRoom
  userId?: string
  isHost: boolean
  
  // 참가자 관리
  participants: ParticipantWithUser[]
  currentFocusScore: number
  
  // 알림 시스템
  notifications: Array<{id: string, message: string, type: 'join' | 'leave' | 'info', timestamp: number}>
  addNotification: (message: string, type?: 'join' | 'leave' | 'info') => void
  removeNotification: (id: string) => void
  
  // 방 관리 액션
  leaveRoom: () => Promise<void>
  endRoom: () => Promise<void>
  
  // 실시간 기능
  sendFocusUpdate: (score: number) => void
  sendEncouragement: (targetUserId: string, message: string) => void
  
  // 로딩 상태
  loading: boolean
  error: string | null
}

const StudyRoomContext = createContext<StudyRoomContextValue | null>(null)

interface StudyRoomProviderProps {
  room?: StudyRoom
  userId?: string
  children: React.ReactNode
}

export function StudyRoomProvider({ room, userId, children }: StudyRoomProviderProps) {
  // 핵심 로직
  const coreState = useStudyRoomCore({ room, userId })
  
  // 실시간 기능
  const realtimeActions = useStudyRoomRealtime({
    room,
    userId,
    onParticipantUpdate: coreState.updateParticipants,
    onFocusScoreUpdate: coreState.updateFocusScore,
    onNotification: coreState.addNotification
  })

  // 방 나가기
  const leaveRoom = useCallback(async () => {
    if (!room?.room_id || !userId) return
    
    try {
      coreState.setLoading(true)
      await realtimeActions.leaveRoom()
      
      const response = await fetch(`/api/social/study-room/${room.room_id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      
      if (!response.ok) {
        throw new Error('방 나가기에 실패했습니다.')
      }
      
      coreState.addNotification('방을 나갔습니다.', 'info')
    } catch (error) {
      coreState.setError(error instanceof Error ? error.message : '방 나가기에 실패했습니다.')
    } finally {
      coreState.setLoading(false)
    }
  }, [room?.room_id, userId, realtimeActions, coreState])

  // 방 종료 (호스트만)
  const endRoom = useCallback(async () => {
    if (!room?.room_id || !userId || !coreState.isHost) return
    
    try {
      coreState.setLoading(true)
      
      const response = await fetch(`/api/social/study-room/${room.room_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_id: userId })
      })
      
      if (!response.ok) {
        throw new Error('방 종료에 실패했습니다.')
      }
      
      coreState.addNotification('스터디룸이 종료되었습니다.', 'info')
    } catch (error) {
      coreState.setError(error instanceof Error ? error.message : '방 종료에 실패했습니다.')
    } finally {
      coreState.setLoading(false)
    }
  }, [room?.room_id, userId, coreState.isHost, coreState])

  const contextValue: StudyRoomContextValue = {
    // 기본 정보
    room,
    userId,
    isHost: coreState.isHost,
    
    // 참가자 관리
    participants: coreState.participants,
    currentFocusScore: coreState.currentFocusScore,
    
    // 알림 시스템
    notifications: coreState.notifications,
    addNotification: coreState.addNotification,
    removeNotification: coreState.removeNotification,
    
    // 방 관리 액션
    leaveRoom,
    endRoom,
    
    // 실시간 기능
    sendFocusUpdate: realtimeActions.sendFocusUpdate,
    sendEncouragement: realtimeActions.sendEncouragement,
    
    // 로딩 상태
    loading: coreState.loading,
    error: coreState.error
  }

  return (
    <StudyRoomContext.Provider value={contextValue}>
      {children}
    </StudyRoomContext.Provider>
  )
}

export function useStudyRoomContext(): StudyRoomContextValue {
  const context = useContext(StudyRoomContext)
  if (!context) {
    throw new Error('useStudyRoomContext must be used within StudyRoomProvider')
  }
  return context
}
