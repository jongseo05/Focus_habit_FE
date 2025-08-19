import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Activity, TrendingUp, TrendingDown } from "lucide-react"
import { FocusSummary } from "@/types/profile"
import { FocusSummaryCard } from "../cards"

interface OverviewTabProps {
  focusSummary: FocusSummary | null
  weeklyStats: any
}

export const OverviewTab = ({ focusSummary, weeklyStats }: OverviewTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {focusSummary && <FocusSummaryCard summary={focusSummary} />}
        
        {/* Weekly Activity Summary */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-green-900 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              이번 주 활동 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-3xl font-bold text-green-900 mb-2">
                  {focusSummary ? `${Math.floor(focusSummary.weekly_total_time / 60)}시간 ${focusSummary.weekly_total_time % 60}분` : '0시간 0분'}
                </div>
                <div className="text-sm text-green-700 font-medium">총 집중시간</div>
              </div>
              
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-3xl font-bold text-green-900 mb-2">
                  {focusSummary?.average_focus_score || 0}점
                </div>
                <div className="text-sm text-green-700 font-medium">평균 집중점수</div>
              </div>
              
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-3xl font-bold text-green-900 mb-2">
                  {focusSummary?.session_count || 0}회
                </div>
                <div className="text-sm text-green-700 font-medium">세션 수</div>
              </div>
            </div>
            
            <Separator />
            
            {/* Weekly Change Visualization */}
            <div>
              <h4 className="text-base font-semibold text-green-900 mb-4 text-center">전주 대비 증감</h4>
              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  {focusSummary && focusSummary.weekly_change > 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-500" />
                  )}
                  <span className={`text-lg font-bold ${
                    focusSummary && focusSummary.weekly_change > 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {focusSummary ? Math.abs(focusSummary.weekly_change) : 0}%
                  </span>
                </div>
                <span className="text-green-700">
                  {focusSummary && focusSummary.weekly_change > 0 ? "증가" : "감소"}
                </span>
              </div>
            </div>

            {/* Weekly Focus Chart */}
            <div>
              <h4 className="text-base font-semibold text-green-900 mb-4 text-center">요일별 집중도</h4>
              <div className="bg-white/60 rounded-lg p-6">
                <div className="flex items-end justify-between h-60 gap-3">
                  {weeklyStats?.daily_stats?.map((dayStat: any, index: number) => {
                    const goalHeight = 120 // 목표 시간 기준 높이
                    const actualHeight = Math.min((dayStat.total_time / dayStat.goal_time) * goalHeight, 180) // 최대 180px
                    const timeText = dayStat.total_time >= 60 
                      ? `${Math.floor(dayStat.total_time / 60)}h ${dayStat.total_time % 60}m`
                      : `${dayStat.total_time}m`
                    const goalDiff = dayStat.total_time - dayStat.goal_time
                    const diffText = goalDiff >= 0 
                      ? `+${goalDiff >= 60 ? `${Math.floor(goalDiff / 60)}h ${goalDiff % 60}m` : `${goalDiff}m`}`
                      : `${goalDiff >= -60 ? `${goalDiff}m` : `${Math.floor(Math.abs(goalDiff) / 60)}h ${Math.abs(goalDiff) % 60}m`}`

                    return (
                      <div key={index} className="flex flex-col items-center gap-3 flex-1">
                        <div className="w-full relative group cursor-pointer">
                          {/* 목표 시간 바 (반투명 연한 초록색) */}
                          <div className="w-full bg-green-200/60 rounded-t-sm" 
                                   style={{ height: `${goalHeight}px` }}></div>
                          {/* 실제 집중 시간 바 (진한 색, 겹쳐서 표시) */}
                          <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t-sm" 
                                   style={{ height: `${actualHeight}px` }}>
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                  {dayStat.day_name}요일: {timeText} (목표: {dayStat.goal_time >= 60 ? `${Math.floor(dayStat.goal_time / 60)}시간` : `${dayStat.goal_time}분`})
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-green-700 font-medium">{dayStat.day_name}</span>
                        <span className="text-xs text-green-600">{timeText}</span>
                        <span className={`text-xs font-medium ${goalDiff >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          {diffText}
                        </span>
                      </div>
                    )
                  }) || Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 flex-1">
                      <div className="w-full relative group cursor-pointer">
                        <div className="w-full bg-green-200/60 rounded-t-sm" style={{ height: '120px' }}></div>
                        <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t-sm" style={{ height: '0px' }}></div>
                      </div>
                      <span className="text-xs text-green-700 font-medium">{['일', '월', '화', '수', '목', '금', '토'][i]}</span>
                      <span className="text-xs text-green-600">0m</span>
                      <span className="text-xs text-red-600 font-medium">-2h</span>
                    </div>
                  ))}
                </div>
                
                {/* Chart Legend */}
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-green-700">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-400 rounded"></div>
                    <span>집중 시간</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-200 rounded"></div>
                    <span>목표 시간 (2시간)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
