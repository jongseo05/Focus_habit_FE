// =====================================================
// 개선된 스터디룸 실시간 기능 훅
// =====================================================

import { useEffect, useCallback, useRef } from 'react'
import { StudyRoomWebSocketClient } from '@/lib/websocket/studyRoomClient'
import { supabaseBrowser } from '@/lib/supabase/client'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface UseStudyRoomRealtimeProps {
  room?: StudyRoom
  userId?: string
  onParticipantUpdate: (participants: ParticipantWithUser[]) => void
  onFocusScoreUpdate: (score: number) => void
  onNotification: (message: string, type?: 'join' | 'leave' | 'info') => void
}



export function useStudyRoomRealtime({
  room,
  userId,
  onParticipantUpdate,
  onFocusScoreUpdate,
  onNotification
}: UseStudyRoomRealtimeProps) {
  
  const wsClient = useRef<StudyRoomWebSocketClient | null>(null)
  const focusUpdateThrottle = useRef<NodeJS.Timeout | null>(null)
  
  // WebSocket 클라이언트 초기화
  useEffect(() => {
    wsClient.current = new StudyRoomWebSocketClient({
      onParticipantJoined: (participant) => {
        onNotification(`${participant.user.name}님이 입장했습니다.`, 'join')
        // 참가자 목록 다시 로드 (API 호출)
        loadParticipants()
      },
      onParticipantLeft: (userId) => {
        onNotification('참가자가 나갔습니다.', 'leave')
        // 참가자 목록 다시 로드 (API 호출)
        loadParticipants()
      },
      onFocusUpdate: (userId, score) => {
        onFocusScoreUpdate(score)
      },
      onEncouragement: (senderId, senderName, message) => {
        onNotification(`💪 ${senderName}: ${message}`, 'info')
      },
      onRoomEnded: () => {
        onNotification('스터디룸이 종료되었습니다.', 'info')
      },
      onError: (error) => {
        onNotification(`연결 오류: ${error}`, 'info')
      }
    })
    
    return () => {
      wsClient.current?.disconnect()
    }
  }, [])

  // Supabase Realtime 구독 (경쟁 시작 이벤트용)
  useEffect(() => {
    if (!room?.room_id || !userId) return

    const supabase = supabaseBrowser()
    const channelName = `room-participants-${room.room_id}`
    
    console.log('🔌 [V2] Supabase Realtime 채널 구독 시작:', channelName)
    console.log('  - 룸 ID:', room.room_id)
    console.log('  - 사용자 ID:', userId)
    
    // 경쟁 시작 브로드캐스트 수신용 채널
    const competitionChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'competition_started' }, async (payload) => {
        console.log('🎯 [V2] 경쟁 시작 알림 수신!')
        console.log('  - 수신 시간:', new Date().toISOString())
        console.log('  - 채널:', channelName)
        console.log('  - 원시 페이로드:', payload)
        console.log('  - 현재 사용자 ID:', userId)
        console.log('  - 룸 ID:', room?.room_id)
        
        // 현재 사용자의 세션 자동 시작
        if (payload.payload && userId) {
          console.log('🚀 [V2] 자동 세션 시작 처리 시작...')
          onNotification('집중도 대결이 시작되었습니다! 세션을 시작합니다.', 'info')
          
          try {
            const sessionData = {
              room_id: room.room_id,
              goal_min: payload.payload.duration,
              context_tag: '집중도 대결',
              session_type: 'study_room',
              notes: `${payload.payload.name} 참가`
            }
            
            console.log('📝 [V2] 세션 생성 데이터:', sessionData)
            console.log('📡 [V2] 스터디룸 집중 세션 API 호출 중...')
            
            // 스터디룸 집중 세션 시작 API 호출
            const response = await fetch(`/api/social/study-room-focus-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(sessionData)
            })
            
            console.log('📡 [V2] 세션 API 응답 상태:', response.status, response.statusText)
            
            if (response.ok) {
              const result = await response.json()
              console.log('✅ [V2] 경쟁 세션 자동 시작 성공:', result)
              onNotification('집중도 대결 세션이 시작되었습니다!', 'info')
            } else {
              const errorData = await response.json()
              console.error('❌ [V2] 경쟁 세션 자동 시작 실패:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
              })
              onNotification('세션 시작에 실패했습니다.', 'info')
            }
          } catch (error) {
            console.error('❌ [V2] 경쟁 세션 시작 중 오류:', error)
            onNotification('세션 시작 중 오류가 발생했습니다.', 'info')
          }
        } else {
          console.log('⚠️ [V2] 세션 시작 조건 미충족:')
          console.log('  - payload.payload 존재:', !!payload.payload)
          console.log('  - payload.payload 내용:', payload.payload)
          console.log('  - userId 존재:', !!userId)
        }
      })
      .on('broadcast', { event: 'competition_ended' }, async (payload) => {
        console.log('🏁 [V2] 경쟁 종료 알림 수신!', payload)
        onNotification('집중도 대결이 종료되었습니다.', 'info')
        // UI 복구용 커스텀 이벤트
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('focus-session-auto-ended', {
            detail: {
              competitionId: payload.payload?.competition_id,
              endedAt: payload.payload?.ended_at,
              sessions: payload.payload?.sessions || []
            }
          }))
        }
        // 참가자 목록 재로딩
        await loadParticipants()
      })
      .subscribe((status) => {
        const timestamp = new Date().toISOString()
        console.log(`📡 [V2] [${timestamp}] Supabase 채널 구독 상태 변경:`)
        console.log('  - 채널:', channelName)
        console.log('  - 상태:', status)
        console.log('  - 사용자 ID:', userId)
        console.log('  - 룸 ID:', room?.room_id)
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [V2] Supabase 채널 구독 성공! 경쟁 시작 브로드캐스트 수신 준비 완료')
          
          // 🧪 테스트용: 구독 성공 즉시 테스트 브로드캐스트 전송
          setTimeout(() => {
            console.log('🧪 [V2] 테스트 브로드캐스트 전송 시도...')
            supabase
              .channel(channelName)
              .send({
                type: 'broadcast',
                event: 'competition_started',
                payload: {
                  test: true,
                  message: '테스트 브로드캐스트',
                  timestamp: new Date().toISOString()
                }
              })
              .then(result => {
                console.log('🧪 [V2] 테스트 브로드캐스트 전송 결과:', result)
              })
              .catch(error => {
                console.error('🧪 [V2] 테스트 브로드캐스트 전송 실패:', error)
              })
          }, 2000) // 2초 후 테스트 전송
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [V2] Supabase 채널 구독 실패!')
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ [V2] Supabase 채널 구독 타임아웃!')
        } else if (status === 'CLOSED') {
          console.log('🔌 [V2] Supabase 채널 구독 종료')
        }
      })

    return () => {
      console.log('📡 [V2] Supabase Realtime 채널 구독 해제:', channelName)
      supabase.removeChannel(competitionChannel)
    }
  }, [room?.room_id, userId, onNotification])

  // 참가자 목록 로드 함수
  const loadParticipants = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/study-room/${room.room_id}/participants`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          onParticipantUpdate(result.data)
        }
      }
    } catch (error) {
      console.error('참가자 목록 로드 실패:', error)
    }
  }, [room?.room_id, onParticipantUpdate])

  // 방 참가
  const joinRoom = useCallback(() => {
    if (!room?.room_id || !userId || !wsClient.current) return
    
    wsClient.current.connect(room.room_id, userId)
    loadParticipants()
  }, [room?.room_id, userId, loadParticipants])

  // 방 나가기
  const leaveRoom = useCallback(() => {
    if (!wsClient.current) return
    
    wsClient.current.disconnect()
  }, [])

  // 집중도 점수 전송 (스로틀링 적용)
  const sendFocusUpdate = useCallback((score: number) => {
    if (!wsClient.current) return
    
    // 500ms마다 한 번만 전송 (성능 최적화)
    if (focusUpdateThrottle.current) {
      clearTimeout(focusUpdateThrottle.current)
    }
    
    focusUpdateThrottle.current = setTimeout(() => {
      wsClient.current?.sendFocusUpdate(score)
    }, 500)
  }, [])

  // 격려 메시지 전송
  const sendEncouragement = useCallback((targetUserId: string, message: string) => {
    if (!wsClient.current || !message.trim()) return
    
    wsClient.current.sendEncouragement(targetUserId, message.trim())
  }, [])

  // 방 종료 알림 (호스트만)
  const notifyRoomEnd = useCallback(() => {
    // 구현 필요시 추가
  }, [])

  // 방 정보가 변경될 때 연결
  useEffect(() => {
    if (room?.room_id && userId) {
      joinRoom()
    }
    
    return () => {
      leaveRoom()
    }
  }, [room?.room_id, userId, joinRoom, leaveRoom])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (focusUpdateThrottle.current) {
        clearTimeout(focusUpdateThrottle.current)
      }
      wsClient.current?.disconnect()
    }
  }, [])

  return {
    // 연결 상태
    status: wsClient.current?.isConnected ? 'connected' : 'disconnected',
    
    // 액션 함수
    joinRoom,
    leaveRoom,
    sendFocusUpdate,
    sendEncouragement,
    notifyRoomEnd,
    
    // 수동 연결 제어
    connect: joinRoom,
    disconnect: leaveRoom
  }
}
