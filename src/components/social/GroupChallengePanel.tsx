'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Calendar, Target, Users, Trophy, Clock, Plus, X, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { 
  GroupChallenge, 
  GroupChallengeProgress, 
  CreateGroupChallengeData,
  ParticipantWithUser 
} from '@/types/social'

interface GroupChallengePanelProps {
  roomId: string
  participants: ParticipantWithUser[]
  isHost: boolean
  currentChallenges: GroupChallenge[]
  challengeProgressMap: Record<string, GroupChallengeProgress>
  currentUserId: string
  onCreateChallenge: (data: CreateGroupChallengeData) => Promise<void>
  onJoinChallenge: (challengeId: string) => Promise<void>
  onLeaveChallenge: (challengeId: string) => Promise<void>
  onDeleteChallenge: (challengeId: string) => Promise<void>
}

export function GroupChallengePanel({
  roomId,
  participants,
  isHost,
  currentChallenges,
  challengeProgressMap,
  currentUserId,
  onCreateChallenge,
  onJoinChallenge,
  onLeaveChallenge,
  onDeleteChallenge
}: GroupChallengePanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [joiningChallenges, setJoiningChallenges] = useState<Set<string>>(new Set())
  const [leavingChallenges, setLeavingChallenges] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState<CreateGroupChallengeData>({
    room_id: roomId,
    title: '',
    description: '',
    type: 'focus_time',
    target_value: 0,
    unit: 'hours', // 기본값을 시간으로 변경
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 기본 7일 후
  })

  const handleCreateChallenge = useCallback(async () => {
    if (!formData.title || !formData.description || formData.target_value <= 0) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    setIsLoading(true)
    try {
      await onCreateChallenge(formData)
      setShowCreateForm(false)
      setFormData({
        room_id: roomId,
        title: '',
        description: '',
        type: 'focus_time',
        target_value: 0,
        unit: 'hours',
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
    } catch (error) {
      console.error('그룹 챌린지 생성 실패:', error)
      alert('그룹 챌린지 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [formData, onCreateChallenge, roomId])

  const handleJoinChallenge = useCallback(async (challengeId: string) => {
    if (joiningChallenges.has(challengeId)) {
      return // 이미 참여 중인 경우 중복 요청 방지
    }

    setJoiningChallenges(prev => new Set(prev).add(challengeId))
    try {
      await onJoinChallenge(challengeId)
    } catch (error) {
      console.error('챌린지 참여 실패:', error)
      // 에러 메시지는 onJoinChallenge에서 처리됨
    } finally {
      setJoiningChallenges(prev => {
        const newSet = new Set(prev)
        newSet.delete(challengeId)
        return newSet
      })
    }
  }, [joiningChallenges, onJoinChallenge])

  const handleLeaveChallenge = useCallback(async (challengeId: string) => {
    if (leavingChallenges.has(challengeId)) {
      return // 이미 탈퇴 중인 경우 중복 요청 방지
    }

    setLeavingChallenges(prev => new Set(prev).add(challengeId))
    try {
      await onLeaveChallenge(challengeId)
    } catch (error) {
      console.error('챌린지 탈퇴 실패:', error)
      // 에러 메시지는 onLeaveChallenge에서 처리됨
    } finally {
      setLeavingChallenges(prev => {
        const newSet = new Set(prev)
        newSet.delete(challengeId)
        return newSet
      })
    }
  }, [leavingChallenges, onLeaveChallenge])

  const getChallengeTypeInfo = (type: string) => {
    switch (type) {
      case 'focus_time':
        return { label: '집중 시간', icon: Clock, color: 'bg-blue-500' }
      case 'study_sessions':
        return { label: '학습 세션', icon: Target, color: 'bg-green-500' }
      case 'streak_days':
        return { label: '연속 학습', icon: Trophy, color: 'bg-purple-500' }
      case 'focus_score':
        return { label: '집중도 점수', icon: Target, color: 'bg-red-500' }
      case 'custom':
        return { label: '커스텀', icon: Plus, color: 'bg-orange-500' }
      default:
        return { label: '기타', icon: Target, color: 'bg-gray-500' }
    }
  }

  // 챌린지 타입에 따른 기본 단위 반환
  const getDefaultUnitForType = (type: string) => {
    switch (type) {
      case 'focus_time':
        return 'hours' // 분에서 시간으로 변경
      case 'study_sessions':
        return 'sessions'
      case 'streak_days':
        return 'days'
      case 'focus_score':
        return 'points'
      case 'custom':
        return 'custom'
      default:
        return 'minutes'
    }
  }

  // 챌린지 타입 변경 시 단위도 자동으로 변경
  const handleTypeChange = (newType: 'focus_time' | 'study_sessions' | 'streak_days' | 'focus_score' | 'custom') => {
    const defaultUnit = getDefaultUnitForType(newType)
    setFormData(prev => ({ 
      ...prev, 
      type: newType,
      unit: defaultUnit
    }))
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'yyyy년 MM월 dd일', { locale: ko })
  }

  const getTimeRemaining = (endDate: string) => {
    const now = new Date()
    const end = new Date(endDate)
    const diff = end.getTime() - now.getTime()
    
    if (diff <= 0) return '종료됨'
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    
    if (days > 0) return `${days}일 ${hours}시간 남음`
    return `${hours}시간 남음`
  }

  return (
    <Card className="rounded-xl shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Trophy className="w-5 h-5 text-yellow-500" />
            그룹 챌린지
          </CardTitle>
          {isHost && (
            <Button
              onClick={() => setShowCreateForm(true)}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              챌린지 생성
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 챌린지 생성 폼 */}
        {showCreateForm && (
          <Card className="border border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-purple-900">
                  새로운 그룹 챌린지 생성
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="title" className="text-sm">챌린지 제목</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 이번 주 100시간 집중하기"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="type" className="text-sm">챌린지 유형</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => handleTypeChange(value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="focus_time">집중 시간</SelectItem>
                      <SelectItem value="study_sessions">학습 세션</SelectItem>
                      <SelectItem value="streak_days">연속 학습</SelectItem>
                      <SelectItem value="focus_score">집중도 점수</SelectItem>
                      <SelectItem value="custom">커스텀</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description" className="text-sm">챌린지 설명</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="챌린지에 대한 자세한 설명을 입력하세요..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="target" className="text-sm">목표 값</Label>
                  <Input
                    id="target"
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_value: Number(e.target.value) }))}
                    placeholder="100"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-sm">단위</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">시간</SelectItem>
                      <SelectItem value="minutes">분</SelectItem>
                      <SelectItem value="sessions">세션</SelectItem>
                      <SelectItem value="days">일</SelectItem>
                      <SelectItem value="points">점수</SelectItem>
                      <SelectItem value="custom">커스텀</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate" className="text-sm">종료일</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.end_date.split('T')[0]}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      end_date: new Date(e.target.value).toISOString() 
                    }))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreateChallenge}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                >
                  {isLoading ? '생성 중...' : '챌린지 생성'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isLoading}
                >
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 현재 활성 챌린지들 */}
        {currentChallenges && currentChallenges.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {/* 4개 섹션으로 나누어 각 챌린지 타입별로 표시 */}
            {['focus_time', 'study_sessions', 'streak_days', 'focus_score'].map((challengeType) => {
              const challenge = currentChallenges.find(c => c.type === challengeType)
              const challengeProgress = challenge ? challengeProgressMap[challenge.challenge_id] : null
              const typeInfo = getChallengeTypeInfo(challengeType)
              const Icon = typeInfo.icon
              
              return (
                <div key={challengeType} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-md ${typeInfo.color}`}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{typeInfo.label}</h3>
                  </div>
                  
                  {challenge ? (
                    <div className="space-y-3">
                      {/* 챌린지 제목 */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900 mb-1 truncate">
                          {challenge.title}
                        </h4>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {challenge.description}
                        </p>
                      </div>
                      
                      {/* 진행률 */}
                      {challengeProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">진행률</span>
                            <span className="font-semibold text-slate-900">
                              {challengeProgress.completion_percentage.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={challengeProgress.completion_percentage} 
                            className="h-2"
                          />
                          <div className="text-xs text-slate-600 text-center">
                            {challengeProgress.total_contribution} / {challenge.target_value} {challenge.unit}
                          </div>
                        </div>
                      )}

                       {/* 순위 */}
                                               {challengeProgress && challengeProgress.top_contributors && challengeProgress.top_contributors.length > 0 && (
                         <div className="bg-slate-100 rounded p-2">
                           <h5 className="text-xs font-semibold text-slate-700 mb-2">순위</h5>
                           <div className="space-y-2">
                             {challengeProgress.top_contributors.slice(0, 3).map((contributor: any, index: number) => (
                               <div key={contributor.user_id} className="flex items-center gap-2 p-1.5 bg-white rounded border border-slate-200">
                                 {/* 순위 아이콘 */}
                                 <div className={`flex items-center justify-center w-5 h-5 rounded-full ${
                                   index === 0 ? 'bg-yellow-100 border border-yellow-300' : 
                                   index === 1 ? 'bg-gray-100 border border-gray-300' : 
                                   'bg-orange-100 border border-orange-300'
                                 }`}>
                                   {index === 0 ? (
                                     <Trophy className="w-3 h-3 text-yellow-600" />
                                   ) : index === 1 ? (
                                     <span className="text-xs font-bold text-gray-600">2</span>
                                   ) : (
                                     <span className="text-xs font-bold text-orange-600">3</span>
                                   )}
                                 </div>
                                 
                                 {/* 사용자 정보 */}
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2">
                                     <span className="text-xs font-medium text-slate-900 truncate">
                                       {contributor.name}
                                     </span>
                                     {index === 0 && (
                                       <span className="text-xs text-yellow-600 font-bold">🥇</span>
                                     )}
                                   </div>
                                 </div>
                                 
                                 {/* 기여도 */}
                                 <div className="text-right">
                                   <span className="text-xs font-semibold text-slate-700">
                                     {contributor.contribution} {challenge.unit}
                                   </span>
                                 </div>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}

                      {/* 참여/탈퇴 버튼 */}
                      {!challenge.is_completed && (() => {
                        // 참여 상태 확인 - 더 안전한 방식으로 수정
                        const allParticipants = challengeProgress?.all_participants || []
                        const isParticipating = Array.isArray(allParticipants) && 
                          allParticipants.some((participant: any) => 
                            participant && participant.user_id === currentUserId
                          ) || false
                        const isJoining = joiningChallenges.has(challenge.challenge_id)
                        const isLeaving = leavingChallenges.has(challenge.challenge_id)

                        return (
                          <div className="flex gap-2">
                            {!isParticipating ? (
                              <Button
                                onClick={() => handleJoinChallenge(challenge.challenge_id)}
                                disabled={isJoining || isLeaving}
                                size="sm"
                                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-xs"
                              >
                                <Users className="w-3 h-3 mr-1" />
                                {isJoining ? '참여 중...' : '참여'}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLeaveChallenge(challenge.challenge_id)}
                                disabled={isJoining || isLeaving}
                                className="flex-1 text-xs"
                              >
                                <X className="w-3 h-3 mr-1" />
                                {isLeaving ? '탈퇴 중...' : '탈퇴'}
                              </Button>
                            )}
                            
                            {/* 호스트만 삭제 버튼 표시 */}
                            {isHost && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isJoining || isLeaving}
                                onClick={() => {
                                  if (confirm('정말로 이 챌린지를 삭제하시겠습니까?')) {
                                    onDeleteChallenge(challenge.challenge_id)
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300 text-xs"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        )
                      })()}

                      {/* 완료 상태 */}
                      {challenge.is_completed && (
                        <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                          <Trophy className="w-4 h-4 text-green-600 mx-auto mb-1" />
                          <p className="text-xs font-semibold text-green-800">완료!</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 해당 타입의 챌린지가 없을 때 */
                    <div className="text-center py-4">
                      <Icon className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">
                        {isHost ? '챌린지 생성 가능' : '챌린지 없음'}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* 챌린지가 없을 때 */
          <div className="text-center py-6">
            <Trophy className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 mb-1">
              활성 그룹 챌린지가 없습니다
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {isHost 
                ? '새로운 그룹 챌린지를 생성하여 팀원들과 함께 목표를 달성해보세요!'
                : '호스트가 그룹 챌린지를 생성할 때까지 기다려주세요.'
              }
            </p>
            {!isHost && (
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Users className="w-3 h-3" />
                <span>호스트만 챌린지를 생성할 수 있습니다</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
