import { useEffect, useRef, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'user-joined' | 'user-left'
  from: string
  to?: string
  roomId: string
  data: any
  timestamp: number
}

interface UseSignalingProps {
  roomId: string
  userId: string
  onOffer: (from: string, offer: RTCSessionDescriptionInit) => void
  onAnswer: (from: string, answer: RTCSessionDescriptionInit) => void
  onIceCandidate: (from: string, candidate: RTCIceCandidateInit) => void
  onUserJoined: (userId: string) => void
  onUserLeft: (userId: string) => void
}

export function useSignaling({
  roomId,
  userId,
  onOffer,
  onAnswer,
  onIceCandidate,
  onUserJoined,
  onUserLeft
}: UseSignalingProps) {
  const supabase = supabaseBrowser()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const roomJoined = useRef(false)

  // 룸 입장
  const joinRoom = useCallback(async () => {
    if (!roomJoined.current) {
      try {
        // Supabase Realtime 채널 구독
        const channel = supabase.channel(`signaling:${roomId}`)
        
        // 시그널링 메시지 수신
        channel
          .on('broadcast', { event: 'signaling' }, (payload: { payload: SignalingMessage }) => {
            const message: SignalingMessage = payload.payload
            
            // 자신에게 온 메시지는 무시
            if (message.from === userId) {
              return
            }

            console.log('시그널링 메시지 수신:', message)

            switch (message.type) {
              case 'offer':
                onOffer(message.from, message.data.offer)
                break
              case 'answer':
                onAnswer(message.from, message.data.answer)
                break
              case 'ice-candidate':
                onIceCandidate(message.from, message.data.candidate)
                break
              case 'user-joined':
                onUserJoined(message.data.userId)
                break
              case 'user-left':
                onUserLeft(message.data.userId)
                break
            }
          })
          .subscribe((status: string) => {
            console.log('Supabase Realtime 채널 상태:', status)
            
            if (status === 'SUBSCRIBED') {
              // 룸 입장 메시지 전송
              const message: SignalingMessage = {
                type: 'join',
                from: userId,
                roomId,
                data: { userId },
                timestamp: Date.now()
              }
              
              channel.send({
                type: 'broadcast',
                event: 'signaling',
                payload: message
              })
              
              roomJoined.current = true
              console.log(`룸 ${roomId}에 입장했습니다.`)
            }
          })

        channelRef.current = channel
      } catch (error) {
        console.error('룸 입장 실패:', error)
      }
    }
  }, [roomId, userId, supabase, onOffer, onAnswer, onIceCandidate, onUserJoined, onUserLeft])

  // 룸 퇴장
  const leaveRoom = useCallback(async () => {
    if (roomJoined.current && channelRef.current) {
      try {
        // 퇴장 메시지 전송
        const message: SignalingMessage = {
          type: 'leave',
          from: userId,
          roomId,
          data: { userId },
          timestamp: Date.now()
        }
        
        channelRef.current.send({
          type: 'broadcast',
          event: 'signaling',
          payload: message
        })

        // 채널 구독 해제
        await supabase.removeChannel(channelRef.current)
        channelRef.current = null
        roomJoined.current = false
        
        console.log(`룸 ${roomId}에서 퇴장했습니다.`)
      } catch (error) {
        console.error('룸 퇴장 실패:', error)
      }
    }
  }, [roomId, userId, supabase])

  // Offer 전송
  const sendOffer = useCallback((to: string, offer: RTCSessionDescriptionInit) => {
    if (channelRef.current && roomJoined.current) {
      const message: SignalingMessage = {
        type: 'offer',
        from: userId,
        to,
        roomId,
        data: { offer },
        timestamp: Date.now()
      }
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'signaling',
        payload: message
      })
      
      console.log(`${to}에게 Offer 전송:`, offer)
    }
  }, [userId, roomId])

  // Answer 전송
  const sendAnswer = useCallback((to: string, answer: RTCSessionDescriptionInit) => {
    if (channelRef.current && roomJoined.current) {
      const message: SignalingMessage = {
        type: 'answer',
        from: userId,
        to,
        roomId,
        data: { answer },
        timestamp: Date.now()
      }
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'signaling',
        payload: message
      })
      
      console.log(`${to}에게 Answer 전송:`, answer)
    }
  }, [userId, roomId])

  // ICE 후보 전송
  const sendIceCandidate = useCallback((to: string, candidate: RTCIceCandidateInit) => {
    if (channelRef.current && roomJoined.current) {
      const message: SignalingMessage = {
        type: 'ice-candidate',
        from: userId,
        to,
        roomId,
        data: { candidate },
        timestamp: Date.now()
      }
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'signaling',
        payload: message
      })
      
      console.log(`${to}에게 ICE 후보 전송:`, candidate)
    }
  }, [userId, roomId])

  // 컴포넌트 마운트 시 자동으로 룸 입장
  useEffect(() => {
    joinRoom()

    // 컴포넌트 언마운트 시 정리
    return () => {
      leaveRoom()
    }
  }, [joinRoom, leaveRoom])

  return {
    isConnected: roomJoined.current,
    joinRoom,
    leaveRoom,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  }
}
