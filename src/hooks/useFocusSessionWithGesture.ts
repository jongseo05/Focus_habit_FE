import { useCallback, useRef, useEffect, useState } from 'react'
import useMediaStream from '@/hooks/useMediaStream'
import { useWebSocket } from '@/hooks/useWebSocket'
import { FrameStreamer } from '@/lib/websocket/utils'
import { useFocusSessionErrorHandler } from '@/hooks/useFocusSessionErrorHandler'
import { FocusSessionErrorType, FocusSessionStatus } from '@/types/focusSession'

interface FocusSessionWithGestureOptions {
  frameRate?: number
  enableGestureRecognition?: boolean
  gestureJpegQuality?: number
}

interface FocusSessionWithGestureReturn {
  // MediaStream 기능 전체를 포함
  stream: MediaStream | null
  isLoading: boolean
  error: string | null
  isPermissionGranted: boolean
  isPermissionDenied: boolean
  requestPermission: () => Promise<boolean>
  startStream: () => Promise<boolean>
  stopStream: () => void
  resetError: () => void
  retryPermission: () => Promise<boolean>
  
  // 제스처 인식 추가 기능
  isGestureRecognitionActive: boolean
  gestureWebSocketConnected: boolean
  gestureFramesSent: number
  
  // 집중 세션 에러 처리
  sessionStatus: FocusSessionStatus
  sessionErrors: any[]
  lastSessionError: any | null
  canRecoverFromError: boolean
  retrySessionRecovery: () => Promise<boolean>
}

