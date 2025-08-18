"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, Target, Clock, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useStudyRoomChallenges } from "@/hooks/useSocial"
import { useAuth } from "@/hooks/useAuth"

// 대시보드용 팀 목표 컴포넌트 (스터디룸 챌린지)
export function DashboardTeamGoals() {
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
  
  console.log('DashboardTeamGoals 컴포넌트 렌더링 시작')
  const { data: studyRooms, isLoading: studyRoomsLoading, error: studyRoomsError } = useStudyRoomChallenges({
    enabled: isVisible // 페이지가 보일 때만 활성화
  })
  const { user } = useAuth()
  console.log('useStudyRoomChallenges 결과:', { studyRooms, isLoading: studyRoomsLoading, error: studyRoomsError })
  console.log('현재 사용자:', user)
  
  // 데이터 구조 상세 분석
  if (studyRooms && studyRooms.length > 0) {
    console.log('첫 번째 스터디룸 상세 데이터:', studyRooms[0])
    console.log('linked_challenge_id가 있는 룸들:', studyRooms.filter(room => room.linked_challenge_id))
    console.log('linked_challenge가 있는 룸들:', studyRooms.filter(room => room.linked_challenge))
    console.log('활성 챌린지가 있는 룸들:', studyRooms.filter(room => room.linked_challenge && room.linked_challenge.is_active))
  }

  if (studyRoomsLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (studyRoomsError) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">스터디룸 챌린지를 불러올 수 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">잠시 후 다시 시도해주세요</p>
      </div>
    )
  }

  // 스터디룸이 없는 경우
  if (!studyRooms || studyRooms.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">참여 중인 스터디룸이 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">스터디룸에 참여하고 팀 챌린지를 시작해보세요!</p>
      </div>
    )
  }

  // 챌린지가 연동된 스터디룸만 필터링
  const roomsWithChallenges = studyRooms.filter(room => 
    room.linked_challenge && room.linked_challenge.is_active
  )

  // 스터디룸은 있지만 챌린지가 연동되지 않은 경우
  if (roomsWithChallenges.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <Target className="h-8 w-8 mx-auto mb-2 text-slate-400" />
        <p className="text-sm">연동된 챌린지가 없습니다</p>
        <p className="text-xs text-slate-400 mt-1">스터디룸에 챌린지를 연동해보세요!</p>
        <div className="mt-3">
          <Link 
            href="/social" 
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            스터디룸 보기 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {roomsWithChallenges.slice(0, 3).map((room) => {
        const challenge = room.linked_challenge!
        const progressPercentage = Math.min((challenge.current_value / challenge.target_value) * 100, 100)
        
        return (
          <div
            key={`${room.room_id}-${challenge.challenge_id}`}
            className="p-4 border border-slate-200 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:shadow-lg transition-all duration-300 cursor-pointer group"
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {challenge.title}
                  </h4>
                </div>
                <p className="text-sm text-slate-600 mb-2">{room.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    팀 챌린지
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(challenge.end_date).toLocaleDateString()}까지
                  </span>
                </div>
              </div>
              <Badge 
                variant={challenge.is_active ? "default" : "secondary"} 
                className="text-xs px-2 py-1"
              >
                {challenge.is_active ? '진행중' : '완료'}
              </Badge>
            </div>
            
            {/* 진행률 정보 */}
            <div className="space-y-3">
              {/* 목표 정보 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">목표</span>
                <span className="font-bold text-blue-600">
                  {challenge.target_value} {challenge.unit === 'hours' ? '시간' : challenge.unit}
                </span>
              </div>
              
              {/* 현재 진행률 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">현재 진행률</span>
                <span className="font-bold text-green-600">
                  {challenge.current_value} / {challenge.target_value}
                </span>
              </div>
              
              {/* 진행률 바 */}
              {challenge.is_active && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>진행률</span>
                    <span className="font-medium text-blue-600">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 액션 버튼 */}
            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
              <Link href={`/social/room/${room.room_id}`}>
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm py-2"
                  size="sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  스터디룸 보기
                </Button>
              </Link>

            </div>
          </div>
        )
      })}
      
      {/* 더 보기 링크 */}
      <div className="pt-2 text-center">
        <Link 
          href="/social" 
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 underline hover:no-underline transition-all duration-200"
        >
          <span>더 많은 팀 목표 보기</span>
          <TrendingUp className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
