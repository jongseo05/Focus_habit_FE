import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket } from '@/hooks/useWebSocket'
import { FrameStreamer } from '@/lib/websocket/utils'
import { GestureResponse } from '@/types/websocket'

interface UseGestureRecognitionOptions {
  frameRate?: number // 초당 프레임 수 (기본값: 10)
  videoConstraints?: MediaTrackConstraints
  autoStart?: boolean // 카메라 권한 획득 후 자동 시작
}

interface UseGestureRecognitionReturn {
  // 카메라 상태
  isVideoReady: boolean
  isCameraError: boolean
  cameraError: string | null
  
  // 스트리밍 상태
  isStreaming: boolean
  framesSent: number
  
  // 제스처 인식 결과
  currentGesture: string | null
  lastGestureTime: string | null
  gestureHistory: Array<{ gesture: string; timestamp: string }>
  
  // 제어 함수
  startCamera: () => Promise<void>
  stopCamera: () => void
  startStreaming: () => void
  stopStreaming: () => void
  setFrameRate: (fps: number) => void
  
  // 참조
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function useGestureRecognition(
  options: UseGestureRecognitionOptions = {}
): UseGestureRecognitionReturn {
  const {
    frameRate = 10,
    videoConstraints = { width: 640, height: 480 },
    autoStart = false
  } = options

  // 상태 관리
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [isCameraError, setIsCameraError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [framesSent, setFramesSent] = useState(0)
  const [currentGesture, setCurrentGesture] = useState<string | null>(null)
  const [lastGestureTime, setLastGestureTime] = useState<string | null>(null)
  const [gestureHistory, setGestureHistory] = useState<Array<{ gesture: string; timestamp: string }>>([])

  // 참조
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameStreamerRef = useRef<FrameStreamer | null>(null)

  // WebSocket 연결
  const { sendRawText, isConnected } = useWebSocket({}, {
    onMessage: (rawData) => {
      try {
        // 백엔드에서 JSON 응답을 직접 받음
        // { "gesture": "...", "timestamp": "..." }
        const data = rawData as unknown
        if (typeof data === 'object' && data && 'gesture' in data && 'timestamp' in data) {
          const gestureData = data as { gesture: string; timestamp: string }
          setCurrentGesture(gestureData.gesture)
          setLastGestureTime(gestureData.timestamp)
          
          // 히스토리에 추가 (최근 50개만 유지)
          setGestureHistory(prev => [
            { gesture: gestureData.gesture, timestamp: gestureData.timestamp },
            ...prev.slice(0, 49)
          ])
          
          console.log('제스처 인식 결과:', gestureData)
        }
      } catch (error) {
        console.error('제스처 응답 파싱 오류:', error)
      }
    }
  })

  // 카메라 시작
  const startCamera = useCallback(async () => {
    try {
      setIsCameraError(false)
      setCameraError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true)
          if (autoStart) {
            startStreaming()
          }
        }
      }
    } catch (error) {
      console.error('카메라 접근 실패:', error)
      setIsCameraError(true)
      setCameraError(error instanceof Error ? error.message : '카메라 접근 실패')
    }
  }, [videoConstraints, autoStart])

  // 카메라 중지
  const stopCamera = useCallback(() => {
    stopStreaming()
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setIsVideoReady(false)
  }, [])

  // 프레임 전송 함수
  const sendFrame = useCallback((base64: string) => {
    if (!isConnected) {
      console.warn('WebSocket not connected')
      return
    }

    // 백엔드 요구사항에 맞춰 순수 Base64 문자열만 전송
    sendRawText(base64)
    setFramesSent(prev => prev + 1)
  }, [isConnected, sendRawText])

  // 스트리밍 시작
  const startStreaming = useCallback(() => {
    if (!videoRef.current || !isVideoReady || !isConnected) {
      console.warn('Cannot start streaming: video not ready or WebSocket not connected')
      return
    }

    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
    }

    frameStreamerRef.current = new FrameStreamer(
      videoRef.current,
      sendFrame,
      (error) => {
        console.error('Frame streaming error:', error)
        setIsStreaming(false)
      }
    )

    frameStreamerRef.current.setFrameRate(frameRate)
    frameStreamerRef.current.start()
    setIsStreaming(true)
    setFramesSent(0)
  }, [isVideoReady, isConnected, sendFrame, frameRate])

  // 스트리밍 중지
  const stopStreaming = useCallback(() => {
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  // 프레임 레이트 설정
  const setFrameRateCallback = useCallback((fps: number) => {
    if (frameStreamerRef.current) {
      frameStreamerRef.current.setFrameRate(fps)
    }
  }, [])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    // 카메라 상태
    isVideoReady,
    isCameraError,
    cameraError,
    
    // 스트리밍 상태
    isStreaming,
    framesSent,
    
    // 제스처 인식 결과
    currentGesture,
    lastGestureTime,
    gestureHistory,
    
    // 제어 함수
    startCamera,
    stopCamera,
    startStreaming,
    stopStreaming,
    setFrameRate: setFrameRateCallback,
    
    // 참조
    videoRef
  }
}
