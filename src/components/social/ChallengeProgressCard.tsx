'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Target, Clock, Users, TrendingUp, Calendar, Star, Zap, Award, Flag, Crown, Medal } from 'lucide-react'
import { useGroupChallenge } from '@/hooks/useGroupChallenge'
import type { GroupChallenge } from '@/types/social'

interface ChallengeProgress {
  challenge_id: string
  goal_type: string
  goal_value: number
  total_progress: number
  average_progress: number
  progress_percentage: number
  user_progress: number
  participants_count: number
  participants: Array<{
    user_id: string
    name: string
    avatar_url?: string
    current_progress: number
    joined_at: string
  }>
}

interface ChallengeProgressCardProps {
  className?: string
}

export function ChallengeProgressCard({ className }: ChallengeProgressCardProps) {
  const { myChallenges, loading, getActiveChallenges } = useGroupChallenge()
  const [activeChallenges, setActiveChallenges] = useState<GroupChallenge[]>([])
  const [challengeProgresses, setChallengeProgresses] = useState<{ [key: string]: ChallengeProgress }>({})
  const [progressLoading, setProgressLoading] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    const challenges = getActiveChallenges()
    setActiveChallenges(challenges)
  }, [myChallenges, getActiveChallenges])

  // 각 챌린지의 진행 상황을 가져오기
  useEffect(() => {
    const fetchChallengeProgresses = async () => {
      for (const challenge of activeChallenges) {
        if (!challengeProgresses[challenge.challenge_id] && !progressLoading[challenge.challenge_id]) {
          setProgressLoading(prev => ({ ...prev, [challenge.challenge_id]: true }))
          
          try {
            console.log(`챌린지 ${challenge.challenge_id} 진행 상황 조회 시작`)
            const response = await fetch(`/api/social/group-challenge/progress?challenge_id=${challenge.challenge_id}`)
            
            if (response.ok) {
              const data = await response.json()
              if (data.success) {
                console.log(`챌린지 ${challenge.challenge_id} 진행 상황 조회 성공:`, data.challenge_progress)
                setChallengeProgresses(prev => ({
                  ...prev,
                  [challenge.challenge_id]: data.challenge_progress
                }))
              } else {
                console.error(`챌린지 ${challenge.challenge_id} 응답 실패:`, data.error)
              }
            } else {
              const errorData = await response.json().catch(() => ({}))
              console.error(`챌린지 ${challenge.challenge_id} HTTP 오류:`, response.status, errorData)
            }
          } catch (error) {
            console.error(`챌린지 ${challenge.challenge_id} 진행 상황 조회 실패:`, error)
          } finally {
            setProgressLoading(prev => ({ ...prev, [challenge.challenge_id]: false }))
          }
        }
      }
    }

    if (activeChallenges.length > 0) {
      console.log('활성 챌린지들에 대한 진행 상황 조회 시작:', activeChallenges.length)
      fetchChallengeProgresses()
    }
  }, [activeChallenges, challengeProgresses, progressLoading])

  const getGoalTypeInfo = (challenge: GroupChallenge) => {
    switch (challenge.goal_type) {
      case 'total_hours':
        return {
          icon: Zap,
          label: '총 학습 시간',
          unit: '시간',
          color: 'text-orange-600'
        }
      case 'total_sessions':
        return {
          icon: Target,
          label: '총 세션 수',
          unit: '회',
          color: 'text-green-600'
        }
      case 'average_focus_score':
        return {
          icon: TrendingUp,
          label: '평균 집중도',
          unit: '점',
          color: 'text-purple-600'
        }
      default:
        return {
          icon: Star,
          label: '목표',
          unit: '',
          color: 'text-yellow-600'
        }
    }
  }

  const getProgressPercentage = (challenge: GroupChallenge) => {
    const progress = challengeProgresses[challenge.challenge_id]
    if (progress) {
      return Math.round(progress.progress_percentage)
    }
    return 0
  }

  const getRemainingDays = (endDate: string) => {
    const now = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Trophy className="w-5 h-5 text-yellow-500" />
            도전 과제
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (activeChallenges.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Trophy className="w-5 h-5 text-yellow-500" />
            도전 과제
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">진행 중인 챌린지가 없습니다</h3>
            <p className="text-sm text-gray-500 mb-4">
              새로운 챌린지에 참가하거나 챌린지를 생성해보세요
            </p>
            <Button 
              variant="outline" 
              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              onClick={() => window.location.href = '/social'}
            >
              챌린지 보기
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Trophy className="w-5 h-5 text-yellow-500" />
            도전 과제
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            onClick={() => window.location.href = '/social?tab=challenges'}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            상세 보기
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeChallenges.slice(0, 3).map((challenge) => {
          const goalInfo = getGoalTypeInfo(challenge)
          const Icon = goalInfo.icon
          const progress = getProgressPercentage(challenge)
          const remainingDays = getRemainingDays(challenge.ends_at)
          const challengeProgress = challengeProgresses[challenge.challenge_id]
          const isLoading = progressLoading[challenge.challenge_id]
          
          return (
            <div key={challenge.challenge_id} className="space-y-3 p-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between">
                                 <div className="flex items-center gap-3">
                   <div className={`p-1.5 rounded-full bg-${goalInfo.color.replace('text-', '')} bg-opacity-10`}>
                     <Icon className={`h-4 w-4 ${goalInfo.color}`} />
                   </div>
                                     <div className="flex-1">
                     <h4 className="font-semibold text-slate-900 text-sm">{challenge.name}</h4>
                     <p className="text-xs text-slate-600">{challenge.description}</p>
                   </div>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 h-auto"
                     onClick={() => window.location.href = '/social?tab=challenges'}
                   >
                     상세보기
                   </Button>
                </div>
                <div className="text-right">
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${remainingDays <= 3 ? 'border-red-300 text-red-600' : 'border-green-300 text-green-600'}`}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {remainingDays}일 남음
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{goalInfo.label}</span>
                  <span className="font-semibold text-slate-900">
                    {isLoading ? '...' : `${progress}%`}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>목표: {challenge.goal_value} {goalInfo.unit}</span>
                                                   <div className="flex items-center gap-1">
                   <Users className="h-3 w-3 text-slate-500" />
                   <span>
                     {isLoading ? '로딩 중...' : 
                      challengeProgress ? 
                        `${challengeProgress.participants_count}명 참가` : 
                        '진행 중'}
                   </span>
                 </div>
                </div>
                

              </div>

              {remainingDays <= 3 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 text-center">
                  ⏰ 마감이 임박했습니다! 서둘러 목표를 달성해보세요
                </div>
              )}
            </div>
          )
        })}

        {activeChallenges.length > 3 && (
          <div className="text-center pt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-700"
              onClick={() => window.location.href = '/social'}
            >
              더 많은 챌린지 보기 ({activeChallenges.length - 3}개 더)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
