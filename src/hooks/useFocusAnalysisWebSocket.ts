import { useState, useEffect, useRef, useCallback } from 'react'
import { useWebSocket } from './useWebSocket'

// WebSocket 응답 타입 정의
interface FocusAnalysisResponse {
  timestamp: number
  eye_status: {
    status: 'OPEN' | 'CLOSED' | 'PARTIAL'
    ear_value: number
  }
  head_pose: {
    pitch: number
    yaw: number
    roll: number
  }
  prediction_result: {
    timestamp: number
    prediction: number // 집중도 점수 (0-100)
    confidence: number // 신뢰도 (0-1)
  }
}

interface UseFocusAnalysisWebSocketOptions {
  userId: string
  enabled?: boolean
  onFocusScoreUpdate?: (score: number, confidence: number) => void
  onError?: (error: string) => void
}

interface UseFocusAnalysisWebSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  lastFocusScore: number | null
  lastConfidence: number | null
  lastUpdateTime: number | null
  error: string | null
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  sendFrame: (frameData: string) => void
}

export const useFocusAnalysisWebSocket = ({
  userId,
  enabled = true,
  onFocusScoreUpdate,
  onError
}: UseFocusAnalysisWebSocketOptions): UseFocusAnalysisWebSocketReturn => {
  const [lastFocusScore, setLastFocusScore] = useState<number | null>(null)
  const [lastConfidence, setLastConfidence] = useState<number | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // WebSocket 연결
  const {
    isConnected,
    status,
    connect: wsConnect,
    disconnect: wsDisconnect,
    reconnect: wsReconnect,
    sendFrame: wsSendFrame
  } = useWebSocket({
    url: `wss://focushabit.site/ws/analysis?user_id=${userId}`,
    reconnectInterval: 5000,
    maxReconnectAttempts: 2
  }, {
    onMessage: (message: any) => {
      try {
        // 서버에서 보내는 집중도 분석 응답 형식에 맞게 처리
        let data = message
        
        // 이미 파싱된 객체인 경우 (WebSocketClient에서 파싱됨)
        if (typeof message === 'object' && message !== null) {
          data = message
        }
        // 문자열인 경우 JSON 파싱 (백업)
        else if (typeof message === 'string') {
          try {
            data = JSON.parse(message)
          } catch (parseError) {
            console.error('📨 JSON 파싱 실패:', parseError)
            return
          }
        }
        
        // 데이터 구조 검증
        if (!data || typeof data !== 'object') {
          console.warn('❌ 유효하지 않은 WebSocket 메시지 형식:', data)
          return
        }
        
        // 서버 응답 형식 확인: prediction_result와 timestamp가 있는지 확인
        if (!data.prediction_result || !data.timestamp) {
          console.warn('❌ 예상된 집중도 분석 응답 형식이 아님:', {
            hasPredictionResult: !!data.prediction_result,
            hasTimestamp: !!data.timestamp,
            keys: Object.keys(data)
          })
          return
        }
        
        if (typeof data.prediction_result.prediction !== 'number') {
          console.warn('❌ prediction이 숫자가 아닌 메시지:', data.prediction_result)
          return
        }

        // 집중도 점수 추출 및 검증
        const rawScore = data.prediction_result.prediction
        const confidence = data.prediction_result.confidence || 0.8
        
        // 점수가 이미 0-100 범위인지 확인하고 반올림
        const focusScore = Math.round(Math.max(0, Math.min(100, rawScore)))

        // 상태 업데이트
        setLastFocusScore(focusScore)
        setLastConfidence(confidence)
        setLastUpdateTime(data.timestamp)
        setError(null)
        
                // 메시지 수신 통계 업데이트
        setLastMessageTime(Date.now())
        setMessageCount(prev => prev + 1)

        // 콜백 호출
        if (onFocusScoreUpdate) {
          onFocusScoreUpdate(focusScore, confidence)
        }

      } catch (parseError) {
        console.error('❌ WebSocket 메시지 파싱 오류:', parseError)
        console.error('❌ 원본 메시지:', message)
        setError('데이터 파싱 오류')
        if (onError) {
          onError('데이터 파싱 오류')
        }
      }
    },
    onOpen: () => {
      console.log('🔗 WebSocket 집중도 분석 연결 성공 ====================')
      console.log('📡 연결 URL:', `wss://focushabit.site/ws/analysis?user_id=${userId}`)
      console.log('👤 사용자 ID:', userId)
      console.log('⏰ 연결 시간:', new Date().toISOString())
      setIsConnecting(false)
      setError(null)
      console.log('🔗 WebSocket 연결 완료 ====================')
    },
    onClose: (event) => {
      console.log('WebSocket 집중도 분석 연결 종료:', event.code, event.reason)
      setIsConnecting(false)
      
      // 연결이 정상적으로 종료되지 않은 경우
      if (event.code !== 1000) {
        const errorMessage = 'WebSocket 연결이 끊어졌습니다. 잠시 후 다시 시도해주세요.'
        setError(errorMessage)
        if (onError) {
          onError(errorMessage)
        }
      }
    },
    onError: (error) => {
      console.error('WebSocket 집중도 분석 오류:', error)
      setIsConnecting(false)
      
      const errorMessage = 'WebSocket 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
      setError(errorMessage)
      
      if (onError) {
        onError(errorMessage)
      }
    }
  })

  // 데이터 수신 모니터링
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null)
  const [messageCount, setMessageCount] = useState(0)

  // 연결 함수
  const connect = useCallback(() => {
    if (!enabled || !userId) {
      return
    }

    if (isConnected) {
      return
    }

    setIsConnecting(true)
    setError(null)
    wsConnect()
  }, [enabled, userId, isConnected, wsConnect])





  // 연결 해제 함수
  const disconnect = useCallback(() => {
    setIsConnecting(false)
    wsDisconnect()
  }, [wsDisconnect])

  // 재연결 함수
  const reconnect = useCallback(() => {
    setIsConnecting(true)
    setError(null)
    wsReconnect()
  }, [wsReconnect])

  // 프레임 전송 통계
  const [framesSent, setFramesSent] = useState(0)
  const [lastFrameTime, setLastFrameTime] = useState<number | null>(null)

  // 프레임 전송 함수
  const sendFrame = useCallback((frameData: string) => {
    if (!isConnected) {
      return
    }

    try {
      // base64 데이터에서 "data:image/jpeg;base64," 부분 제거
      const base64Data = frameData.replace(/^data:image\/[a-z]+;base64,/, '')
      
      // 순수한 base64 데이터만 전송
      wsSendFrame(base64Data)
      
      // 통계 업데이트
      setFramesSent(prev => prev + 1)
      setLastFrameTime(Date.now())
    } catch (error) {
      console.error('❌ 프레임 전송 오류:', error)
    }
  }, [isConnected, wsSendFrame])



  // 컴포넌트 마운트 시 연결
  useEffect(() => {
    if (enabled && userId) {
      connect()
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      disconnect()
    }
  }, [enabled, userId, connect, disconnect])

  // enabled 또는 userId 변경 시 재연결
  useEffect(() => {
    if (enabled && userId && !isConnected && !isConnecting) {
      connect()
    } else if (!enabled) {
      disconnect()
    }
  }, [enabled, userId, isConnected, isConnecting, connect, disconnect])

  return {
    isConnected,
    isConnecting,
    lastFocusScore,
    lastConfidence,
    lastUpdateTime,
    error,
    connect,
    disconnect,
    reconnect,
    sendFrame
  }
}
