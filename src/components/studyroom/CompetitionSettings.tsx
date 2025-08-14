'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

interface CompetitionSettingsProps {
  activeTab: 'pomodoro' | 'custom'
  competitionDuration: number
  breakDuration: number
  customHours: number
  customMinutes: number
  onActiveTabChange: (tab: 'pomodoro' | 'custom') => void
  onCompetitionDurationChange: (duration: number) => void
  onBreakDurationChange: (duration: number) => void
  onCustomHoursChange: (hours: number) => void
  onCustomMinutesChange: (minutes: number) => void
  onStartCompetition: () => void
  onCancel: () => void
}

export function CompetitionSettings({
  activeTab,
  competitionDuration,
  breakDuration,
  customHours,
  customMinutes,
  onActiveTabChange,
  onCompetitionDurationChange,
  onBreakDurationChange,
  onCustomHoursChange,
  onCustomMinutesChange,
  onStartCompetition,
  onCancel
}: CompetitionSettingsProps) {
  return (
    <Card className="bg-white border border-gray-200 shadow-lg">
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
              onClick={onStartCompetition}
              className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium"
              disabled={activeTab === 'custom' && customHours === 0 && customMinutes === 0}
            >
              <Play className="h-5 w-5 mr-2" />
              대결 시작
            </Button>
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex-1 h-12 text-base font-medium"
            >
              취소
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
