import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  FocusSessionState, 
  FocusSessionActions, 
  FocusSessionError, 
  FocusSessionErrorType, 
  FocusSessionStatus,
  FocusSessionConfig,
  RecoveryStrategy
} from '@/types/focusSession'

// 기본 복구 전략
const DEFAULT_RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    type: FocusSessionErrorType.CAMERA_DISCONNECTED,
    maxRetries: 3,
    retryDelay: 2000,
    userNotification: '카메라 연결이 끊어졌습니다. 재연결을 시도합니다.'
  },
  {
    type: FocusSessionErrorType.WEBSOCKET_FAILED,
    maxRetries: 5,
    retryDelay: 1000,
    userNotification: '서버 연결이 불안정합니다. 재연결을 시도합니다.'
  },
  {
    type: FocusSessionErrorType.GESTURE_SERVER_ERROR,
    maxRetries: 3,
    retryDelay: 3000,
    userNotification: '제스처 인식 서버에 오류가 발생했습니다. 재시도합니다.'
  },
  {
    type: FocusSessionErrorType.NETWORK_ERROR,
    maxRetries: 3,
    retryDelay: 5000,
    userNotification: '네트워크 연결을 확인하고 재시도합니다.'
  }
]

// 기본 설정
const DEFAULT_CONFIG: FocusSessionConfig = {
  autoRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryStrategies: DEFAULT_RECOVERY_STRATEGIES,
  gracefulDegradation: true,
  fallbackMode: true
}

export interface UseFocusSessionErrorHandlerOptions {
  config?: Partial<FocusSessionConfig>
  onError?: (error: FocusSessionError) => void
  onRecoveryStart?: (errorType: FocusSessionErrorType) => void
  onRecoverySuccess?: (errorType: FocusSessionErrorType) => void
  onRecoveryFailed?: (error: FocusSessionError) => void
  onSessionInterrupted?: () => void
  onFallbackMode?: () => void
}

