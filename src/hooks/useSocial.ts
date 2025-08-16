import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/hooks/useAuth'
import type { 
  StudyRoom, 
  RoomParticipant, 
  CreateStudyRoomData,
  FocusCompetition,
  UserFriend,
  FriendsListResponse,
  CreateFriendRequestData,
  FriendRequestsResponse,
  FriendRequestResponse,
  FriendRankingResponse
} from '@/types/social'

// =====================================================
// 1. 스터디룸 관련 훅
// =====================================================

export function useStudyRooms() {
  return useQuery({
    queryKey: ['study-rooms'],
    queryFn: async (): Promise<StudyRoom[]> => {
      const response = await fetch('/api/social/study-room')
      if (!response.ok) {
        throw new Error('스터디룸 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다 자동 새로고침
  })
}

export function useCreateStudyRoom() {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (data: Omit<CreateStudyRoomData, 'host_id'>): Promise<StudyRoom> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch('/api/social/study-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          host_id: user.id
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '스터디룸 생성에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: () => {
      // 스터디룸 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    }
  })
}

export function useJoinStudyRoom() {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (roomId: string): Promise<{ success: boolean; message?: string }> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch(`/api/social/study-room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '스터디룸 참가에 실패했습니다.')
      }

      return result
    },
    onSuccess: (data) => {
      // 스터디룸 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
      
      // 성공 메시지가 있으면 콘솔에 출력 (디버깅용)
      if (data.message) {
        console.log('참가 결과:', data.message)
      }
    }
  })
}

export function useLeaveStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }) => {
      const response = await fetch(`/api/social/study-room/${roomId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: '' }) // 서버에서 인증된 사용자 ID 사용
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '스터디룸 나가기에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (_, { roomId }) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    }
  })
}

export function useEndStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }) => {
      const response = await fetch(`/api/social/study-room/${roomId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '스터디룸 종료에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (_, { roomId }) => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room', roomId] })
    }
  })
}

export function useRoomParticipants(roomId: string) {
  return useQuery({
    queryKey: ['room-participants', roomId],
    queryFn: async (): Promise<{ participants: RoomParticipant[], count: number }> => {
      const response = await fetch(`/api/social/study-room/${roomId}/participants`)
      if (!response.ok) {
        throw new Error('참가자 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!roomId,
    staleTime: 10000, // 10초
    refetchInterval: 30000, // 30초마다 자동 새로고침
  })
}

// =====================================================
// 2. 집중도 대결 관련 훅
// =====================================================

export function useFocusCompetitions(roomId: string) {
  return useQuery({
    queryKey: ['focus-competitions', roomId],
    queryFn: async (): Promise<FocusCompetition[]> => {
      const response = await fetch(`/api/social/competitions?roomId=${roomId}`)
      if (!response.ok) {
        throw new Error('대결 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!roomId,
  })
}

export function useCreateCompetition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { roomId: string; name: string; durationMinutes: number }): Promise<FocusCompetition> => {
      const response = await fetch('/api/social/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '대결 생성에 실패했습니다.')
      }

      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-competitions', variables.roomId] })
    }
  })
}

// =====================================================
// 3. 친구 시스템 관련 훅 (업데이트됨)
// =====================================================

// 친구 목록 조회
export function useFriends(search?: string) {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['friends', search],
    queryFn: async (): Promise<FriendsListResponse> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('limit', '50')

      const response = await fetch(`/api/social/friends?${params}`)
      if (!response.ok) {
        throw new Error('친구 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!user,
  })
}

// 친구 요청 보내기
export function useSendFriendRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateFriendRequestData) => {
      const response = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '친구 요청을 보내는데 실패했습니다.')
      }
      return response.json()
    },
    onSuccess: () => {
      // 친구 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      // 친구 요청 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    }
  })
}

// 친구 검색
export function useFriendSearch() {
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (search: string) => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch('/api/social/friends', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, limit: 20 })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '사용자 검색에 실패했습니다.')
      }
      return response.json()
    }
  })
}

// 받은 친구 요청 목록 조회
export function useFriendRequests() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: async (): Promise<FriendRequestsResponse> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch('/api/social/friends/requests')
      if (!response.ok) {
        throw new Error('친구 요청 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!user,
  })
}

// 친구 요청 응답 (수락/거절)
export function useRespondToFriendRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FriendRequestResponse) => {
      const response = await fetch('/api/social/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '요청 응답 처리에 실패했습니다.')
      }
      return response.json()
    },
    onSuccess: () => {
      // 친구 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      // 친구 요청 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    }
  })
}

// 친구 랭킹 조회
export function useFriendRanking(period: 'daily' | 'weekly' | 'monthly' = 'weekly') {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['friend-ranking', period],
    queryFn: async (): Promise<FriendRankingResponse> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch(`/api/social/friends/ranking?period=${period}`)
      if (!response.ok) {
        throw new Error('친구 랭킹을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!user,
    staleTime: 10000, // 10초
    refetchInterval: 30000, // 30초마다 자동 새로고침
  })
}

// 친구 삭제
export function useRemoveFriend() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (friendId: string) => {
      const response = await fetch(`/api/social/friends/${friendId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '친구 삭제에 실패했습니다.')
      }
      return response.json()
    },
    onSuccess: () => {
      // 친구 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      // 친구 랭킹 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-ranking'] })
    }
  })
}

