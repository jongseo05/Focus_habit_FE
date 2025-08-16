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
  FriendRequestResponse,
  FriendRankingResponse,
  FriendRequestsView
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
    refetchInterval: false, // 자동 새로고침 비활성화 (대시보드에서 사용 시)
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 5 * 60 * 1000, // 5분 후 가비지 컬렉션 (대시보드에서 사용 시)
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

export function useCreateStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateStudyRoomData): Promise<StudyRoom> => {
      const response = await fetch('/api/social/study-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error('스터디룸 생성에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리만 무효화 (전체 캐시 무효화 방지)
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    },
  })
}

export function useJoinStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }): Promise<void> => {
      const response = await fetch(`/api/social/study-room/${roomId}/join`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('스터디룸 입장에 실패했습니다.')
      }
    },
    onSuccess: (_, { roomId }) => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
    },
  })
}

export function useLeaveStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }): Promise<void> => {
      const response = await fetch(`/api/social/study-room/${roomId}/leave`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('스터디룸 퇴장에 실패했습니다.')
      }
    },
    onSuccess: (_, { roomId }) => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
    },
  })
}

export function useEndStudyRoom() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ roomId }: { roomId: string }): Promise<void> => {
      const response = await fetch(`/api/social/study-room/${roomId}/end`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('스터디룸 종료에 실패했습니다.')
      }
    },
    onSuccess: (_, { roomId }) => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
    },
  })
}

// =====================================================
// 2. 룸 참가자 관련 훅
// =====================================================

export function useRoomParticipants(roomId: string) {
  return useQuery({
    queryKey: ['room-participants', roomId],
    queryFn: async (): Promise<RoomParticipant[]> => {
      const response = await fetch(`/api/social/study-room/${roomId}/participants`)
      if (!response.ok) {
        throw new Error('참가자 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    enabled: !!roomId, // roomId가 있을 때만 실행
    staleTime: 15000, // 15초
    refetchInterval: false, // 자동 새로고침 비활성화
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 3 * 60 * 1000, // 3분 후 가비지 컬렉션
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

// =====================================================
// 3. 챌린지 관련 훅
// =====================================================

export function useCreateChallenge() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: any): Promise<any> => {
      const response = await fetch('/api/social/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error('챌린지 생성에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
    },
  })
}

export function useJoinChallenge() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ challengeId }: { challengeId: string }): Promise<void> => {
      const response = await fetch(`/api/social/challenge/${challengeId}/join`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('챌린지 참가에 실패했습니다.')
      }
    },
    onSuccess: (_, { challengeId }) => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] })
    },
  })
}