export function useFocusSessionWithGesture(
  isSessionRunning: boolean,
  options: FocusSessionWithGestureOptions = {}
): FocusSessionWithGestureReturn {
  const { 
    frameRate = 10, // 1초에 10번 (10fps)
    enableGestureRecognition = true,
    gestureJpegQuality = 0.9
  } = options
  
  // 기존 미디어 스트림 훅 사용
  const mediaStream = useMediaStream()
  
  // 제스처 인식 상태
  const [gestureFramesSent, setGestureFramesSent] = useState(0)
  const [isGestureActive, setIsGestureActive] = useState(false)

  // 집중 세션 통합 에러 핸들러
  const { 
    state: errorHandlerState, 
    handleError, 
    classifyError, 
    retryRecovery,
    clearErrors 
  } = useFocusSessionErrorHandler({
    config: {
      autoRecovery: true,
      maxRecoveryAttempts: 3,
      gracefulDegradation: true,
      fallbackMode: true
    },
    onError: (error) => {
      console.error('[FOCUS_SESSION] 집중 세션 오류:', error)
      
      // 특정 에러 타입에 따른 처리
      switch (error.type) {
        case FocusSessionErrorType.CAMERA_DISCONNECTED:
          setIsGestureActive(false)
          break
        case FocusSessionErrorType.WEBSOCKET_FAILED:
        case FocusSessionErrorType.GESTURE_SERVER_ERROR:
          setIsGestureActive(false)
          break
      }
    },
    onRecoveryStart: (errorType) => {
    },
    onRecoverySuccess: (errorType) => {
      // 복구 성공 시 제스처 인식 재시작
      if (isSessionRunning && mediaStream.stream && mediaStream.isPermissionGranted) {
        setTimeout(() => {
          startGestureRecognition()
        }, 1000)
      }
    },
    onRecoveryFailed: (error) => {
      console.error('[FOCUS_SESSION] 집중 세션 복구 실패:', error)
      setIsGestureActive(false)
    },
    onSessionInterrupted: () => {
      console.warn('[FOCUS_SESSION] 집중 세션이 중단되었습니다')
      setIsGestureActive(false)
    },
    onFallbackMode: () => {
      // 카메라 없이 기본 집중 세션 유지
    }
  })
  
  // 제스처 인식을 위한 WebSocket
  const { sendRawText, isConnected } = useWebSocket({}, {
    onMessage: (rawData) => {
      try {
        // 실제 응답 구조에 맞게 파싱
        const data = rawData as any
        
        if (data && typeof data === 'object') {
          // 현재 받고 있는 응답 구조 분석
          const analysis = {
            timestamp: data.timestamp || 'N/A',
            eyeStatus: data.eye_status?.status || 'N/A',
            eyeValue: data.eye_status?.ear_value || 'N/A',
            handAction: data.hand_action?.action || 'N/A',
            handConfidence: data.hand_action?.confidence || 'N/A',
            headPose: {
              pitch: data.head_pose?.pitch || 'N/A',
              roll: data.head_pose?.roll || 'N/A',
              yaw: data.head_pose?.yaw || 'N/A'
            }
          }
        }        } catch (error) {
          console.error('[GESTURE] 제스처 응답 파싱 오류:', error, '| 원시 데이터:', rawData)
          
          // 응답 파싱 오류를 제스처 서버 오류로 분류
          const gestureError = classifyError(error, 'gesture')
          handleError(gestureError)
        }
    },
    onOpen: () => {
    },
    onClose: () => {
    },
    onError: (error) => {
      console.error('[GESTURE] 제스처 인식 WebSocket 오류:', error)
      
      // WebSocket 오류를 에러 핸들러에 전달
      const wsError = classifyError(error, 'websocket')
      handleError(wsError)
    }
  })
  
  // 프레임 스트리머와 숨겨진 비디오 엘리먼트 참조
  const frameStreamerRef = useRef<FrameStreamer | null>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  
  // 제스처 인식 시작
  const startGestureRecognition = useCallback(() => {
    if (!mediaStream.stream || !isConnected || !enableGestureRecognition) {
      return
    }
    
    // 이미 실행 중이면 리턴
    if (frameStreamerRef.current && frameStreamerRef.current.getIsStreaming()) {
      return
    }
    
    // 이미 실행 중이면 중지
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
    
    // 숨겨진 비디오 엘리먼트 생성 또는 재사용
    if (!hiddenVideoRef.current) {
      hiddenVideoRef.current = document.createElement('video')
      hiddenVideoRef.current.style.display = 'none'
      hiddenVideoRef.current.style.position = 'fixed'
      hiddenVideoRef.current.style.top = '-9999px'
      hiddenVideoRef.current.style.left = '-9999px'
      hiddenVideoRef.current.autoplay = true
      hiddenVideoRef.current.playsInline = true
      hiddenVideoRef.current.muted = true
      // 웹캠 원본 해상도 사용 (고정 크기 제거)
      document.body.appendChild(hiddenVideoRef.current)
    }
    
    // 스트림 연결
    hiddenVideoRef.current.srcObject = mediaStream.stream
    
    hiddenVideoRef.current.onloadedmetadata = () => {
      // 비디오 재생 시도
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.play().catch(error => {
          console.warn('[VIDEO] 비디오 자동 재생 실패:', error)
        })
      }
      
      if (!frameStreamerRef.current && hiddenVideoRef.current) {
        frameStreamerRef.current = new FrameStreamer(
          hiddenVideoRef.current,
          (base64) => {
            sendRawText(base64)
            setGestureFramesSent(prev => prev + 1)
          },
          (error) => {
            console.error('[GESTURE] 프레임 스트리밍 오류:', error)
            setIsGestureActive(false)
            
            // 제스처 서버 오류로 분류하여 에러 핸들러에 전달
            const gestureError = classifyError(error, 'gesture')
            handleError(gestureError)
          },
          gestureJpegQuality
        )
        
        frameStreamerRef.current.setFrameRate(frameRate)
        frameStreamerRef.current.start()
        setIsGestureActive(true)
        setGestureFramesSent(0)
      }
    }
    
    hiddenVideoRef.current.onerror = (error) => {
      console.error('[VIDEO] 숨겨진 비디오 엘리먼트 오류:', error)
      setIsGestureActive(false)
      
      // 비디오 엘리먼트 오류를 카메라 오류로 분류
      const cameraError = classifyError(error, 'camera')
      handleError(cameraError)
    }
  }, [
    mediaStream.stream, 
    isConnected, 
    enableGestureRecognition, 
    frameRate, 
    gestureJpegQuality,
    sendRawText
  ])
  
  // 제스처 인식 중지
  const stopGestureRecognition = useCallback(() => {
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
    
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null
      hiddenVideoRef.current.remove()
      hiddenVideoRef.current = null
    }
    
    if (isGestureActive) {
      setIsGestureActive(false)
      setGestureFramesSent(0)
    }
  }, [isGestureActive])
  
  // 세션 상태에 따른 자동 제어
  useEffect(() => {
    if (isSessionRunning && mediaStream.stream && mediaStream.isPermissionGranted) {
      // 약간의 지연을 두어 스트림이 안정화되도록 함
      const timer = setTimeout(() => {
        startGestureRecognition()
      }, 1000)
      
      return () => clearTimeout(timer)
    } else {
      stopGestureRecognition()
    }
  }, [
    isSessionRunning, 
    mediaStream.stream, 
    mediaStream.isPermissionGranted
    // startGestureRecognition, stopGestureRecognition 제거하여 무한 루프 방지
  ])
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopGestureRecognition()
    }
  }, []) // 의존성 배열을 비워서 언마운트 시에만 실행
  
  // MediaStream의 모든 기능을 그대로 노출하면서 제스처 관련 기능 추가
  return {
    stream: mediaStream.stream,
    isLoading: mediaStream.isLoading,
    error: mediaStream.error,
    isPermissionGranted: mediaStream.isPermissionGranted,
    isPermissionDenied: mediaStream.isPermissionDenied,
    requestPermission: mediaStream.requestPermission,
    startStream: mediaStream.startStream,
    stopStream: mediaStream.stopStream,
    resetError: mediaStream.resetError,
    retryPermission: mediaStream.retryPermission,
    
    // 제스처 인식 추가 기능
    isGestureRecognitionActive: isGestureActive,
    gestureWebSocketConnected: isConnected,
    gestureFramesSent,
    
    // 집중 세션 에러 처리
    sessionStatus: errorHandlerState.status,
    sessionErrors: errorHandlerState.errors,
    lastSessionError: errorHandlerState.lastError,
    canRecoverFromError: errorHandlerState.lastError?.recoverable || false,
    retrySessionRecovery: retryRecovery
  }
}
