import { useState, useEffect, useCallback, useRef } from 'react'
import { WebSocketClient } from '@/lib/websocket/client'
import { useUser } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useFocusSessionErrorHandler } from '@/hooks/useFocusSessionErrorHandler'
import { FocusSessionErrorType } from '@/types/focusSession'
import {
  WebSocketStatus,
  WebSocketMessage,
  WebSocketConfig,
  WebSocketEventHandlers
} from '@/types/websocket'

// WebSocket 훅 반환 타입 정의
interface UseWebSocketReturn {
  status: WebSocketStatus
  lastMessage: WebSocketMessage | null
  sendMessage: (message: WebSocketMessage) => void
  sendFrame: (frameData: string) => void // 프레임 전송 추가
  sendRawText: (text: string) => void // 원시 텍스트 전송 추가
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  isConnected: boolean
  isConnecting: boolean
  reconnectAttempts: number
  connectionStable: boolean
}

// 기본 WebSocket 설정
const defaultConfig: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://focushabit.site/ws/analysis',
  reconnectInterval: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_RECONNECT_INTERVAL || '5000'),
  maxReconnectAttempts: parseInt(process.env.NEXT_PUBLIC_WEBSOCKET_MAX_RECONNECT_ATTEMPTS || '5'),
  enablePing: true,
  pingInterval: 30000, // 30초마다 ping
}

export function useWebSocket(
  customConfig?: Partial<WebSocketConfig>,
  eventHandlers?: Partial<WebSocketEventHandlers>
): UseWebSocketReturn {
  const { data: user } = useUser()
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.DISCONNECTED)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [connectionStable, setConnectionStable] = useState(false)
  
  const wsClientRef = useRef<WebSocketClient | null>(null)
  const configRef = useRef<WebSocketConfig>({ ...defaultConfig, ...customConfig })
  const connectionStartTime = useRef<number | null>(null)
  const lastDisconnectionTime = useRef<number | null>(null)

  // 집중 세션 에러 핸들러
  const { handleError, classifyError } = useFocusSessionErrorHandler({
    onError: (error) => {
      // 에러 처리
    },
    onRecoveryStart: (errorType) => {
      setStatus(WebSocketStatus.RECONNECTING)
    },
    onRecoverySuccess: (errorType) => {
      setConnectionStable(true)
    },
    onRecoveryFailed: (error) => {
      setStatus(WebSocketStatus.ERROR)
    }
  })

  // JWT 토큰 가져오기
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = supabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      return null
    }
  }, [])

  // WebSocket 이벤트 핸들러 설정
  const setupEventHandlers = useCallback((): WebSocketEventHandlers => {
    return {
      onOpen: (event) => {
        setStatus(WebSocketStatus.CONNECTED)
        setReconnectAttempts(0)
        connectionStartTime.current = Date.now()
        
        // 연결 안정성 확인 (5초 후)
        setTimeout(() => {
          if (status === WebSocketStatus.CONNECTED) {
            setConnectionStable(true)
          }
        }, 5000)
        
        eventHandlers?.onOpen?.(event)
      },
      onMessage: (message) => {
        // 제스처 인식 서버 오류 체크
        if (message.type === 'error' || (message.data && message.data.error)) {
          const gestureError = classifyError(
            new Error(message.data?.error || 'Gesture server error'), 
            'gesture'
          )
          handleError(gestureError)
        }
        
        setLastMessage(message)
        eventHandlers?.onMessage?.(message)
      },
      onClose: (event) => {
        setStatus(WebSocketStatus.DISCONNECTED)
        setConnectionStable(false)
        lastDisconnectionTime.current = Date.now()
        
        // 예기치 않은 연결 끊김인지 확인
        const isUnexpected = event.code !== 1000 && event.code !== 1001
        if (isUnexpected) {
          const wsError = classifyError(
            { code: event.code, reason: event.reason, type: 'close' }, 
            'websocket'
          )
          handleError(wsError)
        }
        
        eventHandlers?.onClose?.(event)
      },
      onError: (error) => {
        setStatus(WebSocketStatus.ERROR)
        setConnectionStable(false)
        
        const wsError = classifyError(error, 'websocket')
        handleError(wsError)
        
        eventHandlers?.onError?.(error)
      },
      onReconnect: (attempt) => {
        setStatus(WebSocketStatus.RECONNECTING)
        setReconnectAttempts(attempt)
        eventHandlers?.onReconnect?.(attempt)
      },
      onMaxReconnectAttemptsReached: () => {
        setStatus(WebSocketStatus.ERROR)
        
        const wsError = classifyError(
          new Error('Max reconnect attempts reached'), 
          'websocket'
        )
        handleError(wsError)
        
        eventHandlers?.onMaxReconnectAttemptsReached?.()
      }
    }
  }, [eventHandlers, classifyError, handleError, status])

  // WebSocket 연결
  const connect = useCallback(async () => {
    if (wsClientRef.current?.isConnected()) {
      return
    }

    try {
      // 기존 클라이언트가 있다면 정리
      if (wsClientRef.current) {
        wsClientRef.current.disconnect()
      }

      // 새 클라이언트 생성
      wsClientRef.current = new WebSocketClient(configRef.current, setupEventHandlers())
      
      // 인증 토큰 가져오기
      const authToken = await getAuthToken()
      
      // 연결 시작
      wsClientRef.current.connect(authToken || undefined)
      
    } catch (error) {
      setStatus(WebSocketStatus.ERROR)
    }
  }, [setupEventHandlers, getAuthToken])

  // WebSocket 연결 해제
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.disconnect()
      wsClientRef.current = null
    }
    setStatus(WebSocketStatus.DISCONNECTED)
    setReconnectAttempts(0)
    setLastMessage(null)
  }, [])

  // 프레임 전송
  const sendFrame = useCallback((frameData: string) => {
    if (wsClientRef.current) {
      wsClientRef.current.sendFrame(frameData)
    }
  }, [])

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsClientRef.current) {
      wsClientRef.current.sendMessage(message)
    }
  }, [])

  // 원시 텍스트 전송 (제스처 인식용)
  const sendRawText = useCallback((text: string) => {
    if (!wsClientRef.current?.isConnected()) {
      return
    }

    // WebSocket 클라이언트에 직접 접근해서 원시 텍스트 전송
    const ws = (wsClientRef.current as any).ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(text)
    }
  }, [])

  // 재연결
  const reconnect = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.reconnect()
    } else {
      connect()
    }
  }, [connect])

  // 사용자 로그인 상태 변경 시 처리
  useEffect(() => {
    if (user) {
      connect()
    } else {
      disconnect()
    }
  }, [user])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  // 상태 계산
  const isConnected = status === WebSocketStatus.CONNECTED
  const isConnecting = status === WebSocketStatus.CONNECTING || status === WebSocketStatus.RECONNECTING

  return {
    status,
    lastMessage,
    sendMessage,
    sendFrame,
    sendRawText,
    connect,
    disconnect,
    reconnect,
    isConnected: status === WebSocketStatus.CONNECTED,
    isConnecting: status === WebSocketStatus.CONNECTING,
    reconnectAttempts,
    connectionStable
  }
}
