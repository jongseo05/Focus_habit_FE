// =====================================================
// 스터디룸 실시간 입장 상태 표시 컴포넌트
// =====================================================

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Wifi, WifiOff, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoomPresenceIndicatorProps {
  totalPresent: number
  onlineAndPresent: number
  canStartSession: boolean
  isCurrentUserPresent: boolean
  className?: string
}

export function RoomPresenceIndicator({
  totalPresent,
  onlineAndPresent,
  canStartSession,
  isCurrentUserPresent,
  className
}: RoomPresenceIndicatorProps) {
  
  const getStatusColor = () => {
    if (!isCurrentUserPresent) return 'text-gray-500'
    if (canStartSession) return 'text-green-600'
    if (onlineAndPresent > 0) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getStatusText = () => {
    if (!isCurrentUserPresent) return '룸 밖'
    if (canStartSession) return '세션 시작 가능'
    if (onlineAndPresent > 0) return '일부 참가자 온라인'
    return '세션 시작 불가'
  }

  const getStatusIcon = () => {
    if (!isCurrentUserPresent) return <WifiOff className="h-4 w-4" />
    if (canStartSession) return <Circle className="h-4 w-4 fill-current" />
    return <Wifi className="h-4 w-4" />
  }

  return (
    <Card className={cn("border-l-4", className, {
      "border-l-green-500": canStartSession && isCurrentUserPresent,
      "border-l-yellow-500": onlineAndPresent > 0 && !canStartSession && isCurrentUserPresent,
      "border-l-red-500": onlineAndPresent === 0 && isCurrentUserPresent,
      "border-l-gray-400": !isCurrentUserPresent
    })}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">실시간 참가 상태</span>
          </div>
          
          <div className={cn("flex items-center gap-1 text-sm font-medium", getStatusColor())}>
            {getStatusIcon()}
            {getStatusText()}
          </div>
        </div>
        
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="text-center">
            <div className="font-semibold text-blue-600">{totalPresent}</div>
            <div className="text-gray-500 text-xs">룸에 있음</div>
          </div>
          
          <div className="text-center">
            <div className="font-semibold text-green-600">{onlineAndPresent}</div>
            <div className="text-gray-500 text-xs">온라인+룸</div>
          </div>
          
          <div className="text-center">
            <Badge 
              variant={canStartSession ? "default" : "secondary"}
              className="text-xs"
            >
              {canStartSession ? "가능" : "불가능"}
            </Badge>
          </div>
        </div>

        {!isCurrentUserPresent && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
            💡 세션에 참여하려면 스터디룸 페이지에 머물러 있어야 합니다
          </div>
        )}
        
        {isCurrentUserPresent && !canStartSession && (
          <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ 세션을 시작하려면 온라인 상태인 참가자가 최소 1명 필요합니다
          </div>
        )}
        
        {canStartSession && (
          <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
            ✅ {onlineAndPresent}명의 참가자와 함께 세션을 시작할 수 있습니다
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 참가자 개별 상태 표시 컴포넌트
interface ParticipantPresenceStatusProps {
  isOnline: boolean
  isPresent: boolean
  className?: string
}

export function ParticipantPresenceStatus({
  isOnline,
  isPresent,
  className
}: ParticipantPresenceStatusProps) {
  
  const getStatus = () => {
    if (isOnline && isPresent) return { 
      color: 'bg-green-500', 
      text: '활발히 참여', 
      textColor: 'text-green-700' 
    }
    if (isOnline && !isPresent) return { 
      color: 'bg-yellow-500', 
      text: '온라인 (다른 곳)', 
      textColor: 'text-yellow-700' 
    }
    if (!isOnline && isPresent) return { 
      color: 'bg-orange-500', 
      text: '룸에 있음 (비활성)', 
      textColor: 'text-orange-700' 
    }
    return { 
      color: 'bg-gray-400', 
      text: '오프라인', 
      textColor: 'text-gray-600' 
    }
  }

  const status = getStatus()

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", status.color)} />
      <span className={cn("text-xs", status.textColor)}>
        {status.text}
      </span>
    </div>
  )
}
