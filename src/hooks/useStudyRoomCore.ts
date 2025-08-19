// =====================================================
// 스터디룸 핵심 상태 관리 훅
// =====================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface UseStudyRoomCoreProps {
  room?: StudyRoom
  userId?: string
}

interface Notification {
  id: string
  message: string
  type: 'join' | 'leave' | 'info'
  timestamp: number
}

export function useStudyRoomCore({ room, userId }: UseStudyRoomCoreProps) {
  // 기본 상태
  const [participants, setParticipants] = useState<ParticipantWithUser[]>([])
  const [currentFocusScore, setCurrentFocusScore] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 알림 시스템
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notificationIdCounter = useRef(0)

  // 호스트 여부 확인
  useEffect(() => {
    if (room && userId) {
      setIsHost(room.host_id === userId)
    }
  }, [room, userId])

  // 고유한 알림 ID 생성
  const generateNotificationId = useCallback(() => {
    return `notification-${++notificationIdCounter.current}-${Date.now()}`
  }, [])

  // 알림 추가 (중복 방지 로직 포함)
  const addNotification = useCallback((message: string, type: 'join' | 'leave' | 'info' = 'info') => {
    const now = Date.now()
    
    setNotifications(prev => {
      // 5초 내 동일한 메시지 중복 방지
      const isDuplicate = prev.some(notification => 
        notification.message === message && 
        notification.type === type &&
        now - notification.timestamp < 5000
      )
      
      if (isDuplicate) {
        return prev
      }
      
      const newNotification: Notification = {
        id: generateNotificationId(),
        message,
        type,
        timestamp: now
      }
      
      // 최대 10개까지만 유지 (오래된 것부터 제거)
      const updatedNotifications = [...prev, newNotification]
      if (updatedNotifications.length > 10) {
        updatedNotifications.shift()
      }
      
      return updatedNotifications
    })
  }, [generateNotificationId])

  // 알림 제거
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  // 5분 후 알림 자동 제거
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      setNotifications(prev => 
        prev.filter(notification => now - notification.timestamp < 300000) // 5분
      )
    }, 60000) // 1분마다 정리

    return () => clearInterval(cleanup)
  }, [])

  // 참가자 업데이트
  const updateParticipants = useCallback((newParticipants: ParticipantWithUser[]) => {
    setParticipants(prev => {
      // 변경사항이 있는지 확인
      if (JSON.stringify(prev) === JSON.stringify(newParticipants)) {
        return prev
      }
      
      // 새로 들어온 참가자 알림
      const prevUserIds = new Set(prev.map(p => p.user_id))
      const newUsers = newParticipants.filter(p => !prevUserIds.has(p.user_id))
      
      newUsers.forEach(user => {
        if (user.user_id !== userId) { // 본인 제외
          addNotification(`${user.user.name}님이 입장했습니다.`, 'join')
        }
      })
      
      // 나간 참가자 알림
      const newUserIds = new Set(newParticipants.map(p => p.user_id))
      const leftUsers = prev.filter(p => !newUserIds.has(p.user_id))
      
      leftUsers.forEach(user => {
        if (user.user_id !== userId) { // 본인 제외
          addNotification(`${user.user.name}님이 나갔습니다.`, 'leave')
        }
      })
      
      return newParticipants
    })
  }, [userId, addNotification])

  // 집중도 점수 업데이트
  const updateFocusScore = useCallback((score: number) => {
    setCurrentFocusScore(prev => {
      // 점수가 크게 변했을 때만 업데이트 (노이즈 제거)
      if (Math.abs(prev - score) > 1) {
        return score
      }
      return prev
    })
  }, [])

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // 초기 데이터 로드
  const loadInitialData = useCallback(async () => {
    if (!room?.room_id || !userId) return
    
    try {
      setLoading(true)
      setError(null)
      
      // 참가자 목록 로드
      const participantsResponse = await fetch(`/api/social/study-room/${room.room_id}/participants`)
      if (participantsResponse.ok) {
        const participantsData = await participantsResponse.json()
        if (participantsData.success) {
          updateParticipants(participantsData.data || [])
        }
      }
      
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error)
      setError(error instanceof Error ? error.message : '데이터 로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, userId, updateParticipants])

  // 방 정보가 변경될 때 초기 데이터 로드
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  return {
    // 상태
    participants,
    currentFocusScore,
    isHost,
    loading,
    error,
    notifications,
    
    // 상태 업데이트 함수
    setParticipants,
    setCurrentFocusScore,
    setIsHost,
    setLoading,
    setError,
    
    // 유틸리티 함수
    updateParticipants,
    updateFocusScore,
    addNotification,
    removeNotification,
    clearError,
    loadInitialData
  }
}
