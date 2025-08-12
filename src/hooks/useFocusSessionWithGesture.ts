import { useCallback, useRef, useEffect, useState } from 'react'
import useMediaStream from '@/hooks/useMediaStream'
import { useWebSocket } from '@/hooks/useWebSocket'
import { FrameStreamer } from '@/lib/websocket/utils'
import { useFocusSessionErrorHandler } from '@/hooks/useFocusSessionErrorHandler'
import { FocusSessionErrorType, FocusSessionStatus } from '@/types/focusSession'
import { determineFocusStatus, type FocusStatus } from '@/lib/focusScoreEngine'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { GestureFeatures } from '@/types/focusSession'

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
  isRunning: boolean,
  sessionId: string | null | undefined,
  options: FocusSessionWithGestureOptions = {}
) {
  
  const {
    frameRate = 10,
    enableGestureRecognition = true,
    gestureJpegQuality = 0.8
  } = options
  
  // 기존 미디어 스트림 훅 사용
  const mediaStream = useMediaStream()
  
  // 제스처 인식 상태
  const [gestureFramesSent, setGestureFramesSent] = useState(0)
  const [isGestureActive, setIsGestureActive] = useState(false)

  // 1. 상태 추가
  const [isSpeechRecognitionActive, setIsSpeechRecognitionActive] = useState(false)

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
      if (isRunning && mediaStream.stream && mediaStream.isPermissionGranted) {
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
  
    // 프레임 스트리머와 숨겨진 비디오 엘리먼트 참조
  const frameStreamerRef = useRef<FrameStreamer | null>(null)
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
  
  // 제스처 피쳐를 데이터베이스에 저장하는 함수
  const saveGestureFeatures = useCallback(async (features: GestureFeatures) => {
    let currentSessionId = sessionId
    
    // If sessionId is not provided, try to fetch active session directly
    if (!currentSessionId) {
      try {
        const supabase = supabaseBrowser()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (!authError && user) {
          const { data: activeSession, error: sessionError } = await supabase
            .from('focus_session')
            .select('session_id')
            .eq('user_id', user.id)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1)
            .single()
          
          if (!sessionError && activeSession) {
            currentSessionId = activeSession.session_id
          }
        }
      } catch (error) {
        console.error('Failed to fetch active session:', error)
      }
    }
    
    if (!currentSessionId) {
      console.error('No session ID available')
      return
    }
    
    try {
      const supabase = supabaseBrowser()
      
      // 1. ML 피쳐 데이터 저장 (집중 상태 포함)
      const { error: mlError } = await supabase
        .from('ml_features')
        .insert({
          session_id: currentSessionId,
          ts: new Date().toISOString(),
          head_pose_pitch: features.headPose?.pitch,
          head_pose_yaw: features.headPose?.yaw,
          head_pose_roll: features.headPose?.roll,
          eye_status: features.eyeStatus?.substring(0, 10), // 10자로 제한
          ear_value: features.earValue,
          frame_number: features.frameNumber,
          focus_status: features.focusStatus,
          focus_confidence: features.focusConfidence,
          focus_score: features.focusScore
        })
      
      if (mlError) {
        console.error('ML features save failed:', mlError)
        console.error('Eye status value:', features.eyeStatus)
      }

      // 2. 기존 focus_sample 테이블에도 저장 (호환성을 위해)
      const { error: sampleError } = await supabase
        .from('focus_sample')
        .insert({
          session_id: currentSessionId,
          ts: new Date().toISOString(),
          score: features.focusScore,
          ear_value: features.earValue,
          eye_status: features.eyeStatus?.substring(0, 10), // 10자로 제한
          head_pose_pitch: features.headPose?.pitch,
          head_pose_yaw: features.headPose?.yaw,
          head_pose_roll: features.headPose?.roll
        })
      
      if (sampleError) {
        console.error('Focus sample save failed:', sampleError)
      }

      // 3. 집중 상태 변화를 focus_event 테이블에 저장
      const { error: eventError } = await supabase
        .from('focus_event')
        .insert({
          session_id: currentSessionId,
          ts: new Date().toISOString(),
          event_type: 'focus',
          payload: {
            focus_status: features.focusStatus,
            focus_score: features.focusScore,
            focus_confidence: features.focusConfidence,
            eye_status: features.eyeStatus,
            head_pose: features.headPose
          }
        })
      
      if (eventError) {
        console.error('Focus event save failed:', eventError)
      }

    } catch (error) {
      console.error('Gesture features save error:', error)
    }
  }, [sessionId])

  // 제스처 인식을 위한 WebSocket
  const { sendRawText, isConnected } = useWebSocket({}, {
    onMessage: useCallback((rawData: any) => {
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
          
          // 집중 상태 계산을 위한 피쳐 데이터 구성
          const focusFeatures = {
            visual: {
              eyeStatus: data.eye_status?.status || 'OPEN',
              earValue: data.eye_status?.ear_value || 0.3,
              headPose: {
                pitch: data.head_pose?.pitch || 0,
                yaw: data.head_pose?.yaw || 0,
                roll: data.head_pose?.roll || 0
              },
              gazeDirection: 'FORWARD' as const
            },
            // 기본값들 (실제로는 다른 센서에서 받아와야 함)
            audio: {
              isSpeaking: false,
              speechContent: '',
              isStudyRelated: true,
              confidence: 0.8,
              audioLevel: 20
            },
            behavior: {
              mouseActivity: true,
              keyboardActivity: true,
              tabSwitches: 0,
              idleTime: 0
            },
            time: {
              sessionDuration: 0,
              lastBreakTime: 0,
              consecutiveFocusTime: 0
            }
          }
          
          // 집중 상태 계산
          const focusStatusResult = determineFocusStatus(focusFeatures)
          
          // 제스처 인식 결과를 DB에 저장 (집중 상태 포함)
          if (data.timestamp) {
            const features = {
              frameNumber: gestureFramesSent,
              eyeStatus: data.eye_status?.status?.substring(0, 10), // 10자로 제한
              earValue: data.eye_status?.ear_value,
              headPose: {
                pitch: data.head_pose?.pitch,
                roll: data.head_pose?.roll,
                yaw: data.head_pose?.yaw
              },
              focusStatus: focusStatusResult.status,
              focusConfidence: focusStatusResult.confidence,
              focusScore: focusStatusResult.score
            }
            
            saveGestureFeatures(features)
          } else {
            console.warn('⚠️ 데이터 저장 조건 미충족:', {
              sessionId: !!sessionId,
              timestamp: !!data.timestamp,
              sessionIdValue: sessionId,
              timestampValue: data.timestamp
            })
          }
          
        }
      } catch (error) {
        // 응답 파싱 오류를 제스처 서버 오류로 분류
        const gestureError = classifyError(error, 'gesture')
        handleError(gestureError)
      }
    }, [sessionId, gestureFramesSent, saveGestureFeatures]),
    onOpen: () => {
    },
    onClose: () => {
    },
    onError: (error) => {
      // WebSocket 오류를 에러 핸들러에 전달
      const wsError = classifyError(error, 'websocket')
      handleError(wsError)
    }
  })
  
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
        // 프레임 스트리머 생성 및 시작
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
    sendRawText,
    setGestureFramesSent
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
    
    if (isRunning && mediaStream.stream && mediaStream.isPermissionGranted) {
      // 약간의 지연을 두어 스트림이 안정화되도록 함
      const timer = setTimeout(() => {
        startGestureRecognition()
      }, 1000)
      
      return () => clearTimeout(timer)
    } else {
      stopGestureRecognition()
    }
  }, [
    isRunning, 
    mediaStream.stream, 
    mediaStream.isPermissionGranted,
    isConnected,
    enableGestureRecognition
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

