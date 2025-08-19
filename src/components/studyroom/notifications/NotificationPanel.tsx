// =====================================================
// 스터디룸 알림 패널
// =====================================================

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, X, UserPlus, UserMinus, Info } from 'lucide-react'

interface Notification {
  id: string
  message: string
  type: 'join' | 'leave' | 'info'
  timestamp: number
}

interface NotificationPanelProps {
  notifications: Notification[]
  onRemove?: (id: string) => void
}

export function NotificationPanel({ notifications, onRemove }: NotificationPanelProps) {
  // 최근 5개만 표시
  const recentNotifications = notifications.slice(-5).reverse()

  // 알림 타입별 아이콘
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'join':
        return <UserPlus className="h-4 w-4 text-green-500" />
      case 'leave':
        return <UserMinus className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  // 알림 타입별 배경색
  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'join':
        return 'bg-green-50 border-green-200'
      case 'leave':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  // 시간 포맷팅
  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) return '방금 전'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            알림
          </div>
          {notifications.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {notifications.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentNotifications.length > 0 ? (
            recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border transition-all duration-200 ${getNotificationBg(notification.type)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  {/* 삭제 버튼 */}
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(notification.id)}
                      className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">알림이 없습니다</p>
            </div>
          )}
          
          {/* 더 많은 알림이 있는 경우 */}
          {notifications.length > 5 && (
            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                {notifications.length - 5}개의 이전 알림이 더 있습니다
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
