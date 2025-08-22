// =====================================================
// 경쟁 기능 훅 (V2 - 새로운 competitionStore 사용)
// =====================================================

import { useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useCompetitionStore } from '@/stores/competitionStore'
import { supabaseBrowser } from '@/lib/supabase/client'

interface UseCompetitionProps {
  roomId: string
  isHost: boolean
}

export function useCompetition({ roomId, isHost }: UseCompetitionProps) {
  const {
    // 상태
    roomId: storeRoomId,
    competitionId,
    isActive,
    timeLeft,
    duration,
    startedAt,
    endedAt,
    participants,
    hostId,
    winnerId,
    rankings,
    isLoading,
    error,
    
    // 액션
    startCompetition,
    endCompetition,
    updateTimeLeft,
    addParticipant,
    updateParticipant,
    removeParticipant,
    setParticipants,
    updateRankings,
    setWinner,
    restoreCompetitionState,
    saveCompetitionState,
    clearCompetitionState,
    setLoading,
    setError
  } = useCompetitionStore()

  // 실시간 채널 참조
  const realtimeChannelRef = useRef<any>(null)

  // 경쟁 상태 조회 및 복원 (useCallback으로 먼저 정의)
  const fetchCompetitionStatus = useCallback(async (isRestoreMode = false) => {
    if (!roomId) return

    try {
      console.log('📡 경쟁 상태 API 호출:', `/api/social/study-room/${roomId}/competition`)
      const response = await fetch(`/api/social/study-room/${roomId}/competition`)
      const data = await response.json()

      console.log('📊 경쟁 상태 API 응답:', data)

      if (response.ok && data.competition) {
        const competition = data.competition
        
        // 경쟁 상태 업데이트
        if (competition.is_active) {
          // 활성 경쟁이 있으면 상태 복원
          const now = new Date()
          const startTime = new Date(competition.started_at)
          const endTime = new Date(competition.ended_at)
          const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000)
          const totalSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
          const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
          const durationMinutes = Math.floor(totalSeconds / 60)

          // 참가자 정보 변환 (사용자 정보 포함)
          const participants = data.participants?.map((p: any) => ({
            userId: p.user_id,
            totalFocusScore: p.total_focus_score || p.final_score || 0,
            averageFocusScore: p.average_focus_score || 0,
            lastUpdated: p.last_updated || new Date().toISOString(),
            user: p.user || {
              display_name: `사용자-${p.user_id?.slice(-4)}`,
              avatar_url: null
            }
          })) || []

          // 순위 정보 변환 (사용자 정보 포함)
          const rankings = data.participants?.map((p: any, index: number) => ({
            userId: p.user_id,
            score: p.total_focus_score || p.final_score || 0,
            rank: index + 1,
            userName: p.user?.display_name || `사용자-${p.user_id?.slice(-4)}`,
            avatarUrl: p.user?.avatar_url || '',
            user: p.user || {
              display_name: `사용자-${p.user_id?.slice(-4)}`,
              avatar_url: null
            }
          })) || []

          console.log('🔄 경쟁 상태 복원 데이터:', {
            competitionId: competition.competition_id,
            isActive: true,
            timeLeft: remainingSeconds,
            duration: durationMinutes,
            participantsCount: participants.length,
            rankingsCount: rankings.length
          })

          // 스토어 상태 업데이트
          setParticipants(participants)
          updateRankings(rankings)
          updateTimeLeft(remainingSeconds)

          // 필요한 경우 전체 상태 복원 (useCompetitionStore의 상태 직접 업데이트)
          if (isRestoreMode) {
            const store = useCompetitionStore.getState()
            store.roomId = roomId
            store.competitionId = competition.competition_id
            store.isActive = true
            store.timeLeft = remainingSeconds
            store.duration = durationMinutes
            store.startedAt = competition.started_at
            store.endedAt = competition.ended_at
            store.hostId = competition.host_id
            store.winnerId = competition.winner_id || null
            store.lastUpdated = new Date().toISOString()
            
            console.log('✅ 경쟁 상태 전체 복원 완료:', { roomId, competitionId: competition.competition_id, remainingSeconds })
          }
        }
      }
    } catch (error) {
      console.error('❌ 경쟁 상태 조회 실패:', error)
    }
  }, [roomId, setParticipants, updateRankings, updateTimeLeft])

  // 초기 마운트 시 경쟁 상태 확인 및 복원
  useEffect(() => {
    if (roomId && !isActive) {
      console.log('🔍 경쟁 상태 확인 시작:', { roomId })
      fetchCompetitionStatus(true) // isRestoreMode = true
    }
  }, [roomId, isActive, fetchCompetitionStatus])

  // 실시간 이벤트 구독 (roomId가 있으면 항상 구독)
  useEffect(() => {
    if (!roomId) return

    

    const channel = supabaseBrowser().channel(`competition-${roomId}`)
      .on('broadcast', { event: 'competition_update' }, (payload: any) => {
        console.log('📡 경쟁 실시간 업데이트 수신:', payload)
        
        const eventData = payload.payload || payload
        if (eventData.competition_id === competitionId) {
          // 경쟁 상태 업데이트
          if (eventData.timeLeft !== undefined) {
            updateTimeLeft(eventData.timeLeft)
          }
          
          if (eventData.participants) {
            setParticipants(eventData.participants)
          }
          
          if (eventData.rankings) {
            updateRankings(eventData.rankings)
          }
          
          if (eventData.winner_id) {
            setWinner(eventData.winner_id)
          }
        }
      })
      .on('broadcast', { event: 'competition_score_update' }, (payload: any) => {
        console.log('🏆 경쟁 점수 업데이트 수신:', payload)
        
        const eventData = payload.payload || payload
        console.log('🏆 점수 업데이트 데이터:', {
          eventCompetitionId: eventData.competition_id,
          currentCompetitionId: competitionId,
          userId: eventData.user_id,
          score: eventData.total_focus_score,
          isActive
        })
        
        // 경쟁이 활성화되어 있고 같은 경쟁이면 점수 업데이트
        if (isActive && eventData.competition_id === competitionId && eventData.user_id && eventData.total_focus_score !== undefined) {
          console.log('✅ 참가자 점수 업데이트 실행:', {
            userId: eventData.user_id,
            totalFocusScore: eventData.total_focus_score
          })
          
          updateParticipant(eventData.user_id, {
            totalFocusScore: eventData.total_focus_score,
            averageFocusScore: eventData.total_focus_score,
            lastUpdated: new Date().toISOString()
          })
        } else {
          console.log('⚠️ 점수 업데이트 조건 불일치')
        }
      })
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {

      supabaseBrowser().removeChannel(channel)
    }
  }, [roomId, isActive, competitionId, updateTimeLeft, setParticipants, updateRankings, setWinner, updateParticipant])

  // 경쟁 시작
  const handleStartCompetition = useCallback(async (duration: number) => {
    if (!isHost) {
      toast.error('방장만 경쟁을 시작할 수 있습니다')
      return false
    }

    setLoading(true)
    try {
      const success = await startCompetition(roomId, duration)
      if (success) {
        toast.success('집중도 대결이 시작되었습니다!')
        return true
      } else {
        toast.error('경쟁 시작에 실패했습니다')
        return false
      }
    } catch (error) {
      console.error('경쟁 시작 중 오류:', error)
      toast.error('경쟁 시작 중 오류가 발생했습니다')
      return false
    } finally {
      setLoading(false)
    }
  }, [roomId, isHost, startCompetition, setLoading])

  // 경쟁 종료
  const handleEndCompetition = useCallback(async () => {
    if (!isHost) {
      toast.error('방장만 경쟁을 종료할 수 있습니다')
      return false
    }

    setLoading(true)
    try {
      const success = await endCompetition()
      if (success) {
        toast.success('집중도 대결이 종료되었습니다!')
        return true
      } else {
        toast.error('경쟁 종료에 실패했습니다')
        return false
      }
    } catch (error) {
      console.error('경쟁 종료 중 오류:', error)
      toast.error('경쟁 종료 중 오류가 발생했습니다')
      return false
    } finally {
      setLoading(false)
    }
  }, [isHost, endCompetition, setLoading])

  // 타이머 업데이트
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return

    const interval = setInterval(() => {
      const newTimeLeft = timeLeft - 1
      if (newTimeLeft <= 0) {
        // 시간 종료 시 자동 종료
        if (isHost) {
          handleEndCompetition()
        }
      } else {
        updateTimeLeft(newTimeLeft)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, timeLeft, isHost, handleEndCompetition, updateTimeLeft])

  // 경쟁 상태를 기존 인터페이스와 호환되도록 변환
  const competition = {
    id: competitionId,
    isActive,
    timeLeft,
    duration,
    started_at: startedAt,
    ended_at: endedAt,
    participants: participants.map(p => ({
      user_id: p.userId,
      totalFocusScore: p.totalFocusScore,
      current_score: p.totalFocusScore,
      final_score: p.totalFocusScore,
      user: (p as any).user || {
        display_name: `사용자-${p.userId?.slice(-4)}`,
        avatar_url: null
      }
    })),
    host: hostId ? {
      display_name: '', // TODO: 사용자 정보 가져오기
      user_id: hostId
    } : null,
    winner_id: winnerId,
    rankings: rankings.map(r => ({
      user_id: r.userId,
      final_score: r.score,
      rank: r.rank,
      user: (r as any).user || {
        display_name: r.userName || `사용자-${r.userId?.slice(-4)}`,
        avatar_url: r.avatarUrl || null
      }
    })),
    lastUpdated: new Date().toISOString()
  }

  // UI 설정 관련
  const {
    showSettings,
    activeTab,
    customHours,
    customMinutes,
    breakDuration,
    setShowSettings,
    setActiveTab,
    setCustomHours,
    setCustomMinutes,
    setBreakDuration
  } = useCompetitionStore()

  const settings = {
    showSettings,
    activeTab,
    duration,
    breakDuration,
    customHours,
    customMinutes
  }

  return {
    competition,
    settings,
    isLoading,
    error,
    startCompetition: handleStartCompetition,
    endCompetition: handleEndCompetition,
    fetchCompetitionStatus,
    saveCompetitionState,
    clearCompetitionState,
    showCompetitionSettings: showSettings,
    onActiveTabChange: setActiveTab,
    onCompetitionDurationChange: (duration: number) => {
      // 경쟁 시간 설정 - activeTab에 따라 처리
      if (activeTab === 'custom') {
        setCustomMinutes(duration)
      }
      // pomodoro 탭의 경우 미리 정의된 값들을 사용하므로 별도 처리 불필요
    },
    onBreakDurationChange: setBreakDuration,
    onCustomHoursChange: setCustomHours,
    onCustomMinutesChange: setCustomMinutes,
    onStartCompetition: handleStartCompetition,
    onEndCompetition: handleEndCompetition,
    setShowCompetitionSettings: setShowSettings
  }
}
