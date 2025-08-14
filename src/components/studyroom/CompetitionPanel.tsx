'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Sword,
  Timer,
  Target,
  Play,
  Square,
  Award,
  TrendingUp,
  Trophy
} from 'lucide-react'
import { CompetitionSettings } from './CompetitionSettings'
import type { RoomParticipant } from '@/types/social'

interface ParticipantWithUser extends RoomParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

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
  onShowCompetitionSettings,
  onActiveTabChange,
  onCompetitionDurationChange,
  onBreakDurationChange,
  onCustomHoursChange,
  onCustomMinutesChange,
  onStartCompetition,
  onEndCompetition
}: CompetitionPanelProps) {
  return (
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
        {/* 대결 설정 모달 */}
        {showCompetitionSettings && (
          <CompetitionSettings
            activeTab={activeTab}
            competitionDuration={competitionDuration}
            breakDuration={breakDuration}
            customHours={customHours}
            customMinutes={customMinutes}
            onActiveTabChange={onActiveTabChange}
            onCompetitionDurationChange={onCompetitionDurationChange}
            onBreakDurationChange={onBreakDurationChange}
            onCustomHoursChange={onCustomHoursChange}
            onCustomMinutesChange={onCustomMinutesChange}
            onStartCompetition={onStartCompetition}
            onCancel={() => onShowCompetitionSettings(false)}
          />
        )}

        {/* 실시간 순위 */}
        {isCompetitionActive && (
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
        )}

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

        {/* 대결 안내 */}
        {!isCompetitionActive && competitionHistory.length === 0 && (
          <div className="text-center py-6 text-gray-600">
            <Sword className="h-12 w-12 mx-auto text-blue-500 mb-3" />
            <p className="text-sm">
              {isHost ? '대결 시작 버튼을 눌러 집중도 대결을 시작하세요!' : '방장이 대결을 시작할 때까지 기다려주세요.'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              각 라운드 동안의 집중도 × 지속시간으로 점수가 계산됩니다
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
