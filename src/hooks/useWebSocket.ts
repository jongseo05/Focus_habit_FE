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
let globalEventHandlers: WebSocketEventHandlers | null = null

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
  url: 'wss://focushabit.site/ws/analysis',
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
  
  // 자동 연결 플래그 (개인화 데이터 수집용)
  const autoConnectRef = useRef(false)
  
  const wsClientRef = useRef<WebSocketClient | null>(null)
  const configRef = useRef<WebSocketConfig>({ ...defaultConfig, ...customConfig })
  const connectionStartTime = useRef<number | null>(null)
  const lastDisconnectionTime = useRef<number | null>(null)
  const isComponentMounted = useRef(true)
  
  // customConfig가 변경될 때마다 configRef 업데이트
  useEffect(() => {
    const previousUrl = configRef.current.url
    configRef.current = { ...defaultConfig, ...customConfig }
    
    console.log('🔧 configRef 업데이트:', {
      defaultUrl: defaultConfig.url,
      customUrl: customConfig?.url,
      finalUrl: configRef.current.url,
      previousUrl
    })
    
    // URL이 변경되었고 현재 연결되어 있다면 재연결
    if (previousUrl !== configRef.current.url && wsClientRef.current?.isConnected()) {
      
      wsClientRef.current.disconnect()
      wsClientRef.current = null
      setStatus(WebSocketStatus.DISCONNECTED)
    }
  }, [customConfig])
  
  // eventHandlers를 ref로 저장하여 최신 값을 유지
  const eventHandlersRef = useRef<Partial<WebSocketEventHandlers> | undefined>(eventHandlers)
  
  // eventHandlers가 변경될 때마다 ref 업데이트 및 WebSocket 클라이언트 이벤트 핸들러 업데이트
  useEffect(() => {
    eventHandlersRef.current = eventHandlers
    
    // 개발 환경에서만 상세한 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 eventHandlers 업데이트:', {
        hasEventHandlers: !!eventHandlers,
        hasOnMessage: !!eventHandlers?.onMessage,
        keys: eventHandlers ? Object.keys(eventHandlers) : []
      })
    }
    
    // WebSocket 클라이언트가 연결되어 있으면 이벤트 핸들러 업데이트
    if (wsClientRef.current && eventHandlers) {
      if (process.env.NODE_ENV === 'development') {
    
      }
      wsClientRef.current.updateEventHandlers(eventHandlers)
    }
  }, [eventHandlers])

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
      // raw 데이터를 그대로 전달 (WebSocketMessage 타입이 아닌 실제 데이터)
      if (eventHandlersRef.current?.onMessage) {
        eventHandlersRef.current.onMessage(message as any)
      }
    }
  }, [])

  const handleOpen = useCallback(() => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.CONNECTED)
      setConnectionStable(true)
      setReconnectAttempts(0)
      connectionStartTime.current = Date.now()
      // onOpen 이벤트 핸들러 호출 시 이벤트 객체 전달
      eventHandlersRef.current?.onOpen?.(new Event('open'))
    }
  }, [])

  const handleClose = useCallback((event: CloseEvent) => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.DISCONNECTED)
      setConnectionStable(false)
      lastDisconnectionTime.current = Date.now()
      eventHandlersRef.current?.onClose?.(event)
    }
  }, [])

  const handleError = useCallback((error: Event) => {
    if (isComponentMounted.current) {
      setStatus(WebSocketStatus.ERROR)
      setConnectionStable(false)
      eventHandlersRef.current?.onError?.(error)
    }
  }, [])

  // WebSocket 클라이언트 생성 및 연결
  const createWebSocketClient = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        return null
      }

      // 사용자 UID가 없으면 연결하지 않음
      if (!user?.id) {
        console.warn('⚠️ 사용자 ID가 없어 WebSocket 연결을 시도하지 않습니다.')
        return null
      }

      // URL 검증
      if (!configRef.current.url) {
        console.warn('⚠️ WebSocket URL이 설정되지 않았습니다.')
        return null
      }

            // URL에 이미 user_id가 포함되어 있는지 확인
      let finalUrl = configRef.current.url
      
      // 개인화 데이터 수집용 WebSocket은 user_id를 추가하지 않음
      // (wss://focushabit.site/ws/analysis)
      if (!finalUrl.includes('user_id=') && !finalUrl.includes('/ws/analysis')) {
        // user_id가 없고 개인화 데이터 수집용이 아니면 추가
        finalUrl = `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}user_id=${encodeURIComponent(user.id)}`
      }
      
      // 전역 클라이언트가 있고 같은 사용자 UID로 연결되어 있으면 재사용
      if (globalWebSocketClient && globalWebSocketClient.isConnected()) {
        // 현재 연결된 URL에서 user_id 추출
        const currentUrl = globalWebSocketClient.config?.url || ''
        const currentUserId = new URLSearchParams(currentUrl.split('?')[1] || '').get('user_id')
        
        if (currentUserId === user.id) {
          // 전역 이벤트 핸들러 업데이트
          globalEventHandlers = {
            onMessage: handleMessage,
            onOpen: handleOpen,
            onClose: handleClose,
            onError: handleError
          }
          
          // 기존 클라이언트의 이벤트 핸들러 업데이트
          globalWebSocketClient.updateEventHandlers(globalEventHandlers)
          
          // 연결 상태를 올바르게 설정
          setStatus(WebSocketStatus.CONNECTED)
          setConnectionStable(true)
          return globalWebSocketClient
        } else {
          globalWebSocketClient.disconnect()
          globalWebSocketClient = null
          globalEventHandlers = null
          globalConnectionCount = 0
        }
      }

      // 새 클라이언트 생성 (최종 URL 사용)
      const client = new WebSocketClient({
        ...configRef.current,
        url: finalUrl
      }, {
        onMessage: handleMessage,
        onOpen: handleOpen,
        onClose: handleClose,
        onError: handleError
      })

      // 전역 이벤트 핸들러 설정
      globalEventHandlers = {
        onMessage: handleMessage,
        onOpen: handleOpen,
        onClose: handleClose,
        onError: handleError
      }

      // 클라이언트 생성 후 즉시 연결
      client.connect(token)

      return client
    } catch (error) {
      console.error('❌ WebSocket 클라이언트 생성 실패:', error)
      return null
    }
  }, [getAuthToken, handleMessage, handleOpen, handleClose, handleError, user?.id])

  // 연결
  const connect = useCallback(async () => {
    // URL 검증
    if (!configRef.current.url) {
      console.warn('⚠️ WebSocket URL이 설정되지 않아 연결을 시도하지 않습니다.')
      setStatus(WebSocketStatus.ERROR)
      return
    }

    // 실제 연결 상태를 더 정확하게 확인
    if (wsClientRef.current?.isConnected() && status === WebSocketStatus.CONNECTED) {
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

      // 연결 완료 대기 (최대 5초)
      let attempts = 0
      const maxAttempts = 50 // 5초 (100ms * 50)
      
      while (attempts < maxAttempts) {
        if (client.isConnected()) {
          setStatus(WebSocketStatus.CONNECTED)
          setConnectionStable(true)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      
      // 연결 타임아웃
      setStatus(WebSocketStatus.ERROR)
      wsClientRef.current = null
      
    } catch (error) {
      setStatus(WebSocketStatus.ERROR)
      
      // 연결 실패 시 클라이언트 정리
      if (wsClientRef.current) {
        wsClientRef.current = null
      }
    }
  }, [createWebSocketClient, status])

  // 연결 해제
  const disconnect = useCallback(() => {
    if (wsClientRef.current) {
      globalConnectionCount--
      
      // 마지막 사용자가 아니면 실제로 연결을 끊지 않음
      if (globalConnectionCount <= 0) {
        if (globalWebSocketClient) {
          globalWebSocketClient.disconnect()
          globalWebSocketClient = null
        }
        globalEventHandlers = null
        wsClientRef.current = null
      } else {
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
      // 순수한 base64 데이터만 전송
      wsClientRef.current.sendFrame(frameData)
      
    } else {
      console.warn('WebSocket이 연결되지 않아 프레임을 전송할 수 없습니다.')
    }
  }, [])

  // 원시 텍스트 전송 (제스처 인식용)
  const sendRawText = useCallback((text: string) => {
    if (!wsClientRef.current?.isConnected()) {
      return
    }

    try {
      // WebSocket 클라이언트에 직접 접근해서 원시 텍스트 전송
      const ws = (wsClientRef.current as any).ws
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(text)
      }
    } catch (error) {
      console.error('❌ WebSocket 전송 오류:', error)
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
  }, [])

  

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      isComponentMounted.current = false
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
