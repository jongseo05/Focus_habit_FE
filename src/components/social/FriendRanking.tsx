'use client'

import { useState } from 'react'
import { useFriendRanking } from '@/hooks/useSocial'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Award, Calendar, TrendingUp } from 'lucide-react'

export function FriendRanking() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  
  const { data: rankingData, isLoading, error } = useFriendRanking(period)

  const getPeriodText = (period: string) => {
    switch (period) {
      case 'daily':
        return '오늘'
      case 'weekly':
        return '이번 주'
      case 'monthly':
        return '이번 달'
      default:
        return '이번 주'
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Award className="h-5 w-5 text-orange-500" />
      default:
        return <span className="text-sm font-bold text-gray-600">#{rank}</span>
    }
  }

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 2:
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 3:
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const formatFocusTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            친구 랭킹
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            친구 랭킹
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">친구 랭킹을 불러오는데 실패했습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            친구 랭킹
          </CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={period === 'daily' ? 'default' : 'outline'}
              onClick={() => setPeriod('daily')}
            >
              일간
            </Button>
            <Button
              size="sm"
              variant={period === 'weekly' ? 'default' : 'outline'}
              onClick={() => setPeriod('weekly')}
            >
              주간
            </Button>
            <Button
              size="sm"
              variant={period === 'monthly' ? 'default' : 'outline'}
              onClick={() => setPeriod('monthly')}
            >
              월간
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          {getPeriodText(period)} 집중도 랭킹
          {rankingData?.user_rank && (
            <span className="ml-2 text-blue-600 font-medium">
              내 순위: {rankingData.user_rank}위
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {rankingData?.rankings && rankingData.rankings.length > 0 ? (
          <div className="space-y-3">
            {rankingData.rankings.map((ranking) => (
              <div
                key={ranking.user_id}
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  ranking.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8">
                      {getRankIcon(ranking.rank)}
                    </div>
                    <Badge className={getRankBadgeColor(ranking.rank)}>
                      {ranking.rank}위
                    </Badge>
                  </div>
                  
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={ranking.avatar_url} alt={ranking.display_name} />
                    <AvatarFallback>
                      {ranking.display_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h4 className="font-medium">{ranking.display_name}</h4>
                    <p className="text-sm text-gray-500">
                      @{ranking.handle}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-semibold text-blue-600">
                    {formatFocusTime(ranking.total_focus_time)}
                  </div>
                  <div className="text-sm text-gray-500">
                    평균 집중도: {ranking.average_focus_score}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {getPeriodText(period)} 랭킹 데이터가 없습니다.
            </p>
            <p className="text-sm text-gray-400">
              친구들과 함께 집중해보세요!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
