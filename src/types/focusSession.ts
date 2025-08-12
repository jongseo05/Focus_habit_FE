// 집중 세션 관련 타입 정의

export enum FocusSessionErrorType {
  CAMERA_DISCONNECTED = 'camera_disconnected',
  WEBSOCKET_FAILED = 'websocket_failed',
  GESTURE_SERVER_ERROR = 'gesture_server_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_REVOKED = 'permission_revoked',
  HARDWARE_ERROR = 'hardware_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export enum FocusSessionStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error',
  RECOVERING = 'recovering'
}

export interface FocusSessionError {
  type: FocusSessionErrorType
  message: string
  timestamp: number
  recoverable: boolean
  retryCount?: number
  maxRetries?: number
  details?: {
    originalError?: any
    errorCode?: string
    userAgent?: string
    cameraInfo?: MediaTrackSettings
    networkStatus?: 'online' | 'offline'
  }
}

export interface FocusSessionState {
  status: FocusSessionStatus
  isRunning: boolean
  isPaused: boolean
  elapsed: number
  errors: FocusSessionError[]
  lastError: FocusSessionError | null
  recoveryAttempts: number
  maxRecoveryAttempts: number
}

export interface FocusSessionActions {
  startSession: () => Promise<boolean>
  pauseSession: () => void
  resumeSession: () => Promise<boolean>
  stopSession: () => void
  handleError: (error: FocusSessionError) => void
  clearErrors: () => void
  retryRecovery: () => Promise<boolean>
}

// 에러 복구 전략
export interface RecoveryStrategy {
  type: FocusSessionErrorType
  maxRetries: number
  retryDelay: number
  fallbackAction?: () => void
  userNotification?: string
}

// 세션 설정
export interface FocusSessionConfig {
  autoRecovery: boolean
  maxRecoveryAttempts: number
  recoveryStrategies: RecoveryStrategy[]
  gracefulDegradation: boolean // 점진적 성능 저하 허용
  fallbackMode: boolean // 대체 모드 활성화
}

// 제스처 인식 관련 타입들
export interface FocusSessionWithGestureOptions {
  frameRate?: number
  enableGestureRecognition?: boolean
  gestureJpegQuality?: number
  onGestureDetected?: (gesture: string) => void
  onFocusStatusChanged?: (status: 'focused' | 'normal' | 'distracted') => void
}

export interface GestureFeatures {
  frameNumber: number
  eyeStatus?: string
  earValue?: number
  headPose?: {
    pitch?: number
    roll?: number
    yaw?: number
  }
  focusStatus?: 'focused' | 'normal' | 'distracted'
  focusConfidence?: number
  focusScore?: number
}

export interface FocusSessionWithGestureReturn {
  isGestureActive: boolean
  isStreaming: boolean
  isPermissionGranted: boolean
  startStream: () => Promise<void>
  stopStream: () => void
  toggleStream: () => void
  error: string | null
  lastGesture: string | null
  focusStatus: 'focused' | 'normal' | 'distracted' | null
  focusScore: number
}
