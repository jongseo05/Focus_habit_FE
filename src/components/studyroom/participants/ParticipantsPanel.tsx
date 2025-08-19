// =====================================================
// 스터디룸 참가자 패널
// =====================================================

'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { 
  Users, 
  Crown, 
  MessageCircle, 
  Trophy, 
  Activity,
  Wifi,
  WifiOff,
  MoreVertical
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStudyRoomContext } from '../core/StudyRoomProvider'
import type { ParticipantWithUser } from '@/types/social'

interface ParticipantsPanelProps {
  onSendEncouragement?: (userId: string, userName: string) => void
  onViewProfile?: (userId: string) => void
}

export function ParticipantsPanel({ onSendEncouragement, onViewProfile }: ParticipantsPanelProps) {
  const { participants, userId, isHost, currentFocusScore } = useStudyRoomContext()
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)

  // 참가자 정렬 (호스트 먼저, 그 다음 집중도 순)
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // 호스트가 먼저
      if (a.is_host && !b.is_host) return -1
      if (!a.is_host && b.is_host) return 1
      
      // 집중도 높은 순
      const aScore = a.current_focus_score || 0
      const bScore = b.current_focus_score || 0
      return bScore - aScore
    })
  }, [participants])

  // 온라인 상태 확인
  const isOnline = (participant: ParticipantWithUser) => {
    if (!participant.last_activity) return false
    const lastActivity = new Date(participant.last_activity).getTime()
    const now = Date.now()
    return now - lastActivity < 60000 // 1분 이내 활동
  }

  // 집중도 점수 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  // 집중도 텍스트 색상
  const getScoreTextColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  // 격려 메시지 전송
  const handleSendEncouragement = (targetUserId: string, userName: string) => {
    if (onSendEncouragement) {
      onSendEncouragement(targetUserId, userName)
    }
  }

  // 사용자 이름 첫 글자 추출 (아바타 폴백용)
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  // 최고 집중도 참가자 찾기
  const topPerformer = useMemo(() => {
    return sortedParticipants.reduce((prev, current) => {
      const prevScore = prev.current_focus_score || 0
      const currentScore = current.current_focus_score || 0
      return currentScore > prevScore ? current : prev
    }, sortedParticipants[0])
  }, [sortedParticipants])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            참가자 ({participants.length}명)
          </div>
          {topPerformer && topPerformer.current_focus_score && topPerformer.current_focus_score > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-600">최고:</span>
              <span className="font-medium">{topPerformer.user.name}</span>
              <span className={`font-bold ${getScoreTextColor(topPerformer.current_focus_score)}`}>
                {Math.round(topPerformer.current_focus_score)}점
              </span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedParticipants.map((participant) => (
            <div
              key={participant.user_id}
              className={`p-3 rounded-lg border transition-colors ${
                participant.user_id === userId 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* 아바타 */}
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={participant.user.avatar_url || undefined} 
                        alt={participant.user.name}
                      />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {getInitials(participant.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* 온라인 상태 표시 */}
                    <div className="absolute -bottom-1 -right-1">
                      {isOnline(participant) ? (
                        <Wifi className="h-3 w-3 text-green-500 bg-white rounded-full p-0.5" />
                      ) : (
                        <WifiOff className="h-3 w-3 text-gray-400 bg-white rounded-full p-0.5" />
                      )}
                    </div>
                  </div>

                  {/* 사용자 정보 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {participant.user.name}
                        {participant.user_id === userId && (
                          <span className="text-blue-600 text-sm ml-1">(나)</span>
                        )}
                      </span>
                      
                      {/* 호스트 표시 */}
                      {participant.is_host && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                      
                      {/* 최고 성과자 표시 */}
                      {participant.user_id === topPerformer?.user_id && 
                       topPerformer.current_focus_score && topPerformer.current_focus_score > 0 && (
                        <Trophy className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>

                    {/* 집중도 점수 */}
                    {participant.current_focus_score !== null && participant.current_focus_score !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-gray-400" />
                          <span className={`text-sm font-medium ${getScoreTextColor(participant.current_focus_score)}`}>
                            {Math.round(participant.current_focus_score)}점
                          </span>
                        </div>
                        <div className="flex-1 max-w-20">
                          <Progress 
                            value={participant.current_focus_score} 
                            className="h-2"
                            style={{
                              '--progress-background': getScoreColor(participant.current_focus_score)
                            } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 액션 메뉴 (본인 제외) */}
                {participant.user_id !== userId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleSendEncouragement(participant.user_id, participant.user.name)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        격려하기
                      </DropdownMenuItem>
                      {onViewProfile && (
                        <DropdownMenuItem
                          onClick={() => onViewProfile(participant.user_id)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          프로필 보기
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* 상태 배지들 */}
              <div className="flex gap-1 mt-2">
                {isOnline(participant) ? (
                  <Badge variant="secondary" className="text-xs">
                    온라인
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-gray-500">
                    오프라인
                  </Badge>
                )}
                
                {participant.current_focus_score !== null && participant.current_focus_score !== undefined && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                    집중 중
                  </Badge>
                )}
              </div>
            </div>
          ))}

          {/* 참가자가 없는 경우 */}
          {participants.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>아직 참가자가 없습니다.</p>
              <p className="text-sm">친구들을 초대해보세요!</p>
            </div>
          )}
        </div>

        {/* 전체 통계 */}
        {participants.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-500">평균 집중도</div>
                <div className="text-lg font-bold">
                  {Math.round(
                    participants
                      .filter(p => p.current_focus_score !== null && p.current_focus_score !== undefined)
                      .reduce((sum, p) => sum + (p.current_focus_score || 0), 0) /
                    Math.max(participants.filter(p => p.current_focus_score !== null && p.current_focus_score !== undefined).length, 1)
                  )}점
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">활성 사용자</div>
                <div className="text-lg font-bold">
                  {participants.filter(p => isOnline(p)).length}명
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
