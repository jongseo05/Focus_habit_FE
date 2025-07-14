import { useState, useEffect, useCallback, useRef } from 'react'
import { WebSocketClient } from '@/lib/websocket/client'
import { useUser } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase/client'
import {
  WebSocketStatus,
  WebSocketMessage,
  WebSocketConfig,
  WebSocketEventHandlers,
  UseWebSocketReturn
} from '@/types/websocket'

// 기본 WebSocket 설정
const defaultConfig: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8000/ws/analysis',
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
  
  const wsClientRef = useRef<WebSocketClient | null>(null)
  const configRef = useRef<WebSocketConfig>({ ...defaultConfig, ...customConfig })

  // JWT 토큰 가져오기
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = supabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }, [])

  // WebSocket 이벤트 핸들러 설정
  const setupEventHandlers = useCallback((): WebSocketEventHandlers => {
    return {
      onOpen: (event) => {
        console.log('WebSocket connected')
        setStatus(WebSocketStatus.CONNECTED)
        setReconnectAttempts(0)
        eventHandlers?.onOpen?.(event)
      },
      onMessage: (message) => {
        setLastMessage(message)
        eventHandlers?.onMessage?.(message)
      },
      onClose: (event) => {
        console.log('WebSocket disconnected')
        setStatus(WebSocketStatus.DISCONNECTED)
        eventHandlers?.onClose?.(event)
      },
      onError: (error) => {
        console.error('WebSocket error:', error)
        setStatus(WebSocketStatus.ERROR)
        eventHandlers?.onError?.(error)
      },
      onReconnect: (attempt) => {
        console.log(`WebSocket reconnecting... Attempt ${attempt}`)
        setStatus(WebSocketStatus.RECONNECTING)
        setReconnectAttempts(attempt)
        eventHandlers?.onReconnect?.(attempt)
      },
      onMaxReconnectAttemptsReached: () => {
        console.error('WebSocket max reconnect attempts reached')
        setStatus(WebSocketStatus.ERROR)
        eventHandlers?.onMaxReconnectAttemptsReached?.()
      }
    }
  }, [eventHandlers])

  // WebSocket 연결
  const connect = useCallback(async () => {
    if (wsClientRef.current?.isConnected()) {
      console.warn('WebSocket is already connected')
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
      console.error('Failed to connect WebSocket:', error)
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

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsClientRef.current) {
      console.error('WebSocket client is not initialized')
      return
    }

    wsClientRef.current.sendMessage(message)
  }, [])

  // 원시 텍스트 전송 (제스처 인식용)
  const sendRawText = useCallback((text: string) => {
    if (!wsClientRef.current?.isConnected()) {
      console.error('WebSocket is not connected')
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
      // 사용자가 로그인했을 때 자동 연결
      connect()
    } else {
      // 사용자가 로그아웃했을 때 연결 해제
      disconnect()
    }
  }, [user, connect, disconnect])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
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
    sendRawText,
    connect,
    disconnect,
    reconnect,
    isConnected,
    isConnecting,
    reconnectAttempts
  }
}
