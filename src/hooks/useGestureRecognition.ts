import { useState, useEffect, useCallback, useRef } from 'react'
import { useWebSocket } from './useWebSocket'
import { FrameStreamer } from '@/lib/websocket/utils'

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
  
  // 프레임 분석 결과
  frameAnalysisResults: Array<any>
  lastFrameAnalysis: any | null
  
  // 제어 함수
  startCamera: () => Promise<void>
  stopCamera: () => void
  startStreaming: () => void
  stopStreaming: () => void
  setFrameRate: (fps: number) => void
  exportToCSV: () => void
  exportToJSON: () => void
  
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
  
  // 프레임 분석 결과 저장
  const [frameAnalysisResults, setFrameAnalysisResults] = useState<Array<any>>([])
  const [lastFrameAnalysis, setLastFrameAnalysis] = useState<any | null>(null)

  // 참조
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameStreamerRef = useRef<FrameStreamer | null>(null)

  // WebSocket 연결 - 웹캠 분석용 URL 사용 (사용자 ID 포함)
  const { sendFrame, isConnected } = useWebSocket({
    url: 'wss://focushabit.site/ws/analysis'
  }, {
    onMessage: (message: any) => {
      try {
        console.log('📨 제스처 인식 WebSocket 메시지 수신:', message)
        
        // 프레임 분석 결과 처리
        if (message.type === 'frame_analysis_result') {
          const analysisData = message.data
          
          // 분석 결과 저장
          setLastFrameAnalysis(analysisData)
          setFrameAnalysisResults(prev => [...prev, analysisData])
          
          // 제스처 인식 결과도 처리 (기존 로직)
          if (analysisData.features && analysisData.features.gesture) {
            const gestureData = {
              gesture: analysisData.features.gesture,
              timestamp: new Date().toISOString()
            }
            setCurrentGesture(gestureData.gesture)
            setLastGestureTime(gestureData.timestamp)
            setGestureHistory(prev => [
              gestureData,
              ...prev.slice(0, 49)
            ])
          }
        }
        // 기존 제스처 인식 응답 처리 (하위 호환성)
        else if (typeof message === 'object' && message && 'gesture' in message && 'timestamp' in message) {
          const gestureData = message as { gesture: string; timestamp: string }
          setCurrentGesture(gestureData.gesture)
          setLastGestureTime(gestureData.timestamp)
          setGestureHistory(prev => [
            gestureData,
            ...prev.slice(0, 49)
          ])
        }
      } catch (error) {
        console.error('제스처 인식 메시지 처리 오류:', error)
      }
    }
  })

  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    if (frameAnalysisResults.length === 0) {
      alert('내보낼 분석 결과가 없습니다.')
      return
    }

    try {
      // CSV 헤더 생성
      const headers = ['timestamp', 'frameId', 'headPose_pitch', 'headPose_yaw', 'headPose_roll', 'leftEye', 'rightEye', 'eyeConfidence', 'isFocused', 'attentionConfidence', 'distractionLevel']
      
      // CSV 데이터 생성
      const csvData = frameAnalysisResults.map(result => {
        const features = result.features
        return [
          new Date(features.timestamp).toISOString(),
          result.frameId || '',
          features.headPose?.pitch || '',
          features.headPose?.yaw || '',
          features.headPose?.roll || '',
          features.eyeStatus?.leftEye || '',
          features.eyeStatus?.rightEye || '',
          features.eyeStatus?.confidence || '',
          features.attention?.isFocused || '',
          features.attention?.confidence || '',
          features.attention?.distractionLevel || ''
        ].join(',')
      })

      const csvContent = [headers.join(','), ...csvData].join('\n')
      
      // 파일 다운로드
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `frame_analysis_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('[EXPORT] CSV 파일 내보내기 완료')
    } catch (error) {
      console.error('[EXPORT] CSV 내보내기 실패:', error)
      alert('CSV 내보내기에 실패했습니다.')
    }
  }, [frameAnalysisResults])

  // JSON 내보내기
  const exportToJSON = useCallback(() => {
    if (frameAnalysisResults.length === 0) {
      alert('내보낼 분석 결과가 없습니다.')
      return
    }

    try {
      const jsonContent = JSON.stringify(frameAnalysisResults, null, 2)
      
      // 파일 다운로드
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `frame_analysis_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      console.log('[EXPORT] JSON 파일 내보내기 완료')
    } catch (error) {
      console.error('[EXPORT] JSON 내보내기 실패:', error)
      alert('JSON 내보내기에 실패했습니다.')
    }
  }, [frameAnalysisResults])

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
      console.error('[CAMERA] 카메라 접근 실패:', error)
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
  const sendFrameToServer = useCallback((base64: string) => {
    if (!isConnected) {
      console.warn('[WEBSOCKET] WebSocket not connected')
      return
    }

    // 백엔드 요구사항에 맞춰 순수 Base64 문자열만 전송
    sendFrame(base64)
    setFramesSent(prev => prev + 1)
  }, [isConnected, sendFrame])

  // 스트리밍 시작
  const startStreaming = useCallback(() => {
    if (!videoRef.current || !isVideoReady || !isConnected) {
      console.warn('[STREAMING] Cannot start streaming: video not ready or WebSocket not connected')
      return
    }

    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
    }

    frameStreamerRef.current = new FrameStreamer(
      videoRef.current,
      sendFrameToServer,
      (error) => {
        // 스트리밍이 이미 중단된 상태에서 발생하는 오류는 무시
        if (!isStreaming || error.message.includes('Video not ready')) {
          console.log('[FRAME_STREAMING] 스트리밍 종료 중 발생한 자연스러운 오류, 무시함:', error.message)
          return
        }
        console.error('[FRAME_STREAMING] Frame streaming error:', error)
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
    // 먼저 상태를 false로 설정하여 추가 프레임 전송 방지
    setIsStreaming(false)
    
    if (frameStreamerRef.current) {
      frameStreamerRef.current.stop()
      frameStreamerRef.current = null
    }
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
    
    // 프레임 분석 결과
    frameAnalysisResults,
    lastFrameAnalysis,
    
    // 제어 함수
    startCamera,
    stopCamera,
    startStreaming,
    stopStreaming,
    setFrameRate: setFrameRateCallback,
    exportToCSV,
    exportToJSON,
    
    // 참조
    videoRef
  }
}
