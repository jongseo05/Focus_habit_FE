import { 
  WebSocketStatus, 
  WebSocketMessage, 
  WebSocketConfig, 
  WebSocketEventHandlers,
  PingMessage,
  PongMessage,
  AuthMessage,
  FrameMessage
} from '@/types/websocket'

export class WebSocketClient {
  private ws: WebSocket | null = null
  public config: WebSocketConfig
  private eventHandlers: WebSocketEventHandlers
  private reconnectAttempts = 0
  private reconnectTimeoutId: any = null
  private pingIntervalId: any = null
  private status: WebSocketStatus = WebSocketStatus.DISCONNECTED
  private messageQueue: WebSocketMessage[] = []
  private readonly maxQueueSize = 100 // 메시지 큐 크기 제한
  private isAuthenticated = false
  
  // 적응형 재연결을 위한 상태 관리
  private connectionHistory: Array<{ timestamp: number; success: boolean; latency?: number }> = []
  private lastSuccessfulConnection = 0
  private adaptiveReconnectInterval = 1000 // 시작 값

  constructor(config: WebSocketConfig, eventHandlers: WebSocketEventHandlers = {}) {
    this.config = config
    this.eventHandlers = eventHandlers
  }

  // WebSocket 연결
  connect(authToken?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.setStatus(WebSocketStatus.CONNECTING)
    
    try {
      // URL 검증
      if (!this.config.url) {
        throw new Error('WebSocket URL이 설정되지 않았습니다.')
      }
      
      // URL 형식 검증
      try {
        new URL(this.config.url)
      } catch (urlError) {
        throw new Error(`잘못된 WebSocket URL 형식: ${this.config.url}`)
      }
      
      // WebSocket 연결 시도
      
      // WebSocket 연결 생성
      console.log('🔗 WebSocket 연결 시도:', {
        url: this.config.url,
        protocols: this.config.protocols
      })
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
      console.error('WebSocket 연결 생성 실패:', error)
      this.setStatus(WebSocketStatus.ERROR)
      this.eventHandlers.onError?.(error as Event)
    }
  }

  // 상태 설정
  private setStatus(newStatus: WebSocketStatus): void {
    this.status = newStatus
  }

  // 연결 상태 확인
  isConnected(): boolean {
    const isOpen = this.ws?.readyState === WebSocket.OPEN
    const isStatusConnected = this.status === WebSocketStatus.CONNECTED
    const result = isOpen && isStatusConnected
    
    console.log('🔍 WebSocket 연결 상태 확인:', {
      hasWs: !!this.ws,
      readyState: this.ws?.readyState,
      isOpen,
      status: this.status,
      isStatusConnected,
      result
    })
    
    return result
  }

  // 메시지 전송 (메모리 관리 개선)
  sendMessage(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 메시지 큐 크기 제한
      if (this.messageQueue.length >= this.maxQueueSize) {
        this.messageQueue.shift() // 가장 오래된 메시지 제거
      }
      
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
      // 에러 처리
    }
  }

  // 프레임 전송 (raw base64 데이터만 전송)
  sendFrame(frameData: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      // JSON 래핑 없이 raw base64 데이터만 전송
      this.ws.send(frameData)
    } catch (error) {
      // 에러 처리
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
      if (this.ws?.readyState === WebSocket.OPEN) {
        const pingMessage: PingMessage = {
          type: 'ping',
          timestamp: Date.now()
        }
        this.ws.send(JSON.stringify(pingMessage))
      }
    }, this.config.pingInterval)
  }

  // Ping 정리
  private clearPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }
  }

  // Pong 메시지 처리
  private handlePongMessage(pongMessage: PongMessage): void {
    // Pong 응답 처리 로직
  }

  // 연결 시도 기록
  private recordConnectionAttempt(success: boolean, latency?: number): void {
    const record = { timestamp: Date.now(), success, latency }
    this.connectionHistory.push(record)
    
    // 최근 10개 연결 시도만 유지
    if (this.connectionHistory.length > 10) {
      this.connectionHistory.shift()
    }
  }

  // 적응형 재연결
  private adaptiveReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.eventHandlers.onMaxReconnectAttemptsReached?.()
      return
    }

    this.reconnectAttempts++
    this.eventHandlers.onReconnect?.(this.reconnectAttempts)

    // 연결 시도 간격을 점진적으로 증가
    const delay = Math.min(
      this.adaptiveReconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 최대 30초
    )

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect()
    }, delay)
  }

  // 재연결 타임아웃 정리
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId)
      this.reconnectTimeoutId = null
    }
  }

  // 이벤트 리스너 설정
  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onopen = (event) => {
      this.setStatus(WebSocketStatus.CONNECTED)
      this.reconnectAttempts = 0
      this.clearReconnectTimeout()
      
      // 연결 성공 기록
      this.recordConnectionAttempt(true)
      this.lastSuccessfulConnection = Date.now()
      
      // 대기 중인 메시지 전송
      this.sendQueuedMessages()
      
      // Ping 시작
      if (this.config.enablePing) {
        this.startPing()
      }
      
      this.eventHandlers.onOpen?.(event)
    }

    this.ws.onmessage = (event) => {
      console.log('📨 WebSocket 메시지 수신됨:', {
        dataType: typeof event.data,
        dataLength: event.data?.length,
        timestamp: new Date().toISOString()
      })
      
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📨 파싱된 메시지:', message)
        
        // Pong 메시지 처리
        if (message.type === 'pong') {
          this.handlePongMessage(message as PongMessage)
          return
        }

        // 인증 응답 처리
        if (message.type === 'auth_success') {
          this.isAuthenticated = true
        }

        try {
          console.log('📨 WebSocket 클라이언트에서 이벤트 핸들러 호출:', message)
          this.eventHandlers.onMessage?.(message)
        } catch (error) {
          console.error('이벤트 핸들러 호출 실패:', error)
        }
      } catch (error) {
        console.error('WebSocket 메시지 파싱 실패:', error)
        console.log('📨 원본 데이터:', event.data)
        // 파싱 에러 처리
      }
    }

    this.ws.onclose = (event) => {
      // WebSocket 연결 종료
      
      this.setStatus(WebSocketStatus.DISCONNECTED)
      this.clearPingInterval()
      this.isAuthenticated = false
      
      this.eventHandlers.onClose?.(event)
      
      // 의도적인 종료가 아니라면 적응형 재연결 시도
      if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.recordConnectionAttempt(false)
        this.adaptiveReconnect()
      }
    }

    this.ws.onerror = (event) => {
      console.error('WebSocket 연결 오류:', event)
      this.setStatus(WebSocketStatus.ERROR)
      this.recordConnectionAttempt(false)
      this.eventHandlers.onError?.(event)
    }
  }

  // 연결 해제
  disconnect(): void {
    this.clearReconnectTimeout()
    this.clearPingInterval()
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure')
      this.ws = null
    }
    
    this.setStatus(WebSocketStatus.DISCONNECTED)
    this.isAuthenticated = false
  }

  // 재연결
  reconnect(): void {
    this.disconnect()
    setTimeout(() => {
      this.connect()
    }, 1000)
  }

  // 이벤트 핸들러 업데이트
  updateEventHandlers(newHandlers: WebSocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...newHandlers }
  }
}
