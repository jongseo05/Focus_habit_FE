import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Target, TrendingUp, TrendingDown } from "lucide-react"
import { FocusSummary } from "@/types/profile"

interface FocusSummaryCardProps {
  summary: FocusSummary
}

export const FocusSummaryCard = ({ summary }: FocusSummaryCardProps) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`
  }

  const formatScore = (score: number) => {
    return `${score}점`
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <Target className="w-5 h-5" />
          이번 주 집중 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{formatTime(summary.weekly_total_time)}</div>
            <div className="text-sm text-blue-600">총 집중시간</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{formatScore(summary.average_focus_score)}</div>
            <div className="text-sm text-blue-600">평균 집중점수</div>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">{formatTime(summary.longest_streak)}</div>
            <div className="text-sm text-blue-600">최장 스트릭</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">{summary.session_count}회</div>
            <div className="text-sm text-blue-600">세션 수</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          {summary.weekly_change > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={summary.weekly_change > 0 ? "text-green-600" : "text-red-600"}>
            지난주 대비 {Math.abs(summary.weekly_change)}% {summary.weekly_change > 0 ? "증가" : "감소"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
