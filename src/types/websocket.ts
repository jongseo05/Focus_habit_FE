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

// 새로운 웹캠 프레임 분석 결과 타입 (실제 서버 응답 형식)
export interface WebcamFrameAnalysisResult {
  timestamp: number
  eye_status: {
    status: 'OPEN' | 'CLOSED' | 'PARTIALLY_OPEN'
    ear_value: number
  }
  head_pose: {
    pitch: number
    yaw: number
    roll: number
  }
  prediction_result: {
    timestamp: number
    prediction: number // 집중도 백분율 (0-100)
    confidence: number
  }
}

// 집중도 분석 결과를 기존 형식으로 변환하는 헬퍼 타입
export interface FocusAnalysisFeatures {
  eyeStatus: {
    isOpen: boolean
    confidence: number
    earValue: number
  }
  headPose: {
    pitch: number
    yaw: number
    roll: number
  }
  focusScore: {
    score: number // 0-100
    confidence: number
  }
  timestamp: number
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

// 카메라 상태 업데이트 메시지
export interface CameraStateMessage extends WebSocketMessage {
  type: 'camera_state_update'
  data: {
    user_id: string
    room_id: string
    is_video_enabled: boolean
    is_audio_enabled: boolean
    timestamp: string
  }
}

// 카메라 상태 변경 요청 메시지
export interface CameraStateUpdateRequest extends WebSocketMessage {
  type: 'update_camera_state'
  data: {
    room_id: string
    is_video_enabled: boolean
    is_audio_enabled: boolean
  }
}

// 카메라 상태 동기화 응답 메시지
export interface CameraStateSyncResponse extends WebSocketMessage {
  type: 'camera_state_sync'
  data: {
    room_id: string
    participants: Array<{
      user_id: string
      is_video_enabled: boolean
      is_audio_enabled: boolean
      updated_at: string
    }>
  }
}

