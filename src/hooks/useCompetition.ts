'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface CompetitionState {
  id: string | null
  isActive: boolean
  timeLeft: number
  duration: number
  participants: Array<{
    user_id: string
    user: {
      display_name: string
      avatar_url?: string
    }
    current_score: number
    rank?: number
  }>
  host: {
    display_name: string
  } | null
  winner_id: string | null
}

interface CompetitionSettings {
  showSettings: boolean
  activeTab: 'pomodoro' | 'custom'
  duration: number
  breakDuration: number
  customHours: number
  customMinutes: number
}

interface UseCompetitionProps {
  roomId: string
  isHost: boolean
}

export function useCompetition({ roomId, isHost }: UseCompetitionProps) {
  const [competition, setCompetition] = useState<CompetitionState>({
    id: null,
    isActive: false,
    timeLeft: 0,
    duration: 25,
    participants: [],
    host: null,
    winner_id: null
  })

  const [settings, setSettings] = useState<CompetitionSettings>({
    showSettings: false,
    activeTab: 'pomodoro',
    duration: 25,
    breakDuration: 5,
    customHours: 0,
    customMinutes: 30
  })

  const [isLoading, setIsLoading] = useState(false)

  // 경쟁 상태 조회
  const fetchCompetitionStatus = useCallback(async () => {
    console.log('🔄 경쟁 상태 조회 시작, roomId:', roomId)
    try {
      const response = await fetch(`/api/social/study-room/${roomId}/competition`)
      console.log('📡 경쟁 API 응답 상태:', response.status, response.statusText)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📊 경쟁 API 응답 데이터:', data)
        
        // API 응답 구조에 맞게 파싱
        const competitionData = data.competition
        const isActive = competitionData && competitionData.is_active
        
        console.log('🎯 경쟁 데이터 파싱:', {
          competitionExists: !!competitionData,
          isActive: isActive,
          participantsCount: data.participants?.length || 0,
          competitionData: competitionData // 전체 구조 확인
        })
        
        // 남은 시간 계산
        let timeLeft = 0
        if (isActive && competitionData.started_at && competitionData.duration_minutes) {
          const startedAt = new Date(competitionData.started_at).getTime()
          const duration = competitionData.duration_minutes * 60 * 1000 // 밀리초로 변환
          const now = new Date().getTime()
          const endTime = startedAt + duration
          timeLeft = Math.max(0, Math.floor((endTime - now) / 1000)) // 초 단위
          
          console.log('⏰ 시간 계산:', {
            startedAt: new Date(competitionData.started_at).toLocaleString(),
            durationMinutes: competitionData.duration_minutes,
            timeLeftSeconds: timeLeft
          })
        }
        
        // 참가자 데이터 변환 (API의 profiles를 user 구조로 변환)
        const transformedParticipants = (data.participants || []).map((participant: any) => {
          const transformed = {
            user_id: participant.user_id,
            user: {
              display_name: participant.profiles?.display_name || 'Unknown User',
              avatar_url: participant.profiles?.avatar_url
            },
            current_score: participant.current_score || 0,
            rank: participant.rank
          }
          
          console.log('👤 참가자 데이터 변환:', {
            user_id: participant.user_id,
            original_profiles: participant.profiles,
            transformed_user: transformed.user,
            current_score: transformed.current_score
          })
          
          return transformed
        })
        
        console.log('✅ 경쟁 상태 업데이트:', {
          id: competitionData?.competition_id,
          isActive: isActive,
          timeLeft: timeLeft,
          participantsCount: transformedParticipants.length
        })
        
        setCompetition({
          id: competitionData?.competition_id || null,
          isActive: isActive || false,
          timeLeft: timeLeft,
          duration: competitionData?.duration_minutes || 25,
          participants: transformedParticipants,
          host: competitionData?.host_id || null,
          winner_id: competitionData?.winner_id || null
        })
      } else {
        const errorData = await response.text()
        console.error('❌ 경쟁 상태 조회 실패:', response.status, errorData)
      }
    } catch (error) {
      console.error('❌ 경쟁 상태 조회 중 오류:', error)
    }
  }, [roomId])

  // 경쟁 시작
  const startCompetition = useCallback(async () => {
    if (!isHost) {
      toast.error('방장만 경쟁을 시작할 수 있습니다')
      return
    }

    setIsLoading(true)
    console.log('🚀 경쟁 시작 요청, 설정:', settings)
    
    try {
      const duration = settings.activeTab === 'pomodoro' 
        ? settings.duration 
        : settings.customHours * 60 + settings.customMinutes

      console.log('⏱️ 계산된 경쟁 시간:', { duration, activeTab: settings.activeTab })

      const response = await fetch(`/api/social/study-room/${roomId}/competition/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          duration,
          break_duration: settings.breakDuration
        })
      })

      console.log('📡 경쟁 시작 API 응답 상태:', response.status, response.statusText)
      const data = await response.json()
      console.log('📊 경쟁 시작 API 응답 데이터:', data)

      if (response.ok) {
        toast.success('집중도 대결이 시작되었습니다!')
        setSettings(prev => ({ ...prev, showSettings: false }))
        
        // 경쟁 시작 후 즉시 상태 업데이트
        const immediateState = {
          isActive: true,
          timeLeft: duration * 60, // 분을 초로 변환
          duration: duration
        }
        console.log('✨ 즉시 UI 업데이트:', immediateState)
        
        setCompetition(prev => ({
          ...prev,
          ...immediateState
        }))
        
        // 서버에서 최신 상태도 가져오기
        console.log('🔄 경쟁 상태 새로고침 예약 (500ms 후)')
        setTimeout(() => {
          console.log('🔄 경쟁 상태 새로고침 실행')
          fetchCompetitionStatus()
        }, 500) // 500ms 후 서버 상태 동기화
      } else {
        console.error('❌ 경쟁 시작 실패:', data.error)
        toast.error(data.error || '경쟁 시작에 실패했습니다')
      }
    } catch (error) {
      console.error('❌ 경쟁 시작 중 오류:', error)
      toast.error('경쟁 시작 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [roomId, isHost, settings, fetchCompetitionStatus])

  // 경쟁 종료
  const endCompetition = useCallback(async () => {
    if (!isHost) {
      toast.error('방장만 경쟁을 종료할 수 있습니다')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/social/study-room/${roomId}/competition/end`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('집중도 대결이 종료되었습니다!')
        
        // 경쟁 종료 후 즉시 상태 업데이트
        setCompetition(prev => ({
          ...prev,
          isActive: false,
          timeLeft: 0
        }))
        
        // 서버에서 최신 상태도 가져오기
        setTimeout(() => {
          fetchCompetitionStatus()
        }, 500)
      } else {
        toast.error(data.error || '경쟁 종료에 실패했습니다')
      }
    } catch (error) {
      console.error('Failed to end competition:', error)
      toast.error('경쟁 종료 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [roomId, isHost, fetchCompetitionStatus])

  // 실시간 타이머 업데이트
  useEffect(() => {
    if (!competition.isActive || competition.timeLeft <= 0) return

    const timer = setInterval(() => {
      setCompetition(prev => {
        if (prev.timeLeft <= 1) {
          // 시간이 끝나면 상태 새로고침
          fetchCompetitionStatus()
          return { ...prev, timeLeft: 0, isActive: false }
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 }
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [competition.isActive, competition.timeLeft, fetchCompetitionStatus])

  // 주기적으로 상태 업데이트 (실시간 점수 등)
  useEffect(() => {
    if (!competition.isActive) return

    const interval = setInterval(() => {
      fetchCompetitionStatus()
    }, 5000) // 5초마다 업데이트

    return () => clearInterval(interval)
  }, [competition.isActive, fetchCompetitionStatus])

  // 초기 상태 로드
  useEffect(() => {
    fetchCompetitionStatus()
  }, [fetchCompetitionStatus])

  return {
    // 상태
    competition,
    settings,
    isLoading,
    
    // 액션
    startCompetition,
    endCompetition,
    
    // 설정 핸들러
    showCompetitionSettings: (show: boolean) => {
      setSettings(prev => ({ ...prev, showSettings: show }))
    },
    
    onActiveTabChange: (tab: 'pomodoro' | 'custom') => {
      setSettings(prev => ({ ...prev, activeTab: tab }))
    },
    
    onCompetitionDurationChange: (duration: number) => {
      setSettings(prev => ({ ...prev, duration }))
    },
    
    onBreakDurationChange: (breakDuration: number) => {
      setSettings(prev => ({ ...prev, breakDuration }))
    },
    
    onCustomHoursChange: (hours: number) => {
      setSettings(prev => ({ ...prev, customHours: hours }))
    },
    
    onCustomMinutesChange: (minutes: number) => {
      setSettings(prev => ({ ...prev, customMinutes: minutes }))
    }
  }
}
