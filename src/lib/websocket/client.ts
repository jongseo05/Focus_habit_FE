import { 
  WebSocketStatus, 
  WebSocketMessage, 
  WebSocketConfig, 
  WebSocketEventHandlers,
  PingMessage,
  PongMessage,
  AuthMessage
} from '@/types/websocket'

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private eventHandlers: WebSocketEventHandlers
  private reconnectAttempts = 0
  private reconnectTimeoutId: NodeJS.Timeout | null = null
  private pingIntervalId: NodeJS.Timeout | null = null
  private status: WebSocketStatus = WebSocketStatus.DISCONNECTED
  private messageQueue: WebSocketMessage[] = []
  private readonly maxQueueSize = 100 // 메시지 큐 크기 제한
  private isAuthenticated = false

  constructor(config: WebSocketConfig, eventHandlers: WebSocketEventHandlers = {}) {
    this.config = config
    this.eventHandlers = eventHandlers
  }

  // WebSocket 연결
  connect(authToken?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn('WebSocket is already connected')
      return
    }

    this.setStatus(WebSocketStatus.CONNECTING)
    
    try {
      // WebSocket 연결 생성
      this.ws = new WebSocket(this.config.url, this.config.protocols)
      
      // 이벤트 리스너 설정
      this.setupEventListeners()

      // 인증 토큰이 있다면 연결 후 인증 메시지 전송 예약
      if (authToken) {
        const authMessage: AuthMessage = {
          type: 'auth',
          data: {
            token: authToken,
            userId: '' // 토큰에서 추출하거나 별도로 전달받아야 함
          },
          timestamp: Date.now()
        }
        this.messageQueue.unshift(authMessage)
      }

    } catch (error) {
      console.error('WebSocket connection failed:', error)
      this.setStatus(WebSocketStatus.ERROR)
      this.eventHandlers.onError?.(error as Event)
    }
  }

  // WebSocket 연결 해제 (메모리 정리 포함)
  disconnect(): void {
    this.isAuthenticated = false
    this.clearReconnectTimeout()
    this.clearPingInterval()
    
    // 메시지 큐 정리
    this.messageQueue = []
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect')
      this.ws = null
    }
    
    this.setStatus(WebSocketStatus.DISCONNECTED)
    console.log('WebSocket disconnected and memory cleaned')
  }

  // 메시지 전송 (메모리 관리 개선)
  sendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 메시지 큐 크기 제한
      if (this.messageQueue.length >= this.maxQueueSize) {
        console.warn('Message queue is full. Removing oldest message.')
        this.messageQueue.shift() // 가장 오래된 메시지 제거
      }
      
      console.warn('WebSocket is not connected. Message queued.')
      this.messageQueue.push(message)
      return
    }

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: message.timestamp || Date.now()
      }
      
      this.ws.send(JSON.stringify(messageWithTimestamp))
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  // 재연결
  reconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached')
      this.eventHandlers.onMaxReconnectAttemptsReached?.()
      return
    }

    this.reconnectAttempts++
    this.setStatus(WebSocketStatus.RECONNECTING)
    this.eventHandlers.onReconnect?.(this.reconnectAttempts)

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
    }, this.config.reconnectInterval)
  }

  // 상태 설정
  private setStatus(status: WebSocketStatus): void {
    this.status = status
  }

  // 현재 상태 반환
  getStatus(): WebSocketStatus {
    return this.status
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.status === WebSocketStatus.CONNECTED && this.ws?.readyState === WebSocket.OPEN
  }

  // 이벤트 리스너 설정
  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onopen = (event) => {
      console.log('WebSocket connected')
      this.setStatus(WebSocketStatus.CONNECTED)
      this.reconnectAttempts = 0
      this.clearReconnectTimeout()
      
      // 대기 중인 메시지 전송
      this.sendQueuedMessages()
      
      // Ping 시작
      if (this.config.enablePing) {
        this.startPing()
      }
      
      this.eventHandlers.onOpen?.(event)
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        
        // Pong 메시지 처리
        if (message.type === 'pong') {
          this.handlePongMessage(message as PongMessage)
          return
        }

        // 인증 응답 처리
        if (message.type === 'auth_success') {
          this.isAuthenticated = true
          console.log('WebSocket authentication successful')
        }

        this.eventHandlers.onMessage?.(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      this.setStatus(WebSocketStatus.DISCONNECTED)
      this.clearPingInterval()
      this.isAuthenticated = false
      
      this.eventHandlers.onClose?.(event)
      
      // 의도적인 종료가 아니라면 재연결 시도
      if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.reconnect()
      }
    }

    this.ws.onerror = (event) => {
      console.error('WebSocket error:', event)
      this.setStatus(WebSocketStatus.ERROR)
      this.eventHandlers.onError?.(event)
    }
  }

  // 대기 중인 메시지 전송
  private sendQueuedMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.sendMessage(message)
      }
    }
  }

  // Ping 시작
  private startPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
    }

    this.pingIntervalId = setInterval(() => {
      if (this.isConnected()) {
        const pingMessage: PingMessage = {
          type: 'ping',
          timestamp: Date.now()
        }
        this.sendMessage(pingMessage)
      }
    }, this.config.pingInterval)
  }

  // Pong 메시지 처리
  private handlePongMessage(message: PongMessage): void {
    const latency = Date.now() - message.timestamp
    console.log(`WebSocket ping latency: ${latency}ms`)
  }

  // 재연결 타이머 정리
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
  }

  // Ping 타이머 정리
  private clearPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }
  }

  // 재연결 시도 횟수 반환
  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }
}
