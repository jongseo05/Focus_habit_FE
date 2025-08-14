'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { 
  Sword, 
  Timer, 
  Trophy, 
  Target, 
  X, 
  Minimize2, 
  Maximize2,
  Crown,
  Coffee,
  TrendingUp
} from 'lucide-react'
import type { 
  Challenge, 
  ChallengeConfig, 
  ChallengeParticipant,
  ChallengeTick 
} from '@/types/social'

interface ChallengeHUDProps {
  challenge: Challenge
  participants: ChallengeParticipant[]
  currentUserId: string
  currentFocusScore?: number
  currentScores?: {[key: string]: number}
  onClose?: () => void
  onMinimize?: () => void
  isMinimized?: boolean
}

interface ParticipantWithUser extends ChallengeParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

export function ChallengeHUD({ 
  challenge, 
  participants, 
  currentUserId, 
  currentFocusScore = 0,
  currentScores: externalScores = {},
  onClose, 
  onMinimize, 
  isMinimized = false 
}: ChallengeHUDProps) {

  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isBreakTime, setIsBreakTime] = useState(false)
  const [rankings, setRankings] = useState<Array<{userId: string, score: number, rank: number}>>([])
  const [isExpanded, setIsExpanded] = useState(false)

  // 시간 계산
  const calculateTimeLeft = useCallback(() => {
    if (!challenge.start_at) return 0
    
    const startTime = new Date(challenge.start_at).getTime()
    const now = new Date().getTime()
    const elapsed = Math.floor((now - startTime) / 1000) // 초 단위
    

    
    if (challenge.mode === 'pomodoro' && challenge.config?.work) {
      const workDuration = challenge.config.work * 60 // 분을 초로
      const breakDuration = (challenge.config?.break || 5) * 60
      const totalCycle = workDuration + breakDuration
      

      
      if (elapsed < workDuration) {
        // 공부 시간
        setIsBreakTime(false)
        const remaining = workDuration - elapsed
        return remaining
      } else if (elapsed < totalCycle) {
        // 휴식 시간
        setIsBreakTime(true)
        const remaining = totalCycle - elapsed
        return remaining
      } else {
        // 사이클 완료
        return 0
      }
    } else if (challenge.mode === 'custom' && challenge.config?.durationMin) {
      const totalDuration = challenge.config.durationMin * 60
      const remaining = Math.max(0, totalDuration - elapsed)
      return remaining
    }
    
    return 0
  }, [challenge])

  // 타이머 업데이트
  useEffect(() => {
    const updateTimer = () => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)
      
      if (remaining <= 0) {
        // 챌린지 종료
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [calculateTimeLeft])

  // 실시간 점수 업데이트 - 외부에서 전달받은 점수 사용
  useEffect(() => {
    if (challenge.state === 'active') {
      // 외부에서 전달받은 점수 사용
      const allScores = { ...externalScores }
      
      // 현재 사용자의 점수가 없으면 집중도 점수로 설정
      if (!allScores[currentUserId] && currentFocusScore > 0) {
        allScores[currentUserId] = currentFocusScore
      }
      
      // 순위 계산
      const sortedRankings = Object.entries(allScores)
        .map(([userId, score]) => ({ userId, score: score as number }))
        .sort((a, b) => b.score - a.score)
        .map((item, index) => ({ ...item, rank: index + 1 }))
      
      setRankings(sortedRankings)
      console.log('순위 업데이트:', sortedRankings)
    }
  }, [challenge.state, currentFocusScore, currentUserId, externalScores])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getCurrentUserRank = () => {
    return rankings.find(r => r.userId === currentUserId)?.rank || 0
  }

  const getCurrentUserScore = () => {
    // 현재 사용자의 점수 반환 - 외부 점수 사용
    const score = externalScores[currentUserId] || 0
    console.log('현재 사용자 점수:', { 
      currentUserId, 
      score, 
      externalScores, 
      currentFocusScore,
      hasExternalScores: Object.keys(externalScores).length > 0,
      externalScoresKeys: Object.keys(externalScores)
    })
    return score
  }

  // 최소화된 상태
  if (isMinimized) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <Card className="w-64 bg-white/95 backdrop-blur-sm border-blue-200 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sword className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">집중도 대결</span>
                {isBreakTime && <Coffee className="h-3 w-3 text-orange-500" />}
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={isBreakTime ? "secondary" : "destructive"} className="text-xs">
                  <Timer className="h-3 w-3 mr-1" />
                  {formatTime(timeLeft)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(true)}
                  className="h-6 w-6 p-0"
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 확장된 상태
  return (
    <div className="fixed top-4 right-4 z-50">
      <Card className={`bg-white/95 backdrop-blur-sm border-blue-200 shadow-lg transition-all duration-300 ${
        isExpanded ? 'w-80' : 'w-64'
      }`}>
        <CardContent className="p-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sword className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-800">⚔️ 집중도 대결</span>
              {isBreakTime && (
                <Badge variant="outline" className="text-xs">
                  <Coffee className="h-3 w-3 mr-1" />
                  휴식
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* 타이머 */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <Badge variant={isBreakTime ? "secondary" : "destructive"} className="text-sm">
                <Timer className="h-4 w-4 mr-1" />
                {formatTime(timeLeft)}
              </Badge>
              <span className="text-xs text-gray-500">
                {isBreakTime ? '휴식 시간' : '공부 시간'}
              </span>
            </div>
          </div>

          {/* 현재 사용자 정보 */}
          <div className="mb-3 p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                    Me
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">나</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-blue-700">
                  {getCurrentUserScore()}점
                </div>
                <div className="text-xs text-gray-500">
                  {getCurrentUserRank() > 0 ? `${getCurrentUserRank()}위` : '순위 없음'}
                </div>
              </div>
            </div>
          </div>

          {/* 확장된 순위 표시 */}
          {isExpanded && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <TrendingUp className="h-4 w-4" />
                실시간 순위
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {rankings.slice(0, 5).map((rank, index) => {
                  const participant = participants.find(p => p.user_id === rank.userId)
                  if (!participant) return null
                  
                  return (
                    <div 
                      key={rank.userId}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        rank.userId === currentUserId 
                          ? 'bg-blue-100 border border-blue-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-400 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-300 text-gray-700'
                        }`}>
                          {index === 0 ? <Crown className="h-3 w-3" /> : rank.rank}
                        </div>
                                                  <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {rank.userId === currentUserId ? 'M' : 'U'}
                            </AvatarFallback>
                          </Avatar>
                        <span className="text-xs font-medium truncate max-w-16">
                          {rank.userId === currentUserId ? '나' : `사용자 ${rank.userId.slice(0, 4)}`}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-blue-700">
                        {rank.score}점
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

                     {/* 진행 상태 표시 */}
           <div className="mt-3 pt-2 border-t border-gray-200">
             <div className="flex items-center justify-between text-xs text-gray-500">
                               <span>
                  {challenge.mode === 'pomodoro' 
                    ? `🍅 ${challenge.config?.work || 25}분 공부 + ${challenge.config?.break || 5}분 휴식 (총 ${(challenge.config?.work || 25) + (challenge.config?.break || 5)}분)`
                    : `⚙️ ${challenge.config?.durationMin || 0}분 커스텀`
                  }
                </span>
               <span>{participants.length}명 참가</span>
             </div>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
