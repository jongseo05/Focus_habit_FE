'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Sword,
  Target,
  Timer,
  Play,
  Square,
  Award,
  TrendingUp,
  Trophy
} from 'lucide-react'
import type { ParticipantWithUser } from '@/types/social'

interface CompetitionPanelProps {
  isHost: boolean
  isCompetitionActive: boolean
  isBreakTime: boolean
  competitionTimeLeft: number
  competitionDuration: number
  breakDuration: number
  competitionScores: {[key: string]: number}
  competitionHistory: Array<{
    round: number
    duration: number
    scores: {[key: string]: number}
    winner: string
  }>
  participants: ParticipantWithUser[]
  showCompetitionSettings: boolean
  activeTab: 'pomodoro' | 'custom'
  customHours: number
  customMinutes: number
  hasPendingInvitation: boolean
  onShowCompetitionSettings: (show: boolean) => void
  onActiveTabChange: (tab: 'pomodoro' | 'custom') => void
  onCompetitionDurationChange: (duration: number) => void
  onBreakDurationChange: (duration: number) => void
  onCustomHoursChange: (hours: number) => void
  onCustomMinutesChange: (minutes: number) => void
  onStartCompetition: () => void
  onEndCompetition: () => void
}

export function CompetitionPanel({
  isHost,
  isCompetitionActive,
  isBreakTime,
  competitionTimeLeft,
  competitionDuration,
  breakDuration,
  competitionScores,
  competitionHistory,
  participants,
  showCompetitionSettings,
  activeTab,
  customHours,
  customMinutes,
  hasPendingInvitation,
  onShowCompetitionSettings,
  onActiveTabChange,
  onCompetitionDurationChange,
  onBreakDurationChange,
  onCustomHoursChange,
  onCustomMinutesChange,
  onStartCompetition,
  onEndCompetition
}: CompetitionPanelProps) {
  // 불필요한 로그 제거
  const handleStart = () => {
    if (activeTab === 'pomodoro') {
      onStartCompetition()
    } else {
      const totalMinutes = customHours * 60 + customMinutes
      if (totalMinutes > 0) {
        onStartCompetition()
      }
    }
  }

  const isValidCustomTime = activeTab === 'custom' && (customHours > 0 || customMinutes > 0)

  return (
    <>
      <Card className="bg-white border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
              <Sword className="h-5 w-5 text-blue-600" />
              ⚔️ 집중도 대결
            </CardTitle>
            <div className="flex items-center gap-2">
              {isCompetitionActive ? (
                <div className="flex items-center gap-2">
                  <Badge variant={isBreakTime ? "secondary" : "destructive"} className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {Math.floor(competitionTimeLeft / 60)}:{(competitionTimeLeft % 60).toString().padStart(2, '0')}
                  </Badge>
                  {isBreakTime && (
                    <Badge variant="outline" className="text-xs">
                      ☕ 휴식
                    </Badge>
                  )}
                </div>
              ) : (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  대기 중
                </Badge>
              )}
                                            {isHost && (
                 <Button
                   variant={isCompetitionActive ? "destructive" : "default"}
                   size="sm"
                   onClick={isCompetitionActive ? onEndCompetition : () => onShowCompetitionSettings(true)}
                   className="bg-blue-600 hover:bg-blue-700"
                   disabled={!isCompetitionActive && participants.length < 2}
                   title={!isCompetitionActive && participants.length < 2 ? "최소 2명 이상의 참가자가 필요합니다" : ""}
                 >
                   {isCompetitionActive ? (
                     <>
                       <Square className="h-4 w-4 mr-1" />
                       대결 종료
                     </>
                   ) : (
                     <>
                       <Play className="h-4 w-4 mr-1" />
                       대결 시작
                     </>
                   )}
                 </Button>
               )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 대결이 활성화되었을 때만 실시간 순위 표시 */}
          {isCompetitionActive ? (
            <>
                                            {/* 실시간 순위 */}
               <div className="space-y-3">
                 <h4 className="font-medium text-blue-700 flex items-center gap-2">
                   <TrendingUp className="h-4 w-4" />
                   실시간 순위
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                   {participants
                     .map(participant => {
                       const score = competitionScores[participant.user_id] || 0
                       return { participant, score, userId: participant.user_id }
                     })
                     .sort((a, b) => b.score - a.score)
                     .map(({ participant, score, userId }, index) => {
                       return (
                         <div 
                           key={userId} 
                           className={`p-3 rounded-lg border-2 transition-all ${
                             index === 0 ? 'border-yellow-400 bg-yellow-50' :
                             index === 1 ? 'border-gray-300 bg-gray-50' :
                             index === 2 ? 'border-amber-600 bg-amber-50' :
                             'border-gray-200 bg-white'
                           }`}
                         >
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                 index === 0 ? 'bg-yellow-400 text-white' :
                                 index === 1 ? 'bg-gray-400 text-white' :
                                 index === 2 ? 'bg-amber-600 text-white' :
                                 'bg-gray-300 text-gray-700'
                               }`}>
                                 {index + 1}
                               </div>
                               <Avatar className="h-6 w-6">
                                 <AvatarImage src={participant.user.avatar_url} />
                                 <AvatarFallback className="text-xs">
                                   {participant.user.name?.charAt(0) || 'U'}
                                 </AvatarFallback>
                               </Avatar>
                               <span className="text-sm font-medium">{participant.user.name}</span>
                             </div>
                             <div className="text-right">
                               <div className="text-lg font-bold text-blue-700">
                                 {Math.round(score)}
                               </div>
                               <div className="text-xs text-gray-500">점수</div>
                             </div>
                           </div>
                         </div>
                       )
                     })}
                 </div>
               </div>

                                            {/* 대결 기록 */}
               {competitionHistory.length > 0 && (
                 <div className="space-y-3">
                   <h4 className="font-medium text-blue-700 flex items-center gap-2">
                     <Award className="h-4 w-4" />
                     대결 기록
                   </h4>
                  <div className="space-y-2">
                    {competitionHistory.slice(-3).reverse().map((record, index) => {
                      const winner = participants.find(p => p.user_id === record.winner)
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">
                              {Math.floor(record.duration / 60)}시간 {record.duration % 60}분 라운드 - {winner?.user.name || 'Unknown'} 우승
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {record.round}라운드
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 대결 기록 (대결이 비활성화되어 있을 때도 표시) */}
              {competitionHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-blue-700 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {participants.length < 2 ? '연습 기록' : '대결 기록'}
                  </h4>
                  <div className="space-y-2">
                    {competitionHistory.slice(-3).reverse().map((record, index) => {
                      const isSoloMode = participants.length < 2
                      const winner = participants.find(p => p.user_id === record.winner)
                      const recordText = isSoloMode
                        ? `${Math.floor(record.duration / 60)}시간 ${record.duration % 60}분 연습 - ${Math.round(record.scores[record.winner] || 0)}점 달성`
                        : `${Math.floor(record.duration / 60)}시간 ${record.duration % 60}분 라운드 - ${winner?.user.name || 'Unknown'} 우승`
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm">
                              {recordText}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {isSoloMode ? `${record.round}회차` : `${record.round}라운드`}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

                                            {/* 대결 안내 */}
                {competitionHistory.length === 0 && (
                  <div className="text-center py-6 text-gray-600">
                    <Sword className="h-12 w-12 mx-auto text-blue-500 mb-3" />
                    <p className="text-sm">
                      {isHost 
                        ? participants.length < 2 
                          ? '다른 참가자가 입장하면 대결을 시작할 수 있습니다!' 
                          : '대결 시작 버튼을 눌러 집중도 대결을 시작하세요!'
                        : '방장이 대결을 시작할 때까지 기다려주세요.'
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {participants.length < 2 
                        ? '최소 2명 이상의 참가자가 필요합니다'
                        : '각 라운드 동안의 집중도 × 지속시간으로 점수가 계산됩니다'
                      }
                    </p>
                    {isHost && participants.length < 2 && (
                      <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700">
                          ⚠️ <strong>대결 불가:</strong> 혼자서는 집중도 대결을 할 수 없습니다. 다른 참가자를 초대해주세요!
                        </p>
                      </div>
                    )}
                  </div>
                )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 대결 설정 모달 */}
      {showCompetitionSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="bg-white border border-gray-200 shadow-lg max-w-2xl w-full">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">⚔️ 집중도 대결 설정</h3>
                  <p className="text-sm text-gray-600">라운드 시간을 설정하고 대결을 시작하세요</p>
                </div>
                
                {/* 탭 네비게이션 */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => onActiveTabChange('pomodoro')}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                      activeTab === 'pomodoro'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    🍅 뽀모도로
                  </button>
                  <button
                    onClick={() => onActiveTabChange('custom')}
                    className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                      activeTab === 'custom'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    ⚙️ 커스텀
                  </button>
                </div>
                
                {/* 뽀모도로 탭 */}
                {activeTab === 'pomodoro' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">뽀모도로 기법에 맞춘 집중 세션을 시작하세요</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { 
                          label: '25분 공부', 
                          value: 25, 
                          breakValue: 5,
                          color: 'bg-orange-50 border-orange-200 text-orange-700', 
                          desc: '25분 공부 + 5분 휴식',
                          subDesc: '표준 뽀모도로'
                        },
                        { 
                          label: '50분 공부', 
                          value: 50, 
                          breakValue: 10,
                          color: 'bg-blue-50 border-blue-200 text-blue-700', 
                          desc: '50분 공부 + 10분 휴식',
                          subDesc: '긴 뽀모도로'
                        }
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            onCompetitionDurationChange(option.value)
                            onBreakDurationChange(option.breakValue)
                          }}
                          className={`p-6 rounded-lg border-2 transition-all hover:scale-105 ${
                            competitionDuration === option.value 
                              ? `${option.color} ring-2 ring-offset-2 ring-blue-500` 
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <div className="text-xl font-semibold mb-2">{option.label}</div>
                          <div className="text-sm opacity-75 mb-1">{option.desc}</div>
                          <div className="text-xs opacity-60">{option.subDesc}</div>
                        </button>
                      ))}
                    </div>
                    <div className="text-center text-xs text-gray-500">
                      * 휴식 시간에는 점수 계산이 일시 중단됩니다
                    </div>
                  </div>
                )}
                
                {/* 커스텀 탭 */}
                {activeTab === 'custom' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">원하는 시간을 직접 설정하여 대결을 시작하세요</p>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      <div className="text-center">
                        <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={customHours}
                          onChange={(e) => onCustomHoursChange(parseInt(e.target.value) || 0)}
                          className="w-20 p-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="text-xs text-gray-500 mt-1">시간</div>
                      </div>
                      <div className="text-2xl font-bold text-gray-400">:</div>
                      <div className="text-center">
                        <label className="block text-sm font-medium text-gray-700 mb-2">분</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={customMinutes}
                          onChange={(e) => onCustomMinutesChange(parseInt(e.target.value) || 0)}
                          className="w-20 p-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="text-xs text-gray-500 mt-1">분</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        총 {customHours}시간 {customMinutes}분
                      </div>
                      <div className="text-xs text-gray-500">설정된 시간</div>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleStart}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium"
                    disabled={activeTab === 'custom' && !isValidCustomTime || hasPendingInvitation}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {hasPendingInvitation ? '대기 중인 초대가 있습니다' : '대결 시작'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => onShowCompetitionSettings(false)}
                    className="flex-1 h-12 text-base font-medium"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
