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
        console.log('🔍 WebSocket 메시지 수신 시작 ====================')
        console.log('📨 원본 메시지 객체:', message)
        console.log('📨 메시지 타입:', typeof message)
        
        // 서버에서 보내는 집중도 분석 응답 형식에 맞게 처리
        let data = message
        
        // 이미 파싱된 객체인 경우 (WebSocketClient에서 파싱됨)
        if (typeof message === 'object' && message !== null) {
          data = message
          console.log('📨 이미 파싱된 객체 사용:', data)
        }
        // 문자열인 경우 JSON 파싱 (백업)
        else if (typeof message === 'string') {
          try {
            data = JSON.parse(message)
            console.log('📨 JSON 파싱 성공:', data)
          } catch (parseError) {
            console.error('📨 JSON 파싱 실패:', parseError)
            console.log('📨 파싱 실패한 문자열:', message)
            return
          }
        }
        
        console.log('📨 최종 데이터:', data)
        console.log('📨 데이터 키들:', data && typeof data === 'object' ? Object.keys(data) : 'N/A')
        
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
        
        console.log('📨 prediction_result:', data.prediction_result)
        console.log('📨 prediction 타입:', typeof data.prediction_result.prediction)
        console.log('📨 eye_status:', data.eye_status)
        console.log('📨 head_pose:', data.head_pose)
        
        if (typeof data.prediction_result.prediction !== 'number') {
          console.warn('❌ prediction이 숫자가 아닌 메시지:', data.prediction_result)
          return
        }
        
        console.log('✅ 집중도 분석 데이터 수신 성공:', data)

        // 집중도 점수 추출 및 검증
        const rawScore = data.prediction_result.prediction
        const confidence = data.prediction_result.confidence || 0.8
        
        console.log('📊 원본 점수:', rawScore)
        console.log('📊 신뢰도:', confidence)
        
        // 점수가 이미 0-100 범위인지 확인하고 반올림
        const focusScore = Math.round(Math.max(0, Math.min(100, rawScore)))
        
        console.log('📊 최종 점수:', focusScore)

        console.log('✅ 집중도 점수 처리 완료:', { 
          rawScore, 
          focusScore, 
          confidence,
          timestamp: data.timestamp,
          eyeStatus: data.eye_status?.status,
          earValue: data.eye_status?.ear_value,
          headPose: data.head_pose
        })

        // 상태 업데이트
        console.log('🔄 상태 업데이트 시작...')
        setLastFocusScore(focusScore)
        setLastConfidence(confidence)
        setLastUpdateTime(data.timestamp)
        setError(null)
        
        // 메시지 수신 통계 업데이트
        setLastMessageTime(Date.now())
        setMessageCount(prev => {
          const newCount = prev + 1
          console.log('📈 메시지 카운트 업데이트:', prev, '→', newCount)
          return newCount
        })

        // 콜백 호출
        console.log('🔄 onFocusScoreUpdate 콜백 호출 준비...')
        if (onFocusScoreUpdate) {
          console.log('✅ onFocusScoreUpdate 콜백 호출:', { focusScore, confidence })
          onFocusScoreUpdate(focusScore, confidence)
        } else {
          console.warn('⚠️ onFocusScoreUpdate 콜백이 설정되지 않음')
        }
        
        console.log('🔍 WebSocket 메시지 처리 완료 ====================')

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
      console.log('WebSocket 연결 비활성화 또는 사용자 ID 없음')
      return
    }

    if (isConnected) {
      console.log('WebSocket이 이미 연결되어 있습니다.')
      return
    }

    console.log('WebSocket 연결 시도:', {
      url: `wss://focushabit.site/ws/analysis?user_id=${userId}`,
      userId,
      enabled,
      environment: process.env.NODE_ENV
    })

    setIsConnecting(true)
    setError(null)
    wsConnect()
  }, [enabled, userId, isConnected, wsConnect])

  // 연결 후 메시지 수신 확인
  useEffect(() => {
    if (isConnected && messageCount === 0) {
      console.log('🔍 연결 후 메시지 수신 확인 시작...')
      
      // 3초 후에도 메시지가 없으면 경고
      const checkTimeout = setTimeout(() => {
        if (messageCount === 0) {
          console.warn('⚠️ WebSocket 연결됨 but 3초 동안 메시지 수신 없음')
          console.warn('⚠️ 서버에서 집중도 분석 데이터를 보내지 않고 있을 수 있습니다')
          console.warn('⚠️ URL 확인:', `wss://focushabit.site/ws/analysis?user_id=${userId}`)
        }
      }, 3000)

      return () => clearTimeout(checkTimeout)
    }
  }, [isConnected, messageCount, userId])

  // 메시지 수신 상태 모니터링 (주기적 체크)
  useEffect(() => {
    if (!isConnected) return

    const monitoringInterval = setInterval(() => {
      if (lastMessageTime) {
        const timeSinceLastMessage = Date.now() - lastMessageTime
        console.log('📊 WebSocket 메시지 수신 상태:', {
          timeSinceLastMessage: `${Math.round(timeSinceLastMessage / 1000)}초 전`,
          messageCount,
          isConnected,
          lastMessageTime: new Date(lastMessageTime).toISOString(),
          userId
        })
        
        if (timeSinceLastMessage > 30000) { // 30초 이상 메시지가 없으면
          console.warn('⚠️ WebSocket 연결됨 but 데이터 수신 없음 - 연결 상태 점검 필요:', {
            timeSinceLastMessage: `${Math.round(timeSinceLastMessage / 1000)}초`,
            messageCount,
            isConnected,
            url: `wss://focushabit.site/ws/analysis?user_id=${userId}`
          })
        }
      } else {
        console.log('📊 WebSocket 연결됨, 첫 메시지 대기 중...', {
          connectionTime: new Date().toISOString(),
          messageCount,
          userId
        })
      }
    }, 10000) // 10초마다 체크

    return () => clearInterval(monitoringInterval)
  }, [isConnected, lastMessageTime, messageCount, userId])

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
      console.warn('❌ WebSocket이 연결되지 않아 프레임을 전송할 수 없습니다.')
      return
    }

    try {
      // base64 데이터에서 "data:image/jpeg;base64," 부분 제거
      const base64Data = frameData.replace(/^data:image\/[a-z]+;base64,/, '')
      
      console.log('📤 프레임 전송 시도:', {
        originalLength: frameData.length,
        base64Length: base64Data.length,
        dataSizeKB: Math.round(base64Data.length / 1024),
        timestamp: new Date().toISOString()
      })
      
      // 순수한 base64 데이터만 전송
      wsSendFrame(base64Data)
      
      // 통계 업데이트
      setFramesSent(prev => prev + 1)
      setLastFrameTime(Date.now())
      
      console.log('✅ 프레임 전송 완료:', {
        frameNumber: framesSent + 1,
        dataLength: base64Data.length,
        dataSizeKB: Math.round(base64Data.length / 1024),
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('❌ 프레임 전송 오류:', error)
    }
  }, [isConnected, wsSendFrame, framesSent])

  // 프레임 전송 통계 모니터링
  useEffect(() => {
    if (!isConnected || framesSent === 0) return

    const statsInterval = setInterval(() => {
      const timeSinceLastFrame = lastFrameTime ? Date.now() - lastFrameTime : 0
      
      console.log('📊 프레임 전송 통계:', {
        totalFramesSent: framesSent,
        lastFrameTime: lastFrameTime ? new Date(lastFrameTime).toISOString() : null,
        timeSinceLastFrame: `${Math.round(timeSinceLastFrame / 1000)}초 전`,
        isConnected,
        userId
      })
      
      if (timeSinceLastFrame > 10000) { // 10초 이상 프레임 전송이 없으면
        console.warn('⚠️ 프레임 전송이 중단된 것 같습니다:', {
          timeSinceLastFrame: `${Math.round(timeSinceLastFrame / 1000)}초`,
          totalFramesSent: framesSent
        })
      }
    }, 15000) // 15초마다 체크

    return () => clearInterval(statsInterval)
  }, [isConnected, framesSent, lastFrameTime, userId])

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