// 친구 격려 메시지 기능은 제외됨

// 친구 활동 상태 업데이트
export function useUpdateFriendActivityStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { status: string, current_focus_score?: number }) => {
      const response = await fetch('/api/social/friends/activity-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '활동 상태 업데이트에 실패했습니다.')
      }
      return response.json()
    },
    onSuccess: () => {
      // 친구 목록 캐시 무효화 (활동 상태 포함)
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    }
  })
}

// =====================================================
// 4. 격려 메시지 관련 훅
// =====================================================

// 격려 메시지 기능은 제외됨
// export function useEncouragementMessages() {
//   const { data: user } = useUser()

//   return useQuery({
//     queryKey: ['encouragement-messages'],
//     queryFn: async (): Promise<any[]> => {
//       if (!user) throw new Error('로그인이 필요합니다.')

//       const response = await fetch('/api/social/encouragement')
//       if (!response.ok) {
//         throw new Error('격려 메시지를 불러오는데 실패했습니다.')
//       }
//       return response.json()
//     },
//     enabled: !!user,
//   })
// }

// 격려 메시지 기능은 제외됨
// export function useSendEncouragement() {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async (data: {
//       toUserId: string
//       roomId?: string
//       messageType: 'text' | 'emoji' | 'sticker' | 'ai_generated'
//       content: string
//     }): Promise<void> => {
//       const response = await fetch('/api/social/encouragement', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(data)
//       })

//       if (!response.ok) {
//         const error = await response.json()
//         throw new Error(error.error || '격려 메시지 전송에 실패했습니다.')
//       }
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['encouragement-messages'] })
//     }
//   })
// }

// export function useMarkMessageAsRead() {
//   const queryClient = useQueryClient()

//   return useMutation({
//     mutationFn: async (messageId: string): Promise<void> => {
//       const response = await fetch(`/api/social/encouragement/${messageId}/read`, {
//         method: 'PUT'
//       })

//       if (!response.ok) {
//         const error = await response.json()
//         throw new Error(error.error || '메시지 읽음 처리에 실패했습니다.')
//       }
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ['encouragement-messages'] })
//     }
//   })
// }

// =====================================================
// 5. 소셜 통계 관련 훅
// =====================================================

export function useSocialStats() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['social-stats'],
    queryFn: async (): Promise<any | null> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch('/api/social/stats')
      if (!response.ok) {
        throw new Error('소셜 통계를 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!user,
  })
}

// =====================================================
// 6. 실시간 업데이트 훅
// =====================================================

export function useRealTimeUpdates(roomId?: string) {
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  useEffect(() => {
    if (!roomId || !user) return

    // WebSocket 연결 및 실시간 업데이트 처리
    const handleFocusUpdate = (data: any) => {
      // 집중도 업데이트 시 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
    }

    const handleParticipantJoin = (data: any) => {
      // 참가자 입장 시 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    }

    const handleParticipantLeave = (data: any) => {
      // 참가자 퇴장 시 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    }

    // 이벤트 리스너 등록 (실제로는 WebSocket 이벤트)
    // window.addEventListener('focus-update', handleFocusUpdate)
    // window.addEventListener('participant-join', handleParticipantJoin)
    // window.addEventListener('participant-leave', handleParticipantLeave)

    return () => {
      // 이벤트 리스너 제거
      // window.removeEventListener('focus-update', handleFocusUpdate)
      // window.removeEventListener('participant-join', handleParticipantJoin)
      // window.removeEventListener('participant-leave', handleParticipantLeave)
    }
  }, [roomId, user, queryClient])

  return {
    // 실시간 업데이트 상태 반환
    isConnected: true, // 실제로는 WebSocket 연결 상태
  }
}

// 스터디룸 챌린지 조회
export function useStudyRoomChallenges() {
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['study-room-challenges'],
    queryFn: async (): Promise<StudyRoom[]> => {
      if (!user) throw new Error('로그인이 필요합니다.')

      const response = await fetch('/api/social/study-room?withChallenges=true')
      if (!response.ok) {
        throw new Error('스터디룸 챌린지를 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!user,
    staleTime: 30000, // 30초
    refetchInterval: 60000, // 1분마다 자동 새로고침
  })
}
