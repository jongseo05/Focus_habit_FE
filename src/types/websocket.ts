// WebSocket 연결 상태
export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// WebSocket 메시지 타입
export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
  id?: string
}

// Ping/Pong 메시지
export interface PingMessage extends WebSocketMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage extends WebSocketMessage {
  type: 'pong'
  timestamp: number
}

// 인증 메시지
export interface AuthMessage extends WebSocketMessage {
  type: 'auth'
  data: {
    token: string
    userId: string
  }
  timestamp: number
}

// 제스처 인식 응답 메시지
export interface GestureResponse {
  gesture: string // 인식된 제스처
  timestamp: string // ISO 형식 타임스탬프
}

// WebSocket 구성 옵션
export interface WebSocketConfig {
  url: string
  reconnectInterval: number
  maxReconnectAttempts: number
  enablePing: boolean
  pingInterval: number
  protocols?: string[]
  headers?: Record<string, string>
}

// WebSocket 이벤트 핸들러
export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void
  onMessage?: (message: WebSocketMessage) => void
  onClose?: (event: CloseEvent) => void
  onError?: (error: Event) => void
  onReconnect?: (attempt: number) => void
  onMaxReconnectAttemptsReached?: () => void
}

// WebSocket 훅 반환 타입
export interface UseWebSocketReturn {
  status: WebSocketStatus
  lastMessage: WebSocketMessage | null
  sendMessage: (message: WebSocketMessage) => void
  sendRawText: (text: string) => void // 원시 텍스트 전송용 (제스처 인식)
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  isConnected: boolean
  isConnecting: boolean
  reconnectAttempts: number
}
