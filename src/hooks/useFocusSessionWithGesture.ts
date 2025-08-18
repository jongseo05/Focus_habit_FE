import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebSocket } from './useWebSocket'
import { useMediaStream } from './useMediaStream'
import { FrameStreamer } from '@/lib/websocket/utils'
import { useDashboardStore } from '@/stores/dashboardStore'
import { useFocusSessionActions } from '@/stores/focusSessionStore'
import type { WebcamFrameAnalysisResult, FocusAnalysisFeatures } from '@/types/websocket'
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
      setIsGestureActive(false)
    },
    onSessionInterrupted: () => {
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
      
      // ML 피쳐 데이터 저장 제거 (피쳐 저장 불필요)

      // 2. focus_sample 테이블에 기본 집중도 점수만 저장
      const { error: sampleError } = await supabase
        .from('focus_sample')
        .insert({
          session_id: currentSessionId,
          ts: new Date().toISOString(),
          score: features.focusScore,
          score_conf: features.focusConfidence,
          topic_tag: 'webcam_analysis'
        })
      
      if (sampleError) {
        console.error('Focus sample save failed:', sampleError)
      }

      // 3. 집중 상태 변화를 focus_event 테이블에 저장 (피쳐 제거)
      const { error: eventError } = await supabase
        .from('focus_event')
        .insert({
          session_id: currentSessionId,
          ts: new Date().toISOString(),
          event_type: 'focus',
          payload: {
            focus_score: features.focusScore,
            focus_confidence: features.focusConfidence,
            analysis_method: 'webcam_analysis'
          }
        })
      
      if (eventError) {
        console.error('Focus event save failed:', eventError)
      }

    } catch (error) {
      console.error('Gesture features save error:', error)
    }
  }, [sessionId])

  // 새로운 웹캠 프레임 분석 결과 상태
  const [webcamAnalysisResult, setWebcamAnalysisResult] = useState<WebcamFrameAnalysisResult | null>(null)
  const [focusFeatures, setFocusFeatures] = useState<FocusAnalysisFeatures | null>(null)
  const [lastFocusScore, setLastFocusScore] = useState<number>(85)

  // lastFocusScore 업데이트 로깅
  useEffect(() => {
    console.log('📊 lastFocusScore 업데이트:', lastFocusScore)
  }, [lastFocusScore])
  
  // 제스처 인식 상태 추가
  const [currentGesture, setCurrentGesture] = useState<string>('neutral')
  const [lastGestureTime, setLastGestureTime] = useState<string>('')
  const [gestureHistory, setGestureHistory] = useState<Array<{ gesture: string; timestamp: string }>>([])
  
  // 집중 세션 스토어에서 집중도 업데이트 함수 가져오기
  const { updateFocusScore } = useFocusSessionActions()

  // 헤드 포즈를 기반으로 제스처 판단하는 함수
  const determineGestureFromHeadPose = (headPose: { pitch: number; yaw: number; roll: number }): string => {
    const { pitch, yaw, roll } = headPose
    
    // 고개 숙임 (pitch가 양수)
    if (pitch > 15) return 'head_down'
    // 고개 들기 (pitch가 음수)
    if (pitch < -15) return 'head_up'
    // 고개 좌우 회전 (yaw 절댓값이 큼)
    if (Math.abs(yaw) > 30) return 'head_turn'
    // 고개 기울기 (roll 절댓값이 큼)
    if (Math.abs(roll) > 20) return 'head_tilt'
    
    return 'neutral'
  }

  // 데이터베이스 저장 디바운싱을 위한 ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedScoreRef = useRef<number | null>(null)

  // 집중도 점수를 데이터베이스에 저장하는 함수 (2초 디바운싱)
  const saveFocusScoreToDatabase = useCallback(async (
    sessionId: string, 
    focusScore: number, 
    confidence: number, 
    timestamp: number
  ) => {
    // 이전 타이머가 있으면 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 마지막 저장된 점수와 같으면 저장하지 않음 (5점 이상 차이나면 저장)
    if (lastSavedScoreRef.current !== null && Math.abs(lastSavedScoreRef.current - focusScore) < 5) {
      console.log('📊 점수 변화 미미, 저장 건너뜀:', { last: lastSavedScoreRef.current, current: focusScore })
      return
    }

    // 1초 후에 저장 (디바운싱 시간 단축)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/focus-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
                      body: JSON.stringify({
              sessionId,
              focusScore,
              timestamp: new Date(timestamp).toISOString(),
              confidence,
              analysisMethod: 'webcam_analysis'
            })
        })

        if (response.ok) {
          lastSavedScoreRef.current = focusScore
        } else {
          console.warn('웹캠 집중도 점수 저장 실패:', response.status)
        }
      } catch (error) {
        console.error('웹캠 집중도 점수 저장 오류:', error)
      }
    }, 2000) // 2초 디바운싱
  }, [])

  // WebSocket 메시지 처리를 위한 직접 핸들러
  const handleWebSocketMessage = useCallback((rawData: any) => {
    console.log('🎯 handleWebSocketMessage 호출됨!', rawData)
    
    try {
      console.log('📨 WebSocket 메시지 수신 시작:', {
        type: typeof rawData,
        isObject: typeof rawData === 'object',
        keys: rawData && typeof rawData === 'object' ? Object.keys(rawData) : 'N/A',
        timestamp: new Date().toISOString(),
        hasPredictionResult: rawData && typeof rawData === 'object' && 'prediction_result' in rawData
      })
      
      // rawData가 문자열인 경우 JSON 파싱 시도
      let parsedData = rawData
      if (typeof rawData === 'string') {
        try {
          parsedData = JSON.parse(rawData)
          console.log('📨 JSON 파싱 성공:', parsedData)
        } catch (parseError) {
          console.log('📨 JSON 파싱 실패, 원본 데이터:', rawData)
          return
        }
      }
      
      console.log('📨 파싱된 데이터:', parsedData)
      console.log('📨 조건 확인:', {
        hasTimestamp: 'timestamp' in parsedData,
        hasPredictionResult: 'prediction_result' in parsedData,
        keys: Object.keys(parsedData)
      })
      
              // 새로운 웹캠 프레임 분석 결과 처리 (prediction_result가 있는 경우)
        if (parsedData && typeof parsedData === 'object' && 'timestamp' in parsedData && 'prediction_result' in parsedData) {
          console.log('🎯 웹캠 분석 결과:', parsedData)
          
          // 분석 결과 저장
          setWebcamAnalysisResult(parsedData as WebcamFrameAnalysisResult)
          
          // 집중도 점수 추출 및 변환 (실제 서버
          const rawFocusScore = parsedData.prediction_result.prediction
          const confidence = parsedData.prediction_result.confidence
          
          // 0~1 범위를 0~100 범위로 변환
          const focusScore = Math.round(rawFocusScore * 100)
          
          console.log('📊 집중도 점수 추출:', {
            rawFocusScore,
            focusScore,
            confidence,
            timestamp: parsedData.timestamp
          })
          
          // 기존 형식으로 변환
          const features: FocusAnalysisFeatures = {
            eyeStatus: {
              isOpen: parsedData.eye_status.status === 'OPEN',
              confidence: confidence,
              earValue: parsedData.eye_status.ear_value
            },
            headPose: {
              pitch: parsedData.head_pose.pitch,
              yaw: parsedData.head_pose.yaw,
              roll: parsedData.head_pose.roll
            },
            focusScore: {
              score: focusScore,
              confidence: confidence
            },
            timestamp: parsedData.timestamp
          }
          
          setFocusFeatures(features)
          console.log('📊 setLastFocusScore 호출 (prediction_result 있음):', focusScore)
          setLastFocusScore(focusScore)
        
        // 집중도 점수 업데이트 (대시보드 스토어)
        console.log('🔄 대시보드 스토어 업데이트 시도:', focusScore)
        updateFocusScore(focusScore)
        
        // 집중도 점수를 데이터베이스에 저장
        if (sessionId && isRunning) {
          console.log('💾 데이터베이스 저장 시도:', { sessionId, focusScore, confidence })
          saveFocusScoreToDatabase(sessionId, focusScore, confidence, parsedData.timestamp)
        }
        
        // 제스처 인식 결과도 처리 (기존 로직 유지)
        if (parsedData.head_pose) {
          const gestureData = {
            gesture: determineGestureFromHeadPose(parsedData.head_pose),
            timestamp: new Date(parsedData.timestamp).toISOString()
          }
          setCurrentGesture(gestureData.gesture)
          setLastGestureTime(gestureData.timestamp)
          setGestureHistory((prev: Array<{ gesture: string; timestamp: string }>) => [
            gestureData,
            ...prev.slice(0, 49)
          ])
        }
        
        return // 정상 처리 완료
      }
              // 새로운 서버 응답 구조 처리 (prediction_result가 없는 경우)
        else if (parsedData && typeof parsedData === 'object' && 'timestamp' in parsedData && 'eye_status' in parsedData && 'head_pose' in parsedData) {
          console.log('🎯 새로운 웹캠 분석 결과 (prediction_result 없음):', parsedData)
          
          // 분석 결과 저장
          setWebcamAnalysisResult(parsedData as WebcamFrameAnalysisResult)
          
          // 집중도 점수 계산 (기본값 또는 계산 로직)
          const confidence = 0.8 // 기본 신뢰도
          const focusScore = 75 // 기본 집중도 점수
          
          console.log('📊 기본 집중도 점수 설정:', {
            focusScore,
            confidence,
            timestamp: parsedData.timestamp
          })
          
          // 기존 형식으로 변환
          const features: FocusAnalysisFeatures = {
            eyeStatus: {
              isOpen: parsedData.eye_status.status === 'OPEN',
              confidence: confidence,
              earValue: parsedData.eye_status.ear_value
            },
            headPose: {
              pitch: parsedData.head_pose.pitch,
              yaw: parsedData.head_pose.yaw,
              roll: parsedData.head_pose.roll
            },
            focusScore: {
              score: focusScore,
              confidence: confidence
            },
            timestamp: parsedData.timestamp
          }
          
          setFocusFeatures(features)
          console.log('📊 setLastFocusScore 호출 (prediction_result 없음):', focusScore)
          setLastFocusScore(focusScore)
        
        // 집중도 점수 업데이트 (대시보드 스토어)
        console.log('🔄 대시보드 스토어 업데이트 시도:', focusScore)
        updateFocusScore(focusScore)
        
        // 집중도 점수를 데이터베이스에 저장
        if (sessionId && isRunning) {
          console.log('💾 데이터베이스 저장 시도:', { sessionId, focusScore, confidence })
          saveFocusScoreToDatabase(sessionId, focusScore, confidence, parsedData.timestamp)
        }
        
        // 제스처 인식 결과도 처리 (기존 로직 유지)
        if (parsedData.head_pose) {
          const gestureData = {
            gesture: determineGestureFromHeadPose(parsedData.head_pose),
            timestamp: new Date(parsedData.timestamp).toISOString()
          }
          setCurrentGesture(gestureData.gesture)
          setLastGestureTime(gestureData.timestamp)
          setGestureHistory((prev: Array<{ gesture: string; timestamp: string }>) => [
            gestureData,
            ...prev.slice(0, 49)
          ])
        }
        
        return // 정상 처리 완료
      }
      // 기존 제스처 인식 응답 처리 (하위 호환성)
      else if (parsedData && typeof parsedData === 'object' && 'gesture' in parsedData && 'timestamp' in parsedData) {
        const gestureData = parsedData as { gesture: string; timestamp: string }
        setCurrentGesture(gestureData.gesture)
        setLastGestureTime(gestureData.timestamp)
        setGestureHistory((prev: Array<{ gesture: string; timestamp: string }>) => [
          gestureData,
          ...prev.slice(0, 49)
        ])
        
        return // 정상 처리 완료
      }
      // 기존 응답 구조 처리 (하위 호환성)
      else if (parsedData && typeof parsedData === 'object') {
        const data = parsedData as any
        
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
        
        console.log('📊 기존 응답 구조 집중도 계산:', {
          focusStatus: focusStatusResult.status,
          focusConfidence: focusStatusResult.confidence,
          focusScore: focusStatusResult.score
        })
        
        // 집중도 점수 업데이트 (대시보드 스토어)
        updateFocusScore(focusStatusResult.score)
        
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
          // 데이터 저장 조건 미충족
        }
        
      }
    } catch (error) {
      // 응답 파싱 오류를 제스처 서버 오류로 분류
      const gestureError = classifyError(error, 'gesture')
      handleError(gestureError)
    }
  }, [sessionId, isRunning, updateFocusScore, saveFocusScoreToDatabase, handleError, classifyError])

  // 제스처 인식을 위한 WebSocket - 웹캠 분석용 URL 사용 (사용자 ID 포함)
  const { sendRawText, isConnected, connect, disconnect } = useWebSocket({
    url: 'wss://focushabit.site/ws/analysis'
  }, {
    onMessage: handleWebSocketMessage,
    onOpen: () => {
      console.log('🔗 WebSocket 연결 성공')
    },
    onClose: () => {
      console.log('🔌 WebSocket 연결 종료')
    },
    onError: (error) => {
      console.error('❌ WebSocket 오류:', error)
      // WebSocket 오류를 에러 핸들러에 전달
      const wsError = classifyError(error, 'websocket')
      handleError(wsError)
    }
  })
  
  // 연결 상태를 ref로 저장하여 클로저 문제 해결
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected

  // WebSocket 연결 상태 로깅
  useEffect(() => {
    console.log('🔗 WebSocket 연결 상태:', { 
      isConnected,
      sessionId,
      isRunning,
      enableGestureRecognition
    })
  }, [isConnected, sessionId, isRunning, enableGestureRecognition])
  
  // 제스처 인식 시작
  const startGestureRecognition = useCallback(() => {
    console.log('🎯 제스처 인식 시작 시도:', {
      hasStream: !!mediaStream.stream,
      enableGestureRecognition,
      isConnected,
      isGestureActive
    })
    
    if (!mediaStream.stream || !enableGestureRecognition) {
      console.log('❌ 제스처 인식 시작 조건 미충족')
      return
    }
    
    // 이미 실행 중이면 리턴
    if (isGestureActive) {
      console.log('❌ 제스처 인식이 이미 활성화됨')
      return
    }
    
    // 기존 프레임 스트리머 정리
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
    
    // 기존 비디오 엘리먼트 정리
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null
      hiddenVideoRef.current.remove()
      hiddenVideoRef.current = null
    }
    
    // 숨겨진 비디오 엘리먼트 생성
    hiddenVideoRef.current = document.createElement('video')
    hiddenVideoRef.current.style.display = 'none'
    hiddenVideoRef.current.style.position = 'fixed'
    hiddenVideoRef.current.style.top = '-9999px'
    hiddenVideoRef.current.style.left = '-9999px'
    hiddenVideoRef.current.autoplay = true
    hiddenVideoRef.current.playsInline = true
    hiddenVideoRef.current.muted = true
    document.body.appendChild(hiddenVideoRef.current)
    
    // 스트림 연결
    hiddenVideoRef.current.srcObject = mediaStream.stream
    
    // 비디오 로드 완료 후 프레임 스트리머 시작
    const handleVideoReady = () => {
      console.log('비디오 로드 완료, 프레임 스트리머 시작')
      
      if (!hiddenVideoRef.current) return
      
      // 비디오 재생 시도
      hiddenVideoRef.current.play().catch(error => {
        console.warn('비디오 자동 재생 실패:', error)
      })
      
                    // 프레임 스트리머 생성 및 시작
        frameStreamerRef.current = new FrameStreamer(
          hiddenVideoRef.current,
          (base64) => {
            // 최신 연결 상태 확인
            const currentConnectionStatus = isConnectedRef.current
            
            console.log('📤 프레임 전송 시도:', { 
              isConnected: currentConnectionStatus, 
              base64Length: base64.length,
              frameCount: gestureFramesSent + 1
            })
            
            // WebSocket이 연결된 경우에만 전송
            if (currentConnectionStatus) {
              sendRawText(base64)
              setGestureFramesSent((prev) => prev + 1)
            } else {
              console.warn('⚠️ WebSocket 연결되지 않음, 프레임 전송 건너뜀')
            }
          },
        (error) => {
          console.error('프레임 스트리머 오류:', error)
          setIsGestureActive(false)
          
          // 세션 종료 과정에서 발생하는 자연스러운 오류는 무시
          if (!isRunning || error.message.includes('Video not ready')) {
            console.log('세션 종료 중 발생한 자연스러운 오류, 무시함:', error.message)
            return
          }
          
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
      console.log('제스처 인식 시작 완료')
    }
    
    // 이벤트 리스너 설정
    hiddenVideoRef.current.onloadedmetadata = handleVideoReady
    hiddenVideoRef.current.oncanplay = handleVideoReady
    
    hiddenVideoRef.current.onerror = (error) => {
      console.error('비디오 엘리먼트 오류:', error)
      setIsGestureActive(false)
      
      // 비디오 엘리먼트 오류를 카메라 오류로 분류
      const cameraError = classifyError(error, 'camera')
      handleError(cameraError)
    }
     }, [
     mediaStream.stream, 
     enableGestureRecognition, 
     frameRate, 
     gestureJpegQuality,
     sendRawText,
     isGestureActive
   ])
  
  // 제스처 인식 중지
  const stopGestureRecognition = useCallback(() => {
    console.log('제스처 인식 중지')
    
    // 1. 먼저 상태를 inactive로 설정하여 추가 프레임 전송 방지
    setIsGestureActive(false)
    
    // 2. FrameStreamer 중지 (에러 콜백 제거하여 cleanup 과정에서 오류 방지)
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
    
    // 3. 비디오 엘리먼트 정리 (약간의 지연 후)
    if (hiddenVideoRef.current) {
      // 이벤트 리스너 제거
      hiddenVideoRef.current.onloadedmetadata = null
      hiddenVideoRef.current.oncanplay = null
      hiddenVideoRef.current.onerror = null
      
      // 비디오 일시정지 후 스트림 해제
      hiddenVideoRef.current.pause()
      hiddenVideoRef.current.srcObject = null
      
      // DOM에서 제거
      if (hiddenVideoRef.current.parentNode) {
        hiddenVideoRef.current.parentNode.removeChild(hiddenVideoRef.current)
      }
      hiddenVideoRef.current = null
    }
    
    setGestureFramesSent(0)
  }, [])
  
  // 세션 상태에 따른 자동 제어
  useEffect(() => {
    console.log('🔄 세션 상태 변화:', {
      isRunning,
      hasStream: !!mediaStream.stream,
      isPermissionGranted: mediaStream.isPermissionGranted,
      sessionId
    })
    
    if (isRunning && mediaStream.stream && mediaStream.isPermissionGranted) {
      console.log('🔗 WebSocket 연결 시작')
      // WebSocket 연결 시작
      connect()
    } else {
      console.log('🛑 제스처 인식 중지')
      stopGestureRecognition()
      // 세션이 끝났으면 WebSocket 연결 해제
      if (!isRunning) {
        console.log('🔌 세션 종료로 인한 WebSocket 연결 해제')
        disconnect()
      }
    }
  }, [
    isRunning, 
    mediaStream.stream, 
    mediaStream.isPermissionGranted,
    sessionId
  ])

  // WebSocket 연결 완료 시 제스처 인식 시작 (안정화된 연결만 처리)
  const [stableConnection, setStableConnection] = useState(false)
  const connectionStableTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    console.log('🔗 WebSocket 연결 상태 변화:', {
      isRunning,
      hasStream: !!mediaStream.stream,
      isPermissionGranted: mediaStream.isPermissionGranted,
      enableGestureRecognition,
      isConnected,
      isGestureActive,
      stableConnection
    })
    
    // 이전 타이머 정리
    if (connectionStableTimerRef.current) {
      clearTimeout(connectionStableTimerRef.current)
      connectionStableTimerRef.current = null
    }
    
    if (isConnected) {
      // 연결이 되면 3초 후에 안정화된 것으로 간주
      connectionStableTimerRef.current = setTimeout(() => {
        setStableConnection(true)
        console.log('✅ WebSocket 연결 안정화 완료')
      }, 3000)
    } else {
      setStableConnection(false)
      // 연결이 끊어지면 제스처 인식도 중지
      if (isGestureActive) {
        console.log('🔌 WebSocket 연결 끊어짐, 제스처 인식 중지')
        stopGestureRecognition()
      }
    }
    
    return () => {
      if (connectionStableTimerRef.current) {
        clearTimeout(connectionStableTimerRef.current)
        connectionStableTimerRef.current = null
      }
    }
  }, [isConnected])
  
  // 안정화된 연결에서 제스처 인식 시작
  useEffect(() => {
    if (
      isRunning &&
      mediaStream.stream &&
      mediaStream.isPermissionGranted &&
      enableGestureRecognition &&
      stableConnection &&
      !isGestureActive
    ) {
      console.log('🎯 안정화된 WebSocket 연결에서 제스처 인식 시작')
      const timer = setTimeout(() => {
        startGestureRecognition()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [
    isRunning,
    mediaStream.stream,
    mediaStream.isPermissionGranted,
    enableGestureRecognition,
    stableConnection,
    isGestureActive
  ])
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      console.log('컴포넌트 언마운트, 정리 작업 수행')
      stopGestureRecognition()
      disconnect()
      // 저장 타이머 정리
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      // 연결 안정화 타이머 정리
      if (connectionStableTimerRef.current) {
        clearTimeout(connectionStableTimerRef.current)
      }
    }
  }, [stopGestureRecognition, disconnect]) // 의존성 배열 추가
  
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
    retrySessionRecovery: retryRecovery,
    
    // 새로운 웹캠 분석 결과
    webcamAnalysisResult,
    focusFeatures,
    lastFocusScore,
  }
}

