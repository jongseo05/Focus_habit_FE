import { useEffect, useCallback } from 'react'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { 
  StudyRoom, 
  ParticipantWithUser,
  FocusUpdateMessage,
  RoomJoinMessage,
  EncouragementMessageWS
} from '@/types/social'

interface UseStudyRoomRealtimeProps {
  room?: StudyRoom
  userId?: string
  setParticipants: (participants: ParticipantWithUser[]) => void
  addNotification: (message: string, type?: 'join' | 'leave') => void
  setCurrentFocusScore: (score: number) => void
  setIsHost: (isHost: boolean) => void
  updateFocusHistory?: (userId: string, score: number, confidence?: number) => void
  initialLoadDoneRef: React.MutableRefObject<boolean>
  currentRoomIdRef: React.MutableRefObject<string | undefined>
  lastParticipantCountRef: React.MutableRefObject<number>
}

export function useStudyRoomRealtime({
  room,
  userId,
  setParticipants,
  addNotification,
  setCurrentFocusScore,
  setIsHost,
  updateFocusHistory,
  initialLoadDoneRef,
  currentRoomIdRef,
  lastParticipantCountRef
}: UseStudyRoomRealtimeProps) {
  
  // 실시간 훅 사용
  const { 
    joinRoom, 
    leaveRoom, 
    sendFocusUpdate, 
    sendEncouragement
  } = useSocialRealtime({
    roomId: room?.room_id || '',
    userId: userId || '',
    onFocusUpdate: (data: { user_id: string; room_id: string; focus_score: number; timestamp: string }) => {
      // 집중도 업데이트 처리
      console.log('집중도 업데이트:', data)
      
      // 다른 참가자의 집중도 히스토리 업데이트
      if (updateFocusHistory && data.user_id !== userId) {
        updateFocusHistory(data.user_id, data.focus_score, 0.8)
        console.log(`🔄 참가자 ${data.user_id}의 집중도 히스토리 업데이트: ${data.focus_score}`)
      }
    },
    onEncouragement: (data: { from_user_id: string; to_user_id: string; room_id?: string; message_type: string; content: string; timestamp: string }) => {
      addNotification(`격려 메시지: ${data.content}`)
    }
  })

  // 초기 참가자 로드 (최적화)
  const loadInitialParticipants = useCallback(async () => {
    if (!room?.room_id || initialLoadDoneRef.current) return
    
    try {
      console.log('초기 참가자 로드 시작...')
      
      // API를 통해 참가자 정보 가져오기
      const response = await fetch(`/api/social/study-room/${room.room_id}/participants`)
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`)
      }
      
      const data = await response.json()
      const participants = data.data || []  // API는 data 필드에 참가자 배열 반환
      
      console.log('API 참가자 조회 결과:', participants)

      // 참가자 데이터가 실제로 변경된 경우에만 상태 업데이트
      if (participants.length !== lastParticipantCountRef.current) {
        setParticipants(participants)
        lastParticipantCountRef.current = participants.length
      }
      
      // 호스트 여부 확인
      const currentUserParticipant = participants.find((p: any) => p.user_id === userId)
      const isCurrentUserHost = currentUserParticipant?.is_host || false
      setIsHost(isCurrentUserHost)
      
      initialLoadDoneRef.current = true
      currentRoomIdRef.current = room.room_id
      
      console.log('초기 참가자 로드 완료:', participants.length, '명')
    } catch (error) {
      console.error('초기 참가자 로드 중 오류:', error)
      // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setParticipants([])
      lastParticipantCountRef.current = 0
      setIsHost(false)
      // 에러 시에는 initialLoadDoneRef를 true로 설정하지 않아서 재시도 가능하도록 함
      currentRoomIdRef.current = room.room_id
    }
  }, [room?.room_id, userId, setParticipants, setIsHost, initialLoadDoneRef, currentRoomIdRef, lastParticipantCountRef])

  // 실시간 참가자 업데이트 구독
  useEffect(() => {
    if (!room?.room_id) return

    const supabase = supabaseBrowser()
    const channelName = `room-participants-${room.room_id}`
    
    console.log('🔌 실시간 채널 구독 시작:', channelName)
    
    // 참가자 변경 구독
    const participantsChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${room.room_id}`
      }, async (payload) => {
        console.log('👥 참가자 변경 감지:', payload)
        
        // 참가자 목록 다시 로드
        await loadInitialParticipants()
      })
      .on('broadcast', { event: 'competition_started' }, async (payload) => {
        console.log('🎯 경쟁 시작 알림 수신!')
        console.log('  - 채널:', channelName)
        console.log('  - 페이로드:', payload)
        console.log('  - 현재 사용자 ID:', userId)
        console.log('  - 룸 ID:', room?.room_id)
        
        // 현재 사용자의 세션 자동 시작
        if (payload.payload && userId) {
          console.log('🚀 자동 세션 시작 처리 시작...')
          addNotification('집중도 대결이 시작되었습니다! 세션을 시작합니다.', 'join')
          
          try {
            const sessionData = {
              room_id: room.room_id,
              goal_min: payload.payload.duration,
              context_tag: '집중도 대결',
              session_type: 'study_room',
              notes: `${payload.payload.name} 참가`
            }
            
            console.log('📝 세션 생성 데이터:', sessionData)
            console.log('📡 스터디룸 집중 세션 API 호출 중...')
            
            // 스터디룸 집중 세션 시작 API 호출
            const response = await fetch(`/api/social/study-room-focus-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(sessionData)
            })
            
            console.log('📡 세션 API 응답 상태:', response.status, response.statusText)
            
            if (response.ok) {
              const result = await response.json()
              console.log('✅ 경쟁 세션 자동 시작 성공:', result)
              addNotification('집중도 대결 세션이 시작되었습니다!', 'join')
              
              // 🔄 로컬 세션 상태 동기화를 위한 이벤트 발생
              if (typeof window !== 'undefined') {
                console.log('🔄 로컬 세션 동기화 이벤트 발생...')
                window.dispatchEvent(new CustomEvent('focus-session-auto-started', {
                  detail: {
                    sessionId: result.data?.session_id,
                    sessionData: result.data,
                    roomId: room.room_id,
                    duration: payload.payload.duration
                  }
                }))
              }
            } else {
              const errorData = await response.json()
              console.error('❌ 경쟁 세션 자동 시작 실패:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
              })
              addNotification('세션 시작에 실패했습니다.', 'leave')
            }
          } catch (error) {
            console.error('❌ 경쟁 세션 시작 중 오류:', error)
            addNotification('세션 시작 중 오류가 발생했습니다.', 'leave')
          }
        } else {
          console.log('⚠️ 세션 시작 조건 미충족:')
          console.log('  - payload.payload 존재:', !!payload.payload)
          console.log('  - userId 존재:', !!userId)
        }
      })
      .on('broadcast', { event: 'competition_ended' }, async (payload) => {
        console.log('🏁 경쟁 종료 알림 수신!', payload)
        
        // 🛡️ 중복 이벤트 처리 방지 (sequence_id 기반)
        const competitionId = payload.payload?.competition_id
        const sequenceId = payload.payload?.sequence_id
        
        if (!competitionId || !sequenceId) {
          console.warn('⚠️ 경쟁 종료 이벤트에 필수 정보 누락:', { competitionId, sequenceId })
          return
        }
        
        // 이미 처리된 이벤트인지 확인 (localStorage 사용)
        const processedKey = `competition_ended_${competitionId}_${sequenceId}`
        if (typeof window !== 'undefined' && localStorage.getItem(processedKey)) {
          console.log('🔄 이미 처리된 경쟁 종료 이벤트 무시:', { competitionId, sequenceId })
          return
        }
        
        // 이벤트 처리 마킹 (5분 후 자동 만료)
        if (typeof window !== 'undefined') {
          localStorage.setItem(processedKey, Date.now().toString())
          setTimeout(() => {
            localStorage.removeItem(processedKey)
          }, 5 * 60 * 1000) // 5분 후 정리
        }
        
        addNotification('집중도 대결이 종료되었습니다.', 'leave')
        
        // 로컬 UI 복구용 커스텀 이벤트 발생
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('focus-session-auto-ended', {
            detail: {
              competitionId: competitionId,
              endedAt: payload.payload?.ended_at,
              sessions: payload.payload?.sessions || [],
              sequenceId: sequenceId
            }
          }))
        }
        
        // 참가자 목록 새로고침 (점수/상태 갱신)
        await loadInitialParticipants()
        
        console.log('✅ 경쟁 종료 이벤트 처리 완료:', { competitionId, sequenceId })
      })
      .subscribe((status) => {
        const timestamp = new Date().toISOString()
        console.log(`📡 [${timestamp}] 채널 구독 상태 변경:`)
        console.log('  - 채널:', channelName)
        console.log('  - 상태:', status)
        console.log('  - 사용자 ID:', userId)
        console.log('  - 룸 ID:', room?.room_id)
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [V1] 채널 구독 성공! 브로드캐스트 수신 준비 완료')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 채널 구독 실패!')
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ 채널 구독 타임아웃!')
        } else if (status === 'CLOSED') {
          console.log('🔌 채널 구독 종료')
        }
      })

    return () => {
      console.log('📡 실시간 채널 구독 해제:', channelName)
      supabase.removeChannel(participantsChannel)
    }
  }, [room?.room_id, loadInitialParticipants, userId, addNotification])

  // 룸 변경 시 초기화
  useEffect(() => {
    if (room?.room_id !== currentRoomIdRef.current) {
      // 룸이 변경된 경우 초기화
      initialLoadDoneRef.current = false
      currentRoomIdRef.current = room?.room_id
      lastParticipantCountRef.current = 0
      setParticipants([])
      setIsHost(false)
    }
  }, [room?.room_id, currentRoomIdRef, initialLoadDoneRef, lastParticipantCountRef, setParticipants, setIsHost])

  // 초기 로드 실행
  useEffect(() => {
    loadInitialParticipants()
  }, [loadInitialParticipants])

  // 집중도 업데이트 전송
  const sendFocusScoreUpdate = useCallback(async (score: number) => {
    if (!room?.room_id || !userId) return
    
    try {
      // API로 집중도 업데이트
      const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_score: score })
      })

      if (response.ok) {
        // 실시간으로 다른 참가자에게 전송
        sendFocusUpdate(score)
        
        setCurrentFocusScore(score)
        
        // 집중도 히스토리 업데이트
        if (updateFocusHistory) {
          updateFocusHistory(userId, score, 0.8)
        }
      }
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
    }
  }, [room?.room_id, userId, sendFocusUpdate, setCurrentFocusScore])

  return {
    joinRoom,
    leaveRoom,
    sendFocusScoreUpdate,
    sendEncouragement,
    loadInitialParticipants
  }
}