export function useTickChallenge() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ challengeId, progress }: { challengeId: string; progress: number }): Promise<void> => {
      const response = await fetch(`/api/social/challenge/${challengeId}/tick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ progress }),
      })
      
      if (!response.ok) {
        throw new Error('챌린지 진행도 업데이트에 실패했습니다.')
      }
    },
    onSuccess: (_, { challengeId }) => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['challenge', challengeId] })
    },
  })
}

// =====================================================
// 4. 친구 관련 훅
// =====================================================

export function useFriendsList() {
  return useQuery({
    queryKey: ['friends-list'],
    queryFn: async (): Promise<FriendsListResponse> => {
      const response = await fetch('/api/social/friends')
      if (!response.ok) {
        throw new Error('친구 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    staleTime: 60000, // 1분
    refetchInterval: false, // 자동 새로고침 비활성화
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 10 * 60 * 1000, // 10분 후 가비지 컬렉션
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

export function useFriendRequests() {
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: async (): Promise<FriendRequestsView[]> => {
      const response = await fetch('/api/social/friends/requests')
      if (!response.ok) {
        throw new Error('친구 요청 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    },
    staleTime: 30000, // 30초
    refetchInterval: false, // 자동 새로고침 비활성화
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 5 * 60 * 1000, // 5분 후 가비지 컬렉션
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

export function useCreateFriendRequest() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateFriendRequestData): Promise<FriendRequestResponse> => {
      const response = await fetch('/api/social/friends/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error('친구 요청 생성에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }): Promise<void> => {
      const response = await fetch(`/api/social/friends/requests/${requestId}/accept`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('친구 요청 수락에 실패했습니다.')
      }
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends-list'] })
    },
  })
}

export function useRejectFriendRequest() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }): Promise<void> => {
      const response = await fetch(`/api/social/friends/requests/${requestId}/reject`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('친구 요청 거절에 실패했습니다.')
      }
    },
    onSuccess: () => {
      // 성공 시 관련 쿼리만 무효화
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })
}

// =====================================================
// 5. 통계 관련 훅
// =====================================================

export function useSocialStats() {
  const { data: user } = useUser()
  
  return useQuery({
    queryKey: ['social-stats'],
    queryFn: async (): Promise<any | null> => {
      if (!user) return null
      
      const response = await fetch('/api/social/stats')
      if (!response.ok) {
        throw new Error('소셜 통계를 불러오는데 실패했습니다.')
      }

      return response.json()
    },
    enabled: !!user,
    staleTime: 300000, // 5분
    refetchInterval: false, // 자동 새로고침 비활성화
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 15 * 60 * 1000, // 15분 후 가비지 컬렉션
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
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
      // 집중도 업데이트 시 캐시 무효화 (선택적)
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
    }

    const handleParticipantJoin = (data: any) => {
      // 참가자 입장 시 캐시 무효화 (선택적)
      queryClient.invalidateQueries({ queryKey: ['room-participants', roomId] })
      queryClient.invalidateQueries({ queryKey: ['study-rooms'] })
    }

    const handleParticipantLeave = (data: any) => {
      // 참가자 퇴장 시 캐시 무효화 (선택적)
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
export function useStudyRoomChallenges(options?: { enabled?: boolean }) {
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
    enabled: options?.enabled !== undefined ? options.enabled && !!user : !!user,
    staleTime: 30000, // 30초
    refetchInterval: false, // 자동 새로고침 비활성화 (대시보드에서 사용 시)
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 5 * 60 * 1000, // 5분 후 가비지 컬렉션 (대시보드에서 사용 시)
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

// 친구 랭킹 조회
export function useFriendRanking(
  period: 'daily' | 'weekly' | 'monthly' = 'weekly',
  options?: { enabled?: boolean }
) {
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
    enabled: options?.enabled !== undefined ? options.enabled && !!user : !!user,
    staleTime: 10000, // 10초
    refetchInterval: false, // 자동 새로고침 비활성화 (대시보드에서 사용 시)
    refetchOnWindowFocus: false, // 윈도우 포커스 시 새로고침 비활성화
    gcTime: 5 * 60 * 1000, // 5분 후 가비지 컬렉션 (대시보드에서 사용 시)
    // 성능 최적화 추가
    refetchOnMount: false, // 마운트 시 자동 새로고침 비활성화
    refetchOnReconnect: false, // 재연결 시 자동 새로고침 비활성화
  })
}

// =====================================================
// 7. 추가 친구 관련 훅 (누락된 함수들)
// =====================================================

// 친구 목록 조회 (useFriendsList와 동일하지만 useFriends로도 사용 가능)
export const useFriends = useFriendsList

// 친구 검색
export function useFriendSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const searchFriends = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/social/friends/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('친구 검색 중 오류 발생:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchFriends,
  }
}

// 친구 요청 보내기 (useCreateFriendRequest와 동일하지만 useSendFriendRequest로도 사용 가능)
export const useSendFriendRequest = useCreateFriendRequest

// 친구 요청 응답 (수락/거절)
export function useRespondToFriendRequest() {
  const queryClient = useQueryClient()
  
  const acceptRequest = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }): Promise<void> => {
      const response = await fetch(`/api/social/friends/requests/${requestId}/accept`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('친구 요청 수락에 실패했습니다.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
      queryClient.invalidateQueries({ queryKey: ['friends-list'] })
    },
  })

  const rejectRequest = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }): Promise<void> => {
      const response = await fetch(`/api/social/friends/requests/${requestId}/reject`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error('친구 요청 거절에 실패했습니다.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] })
    },
  })

  return {
    acceptRequest,
    rejectRequest,
  }
}

// 친구 삭제
export function useRemoveFriend() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ friendId }: { friendId: string }): Promise<void> => {
      const response = await fetch(`/api/social/friends/${friendId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('친구 삭제에 실패했습니다.')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-list'] })
    },
  })
}
