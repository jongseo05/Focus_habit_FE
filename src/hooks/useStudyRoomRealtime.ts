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
    
    // 참가자 변경 구독
    const participantsChannel = supabase
      .channel(`room-participants-${room.room_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${room.room_id}`
      }, async (payload) => {
        console.log('참가자 변경 감지:', payload)
        
        // 참가자 목록 다시 로드
        await loadInitialParticipants()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
    }
  }, [room?.room_id, loadInitialParticipants])

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
