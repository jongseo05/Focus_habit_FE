'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { SocialWebSocketHandler, SocialWebSocketHandlers } from '@/lib/websocket/socialHandler'
import type { 
  FocusUpdateMessage,
  RoomJoinMessage,
  RoomLeaveMessage,
  EncouragementMessageWS
} from '@/types/social'

interface UseSocialWebSocketOptions {
  roomId?: string
  userId?: string
  onFocusUpdate?: (data: FocusUpdateMessage['data']) => void
  onRoomJoin?: (data: RoomJoinMessage['data']) => void
  onRoomLeave?: (data: RoomLeaveMessage['data']) => void
  onEncouragement?: (data: EncouragementMessageWS['data']) => void
  onError?: (error: any) => void
}

export function useSocialWebSocket(options: UseSocialWebSocketOptions = {}) {
  const {
    roomId,
    userId,
    onFocusUpdate,
    onRoomJoin,
    onRoomLeave,
    onEncouragement,
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const socialHandlerRef = useRef<SocialWebSocketHandler | null>(null)

  // WebSocket 핸들러 설정
  const webSocketHandlers: SocialWebSocketHandlers = {
    onFocusUpdate: (data) => {
      setLastMessage({ type: 'focus_update', data })
      onFocusUpdate?.(data)
    },
    onRoomJoin: (data) => {
      setLastMessage({ type: 'room_join', data })
      onRoomJoin?.(data)
    },
    onRoomLeave: (data) => {
      setLastMessage({ type: 'room_leave', data })
      onRoomLeave?.(data)
    },
    onEncouragement: (data) => {
      setLastMessage({ type: 'encouragement', data })
      onEncouragement?.(data)
    },
    onError: (error) => {
      console.error('Social WebSocket error:', error)
      onError?.(error)
    }
  }

  // 소셜 핸들러 초기화
  useEffect(() => {
    socialHandlerRef.current = new SocialWebSocketHandler(webSocketHandlers)
    
    // 정리 함수
    return () => {
      if (socialHandlerRef.current) {
        console.log('Social WebSocket 핸들러 정리 중...')
        socialHandlerRef.current = null
      }
    }
  }, [onFocusUpdate, onRoomJoin, onRoomLeave, onEncouragement, onError])

  // 룸 ID 변경 시 핸들러 업데이트
  useEffect(() => {
    if (socialHandlerRef.current) {
      socialHandlerRef.current.setCurrentRoom(roomId || null)
    }
  }, [roomId])

  // WebSocket 연결
  const { sendMessage, isConnected: wsConnected } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
    protocols: ['social-protocol']
  }, {
    onMessage: (message: any) => {
      if (socialHandlerRef.current) {
        socialHandlerRef.current.handleMessage(message)
      }
    },
    onOpen: () => {
      setIsConnected(true)
      console.log('Social WebSocket connected')
    },
    onClose: () => {
      setIsConnected(false)
      console.log('Social WebSocket disconnected')
    },
    onError: (error) => {
      console.error('Social WebSocket error:', error)
      onError?.(error)
    }
  })

  // 룸 입장 메시지 전송
  const joinRoom = useCallback((userName: string, avatarUrl?: string) => {
    if (!roomId || !userId || !socialHandlerRef.current) return

    const joinMessage = socialHandlerRef.current.createRoomJoinMessage(
      userId,
      roomId,
      userName,
      avatarUrl
    )
    sendMessage(joinMessage)
  }, [roomId, userId, sendMessage])

  // 룸 퇴장 메시지 전송
  const leaveRoom = useCallback(() => {
    if (!roomId || !userId || !socialHandlerRef.current) return

    const leaveMessage = socialHandlerRef.current.createRoomLeaveMessage(userId, roomId)
    sendMessage(leaveMessage)
  }, [roomId, userId, sendMessage])

  // 집중도 업데이트 전송
  const sendFocusUpdate = useCallback((focusScore: number) => {
    if (!roomId || !userId || !socialHandlerRef.current) return

    const focusMessage = socialHandlerRef.current.createFocusUpdateMessage(
      userId,
      roomId,
      focusScore
    )
    sendMessage(focusMessage)
  }, [roomId, userId, sendMessage])

  // 격려 메시지 전송
  const sendEncouragement = useCallback((
    toUserId: string, 
    content: string, 
    messageType: 'text' | 'emoji' | 'sticker' = 'text'
  ) => {
    if (!roomId || !userId || !socialHandlerRef.current) return

    const encouragementMessage = socialHandlerRef.current.createEncouragementMessage(
      userId,
      toUserId,
      roomId,
      content,
      messageType
    )
    sendMessage(encouragementMessage)
  }, [roomId, userId, sendMessage])

  return {
    isConnected: isConnected && wsConnected,
    lastMessage,
    joinRoom,
    leaveRoom,
    sendFocusUpdate,
    sendEncouragement,
    sendMessage
  }
}
