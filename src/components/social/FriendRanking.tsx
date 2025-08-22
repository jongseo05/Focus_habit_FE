'use client'

import { useState } from 'react'
import { useFriendRanking } from '@/hooks/useSocial'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { 
  Trophy, 
  Medal, 
  Clock, 
  TrendingUp, 
  Users,
  Calendar,
  Target,
  UserPlus
} from 'lucide-react'

interface FriendRankingProps {
  className?: string
}

export function FriendRanking({ className }: FriendRankingProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const { data: rankingData, isLoading, error } = useFriendRanking(period)

  // 디버깅을 위한 로그
  console.log('FriendRanking 컴포넌트:', { rankingData, isLoading, error })

  // API 응답 구조에 맞게 데이터 추출
  const rankings = rankingData?.rankings || []
  const totalCount = rankingData?.total_count || 0
  const periodStart = rankingData?.period_start
  const periodEnd = rankingData?.period_end

  const getPeriodText = (period: string) => {
    switch (period) {
      case 'weekly':
        return '이번 주'
      case 'monthly':
        return '이번 달'
      default:
        return '이번 주'
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
    return <Target className="w-4 h-4 text-gray-400" />
  }

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-200'
    if (rank === 3) return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-blue-100 text-blue-800 border-blue-200'
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">친구 랭킹</h3>
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="w-8 h-8 bg-gray-200 animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 animate-pulse rounded w-24" />
                <div className="h-3 bg-gray-200 animate-pulse rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">친구 랭킹</h3>
        </div>
        <div className="p-4 text-center text-gray-500">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>랭킹을 불러오는데 실패했습니다.</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  if (!rankings || rankings.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">친구 랭킹</h3>
          <Select value={period} onValueChange={(value: 'weekly' | 'monthly') => setPeriod(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">주간</SelectItem>
              <SelectItem value="monthly">월간</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-8 text-center text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">친구가 존재하지 않습니다!</h4>
          <p className="text-sm text-gray-500 mb-4">친구를 추가하면 함께 랭킹을 비교할 수 있어요</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.location.href = '/social/friends'}
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            친구 추가하기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">친구 랭킹</h3>
        <Select value={period} onValueChange={(value: 'weekly' | 'monthly') => setPeriod(value)}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">주간</SelectItem>
            <SelectItem value="monthly">월간</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        {getPeriodText(period)} 랭킹 ({totalCount}명)
      </div>

      <div className="space-y-3">
        {rankings.map((ranking: any, index: number) => (
          <div
            key={ranking.user_id}
            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
              index < 3 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2 min-w-[60px]">
              {getRankIcon(ranking.rank)}
              <Badge className={getRankBadgeColor(ranking.rank)}>
                {ranking.rank}위
              </Badge>
            </div>
            
            <Avatar className="h-10 w-10">
              <AvatarImage src={ranking.avatar_url} alt={ranking.display_name} />
              <AvatarFallback>
                {ranking.display_name?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">
                {ranking.display_name}
              </h4>
              {ranking.handle && (
                <p className="text-sm text-gray-500">@{ranking.handle}</p>
              )}
            </div>
            
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="font-medium">{ranking.average_focus_score}점</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{formatTime(ranking.total_focus_time)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {periodStart && periodEnd && (
        <div className="text-xs text-gray-400 text-center pt-2 border-t">
          {new Date(periodStart).toLocaleDateString('ko-KR')} ~ {new Date(periodEnd).toLocaleDateString('ko-KR')}
        </div>
      )}
    </div>
  )
}
