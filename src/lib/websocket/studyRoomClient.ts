// =====================================================
// 스터디룸 전용 WebSocket 클라이언트
// =====================================================

import { WebSocketClient } from './client'
import type { WebSocketMessage } from '@/types/websocket'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface StudyRoomWebSocketMessage {
  type: 'join_room' | 'leave_room' | 'focus_update' | 'encouragement' | 'room_ended' | 'participant_update'
  room_id: string
  user_id: string
  timestamp: number
  data?: any
}

interface StudyRoomEventHandlers {
  onParticipantJoined?: (participant: ParticipantWithUser) => void
  onParticipantLeft?: (userId: string) => void
  onFocusUpdate?: (userId: string, score: number) => void
  onEncouragement?: (senderId: string, senderName: string, message: string) => void
  onRoomEnded?: () => void
  onError?: (error: string) => void
}

export class StudyRoomWebSocketClient {
  private wsClient: WebSocketClient
  private currentRoomId: string | null = null
  private userId: string | null = null
  private eventHandlers: StudyRoomEventHandlers
  private heartbeatInterval: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  constructor(eventHandlers: StudyRoomEventHandlers = {}) {
    this.eventHandlers = eventHandlers
    
    this.wsClient = new WebSocketClient(
      {
        url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/studyroom',
        maxReconnectAttempts: this.maxReconnectAttempts,
        reconnectInterval: 3000,
        pingInterval: 30000,
        enablePing: true
      },
      {
        onOpen: this.handleConnect.bind(this),
        onClose: this.handleDisconnect.bind(this),
        onMessage: this.handleMessage.bind(this),
        onError: this.handleError.bind(this)
      }
    )
  }

  // 스터디룸 연결
  connect(roomId: string, userId: string): void {
    this.currentRoomId = roomId
    this.userId = userId
    this.reconnectAttempts = 0
    
    this.wsClient.connect()
  }

  // 연결 해제
  disconnect(): void {
    this.stopHeartbeat()
    
    if (this.currentRoomId && this.userId) {
      this.sendMessage({
        type: 'leave_room',
        room_id: this.currentRoomId,
        user_id: this.userId,
        timestamp: Date.now()
      })
    }
    
    this.wsClient.disconnect()
    this.currentRoomId = null
    this.userId = null
  }

  // 메시지 전송
  private sendMessage(message: StudyRoomWebSocketMessage): void {
    this.wsClient.sendMessage(message)
  }

  // 집중도 점수 업데이트 전송
  sendFocusUpdate(score: number): void {
    if (!this.currentRoomId || !this.userId) return
    
    this.sendMessage({
      type: 'focus_update',
      room_id: this.currentRoomId,
      user_id: this.userId,
      timestamp: Date.now(),
      data: { score: Math.round(score * 10) / 10 }
    })
  }

  // 격려 메시지 전송
  sendEncouragement(targetUserId: string, message: string): void {
    if (!this.currentRoomId || !this.userId) return
    
    this.sendMessage({
      type: 'encouragement',
      room_id: this.currentRoomId,
      user_id: this.userId,
      timestamp: Date.now(),
      data: {
        target_id: targetUserId,
        message: message.trim()
      }
    })
  }

  // 연결 성공 처리
  private handleConnect(event: Event): void {
    console.log('스터디룸 WebSocket 연결됨')
    this.reconnectAttempts = 0
    
    // 방 참가 메시지 전송
    if (this.currentRoomId && this.userId) {
      this.sendMessage({
        type: 'join_room',
        room_id: this.currentRoomId,
        user_id: this.userId,
        timestamp: Date.now()
      })
    }
    
    // 하트비트 시작
    this.startHeartbeat()
  }

  // 연결 해제 처리
  private handleDisconnect(event: CloseEvent): void {
    console.log('스터디룸 WebSocket 연결 해제됨')
    this.stopHeartbeat()
    
    // 재연결 시도
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentRoomId && this.userId) {
      this.reconnectAttempts++
      console.log(`재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      setTimeout(() => {
        this.wsClient.connect()
      }, 3000 * this.reconnectAttempts) // 점진적 지연
    }
  }

  // 메시지 처리
  private handleMessage(message: WebSocketMessage): void {
    try {
      const studyRoomMessage: StudyRoomWebSocketMessage & { sender_name?: string } = message as any
      
      // 본인이 보낸 메시지는 일부 처리 제외
      const isOwnMessage = studyRoomMessage.user_id === this.userId

      switch (studyRoomMessage.type) {
        case 'participant_update':
          if (studyRoomMessage.data?.type === 'joined' && !isOwnMessage) {
            this.eventHandlers.onParticipantJoined?.(studyRoomMessage.data.participant)
          } else if (studyRoomMessage.data?.type === 'left' && !isOwnMessage) {
            this.eventHandlers.onParticipantLeft?.(studyRoomMessage.user_id)
          }
          break

        case 'focus_update':
          if (!isOwnMessage && studyRoomMessage.data?.score !== undefined) {
            this.eventHandlers.onFocusUpdate?.(studyRoomMessage.user_id, studyRoomMessage.data.score)
          }
          break

        case 'encouragement':
          if (!isOwnMessage && studyRoomMessage.data?.message) {
            this.eventHandlers.onEncouragement?.(
              studyRoomMessage.user_id,
              studyRoomMessage.sender_name || '알 수 없음',
              studyRoomMessage.data.message
            )
          }
          break

        case 'room_ended':
          this.eventHandlers.onRoomEnded?.()
          this.disconnect()
          break

        default:
          console.log('알 수 없는 메시지 타입:', message.type)
      }
    } catch (error) {
      console.error('메시지 파싱 오류:', error)
      this.eventHandlers.onError?.('메시지 처리 중 오류가 발생했습니다.')
    }
  }

  // 에러 처리
  private handleError(error: Event): void {
    console.error('스터디룸 WebSocket 오류:', error)
    this.eventHandlers.onError?.('연결 오류가 발생했습니다.')
  }

  // 하트비트 시작
  private startHeartbeat(): void {
    this.stopHeartbeat()
    
    this.heartbeatInterval = setInterval(() => {
      if (this.currentRoomId && this.userId) {
        this.wsClient.sendMessage({
          type: 'ping',
          data: {
            room_id: this.currentRoomId,
            user_id: this.userId
          },
          timestamp: Date.now()
        })
      }
    }, 30000) // 30초마다
  }

  // 하트비트 중지
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // 연결 상태 확인
  get isConnected(): boolean {
    return this.wsClient.isConnected()
  }

  // 현재 방 ID
  get roomId(): string | null {
    return this.currentRoomId
  }
}
