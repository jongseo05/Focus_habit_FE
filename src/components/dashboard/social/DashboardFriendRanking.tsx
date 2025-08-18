"use client"

import { useState, useEffect } from "react"
import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useFriendRanking } from "@/hooks/useSocial"

// 대시보드용 친구 랭킹 컴포넌트 (간단한 버전)
export function DashboardFriendRanking() {
  const [isVisible, setIsVisible] = useState(true)
  
  // 페이지 가시성 확인
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    setIsVisible(!document.hidden)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  
  // 친구 랭킹 데이터 (페이지 가시성에 따라 조건부 활성화)
  const { data: rankingData, isLoading: rankingLoading, error: rankingError } = useFriendRanking('weekly', {
    enabled: isVisible // 페이지가 보일 때만 활성화
  })

  if (rankingLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (rankingError) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">친구 랭킹을 불러올 수 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">친구를 추가하고 함께 성장해보세요!</p>
      </div>
    )
  }

  // 친구가 없거나 랭킹 데이터가 없는 경우
  if (!rankingData?.rankings || rankingData.rankings.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">아직 친구 랭킹이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">친구를 추가하고 집중 세션을 시작해보세요!</p>
      </div>
    )
  }

  const formatFocusTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  return (
    <div className="space-y-3">
      {rankingData.rankings.slice(0, 5).map((ranking) => (
        <div
          key={ranking.user_id}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
            ranking.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Badge 
              variant={ranking.rank <= 3 ? 'default' : 'outline'}
              className={ranking.rank <= 3 ? 'bg-yellow-500' : ''}
            >
              {ranking.rank}위
            </Badge>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium">
              {ranking.display_name.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <div className="flex-1">
            <div className="font-medium text-sm text-slate-900">{ranking.display_name}</div>
            <div className="text-xs text-slate-600">
              이번 주 {formatFocusTime(ranking.total_focus_time)}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-slate-500">
              평균 {ranking.average_focus_score}%
            </div>
          </div>
        </div>
      ))}
      
      {rankingData.user_rank && (
        <div className="pt-2 border-t border-slate-200">
          <div className="text-center text-xs text-slate-500">
            내 순위: {rankingData.user_rank}위
          </div>
        </div>
      )}
    </div>
  )
}