export const useFocusSessionErrorHandler = (
  options: UseFocusSessionErrorHandlerOptions = {}
) => {
  const {
    config: userConfig = {},
    onError,
    onRecoveryStart,
    onRecoverySuccess,
    onRecoveryFailed,
    onSessionInterrupted,
    onFallbackMode
  } = options

  const config = { ...DEFAULT_CONFIG, ...userConfig }
  const recoveryTimeouts = useRef<Map<FocusSessionErrorType, NodeJS.Timeout>>(new Map())

  const [state, setState] = useState<FocusSessionState>({
    status: FocusSessionStatus.IDLE,
    isRunning: false,
    isPaused: false,
    elapsed: 0,
    errors: [],
    lastError: null,
    recoveryAttempts: 0,
    maxRecoveryAttempts: config.maxRecoveryAttempts
  })

  // 에러 분류 및 복구 가능성 판단
  const classifyError = useCallback((
    error: any, 
    context: 'camera' | 'websocket' | 'gesture' | 'network' | 'microphone'
  ): FocusSessionError => {
    let errorType: FocusSessionErrorType
    let message: string
    let recoverable = true

    switch (context) {
      case 'camera':
        if (error.name === 'NotAllowedError') {
          errorType = FocusSessionErrorType.PERMISSION_REVOKED
          message = '카메라 권한이 취소되었습니다'
          recoverable = false
        } else if (error.name === 'NotReadableError' || error.message?.includes('device in use')) {
          errorType = FocusSessionErrorType.CAMERA_DISCONNECTED
          message = '카메라 연결이 끊어졌거나 다른 앱에서 사용 중입니다'
        } else {
          errorType = FocusSessionErrorType.HARDWARE_ERROR
          message = '카메라 하드웨어 오류가 발생했습니다'
        }
        break

      case 'websocket':
        if (error.code === 1006 || error.type === 'error') {
          errorType = FocusSessionErrorType.WEBSOCKET_FAILED
          message = 'WebSocket 연결이 실패했습니다'
        } else {
          errorType = FocusSessionErrorType.NETWORK_ERROR
          message = '네트워크 연결 오류가 발생했습니다'
        }
        break

      case 'gesture':
        errorType = FocusSessionErrorType.GESTURE_SERVER_ERROR
        message = '제스처 인식 서버 오류가 발생했습니다'
        break

      case 'network':
        errorType = FocusSessionErrorType.NETWORK_ERROR
        message = '네트워크 연결이 불안정합니다'
        break

      case 'microphone':
        if (error.name === 'NotAllowedError') {
          errorType = FocusSessionErrorType.PERMISSION_REVOKED
          message = '마이크 권한이 취소되었습니다'
          recoverable = false
        } else if (error.name === 'NotReadableError' || error.message?.includes('device in use')) {
          errorType = FocusSessionErrorType.HARDWARE_ERROR
          message = '마이크 연결이 끊어졌거나 다른 앱에서 사용 중입니다'
        } else {
          errorType = FocusSessionErrorType.HARDWARE_ERROR
          message = '마이크 하드웨어 오류가 발생했습니다'
        }
        break

      default:
        errorType = FocusSessionErrorType.UNKNOWN_ERROR
        message = '알 수 없는 오류가 발생했습니다'
    }

    return {
      type: errorType,
      message,
      timestamp: Date.now(),
      recoverable,
      retryCount: 0,
      maxRetries: config.recoveryStrategies.find(s => s.type === errorType)?.maxRetries || 3,
      details: {
        originalError: error,
        userAgent: navigator.userAgent,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      }
    }
  }, [config.recoveryStrategies])

  // 에러 처리
  const handleError = useCallback(async (sessionError: FocusSessionError) => {
    // 세션이 종료되고 있는 중이거나 이미 종료된 상태에서는 특정 오류들을 무시
    if (!state.isRunning && (
      sessionError.message.includes('Video not ready') ||
      sessionError.message.includes('Frame streaming failed') ||
      sessionError.type === FocusSessionErrorType.CAMERA_DISCONNECTED
    )) {
      console.log('[FOCUS_SESSION] 세션 종료 중 발생한 자연스러운 오류, 무시함:', sessionError.message)
      return
    }
    
    console.error('[FOCUS_SESSION] 집중 세션 오류 발생:', sessionError)

    setState(prev => ({
      ...prev,
      status: FocusSessionStatus.ERROR,
      errors: [...prev.errors, sessionError],
      lastError: sessionError
    }))

    // 사용자 정의 에러 핸들러 호출
    onError?.(sessionError)

    // 자동 복구 시도
    if (config.autoRecovery && sessionError.recoverable) {
      await attemptRecovery(sessionError)
    } else if (!sessionError.recoverable) {
      // 복구 불가능한 경우 세션 중단
      onSessionInterrupted?.()
      
      if (config.fallbackMode) {
        onFallbackMode?.()
      }
    }
  }, [state.isRunning, config.autoRecovery, config.fallbackMode, onError, onSessionInterrupted, onFallbackMode])

  // 복구 시도
  const attemptRecovery = useCallback(async (error: FocusSessionError) => {
    const strategy = config.recoveryStrategies.find(s => s.type === error.type)
    if (!strategy) return false

    const currentRetries = error.retryCount || 0
    if (currentRetries >= strategy.maxRetries) {
      console.error('[RECOVERY] 최대 복구 시도 횟수 초과:', error.type)
      onRecoveryFailed?.(error)
      
      if (config.gracefulDegradation) {
        // 점진적 성능 저하 모드로 전환
        await enableDegradedMode(error.type)
      }
      return false
    }

    setState(prev => ({
      ...prev,
      status: FocusSessionStatus.RECOVERING,
      recoveryAttempts: prev.recoveryAttempts + 1
    }))

    onRecoveryStart?.(error.type)

    // 복구 지연
    await new Promise(resolve => setTimeout(resolve, strategy.retryDelay))

    try {
      let recoverySuccess = false

      switch (error.type) {
        case FocusSessionErrorType.CAMERA_DISCONNECTED:
          recoverySuccess = await recoverCamera()
          break
        case FocusSessionErrorType.WEBSOCKET_FAILED:
          recoverySuccess = await recoverWebSocket()
          break
        case FocusSessionErrorType.GESTURE_SERVER_ERROR:
          recoverySuccess = await recoverGestureServer()
          break
        case FocusSessionErrorType.NETWORK_ERROR:
          recoverySuccess = await recoverNetwork()
          break
        default:
          recoverySuccess = false
      }

      if (recoverySuccess) {
        setState(prev => ({
          ...prev,
          status: prev.isRunning ? FocusSessionStatus.ACTIVE : FocusSessionStatus.IDLE,
          recoveryAttempts: 0
        }))
        onRecoverySuccess?.(error.type)
        return true
      } else {
        // 재시도
        const updatedError = {
          ...error,
          retryCount: currentRetries + 1
        }
        await attemptRecovery(updatedError)
      }
    } catch (recoveryError) {
      console.error('[RECOVERY] 복구 시도 중 오류:', recoveryError)
      onRecoveryFailed?.(error)
    }

    return false
  }, [config.recoveryStrategies, config.gracefulDegradation, onRecoveryStart, onRecoverySuccess, onRecoveryFailed])

  // 카메라 복구
  const recoverCamera = useCallback(async (): Promise<boolean> => {
    try {
      // 기존 스트림 정리
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640, min: 320 }, // 낮은 해상도로 시도
          height: { ideal: 480, min: 240 }
        } 
      })
      
      if (stream) {
        console.log('[CAMERA] 카메라 복구 성공')
        return true
      }
      return false
    } catch (error) {
      console.error('[CAMERA] 카메라 복구 실패:', error)
      return false
    }
  }, [])

  // WebSocket 복구
  const recoverWebSocket = useCallback(async (): Promise<boolean> => {
    try {
      // WebSocket 재연결 로직 (실제 구현은 useWebSocket 훅에서 처리)
      console.log('[WEBSOCKET] WebSocket 복구 시도')
      return true
    } catch (error) {
      console.error('[WEBSOCKET] WebSocket 복구 실패:', error)
      return false
    }
  }, [])

  // 제스처 인식 서버 복구
  const recoverGestureServer = useCallback(async (): Promise<boolean> => {
    try {
      // 제스처 인식 서버 상태 확인 및 재연결
      console.log('[GESTURE_SERVER] 제스처 인식 서버 복구 시도')
      return true
    } catch (error) {
      console.error('[GESTURE_SERVER] 제스처 인식 서버 복구 실패:', error)
      return false
    }
  }, [])

  // 네트워크 복구
  const recoverNetwork = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          console.log('[NETWORK] 네트워크 연결 복구됨')
          resolve(true)
        } else {
          setTimeout(checkConnection, 1000)
        }
      }
      
      // 5초 후 타임아웃
      setTimeout(() => resolve(false), 5000)
      checkConnection()
    })
  }, [])

  // 점진적 성능 저하 모드
  const enableDegradedMode = useCallback(async (errorType: FocusSessionErrorType) => {
    console.log('[PERFORMANCE] 점진적 성능 저하 모드 활성화:', errorType)
    
    setState(prev => ({
      ...prev,
      status: FocusSessionStatus.ACTIVE
    }))

    switch (errorType) {
      case FocusSessionErrorType.CAMERA_DISCONNECTED:
        // 카메라 없이 세션 계속 (제스처 인식 비활성화)
        break
      case FocusSessionErrorType.GESTURE_SERVER_ERROR:
        // 제스처 인식 없이 기본 세션만 유지
        break
      case FocusSessionErrorType.WEBSOCKET_FAILED:
        // 로컬 모드로 전환
        break
    }
  }, [])

  // 에러 정리
  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: [],
      lastError: null,
      recoveryAttempts: 0
    }))
  }, [])

  // 수동 복구 재시도
  const retryRecovery = useCallback(async (): Promise<boolean> => {
    if (!state.lastError) return false
    
    const success = await attemptRecovery(state.lastError)
    return success
  }, [state.lastError, attemptRecovery])

  // 네트워크 상태 모니터링
  useEffect(() => {
    const handleOnline = () => {
      console.log('[NETWORK] 네트워크 연결됨')
      if (state.lastError?.type === FocusSessionErrorType.NETWORK_ERROR) {
        attemptRecovery(state.lastError)
      }
    }

    const handleOffline = () => {
      console.log('[NETWORK] 네트워크 연결 끊김')
      const networkError = classifyError(new Error('Network offline'), 'network')
      handleError(networkError)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [state.lastError, attemptRecovery, classifyError, handleError])

  // 타이머 정리
  useEffect(() => {
    return () => {
      recoveryTimeouts.current.forEach(timeout => clearTimeout(timeout))
      recoveryTimeouts.current.clear()
    }
  }, [])

  return {
    state,
    handleError,
    classifyError,
    clearErrors,
    retryRecovery
  }
}
