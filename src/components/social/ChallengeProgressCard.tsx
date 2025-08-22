'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Target, Clock, Users, TrendingUp, Calendar, Star, Zap, Award, Flag, Crown, Medal, Plus } from 'lucide-react'
import { usePersonalChallenges } from '@/hooks/usePersonalChallenges'
import type { PersonalChallenge } from '@/types/social'
import Link from 'next/link'

interface ChallengeProgressCardProps {
  className?: string
}

export default function ChallengeProgressCard({ className }: ChallengeProgressCardProps) {
  const { challenges, loading, error, updateProgress, refreshChallenges } = usePersonalChallenges()
  const [activeChallenges, setActiveChallenges] = useState<PersonalChallenge[]>([])

  // 활성 챌린지 필터링
  useEffect(() => {
    if (challenges && challenges.length > 0) {
      const active = challenges.filter(challenge => 
        challenge.is_active && !challenge.is_completed
      )
      setActiveChallenges(active)
    }
  }, [challenges])

  const getGoalTypeInfo = (challenge: PersonalChallenge) => {
    switch (challenge.type) {
      case 'focus_time':
        return {
          icon: Zap,
          label: '집중 시간',
          unit: '분',
          color: 'text-orange-600'
        }
      case 'study_sessions':
        return {
          icon: Clock,
          label: '공부 세션',
          unit: '회',
          color: 'text-blue-600'
        }
      case 'streak_days':
        return {
          icon: Calendar,
          label: '연속 달성',
          unit: '일',
          color: 'text-green-600'
        }
      case 'focus_score':
        return {
          icon: Star,
          label: '집중도 점수',
          unit: '점',
          color: 'text-purple-600'
        }
      case 'custom':
        return {
          icon: Target,
          label: '커스텀',
          unit: challenge.unit || '',
          color: 'text-gray-600'
        }
      default:
        return {
          icon: Target,
          label: '목표',
          unit: challenge.unit || '',
          color: 'text-gray-600'
        }
    }
  }

  const getProgressPercentage = (challenge: PersonalChallenge) => {
    if (challenge.target_value === 0) return 0
    return Math.min((challenge.current_value / challenge.target_value) * 100, 100)
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            개인 챌린지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            개인 챌린지
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-slate-500">
            <Target className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium mb-1">챌린지를 불러올 수 없습니다</p>
            <p className="text-xs mb-3">잠시 후 다시 시도해주세요</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            개인 챌린지
          </div>
          <Link href="/social/challenge">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              새 챌린지
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeChallenges.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Target className="h-12 w-12 mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium mb-1">아직 챌린지가 없습니다</p>
            <p className="text-xs mb-4">새로운 목표를 설정하고 달성해보세요!</p>
            <Link href="/social/challenge">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                첫 번째 챌린지 만들기
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeChallenges.slice(0, 3).map((challenge) => {
              const goalInfo = getGoalTypeInfo(challenge)
              const progressPercentage = getProgressPercentage(challenge)
              const IconComponent = goalInfo.icon

              return (
                <div
                  key={challenge.id}
                  className="p-4 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <IconComponent className={`h-4 w-4 ${goalInfo.color}`} />
                        <h4 className="font-medium text-sm text-slate-900">{challenge.title}</h4>
                      </div>
                      {challenge.description && (
                        <p className="text-xs text-slate-600 mb-2">{challenge.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>목표: {
                          challenge.type === 'focus_time' && challenge.unit === '분' && challenge.target_value >= 60
                            ? `${(challenge.target_value / 60).toFixed(1)}시간`
                            : `${challenge.target_value} ${challenge.unit}`
                        }</span>
                        <span>현재: {
                          challenge.type === 'focus_time' && challenge.unit === '분' && challenge.current_value >= 60
                            ? `${(challenge.current_value / 60).toFixed(1)}시간`
                            : `${challenge.current_value} ${challenge.unit}`
                        }</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {challenge.is_active ? '진행중' : '완료'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">진행률</span>
                      <span className="font-medium">{Math.round(progressPercentage)}%</span>
                    </div>
                    
                    <Progress value={progressPercentage} className="h-2" />
                    
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>시작: {formatDate(challenge.start_date)}</span>
                      <span>종료: {formatDate(challenge.end_date)}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {activeChallenges.length > 3 && (
              <div className="text-center pt-2">
                <Link 
                  href="/social/challenge" 
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  모든 챌린지 보기 →
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
