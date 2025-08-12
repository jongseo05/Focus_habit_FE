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

// 프레임 전송 메시지 (base64 프레임만)
export interface FrameMessage extends WebSocketMessage {
  type: 'frame'
  data: string // Base64 인코딩된 프레임 데이터만
}

// 프레임 분석 결과 응답
export interface FrameAnalysisResult extends WebSocketMessage {
  type: 'frame_analysis_result'
  data: {
    frameId: string
    features: {
      headPose: {
        pitch: number
        yaw: number
        roll: number
      }
      eyeStatus: {
        leftEye: 'open' | 'closed' | 'partially_open'
        rightEye: 'open' | 'closed' | 'partially_open'
        confidence: number
      }
      attention: {
        isFocused: boolean
        confidence: number
        distractionLevel: number
      }
      timestamp: number
    }
  }
}

// 에러 메시지
export interface ErrorMessage extends WebSocketMessage {
  type: 'error'
  data: {
    code: string
    message: string
    details?: any
  }
}

// 연결 상태 메시지
export interface StatusMessage extends WebSocketMessage {
  type: 'status'
  data: {
    status: WebSocketStatus
    message?: string
    timestamp: number
  }
}

// WebSocket 클라이언트 설정
export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  reconnectInterval: number
  maxReconnectAttempts: number
  pingInterval: number
  enablePing: boolean
}

// WebSocket 이벤트 핸들러
export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void
  onMessage?: (message: WebSocketMessage) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onReconnect?: (attempt: number) => void
  onMaxReconnectAttemptsReached?: () => void
}

// WebSocket 연결 상태
export interface WebSocketConnectionState {
  status: WebSocketStatus
  isConnected: boolean
  reconnectAttempts: number
}

