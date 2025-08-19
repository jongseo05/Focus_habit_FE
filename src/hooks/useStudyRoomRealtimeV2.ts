// =====================================================
// 개선된 스터디룸 실시간 기능 훅
// =====================================================

import { useEffect, useCallback, useRef } from 'react'
import { StudyRoomWebSocketClient } from '@/lib/websocket/studyRoomClient'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface UseStudyRoomRealtimeProps {
  room?: StudyRoom
  userId?: string
  onParticipantUpdate: (participants: ParticipantWithUser[]) => void
  onFocusScoreUpdate: (score: number) => void
  onNotification: (message: string, type?: 'join' | 'leave' | 'info') => void
}



export function useStudyRoomRealtime({
  room,
  userId,
  onParticipantUpdate,
  onFocusScoreUpdate,
  onNotification
}: UseStudyRoomRealtimeProps) {
  
  const wsClient = useRef<StudyRoomWebSocketClient | null>(null)
  const focusUpdateThrottle = useRef<NodeJS.Timeout | null>(null)
  
  // WebSocket 클라이언트 초기화
  useEffect(() => {
    wsClient.current = new StudyRoomWebSocketClient({
      onParticipantJoined: (participant) => {
        onNotification(`${participant.user.name}님이 입장했습니다.`, 'join')
        // 참가자 목록 다시 로드 (API 호출)
        loadParticipants()
      },
      onParticipantLeft: (userId) => {
        onNotification('참가자가 나갔습니다.', 'leave')
        // 참가자 목록 다시 로드 (API 호출)
        loadParticipants()
      },
      onFocusUpdate: (userId, score) => {
        onFocusScoreUpdate(score)
      },
      onEncouragement: (senderId, senderName, message) => {
        onNotification(`💪 ${senderName}: ${message}`, 'info')
      },
      onRoomEnded: () => {
        onNotification('스터디룸이 종료되었습니다.', 'info')
      },
      onError: (error) => {
        onNotification(`연결 오류: ${error}`, 'info')
      }
    })
    
    return () => {
      wsClient.current?.disconnect()
    }
  }, [])

  // 참가자 목록 로드 함수
  const loadParticipants = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/study-room/${room.room_id}/participants`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          onParticipantUpdate(result.data)
        }
      }
    } catch (error) {
      console.error('참가자 목록 로드 실패:', error)
    }
  }, [room?.room_id, onParticipantUpdate])

  // 방 참가
  const joinRoom = useCallback(() => {
    if (!room?.room_id || !userId || !wsClient.current) return
    
    wsClient.current.connect(room.room_id, userId)
    loadParticipants()
  }, [room?.room_id, userId, loadParticipants])

  // 방 나가기
  const leaveRoom = useCallback(() => {
    if (!wsClient.current) return
    
    wsClient.current.disconnect()
  }, [])

  // 집중도 점수 전송 (스로틀링 적용)
  const sendFocusUpdate = useCallback((score: number) => {
    if (!wsClient.current) return
    
    // 500ms마다 한 번만 전송 (성능 최적화)
    if (focusUpdateThrottle.current) {
      clearTimeout(focusUpdateThrottle.current)
    }
    
    focusUpdateThrottle.current = setTimeout(() => {
      wsClient.current?.sendFocusUpdate(score)
    }, 500)
  }, [])

  // 격려 메시지 전송
  const sendEncouragement = useCallback((targetUserId: string, message: string) => {
    if (!wsClient.current || !message.trim()) return
    
    wsClient.current.sendEncouragement(targetUserId, message.trim())
  }, [])

  // 방 종료 알림 (호스트만)
  const notifyRoomEnd = useCallback(() => {
    // 구현 필요시 추가
  }, [])

  // 방 정보가 변경될 때 연결
  useEffect(() => {
    if (room?.room_id && userId) {
      joinRoom()
    }
    
    return () => {
      leaveRoom()
    }
  }, [room?.room_id, userId, joinRoom, leaveRoom])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (focusUpdateThrottle.current) {
        clearTimeout(focusUpdateThrottle.current)
      }
      wsClient.current?.disconnect()
    }
  }, [])

  return {
    // 연결 상태
    status: wsClient.current?.isConnected ? 'connected' : 'disconnected',
    
    // 액션 함수
    joinRoom,
    leaveRoom,
    sendFocusUpdate,
    sendEncouragement,
    notifyRoomEnd,
    
    // 수동 연결 제어
    connect: joinRoom,
    disconnect: leaveRoom
  }
}
