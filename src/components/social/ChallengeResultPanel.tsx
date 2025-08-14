'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Trophy, 
  Crown, 
  Medal, 
  Award, 
  Target, 
  Clock, 
  Users, 
  X,
  Share2,
  Download,
  RefreshCw,
  TrendingUp
} from 'lucide-react'
import type { 
  Challenge, 
  ChallengeParticipant,
  ChallengeTick 
} from '@/types/social'

interface ChallengeResultPanelProps {
  challenge: Challenge
  participants: ChallengeParticipant[]
  finalScores: {[key: string]: number}
  badges: {[key: string]: string[]}
  onClose?: () => void
  onRestart?: () => void
  onShare?: () => void
}

interface ParticipantWithUser extends ChallengeParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

export function ChallengeResultPanel({ 
  challenge, 
  participants, 
  finalScores, 
  badges, 
  onClose, 
  onRestart, 
  onShare 
}: ChallengeResultPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // 순위 계산
  const rankings = Object.entries(finalScores)
    .map(([userId, score]) => ({ userId, score }))
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const winner = rankings[0]
  const winnerParticipant = participants.find(p => p.user_id === winner?.userId)

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="h-5 w-5 text-yellow-500" />
      case 2: return <Medal className="h-5 w-5 text-gray-400" />
      case 3: return <Award className="h-5 w-5 text-amber-600" />
      default: return <Trophy className="h-4 w-4 text-gray-500" />
    }
  }

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-50 border-yellow-200 text-yellow-800'
      case 2: return 'bg-gray-50 border-gray-200 text-gray-800'
      case 3: return 'bg-amber-50 border-amber-200 text-amber-800'
      default: return 'bg-white border-gray-200 text-gray-700'
    }
  }

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return '🥇 1위'
      case 2: return '🥈 2위'
      case 3: return '🥉 3위'
      default: return `${rank}위`
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  const getChallengeDuration = () => {
    if (challenge.mode === 'pomodoro' && challenge.config.work) {
      return challenge.config.work + (challenge.config.break || 5)
    } else if (challenge.mode === 'custom' && challenge.config.durationMin) {
      return challenge.config.durationMin
    }
    return 0
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6" />
              🏆 집중도 대결 결과
            </CardTitle>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {/* 우승자 섹션 */}
          {winner && winnerParticipant && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-4 border-yellow-400">
                    <AvatarImage src={winnerParticipant.user?.avatar_url} />
                    <AvatarFallback className="text-2xl bg-yellow-100 text-yellow-600">
                      {winnerParticipant.user?.name?.charAt(0) || 'W'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -top-2 -right-2">
                    <Crown className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  🎉 {winnerParticipant.user?.name || 'Unknown'} 님 우승!
                </h3>
                <p className="text-gray-600 mt-1">
                  {Math.round(winner.score)}점으로 1위를 차지했습니다
                </p>
              </div>
            </div>
          )}

          {/* 대결 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto text-blue-600 mb-1" />
              <div className="text-sm font-medium text-blue-800">
                {formatDuration(getChallengeDuration())}
              </div>
              <div className="text-xs text-blue-600">총 시간</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <Users className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <div className="text-sm font-medium text-green-800">
                {participants.length}명
              </div>
              <div className="text-xs text-green-600">참가자</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <Target className="h-5 w-5 mx-auto text-purple-600 mb-1" />
              <div className="text-sm font-medium text-purple-800">
                {challenge.mode === 'pomodoro' ? '뽀모도로' : '커스텀'}
              </div>
              <div className="text-xs text-purple-600">모드</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <Trophy className="h-5 w-5 mx-auto text-orange-600 mb-1" />
              <div className="text-sm font-medium text-orange-800">
                {Math.round(Math.max(...Object.values(finalScores)))}점
              </div>
              <div className="text-xs text-orange-600">최고 점수</div>
            </div>
          </div>

          {/* 전체 순위 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              전체 순위
            </h4>
            <div className="space-y-2">
              {rankings.map((rank) => {
                const participant = participants.find(p => p.user_id === rank.userId)
                if (!participant) return null

                return (
                  <div 
                    key={rank.userId}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                      getRankColor(rank.rank)
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getRankIcon(rank.rank)}
                        <Badge variant="outline" className="text-xs">
                          {getRankBadge(rank.rank)}
                        </Badge>
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.user?.avatar_url} />
                        <AvatarFallback className="text-sm">
                          {participant.user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{participant.user?.name || 'Unknown'}</div>
                        {badges[rank.userId] && badges[rank.userId].length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {badges[rank.userId].slice(0, 3).map((badge, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-blue-700">
                        {Math.round(rank.score)}점
                      </div>
                      <div className="text-xs text-gray-500">
                        평균 {Math.round(rank.score / getChallengeDuration())}점/분
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 확장된 통계 */}
          {isExpanded && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900">📊 상세 통계</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">점수 분포</h5>
                  <div className="space-y-1">
                    {rankings.slice(0, 5).map((rank) => {
                      const maxScore = Math.max(...Object.values(finalScores))
                      const percentage = (rank.score / maxScore) * 100
                      return (
                        <div key={rank.userId} className="flex items-center gap-2">
                          <div className="w-16 text-xs text-gray-600">
                            {rank.rank}위
                          </div>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-12 text-xs text-gray-600 text-right">
                            {Math.round(percentage)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">성취 배지</h5>
                  <div className="space-y-1">
                    {Object.entries(badges).map(([userId, userBadges]) => {
                      const participant = participants.find(p => p.user_id === userId)
                      if (!userBadges.length) return null
                      
                      return (
                        <div key={userId} className="text-xs text-gray-600">
                          <span className="font-medium">{participant?.user?.name || 'Unknown'}:</span>
                          {' '}{userBadges.join(', ')}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? '간단히 보기' : '상세 통계'}
              </Button>
              {onShare && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShare}
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  공유
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {onRestart && (
                <Button
                  variant="outline"
                  onClick={onRestart}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  다시 시작
                </Button>
              )}
              <Button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700"
              >
                확인
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
