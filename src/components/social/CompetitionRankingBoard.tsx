'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Trophy, Clock, Users, Target } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface CompetitionParticipant {
  user_id: string
  session_id?: string
  final_score: number
  rank?: number
  user: {
    display_name: string
    avatar_url?: string
  }
}

interface CompetitionState {
  id: string | null
  isActive: boolean
  timeLeft: number
  duration: number
  started_at: string | null
  ended_at: string | null
  participants: CompetitionParticipant[]
  rankings: CompetitionParticipant[]
  host: {
    display_name: string
    user_id: string
  } | null
  winner_id: string | null
  lastUpdated: string | null
}

interface CompetitionRankingBoardProps {
  competition: CompetitionState
  currentUserId?: string
  className?: string
}

export function CompetitionRankingBoard({ 
  competition, 
  currentUserId,
  className = ""
}: CompetitionRankingBoardProps) {
  
  // 시간 포맷팅 함수
  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // 상위 3명 랭킹 표시
  const topRankings = competition.rankings.slice(0, 3)
  const otherRankings = competition.rankings.slice(3)

  // 현재 사용자 위치 찾기
  const currentUserRank = competition.rankings.findIndex(p => p.user_id === currentUserId) + 1

  if (!competition.isActive && !competition.ended_at) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 경쟁 상태 헤더 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              집중도 대결
              {competition.isActive && (
                <Badge variant="default" className="bg-green-500">
                  진행 중
                </Badge>
              )}
              {competition.ended_at && (
                <Badge variant="secondary">
                  종료
                </Badge>
              )}
            </CardTitle>
            
            {competition.isActive && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {formatTimeLeft(competition.timeLeft)}
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {competition.participants.length}명 참가
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              {competition.duration}분 경쟁
            </div>
          </div>
          
          {competition.isActive && (
            <div className="mt-3">
              <div className="flex justify-between text-sm mb-2">
                <span>진행률</span>
                <span>
                  {Math.round(((competition.duration * 60 - competition.timeLeft) / (competition.duration * 60)) * 100)}%
                </span>
              </div>
              <Progress 
                value={((competition.duration * 60 - competition.timeLeft) / (competition.duration * 60)) * 100} 
                className="h-2"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 실시간 순위표 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">실시간 순위</CardTitle>
          {competition.lastUpdated && (
            <p className="text-sm text-muted-foreground">
              마지막 업데이트: {new Date(competition.lastUpdated).toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        
        <CardContent>
          {/* 상위 3명 */}
          <div className="space-y-3 mb-4">
            {topRankings.map((participant, index) => {
              const isCurrentUser = participant.user_id === currentUserId
              const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']
              const rankIcons = ['🥇', '🥈', '🥉']
              
              return (
                <div 
                  key={participant.user_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isCurrentUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-2xl">
                    {rankIcons[index]}
                  </div>
                  
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={participant.user.avatar_url} />
                    <AvatarFallback>
                      {participant.user.display_name?.charAt(0)?.toUpperCase() || 
                       participant.user_id?.slice(-1)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="font-medium">
                      {participant.user.display_name || `사용자-${participant.user_id?.slice(-4) || 'Unknown'}`}
                      {isCurrentUser && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          나
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {index + 1}위
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {Math.round(participant.final_score)}점
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 현재 사용자가 4위 이하인 경우 표시 */}
          {currentUserRank > 3 && currentUserId && (
            <div className="border-t pt-3">
              <div className="text-sm text-muted-foreground mb-2">내 순위</div>
              {(() => {
                const currentUser = competition.rankings.find(p => p.user_id === currentUserId)
                if (!currentUser) return null
                
                return (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full text-sm font-bold">
                      {currentUserRank}
                    </div>
                    
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={currentUser.user.avatar_url} />
                      <AvatarFallback>
                        {currentUser.user.display_name?.charAt(0)?.toUpperCase() || 
                         currentUser.user_id?.slice(-1)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="font-medium">
                        {currentUser.user.display_name || `사용자-${currentUser.user_id?.slice(-4) || 'Unknown'}`}
                        <Badge variant="outline" className="ml-2 text-xs">
                          나
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {currentUserRank}위
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {Math.round(currentUser.final_score)}점
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* 기타 순위 (접기/펼치기 가능) */}
          {otherRankings.length > 0 && currentUserRank <= 3 && (
            <div className="border-t pt-3">
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  {otherRankings.length}명 더 보기
                </summary>
                <div className="mt-3 space-y-2">
                  {otherRankings.map((participant, index) => {
                    const actualRank = index + 4
                    const isCurrentUser = participant.user_id === currentUserId
                    
                    return (
                      <div 
                        key={participant.user_id}
                        className={`flex items-center gap-3 p-2 rounded ${
                          isCurrentUser ? 'bg-blue-50 border border-blue-200' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full text-xs font-medium">
                          {actualRank}
                        </div>
                        
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={participant.user.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {participant.user.display_name?.charAt(0)?.toUpperCase() || 
                             participant.user_id?.slice(-1)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 text-sm">
                          {participant.user.display_name || `사용자-${participant.user_id?.slice(-4) || 'Unknown'}`}
                          {isCurrentUser && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              나
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm font-medium">
                          {Math.round(participant.final_score)}점
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            </div>
          )}

          {/* 우승자 표시 (경쟁 종료 시) */}
          {competition.ended_at && competition.winner_id && (
            <div className="border-t pt-3 mt-3">
              <div className="text-center">
                <div className="text-lg font-bold text-yellow-600 mb-2">
                  🎉 우승자 🎉
                </div>
                {(() => {
                  const winner = competition.rankings[0]
                  return winner ? (
                    <div className="flex items-center justify-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={winner.user.avatar_url} />
                        <AvatarFallback>
                          {winner.user.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold">{winner.user.display_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {Math.round(winner.final_score)}점
                        </div>
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
