// =====================================================
// 스터디룸 실시간 입장/퇴장 상태 관리 Hook
// =====================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '@/stores/onlineStatusStore'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { ParticipantWithUser } from '@/types/social'

interface PresentParticipant extends ParticipantWithUser {
  is_online: boolean
  is_online_and_present: boolean
  presence_updated_at: string
}

interface SessionEligibilityResult {
  canStart: boolean
  eligibleParticipants: PresentParticipant[]
  totalPresent: number
  onlineAndPresent: number
  message: string
}

interface UseStudyRoomPresenceProps {
  roomId: string | null
  userId: string | null
  enabled?: boolean
}

interface UseStudyRoomPresenceReturn {
  // 상태
  isPresent: boolean
  presentParticipants: PresentParticipant[]
  canStartSession: boolean
  onlineAndPresentCount: number
  loading: boolean
  error: string | null
  
  // 액션
  enterRoom: () => Promise<boolean>
  leaveRoom: () => Promise<boolean>
  checkSessionEligibility: () => Promise<SessionEligibilityResult>
  refreshPresence: () => Promise<void>
}

export function useStudyRoomPresence({
  roomId,
  userId,
  enabled = true
}: UseStudyRoomPresenceProps): UseStudyRoomPresenceReturn {
  
  const [isPresent, setIsPresent] = useState(false)
  const [presentParticipants, setPresentParticipants] = useState<PresentParticipant[]>([])
  const [canStartSession, setCanStartSession] = useState(false)
  const [onlineAndPresentCount, setOnlineAndPresentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { isCurrentUserOnline } = useOnlineStatus()
  const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 스터디룸 입장
  const enterRoom = useCallback(async (): Promise<boolean> => {
    if (!roomId || !userId || !enabled) return false

    try {
      setError(null)
      const response = await fetch(`/api/social/study-room/${roomId}/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('입장 요청 실패')
      }

      const result = await response.json()
      
      if (result.success) {
        setIsPresent(true)
        console.log('✅ 스터디룸 입장 성공:', roomId)
        return true
      } else {
        throw new Error(result.message || '입장 실패')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      setError(errorMessage)
      console.error('❌ 스터디룸 입장 실패:', errorMessage)
      return false
    }
  }, [roomId, userId, enabled])

  // 스터디룸 퇴장
  const leaveRoom = useCallback(async (): Promise<boolean> => {
    if (!roomId || !userId || !enabled) return false

    try {
      setError(null)
      const response = await fetch(`/api/social/study-room/${roomId}/presence`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('퇴장 요청 실패')
      }

      const result = await response.json()
      
      if (result.success) {
        setIsPresent(false)
        console.log('✅ 스터디룸 퇴장 성공:', roomId)
        return true
      } else {
        throw new Error(result.message || '퇴장 실패')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      setError(errorMessage)
      console.error('❌ 스터디룸 퇴장 실패:', errorMessage)
      return false
    }
  }, [roomId, userId, enabled])

  // 실시간 참가자 상태 새로고침
  const refreshPresence = useCallback(async () => {
    if (!roomId || !enabled) return

    try {
      setLoading(true)
      const response = await fetch(`/api/social/study-room/${roomId}/presence`)
      
      if (!response.ok) {
        throw new Error('참가자 상태 조회 실패')
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        setPresentParticipants(result.data.participants || [])
        setCanStartSession(result.data.stats.can_start_session || false)
        setOnlineAndPresentCount(result.data.stats.online_and_present || 0)
        
        // 현재 사용자의 입장 상태 확인
        const currentUser = result.data.participants?.find((p: any) => p.user_id === userId)
        setIsPresent(currentUser?.is_present || false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류'
      setError(errorMessage)
      console.error('❌ 참가자 상태 새로고침 실패:', errorMessage)
    } finally {
      setLoading(false)
    }
  }, [roomId, userId, enabled])

  // 세션 시작 자격 검증
  const checkSessionEligibility = useCallback(async (): Promise<SessionEligibilityResult> => {
    console.log('🔍 checkSessionEligibility 함수 시작', { roomId, enabled })
    
    if (!roomId || !enabled) {
      return {
        canStart: false,
        eligibleParticipants: [],
        totalPresent: 0,
        onlineAndPresent: 0,
        message: '룸 정보가 없습니다.'
      }
    }

    try {
      // 실시간으로 데이터를 가져와서 직접 계산
      console.log('📡 실시간 참가자 상태 조회 API 호출 중...')
      const response = await fetch(`/api/social/study-room/${roomId}/presence`)
      
      if (!response.ok) {
        console.error('❌ API 응답 오류:', response.status, response.statusText)
        throw new Error('참가자 상태 조회 실패')
      }

      const result = await response.json()
      console.log('📋 API 응답 데이터:', result)
      
      if (!result.success || !result.data) {
        console.error('❌ API 응답 데이터 구조 오류:', result)
        return {
          canStart: false,
          eligibleParticipants: [],
          totalPresent: 0,
          onlineAndPresent: 0,
          message: '참가자 상태를 가져올 수 없습니다.'
        }
      }

      const participants = result.data.participants || []
      console.log('👥 전체 참가자 정보:', participants.map((p: any) => ({
        user_id: p.user_id,
        name: p.user?.name,
        is_present: p.is_present,
        is_online: p.is_online,
        is_online_and_present: p.is_online_and_present,
        last_activity: p.last_activity
      })))

      const eligibleParticipants = participants.filter((p: any) => p.is_online_and_present)
      console.log('✅ 세션 참여 가능한 참가자:', eligibleParticipants.length, '명')
      
      const canStart = eligibleParticipants.length >= 1
      
      let message = ''
      if (!canStart) {
        message = '세션을 시작하려면 온라인 상태이면서 룸에 있는 참가자가 최소 1명 이상 필요합니다.'
      } else {
        message = `${eligibleParticipants.length}명의 참가자가 세션에 참여할 수 있습니다.`
      }

      // 상태도 함께 업데이트
      setPresentParticipants(participants)
      setCanStartSession(canStart)
      setOnlineAndPresentCount(eligibleParticipants.length)
      
      console.log('🎯 세션 자격 검증 결과:', {
        canStart,
        eligibleCount: eligibleParticipants.length,
        totalPresent: participants.length,
        message
      })
      
      // 현재 사용자의 입장 상태도 확인
      const currentUser = participants.find((p: any) => p.user_id === userId)
      setIsPresent(currentUser?.is_present || false)

      return {
        canStart,
        eligibleParticipants,
        totalPresent: participants.length,
        onlineAndPresent: eligibleParticipants.length,
        message
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      console.error('❌ 세션 자격 검증 실패:', errorMessage)
      
      return {
        canStart: false,
        eligibleParticipants: [],
        totalPresent: 0,
        onlineAndPresent: 0,
        message: `오류 발생: ${errorMessage}`
      }
    }
  }, [roomId, userId, enabled])

  // 📱 페이지 가시성 변경 감지 (새로고침 및 탭 복귀 시 재연결)
  useEffect(() => {
    if (!enabled || !roomId || !userId) return

    const handleVisibilityChange = () => {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current)
      }

      if (!document.hidden) {
        // 페이지가 다시 보이면 입장 (새로고침/탭 복귀 시 재입장)
        enterTimeoutRef.current = setTimeout(() => {
          console.log('👁️ 페이지 가시성 복원 - 재입장 시도')
          enterRoom()
          
          // 🔄 새로고침 후 경쟁 상태는 사용자가 수동으로 복원하도록 변경
          // 자동 복원 제거됨
        }, 500)
      }
      // 페이지가 숨겨져도 퇴장하지 않음 (다른 탭으로 이동하는 것은 정상적인 사용)
    }

    const handleBeforeUnload = () => {
      // 페이지를 실제로 떠날 때만 퇴장 (navigator.sendBeacon 사용)
      console.log('👋 페이지 떠남 - 퇴장 처리')
      if (isPresent) {
        navigator.sendBeacon(
          `/api/social/study-room/${roomId}/presence`, 
          JSON.stringify({ method: 'DELETE' })
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current)
      }
    }
  }, [roomId, userId, enabled, isPresent, enterRoom, leaveRoom])

  // 컴포넌트 마운트 시 입장, 언마운트 시에만 퇴장
  useEffect(() => {
    if (!enabled || !roomId || !userId) return

    // 마운트 시 입장
    enterRoom()

    // 주기적인 참가자 상태 새로고림은 제거 (이벤트 기반으로 처리)
    // API 호출을 줄이기 위해 polling 제거

    return () => {
      // 언마운트 시에만 퇴장 (실제 컴포넌트가 제거될 때만)
      console.log('🔄 useStudyRoomPresence 언마운트 - 퇴장 처리')
      leaveRoom()
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [roomId, userId, enabled, enterRoom, leaveRoom])

  // 초기 로드 시 참가자 상태 조회 및 실시간 구독
  useEffect(() => {
    if (!enabled || !roomId) return

    // 초기 상태 로드
    refreshPresence()

    // 🎯 Supabase 실시간 구독으로 다른 사용자 상태 변화 감지
    const supabase = supabaseBrowser()
    const channel = supabase
      .channel(`room-presence-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`
      }, (payload: any) => {
        console.log('🔔 실시간 참가자 상태 변화 감지:', payload)
        
        // 현재 사용자의 변화가 아닐 때만 새로고침 (API 호출 최소화)
        if (payload.new?.user_id !== userId && payload.old?.user_id !== userId) {
          console.log('👥 다른 사용자 상태 변화 - 새로고침')
          setTimeout(() => {
            refreshPresence()
          }, 500) // 약간의 지연 후 새로고침
        } else {
          console.log('👤 현재 사용자 변화 - 새로고침 생략')
        }
      })
      .subscribe((status: any) => {
        console.log('📡 실시간 구독 상태:', status)
      })

    return () => {
      console.log('📡 실시간 구독 해제')
      channel.unsubscribe()
    }
  }, [roomId, enabled, refreshPresence, userId])

  return {
    // 상태
    isPresent,
    presentParticipants,
    canStartSession,
    onlineAndPresentCount,
    loading,
    error,
    
    // 액션
    enterRoom,
    leaveRoom,
    checkSessionEligibility,
    refreshPresence
  }
}
