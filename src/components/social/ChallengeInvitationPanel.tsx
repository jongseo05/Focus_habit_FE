'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  Timer,
  Target,
  Coffee
} from 'lucide-react'
import type { ChallengeInvitation } from '@/types/social'

interface ChallengeInvitationPanelProps {
  invitation: ChallengeInvitation
  participants: Array<{
    user_id: string
    user: {
      name: string
      avatar_url?: string
    }
  }>
  currentUserId: string
  onAccept: () => void
  onReject: () => void
  onExpire: () => void
}

export function ChallengeInvitationPanel({
  invitation,
  participants,
  currentUserId,
  onAccept,
  onReject,
  onExpire
}: ChallengeInvitationPanelProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [hasResponded, setHasResponded] = useState<boolean>(false)
  const [isResponding, setIsResponding] = useState<boolean>(false)

  // 만료 시간 계산
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const expiresAt = new Date(invitation.expires_at).getTime()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
      
      if (remaining <= 0) {
        onExpire()
        return 0
      }
      
      return remaining
    }

    setTimeLeft(calculateTimeLeft())
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)
    }, 1000)

    return () => clearInterval(timer)
  }, [invitation.expires_at, onExpire])

  // 이미 응답했는지 확인
  useEffect(() => {
    const userResponse = invitation.responses?.[currentUserId]
    setHasResponded(userResponse === 'accepted' || userResponse === 'rejected')
    
    // 응답 처리 중 상태 확인
    const responseKey = `${invitation.invitation_id}-${currentUserId}`
    const isProcessing = window.sessionStorage.getItem(responseKey) === 'processing'
    setIsResponding(isProcessing)
    
    console.log('응답 상태 업데이트:', {
      userResponse,
      hasResponded: userResponse === 'accepted' || userResponse === 'rejected',
      isProcessing,
      responses: invitation.responses
    })
  }, [invitation.responses, currentUserId, invitation.invitation_id])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getModeInfo = () => {
    if (invitation.mode === 'pomodoro') {
      return {
        icon: <Coffee className="h-4 w-4" />,
        label: '뽀모도로',
        duration: `${invitation.config.work}분 공부 + ${invitation.config.break}분 휴식`
      }
    } else {
      return {
        icon: <Target className="h-4 w-4" />,
        label: '커스텀',
        duration: `${invitation.config.durationMin}분`
      }
    }
  }

  const modeInfo = getModeInfo()

  const getResponseStatus = (userId: string) => {
    const response = invitation.responses?.[userId]
    if (!response) return 'pending'
    return response
  }

  const acceptedCount = Object.values(invitation.responses || {}).filter(r => r === 'accepted').length
  const rejectedCount = Object.values(invitation.responses || {}).filter(r => r === 'rejected').length
  const pendingCount = participants.length - acceptedCount - rejectedCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-blue-800">
            <Target className="h-5 w-5" />
            집중도 대결 초대
          </CardTitle>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Timer className="h-4 w-4" />
            <span>{formatTime(timeLeft)} 남음</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 대결 정보 */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              {modeInfo.icon}
              <span className="font-medium">{modeInfo.label}</span>
            </div>
            <p className="text-sm text-gray-600">{modeInfo.duration}</p>
          </div>

          {/* 응답 현황 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">응답 현황</h4>
            <div className="flex justify-center gap-2">
              <Badge variant="default" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                {acceptedCount} 동의
              </Badge>
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {rejectedCount} 거부
              </Badge>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {pendingCount} 대기
              </Badge>
            </div>
          </div>

          {/* 참가자 목록 */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">참가자 응답</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {participants.map((participant) => {
                const responseStatus = getResponseStatus(participant.user_id)
                const isCurrentUser = participant.user_id === currentUserId

                return (
                  <div key={participant.user_id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={participant.user.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {participant.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {participant.user.name}
                        {isCurrentUser && <span className="text-blue-600 ml-1">(나)</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {responseStatus === 'accepted' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {responseStatus === 'rejected' && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      {responseStatus === 'pending' && (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 응답 버튼 */}
          {!hasResponded && !isResponding && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={onAccept}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                동의
              </Button>
              <Button
                onClick={onReject}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-1" />
                거부
              </Button>
            </div>
          )}

          {isResponding && (
            <div className="text-center pt-2">
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>응답 처리 중...</span>
              </div>
            </div>
          )}

          {hasResponded && !isResponding && (
            <div className="text-center pt-2">
              <Badge variant="outline" className="text-sm">
                이미 응답했습니다
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

