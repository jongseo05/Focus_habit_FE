import type { 
  SocialWebSocketMessage,
  FocusUpdateMessage,
  RoomJoinMessage,
  RoomLeaveMessage,
  EncouragementMessageWS
} from '@/types/social'

export interface SocialWebSocketHandlers {
  onFocusUpdate?: (data: FocusUpdateMessage['data']) => void
  onRoomJoin?: (data: RoomJoinMessage['data']) => void
  onRoomLeave?: (data: RoomLeaveMessage['data']) => void
  onEncouragement?: (data: EncouragementMessageWS['data']) => void
  onError?: (error: any) => void
}

export class SocialWebSocketHandler {
  private handlers: SocialWebSocketHandlers
  private currentRoomId: string | null = null

  constructor(handlers: SocialWebSocketHandlers = {}) {
    this.handlers = handlers
  }

  // 메시지 처리
  handleMessage(message: SocialWebSocketMessage): void {
    try {
      switch (message.type) {
        case 'focus_update':
          this.handleFocusUpdate(message as FocusUpdateMessage)
          break
        case 'room_join':
          this.handleRoomJoin(message as RoomJoinMessage)
          break
        case 'room_leave':
          this.handleRoomLeave(message as RoomLeaveMessage)
          break
        case 'encouragement':
          this.handleEncouragement(message as EncouragementMessageWS)
          break
        default:
          console.warn('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling social message:', error)
      this.handlers.onError?.(error)
    }
  }

  // 집중도 업데이트 처리
  private handleFocusUpdate(message: FocusUpdateMessage): void {
    // 현재 룸의 메시지만 처리
    if (message.data.room_id === this.currentRoomId) {
      this.handlers.onFocusUpdate?.(message.data)
    }
  }

  // 룸 입장 처리
  private handleRoomJoin(message: RoomJoinMessage): void {
    if (message.data.room_id === this.currentRoomId) {
      this.handlers.onRoomJoin?.(message.data)
    }
  }

  // 룸 퇴장 처리
  private handleRoomLeave(message: RoomLeaveMessage): void {
    if (message.data.room_id === this.currentRoomId) {
      this.handlers.onRoomLeave?.(message.data)
    }
  }

  // 격려 메시지 처리
  private handleEncouragement(message: EncouragementMessageWS): void {
    if (message.data.room_id === this.currentRoomId) {
      this.handlers.onEncouragement?.(message.data)
    }
  }

  // 현재 룸 설정
  setCurrentRoom(roomId: string | null): void {
    this.currentRoomId = roomId
  }

  // 룸 입장 메시지 생성
  createRoomJoinMessage(userId: string, roomId: string, userName: string, avatarUrl?: string): RoomJoinMessage {
    return {
      type: 'room_join',
      data: {
        user_id: userId,
        room_id: roomId,
        user_name: userName,
        avatar_url: avatarUrl,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    }
  }

  // 룸 퇴장 메시지 생성
  createRoomLeaveMessage(userId: string, roomId: string): RoomLeaveMessage {
    return {
      type: 'room_leave',
      data: {
        user_id: userId,
        room_id: roomId,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    }
  }

  // 집중도 업데이트 메시지 생성
  createFocusUpdateMessage(userId: string, roomId: string, focusScore: number): FocusUpdateMessage {
    return {
      type: 'focus_update',
      data: {
        user_id: userId,
        room_id: roomId,
        focus_score: focusScore,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    }
  }

  // 격려 메시지 생성
  createEncouragementMessage(
    fromUserId: string, 
    toUserId: string, 
    roomId: string, 
    content: string, 
    messageType: 'text' | 'emoji' | 'sticker' = 'text'
  ): EncouragementMessageWS {
    return {
      type: 'encouragement',
      data: {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        room_id: roomId,
        message_type: messageType,
        content: content,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now()
    }
  }
}
