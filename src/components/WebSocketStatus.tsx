'use client'

import { useWebSocket } from '@/hooks/useWebSocket'
import { WebSocketStatus as WSStatus } from '@/types/websocket'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function WebSocketStatus() {
  const {
    status,
    isConnected,
    isConnecting,
    reconnectAttempts,
    connectionStable,
    connect,
    disconnect,
    reconnect
  } = useWebSocket()

  const getStatusColor = (status: WSStatus) => {
    switch (status) {
      case WSStatus.CONNECTED:
        return 'bg-green-500'
      case WSStatus.CONNECTING:
      case WSStatus.RECONNECTING:
        return 'bg-yellow-500'
      case WSStatus.ERROR:
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: WSStatus) => {
    switch (status) {
      case WSStatus.CONNECTED:
        return '연결됨'
      case WSStatus.CONNECTING:
        return '연결 중'
      case WSStatus.RECONNECTING:
        return '재연결 중'
      case WSStatus.ERROR:
        return '오류'
      case WSStatus.DISCONNECTED:
        return '연결 끊김'
      default:
        return '알 수 없음'
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          WebSocket 상태
          <Badge className={getStatusColor(status)}>
            {getStatusText(status)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>연결 상태:</span>
            <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
              {isConnected ? '연결됨' : '연결 안됨'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>연결 중:</span>
            <span className={isConnecting ? 'text-yellow-600' : 'text-gray-600'}>
              {isConnecting ? '예' : '아니오'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>연결 안정성:</span>
            <span className={connectionStable ? 'text-green-600' : 'text-yellow-600'}>
              {connectionStable ? '안정' : '불안정'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>재연결 시도:</span>
            <span>{reconnectAttempts}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={connect} 
            disabled={isConnected || isConnecting}
            size="sm"
          >
            연결
          </Button>
          <Button 
            onClick={disconnect} 
            disabled={!isConnected}
            size="sm"
            variant="outline"
          >
            연결 해제
          </Button>
          <Button 
            onClick={reconnect} 
            disabled={isConnecting}
            size="sm"
            variant="secondary"
          >
            재연결
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
