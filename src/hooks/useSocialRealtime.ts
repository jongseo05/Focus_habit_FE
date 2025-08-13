'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { 
  FocusUpdateMessage,
  RoomJoinMessage,
  RoomLeaveMessage,
  EncouragementMessageWS
} from '@/types/social'

interface UseSocialRealtimeOptions {
  roomId?: string
  userId?: string
  onFocusUpdate?: (data: FocusUpdateMessage['data']) => void
  onRoomJoin?: (data: RoomJoinMessage['data']) => void
  onRoomLeave?: (data: RoomLeaveMessage['data']) => void
  onEncouragement?: (data: EncouragementMessageWS['data']) => void
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
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const subscriptionRef = useRef<any>(null)
  const onErrorRef = useRef(onError)
  const onRoomJoinRef = useRef(onRoomJoin)
  const onRoomLeaveRef = useRef(onRoomLeave)
  const onEncouragementRef = useRef(onEncouragement)
  const onFocusUpdateRef = useRef(onFocusUpdate)
  
  // ref 업데이트
  useEffect(() => {
    onErrorRef.current = onError
    onRoomJoinRef.current = onRoomJoin
    onRoomLeaveRef.current = onRoomLeave
    onEncouragementRef.current = onEncouragement
    onFocusUpdateRef.current = onFocusUpdate
  }, [onError, onRoomJoin, onRoomLeave, onEncouragement, onFocusUpdate])

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
    console.log('집중도 업데이트:', payload)
    
    if (payload.eventType === 'INSERT') {
      onFocusUpdateRef.current?.({
        user_id: payload.new.user_id,
        room_id: payload.new.room_id,
        focus_score: payload.new.focus_score,
        timestamp: payload.new.created_at
      })
    }
  }, [])

  // Supabase Realtime 구독
  useEffect(() => {
    if (!roomId) return

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
        handleFocusUpdateChange
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
        setIsConnected(status === 'SUBSCRIBED')
        
        if (status === 'CHANNEL_ERROR') {
          onErrorRef.current?.(new Error('Realtime connection failed'))
        }
      })

    subscriptionRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [roomId])

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
