'use client'

import { useState } from 'react'
import { useFriendComparison, useFriendsList } from '@/hooks/useSocial'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  Clock, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  Users,
  Trophy
} from 'lucide-react'

export function FriendComparison() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [selectedFriendId, setSelectedFriendId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'focus_time' | 'focus_score'>('focus_time')
  
  const { data: friendsList } = useFriendsList()
  const { data: comparisonData, isLoading, error } = useFriendComparison(period, selectedFriendId === 'all' ? undefined : selectedFriendId)

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

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  const formatDiff = (diff: number, unit: string = '') => {
    const absValue = Math.abs(diff)
    const sign = diff > 0 ? '+' : diff < 0 ? '-' : ''
    
    if (unit === 'time') {
      return `${sign}${formatTime(absValue)}`
    }
    
    return `${sign}${absValue}${unit}`
  }

  const getDiffIcon = (diff: number) => {
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (diff < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getDiffColor = (diff: number) => {
    if (diff > 0) return 'text-green-600'
    if (diff < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            친구 비교
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
            <BarChart3 className="h-5 w-5" />
            친구 비교
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">친구 비교 데이터를 불러오는데 실패했습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 컨트롤 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            친구 비교
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 기간 선택 */}
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

            {/* 친구 선택 */}
            <Select value={selectedFriendId} onValueChange={setSelectedFriendId}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="친구 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 친구</SelectItem>
                {friendsList?.friends?.map((friend: any) => (
                  <SelectItem key={friend.friend_id} value={friend.friend_id}>
                    {friend.friend_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {comparisonData && (
        <>
          {/* 내 통계 개요 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {getPeriodText(period)} 내 성과
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatTime(comparisonData.user_stats?.total_focus_time || 0)}
                  </div>
                  <div className="text-sm text-gray-500">총 집중 시간</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {comparisonData.user_stats?.average_focus_score || 0}%
                  </div>
                  <div className="text-sm text-gray-500">평균 집중도</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {comparisonData.user_stats?.total_sessions || 0}
                  </div>
                  <div className="text-sm text-gray-500">총 세션 수</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {comparisonData.user_stats?.user_rank || 0}위
                  </div>
                  <div className="text-sm text-gray-500">내 순위</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 1:1 비교 (특정 친구 선택 시) */}
          {selectedFriendId !== 'all' && comparisonData.comparisons?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  1:1 비교
                </CardTitle>
              </CardHeader>
              <CardContent>
                {comparisonData.comparisons.map((comparison: any) => (
                  <div key={comparison.friend_profile.user_id} className="space-y-4">
                    {/* 친구 정보 */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={comparison.friend_profile.avatar_url} alt={comparison.friend_profile.display_name} />
                        <AvatarFallback>
                          {comparison.friend_profile.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{comparison.friend_profile.display_name}</h4>
                        <p className="text-sm text-gray-500">@{comparison.friend_profile.handle}</p>
                      </div>
                    </div>

                    {/* 비교 메트릭 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <div className="flex items-center gap-1">
                            {getDiffIcon(comparison.comparison?.focus_time_diff || 0)}
                            <span className={`text-sm font-medium ${getDiffColor(comparison.comparison?.focus_time_diff || 0)}`}>
                              {formatDiff(comparison.comparison?.focus_time_diff || 0, 'time')}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">집중 시간</div>
                        <div className="text-xs text-gray-500 mt-1">
                          나: {formatTime(comparison.user_stats?.total_focus_time || 0)} | 
                          친구: {formatTime(comparison.friend_stats?.total_focus_time || 0)}
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Target className="h-4 w-4 text-green-500" />
                          <div className="flex items-center gap-1">
                            {getDiffIcon(comparison.comparison?.focus_score_diff || 0)}
                            <span className={`text-sm font-medium ${getDiffColor(comparison.comparison?.focus_score_diff || 0)}`}>
                              {formatDiff(comparison.comparison?.focus_score_diff || 0, '%')}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">집중도</div>
                        <div className="text-xs text-gray-500 mt-1">
                          나: {comparison.user_stats?.average_focus_score || 0}% | 
                          친구: {comparison.friend_stats?.average_focus_score || 0}%
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          <div className="flex items-center gap-1">
                            {getDiffIcon(comparison.comparison?.sessions_diff || 0)}
                            <span className={`text-sm font-medium ${getDiffColor(comparison.comparison?.sessions_diff || 0)}`}>
                              {formatDiff(comparison.comparison?.sessions_diff || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">세션 수</div>
                        <div className="text-xs text-gray-500 mt-1">
                          나: {comparison.user_stats?.total_sessions || 0} | 
                          친구: {comparison.friend_stats?.total_sessions || 0}
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Trophy className="h-4 w-4 text-orange-500" />
                          <div className="flex items-center gap-1">
                            {getDiffIcon(comparison.comparison?.completion_rate_diff || 0)}
                            <span className={`text-sm font-medium ${getDiffColor(comparison.comparison?.completion_rate_diff || 0)}`}>
                              {formatDiff(comparison.comparison?.completion_rate_diff || 0, '%')}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">완료율</div>
                        <div className="text-xs text-gray-500 mt-1">
                          나: {comparison.user_stats?.completion_rate || 0}% | 
                          친구: {comparison.friend_stats?.completion_rate || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 주간 친구 랭킹 (전체 친구 비교 시) */}
          {selectedFriendId === 'all' && comparisonData.top_friends?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  주간 친구 랭킹
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'focus_time' | 'focus_score')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="focus_time" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      집중 세션 시간
                    </TabsTrigger>
                    <TabsTrigger value="focus_score" className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      평균 집중도
                    </TabsTrigger>
                  </TabsList>

                                     <TabsContent value="focus_time" className="mt-6">
                     <div className="space-y-3">
                       {comparisonData.top_friends
                         .sort((a: any, b: any) => (b.stats?.total_focus_time || 0) - (a.stats?.total_focus_time || 0))
                         .map((friend: any, index: number) => (
                           <div
                             key={friend.friend_profile?.user_id}
                             className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                               index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' : 'hover:bg-gray-50'
                             }`}
                           >
                             <div className="flex items-center gap-3">
                               <Badge className={index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}>
                                 {index + 1}위
                               </Badge>
                               
                               <Avatar className="h-8 w-8">
                                 <AvatarImage src={friend.friend_profile?.avatar_url} alt={friend.friend_profile?.display_name} />
                                 <AvatarFallback>
                                   {friend.friend_profile?.display_name === '나' ? '나' : friend.friend_profile?.display_name?.charAt(0).toUpperCase()}
                                 </AvatarFallback>
                               </Avatar>
                              
                              <div>
                                <h4 className="text-sm font-medium">
                                  {friend.friend_profile?.user_id === comparisonData.user_stats?.user_id ? '나' : friend.friend_profile?.display_name}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {friend.friend_profile?.user_id === comparisonData.user_stats?.user_id ? '내 프로필' : `@${friend.friend_profile?.handle}`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm font-semibold text-blue-600">
                                {formatTime(friend.stats?.total_focus_time || 0)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {friend.stats?.total_sessions || 0}세션
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </TabsContent>

                                     <TabsContent value="focus_score" className="mt-6">
                     <div className="space-y-3">
                       {comparisonData.top_friends
                         .sort((a: any, b: any) => (b.stats?.average_focus_score || 0) - (a.stats?.average_focus_score || 0))
                         .map((friend: any, index: number) => (
                           <div
                             key={friend.friend_profile?.user_id}
                             className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                               index < 3 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'hover:bg-gray-50'
                             }`}
                           >
                             <div className="flex items-center gap-3">
                               <Badge className={index < 3 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                                 {index + 1}위
                               </Badge>
                               
                               <Avatar className="h-8 w-8">
                                 <AvatarImage src={friend.friend_profile?.avatar_url} alt={friend.friend_profile?.display_name} />
                                 <AvatarFallback>
                                   {friend.friend_profile?.display_name === '나' ? '나' : friend.friend_profile?.display_name?.charAt(0).toUpperCase()}
                                 </AvatarFallback>
                               </Avatar>
                              
                              <div>
                                <h4 className="text-sm font-medium">
                                  {friend.friend_profile?.user_id === comparisonData.user_stats?.user_id ? '나' : friend.friend_profile?.display_name}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  {friend.friend_profile?.user_id === comparisonData.user_stats?.user_id ? '내 프로필' : `@${friend.friend_profile?.handle}`}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <div className="text-sm font-semibold text-green-600">
                                {friend.stats?.average_focus_score || 0}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatTime(friend.stats?.total_focus_time || 0)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
