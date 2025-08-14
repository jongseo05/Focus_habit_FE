'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { 
  FocusUpdateMessage,
  RoomJoinMessage,
  RoomLeaveMessage,
  EncouragementMessageWS,
  ChallengeEvent,
  ChallengeCreatedPayload,
  ChallengeStartedPayload,
  ChallengeTickPayload,
  ChallengeEndedPayload
} from '@/types/social'

interface UseSocialRealtimeOptions {
  roomId?: string
  userId?: string
  onFocusUpdate?: (data: FocusUpdateMessage['data']) => void
  onRoomJoin?: (data: RoomJoinMessage['data']) => void
  onRoomLeave?: (data: RoomLeaveMessage['data']) => void
  onEncouragement?: (data: EncouragementMessageWS['data']) => void
  onChallengeEvent?: (event: ChallengeEvent) => void
  onError?: (error: any) => void
}

export function useSocialRealtime(options: UseSocialRealtimeOptions = {}) {
  const {
    roomId,
    userId,
    onFocusUpdate,
    onRoomJoin,
    onRoomLeave,
    onEncouragement,
    onChallengeEvent,
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const subscriptionRef = useRef<any>(null)
  const onErrorRef = useRef(onError)
  const onRoomJoinRef = useRef(onRoomJoin)
  const onRoomLeaveRef = useRef(onRoomLeave)
  const onEncouragementRef = useRef(onEncouragement)
  const onFocusUpdateRef = useRef(onFocusUpdate)
  const onChallengeEventRef = useRef(onChallengeEvent)
  
  // ref 업데이트
  useEffect(() => {
    onErrorRef.current = onError
    onRoomJoinRef.current = onRoomJoin
    onRoomLeaveRef.current = onRoomLeave
    onEncouragementRef.current = onEncouragement
    onFocusUpdateRef.current = onFocusUpdate
    onChallengeEventRef.current = onChallengeEvent
  }, [onError, onRoomJoin, onRoomLeave, onEncouragement, onFocusUpdate, onChallengeEvent])

  // 참가자 변경 처리
  const handleParticipantChange = useCallback((payload: any) => {
    console.log('참가자 변경:', payload)
    
    if (payload.eventType === 'INSERT') {
      // 새 참가자 입장
      onRoomJoinRef.current?.({
        user_id: payload.new.user_id,
        room_id: payload.new.room_id,
        user_name: payload.new.user?.name || 'Unknown',
        avatar_url: payload.new.user?.avatar_url,
        timestamp: payload.new.joined_at
      })
    } else if (payload.eventType === 'UPDATE' && payload.new.left_at) {
      // 참가자 퇴장
      onRoomLeaveRef.current?.({
        user_id: payload.new.user_id,
        room_id: payload.new.room_id,
        user_name: payload.new.user?.name || 'Unknown',
        avatar_url: payload.new.user?.avatar_url,
        timestamp: payload.new.left_at
      })
    }
  }, [])

  // 격려 메시지 변경 처리
  const handleEncouragementChange = useCallback((payload: any) => {
    console.log('격려 메시지 변경:', payload)
    
    if (payload.eventType === 'INSERT') {
      onEncouragementRef.current?.({
        from_user_id: payload.new.from_user_id,
        to_user_id: payload.new.to_user_id,
        room_id: payload.new.room_id,
        message_type: payload.new.message_type,
        content: payload.new.content,
        timestamp: payload.new.created_at
      })
    }
  }, [])

  // 집중도 업데이트 처리
  const handleFocusUpdateChange = useCallback((payload: any) => {
    console.log('집중도 업데이트 Realtime 이벤트 수신:', payload)
    console.log('이벤트 타입:', payload.eventType)
    console.log('새 데이터:', payload.new)
    console.log('전체 payload 구조:', JSON.stringify(payload, null, 2))
    
    if (payload.eventType === 'INSERT') {
      console.log('INSERT 이벤트 감지 - onFocusUpdate 콜백 호출')
      console.log('콜백 함수 존재 여부:', !!onFocusUpdateRef.current)
      
      const focusUpdateData = {
        user_id: payload.new.user_id,
        room_id: payload.new.room_id,
        focus_score: payload.new.focus_score,
        timestamp: payload.new.created_at
      }
      
      console.log('전달할 데이터:', focusUpdateData)
      onFocusUpdateRef.current?.(focusUpdateData)
    } else {
      console.log('INSERT 이벤트가 아님:', payload.eventType)
    }
  }, [])

  // 대결 이벤트 처리
  const handleChallengeEvent = useCallback((payload: any) => {
    console.log('대결 이벤트:', payload)
    
    if (payload.eventType === 'INSERT') {
      // 새로운 대결 생성
      onChallengeEventRef.current?.({
        type: 'challenge_created',
        data: {
          challenge_id: payload.new.challenge_id,
          room_id: payload.new.room_id,
          mode: payload.new.mode,
          config: payload.new.config,
          created_by: payload.new.created_by,
          timestamp: payload.new.created_at
        }
      })
    } else if (payload.eventType === 'UPDATE') {
      if (payload.new.state === 'active' && payload.old.state === 'pending') {
        // 대결 시작
        onChallengeEventRef.current?.({
          type: 'challenge_started',
          data: {
            challenge_id: payload.new.challenge_id,
            room_id: payload.new.room_id,
            start_at: payload.new.start_at,
            timestamp: payload.new.updated_at
          }
        })
      } else if (payload.new.state === 'ended' && payload.old.state === 'active') {
        // 대결 종료
        onChallengeEventRef.current?.({
          type: 'challenge_ended',
          data: {
            challenge_id: payload.new.challenge_id,
            room_id: payload.new.room_id,
            final_scores: {}, // 실제로는 challenge_participant에서 조회
            final_rankings: {},
            winner_id: undefined,
            timestamp: payload.new.updated_at
          }
        })
      }
    }
  }, [])

  // Supabase Realtime 구독
  useEffect(() => {
    if (!roomId) {
      console.log('roomId가 없어서 Realtime 구독 건너뜀')
      return
    }

    console.log('Supabase Realtime 구독 시작:', { roomId })
    const supabase = supabaseBrowser()
    const channel = supabase.channel(`social_room:${roomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'room_participants' },
        handleParticipantChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'encouragement_messages' },
        handleEncouragementChange
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'focus_updates' },
        (payload) => {
          console.log('focus_updates 테이블 변경 감지:', payload)
          handleFocusUpdateChange(payload)
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'challenge' },
        handleChallengeEvent
      )
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync')
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Presence join:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Presence leave:', key, leftPresences)
      })
      .subscribe((status) => {
        console.log('Supabase Realtime status:', status)
        console.log('구독된 테이블들:', ['room_participants', 'encouragement_messages', 'focus_updates', 'challenge'])
        console.log('Realtime 연결 상태:', { status, isConnected: status === 'SUBSCRIBED' })
        setIsConnected(status === 'SUBSCRIBED')
        
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime 연결 실패')
          onErrorRef.current?.(new Error('Realtime connection failed'))
        }
      })

    subscriptionRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [roomId, handleParticipantChange, handleEncouragementChange, handleFocusUpdateChange, handleChallengeEvent])

  // 룸 입장 (Presence 사용)
  const joinRoom = useCallback(async (userName: string, avatarUrl?: string) => {
    if (!roomId || !userId || !subscriptionRef.current) return

    try {
      await subscriptionRef.current.track({
        user_id: userId,
        user_name: userName,
        avatar_url: avatarUrl,
        joined_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('룸 입장 실패:', error)
      onErrorRef.current?.(error)
    }
  }, [roomId, userId])

  // 룸 퇴장 (Presence 사용)
  const leaveRoom = useCallback(async () => {
    if (!subscriptionRef.current) return

    try {
      await subscriptionRef.current.untrack()
    } catch (error) {
      console.error('룸 퇴장 실패:', error)
      onErrorRef.current?.(error)
    }
  }, [])

  // 집중도 업데이트 전송 (데이터베이스에 저장)
  const sendFocusUpdate = useCallback(async (focusScore: number) => {
    if (!roomId || !userId) return

    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('focus_updates')
        .insert({
          user_id: userId,
          room_id: roomId,
          focus_score: focusScore
        })

      if (error) throw error
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
      onErrorRef.current?.(error)
    }
  }, [roomId, userId])

  // 격려 메시지 전송 (데이터베이스에 저장)
  const sendEncouragement = useCallback(async (
    toUserId: string, 
    content: string, 
    messageType: 'text' | 'emoji' | 'sticker' = 'text'
  ) => {
    if (!roomId || !userId) return

    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase
        .from('encouragement_messages')
        .insert({
          from_user_id: userId,
          to_user_id: toUserId,
          room_id: roomId,
          message_type: messageType,
          content: content
        })

      if (error) throw error
    } catch (error) {
      console.error('격려 메시지 전송 실패:', error)
      onErrorRef.current?.(error)
    }
  }, [roomId, userId])

  return {
    isConnected,
    joinRoom,
    leaveRoom,
    sendFocusUpdate,
    sendEncouragement
  }
}
