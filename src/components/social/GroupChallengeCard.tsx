'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useGroupChallenge } from '@/hooks/useGroupChallenge'
import { 
  Trophy, 
  Clock, 
  Target, 
  Users, 
  Calendar,
  TrendingUp,
  UserPlus,
  CheckCircle
} from 'lucide-react'
import type { GroupChallenge } from '@/types/social'

interface GroupChallengeCardProps {
  challenge: GroupChallenge & {
    created_by_user?: {
      name: string
      avatar_url?: string
    }
    challenge_participants?: Array<{
      user_id: string
      current_progress: number
      joined_at: string
    }>
  }
  showJoinButton?: boolean
  onJoin?: () => void
  currentUserId?: string
}

export function GroupChallengeCard({ 
  challenge, 
  showJoinButton = false, 
  onJoin,
  currentUserId
}: GroupChallengeCardProps) {
  const { joinChallenge, loading } = useGroupChallenge()
  const [isJoining, setIsJoining] = useState(false)

  // 현재 사용자가 이미 참가했는지 확인
  const isAlreadyJoined = currentUserId && challenge.challenge_participants?.some(
    participant => participant.user_id === currentUserId
  )

  const handleJoin = async () => {
    setIsJoining(true)
    const success = await joinChallenge(challenge.challenge_id)
    if (success) {
      onJoin?.()
    }
    setIsJoining(false)
  }

  const getGoalTypeInfo = () => {
    switch (challenge.goal_type) {
      case 'total_hours':
        return {
          icon: <Clock className="h-4 w-4" />,
          label: '총 학습 시간',
          unit: '시간'
        }
      case 'total_sessions':
        return {
          icon: <Target className="h-4 w-4" />,
          label: '총 세션 수',
          unit: '회'
        }
      case 'average_focus_score':
        return {
          icon: <TrendingUp className="h-4 w-4" />,
          label: '평균 집중도',
          unit: '점'
        }
      default:
        return { icon: null, label: '', unit: '' }
    }
  }

  const getStatusInfo = () => {
    const now = new Date()
    const endDate = new Date(challenge.ends_at)
    const isEnded = now > endDate
    const isActive = challenge.is_active && !isEnded

    if (isEnded) {
      return {
        status: 'ended',
        label: '종료됨',
        color: 'bg-gray-100 text-gray-600'
      }
    }

    if (isActive) {
      return {
        status: 'active',
        label: '진행 중',
        color: 'bg-green-100 text-green-700'
      }
    }

    return {
      status: 'inactive',
      label: '비활성',
      color: 'bg-red-100 text-red-700'
    }
  }

  const getRemainingTime = () => {
    const now = new Date()
    const endDate = new Date(challenge.ends_at)
    const diffTime = endDate.getTime() - now.getTime()
    
    if (diffTime <= 0) return '종료됨'
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
    
    if (diffDays > 1) return `${diffDays}일 남음`
    if (diffHours > 1) return `${diffHours}시간 남음`
    return '1시간 미만'
  }

  const goalInfo = getGoalTypeInfo()
  const statusInfo = getStatusInfo()
  const remainingTime = getRemainingTime()
  const participantsCount = challenge.challenge_participants?.length || 0

  // 진행률 계산 (임시로 0%로 설정, 실제로는 API에서 받아와야 함)
  const progress = 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {challenge.name}
            </CardTitle>
            {challenge.description && (
              <p className="text-sm text-gray-600 mt-1">
                {challenge.description}
              </p>
            )}
          </div>
          <Badge className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 목표 정보 */}
        <div className="flex items-center gap-2 text-sm">
          {goalInfo.icon}
          <span className="font-medium">{goalInfo.label}:</span>
          <span>{challenge.goal_value} {goalInfo.unit}</span>
        </div>

        {/* 진행률 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>진행률</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* 참가자 정보 */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>참가자 {participantsCount}명</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{remainingTime}</span>
          </div>
        </div>

        {/* 생성자 정보 */}
        {challenge.created_by_user && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Avatar className="h-6 w-6">
              <AvatarImage src={challenge.created_by_user.avatar_url} />
              <AvatarFallback>
                {challenge.created_by_user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span>생성자: {challenge.created_by_user.name}</span>
          </div>
        )}

        {/* 참가 버튼 또는 참가 상태 */}
        {statusInfo.status === 'active' && (
          <>
            {showJoinButton && !isAlreadyJoined ? (
              <Button
                onClick={handleJoin}
                disabled={loading || isJoining}
                className="w-full"
                size="sm"
              >
                {loading || isJoining ? (
                  '참가 중...'
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    챌린지 참가
                  </>
                )}
              </Button>
            ) : isAlreadyJoined ? (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>참가 중</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
