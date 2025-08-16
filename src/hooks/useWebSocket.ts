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

// 전역 WebSocket 연결 관리 (페이지 이동 시에도 유지)
let globalWebSocketClient: WebSocketClient | null = null
let globalConnectionCount = 0

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
  url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
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
  const isComponentMounted = useRef(true)

  // 집중 세션 에러 핸들러
  const { handleError: handleSessionError, classifyError } = useFocusSessionErrorHandler({
    onError: (error) => {
      // 에러 처리
    },
    onRecoveryStart: (errorType) => {
      if (isComponentMounted.current) {
        setStatus(WebSocketStatus.RECONNECTING)
      }
    },
    onRecoverySuccess: (errorType) => {
      if (isComponentMounted.current) {
        setConnectionStable(true)
      }
    },
    onRecoveryFailed: (error) => {
      if (isComponentMounted.current) {
        setStatus(WebSocketStatus.ERROR)
      }
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
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (isComponentMounted.current) {
      setLastMessage(message)
      eventHandlers?.onMessage?.(message)
    }
  }, [eventHandlers])

  const handleOpen = useCallback(() => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.CONNECTED)
      setConnectionStable(true)
      setReconnectAttempts(0)
      connectionStartTime.current = Date.now()
      // onOpen 이벤트 핸들러 호출 시 이벤트 객체 전달
      eventHandlers?.onOpen?.(new Event('open'))
    }
  }, [eventHandlers])

  const handleClose = useCallback((event: CloseEvent) => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.DISCONNECTED)
      setConnectionStable(false)
      lastDisconnectionTime.current = Date.now()
      eventHandlers?.onClose?.(event)
    }
  }, [eventHandlers])

  const handleError = useCallback((error: Event) => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.ERROR)
      setConnectionStable(false)
      eventHandlers?.onError?.(error)
    }
  }, [eventHandlers])

  // WebSocket 클라이언트 생성 및 연결
  const createWebSocketClient = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.warn('WebSocket 연결 실패: 인증 토큰 없음')
        return null
      }

      // 전역 클라이언트가 있으면 재사용
      if (globalWebSocketClient && globalWebSocketClient.isConnected()) {
        console.log('기존 전역 WebSocket 클라이언트 재사용')
        return globalWebSocketClient
      }

      // 새 클라이언트 생성
      const client = new WebSocketClient(configRef.current, {
        onMessage: handleMessage,
        onOpen: handleOpen,
        onClose: handleClose,
        onError: handleError
      })

      // 클라이언트 생성 후 즉시 연결
      client.connect(token)

      return client
    } catch (error) {
      console.error('WebSocket 클라이언트 생성 실패:', error)
      return null
    }
  }, [getAuthToken, handleMessage, handleOpen, handleClose, handleError])

  // 연결
  const connect = useCallback(async () => {
    if (wsClientRef.current?.isConnected()) {
      console.log('WebSocket 이미 연결됨')
      return
    }

    setStatus(WebSocketStatus.CONNECTING)
    
    try {
      const client = await createWebSocketClient()
      if (!client) {
        setStatus(WebSocketStatus.ERROR)
        return
      }

      wsClientRef.current = client
      
      // 전역 클라이언트로 설정
      if (!globalWebSocketClient) {
        globalWebSocketClient = client
      }
      globalConnectionCount++

      // 클라이언트가 이미 생성되고 연결됨 (createWebSocketClient에서 처리)
    } catch (error) {
      console.error('WebSocket 연결 실패:', error)
      setStatus(WebSocketStatus.ERROR)
    }
  }, [createWebSocketClient])

  // 연결 해제
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      globalConnectionCount--
      
      // 마지막 사용자가 아니면 실제로 연결을 끊지 않음
      if (globalConnectionCount <= 0) {
        console.log('마지막 WebSocket 사용자, 연결 해제')
        if (globalWebSocketClient) {
          globalWebSocketClient.disconnect()
          globalWebSocketClient = null
        }
        wsClientRef.current = null
      } else {
        console.log('다른 사용자가 WebSocket을 사용 중, 연결 유지')
        wsClientRef.current = null
      }
      
      setStatus(WebSocketStatus.DISCONNECTED)
      setConnectionStable(false)
    }
  }, [])

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.sendMessage(message)
    }
  }, [])

  // 프레임 전송
  const sendFrame = useCallback((frameData: string) => {
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.sendFrame(frameData)
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
      // 기존 클라이언트가 있으면 재연결
      wsClientRef.current.reconnect()
    } else {
      // 새로 연결
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
  }, [user, connect, disconnect])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      isComponentMounted.current = false
      console.log('WebSocket 훅 정리 중...')
      disconnect()
    }
  }, [disconnect])

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
