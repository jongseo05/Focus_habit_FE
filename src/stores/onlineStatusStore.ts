import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 온라인 상태 타입
export type OnlineStatus = 'online' | 'offline' | 'checking'

// 친구 활동 상태 타입
export type FriendActivityStatus = 'online' | 'offline' | 'focusing' | 'break' | 'away'

// 참가자 온라인 상태
export interface ParticipantOnlineStatus {
  participant_id: string
  user_id: string
  is_connected: boolean
  last_activity: string
  online_status: OnlineStatus
  user: {
    name: string
    avatar_url?: string
  }
}

// 친구 온라인 상태
export interface FriendOnlineStatus {
  user_id: string
  activity_status: FriendActivityStatus
  current_focus_score?: number
  last_activity: string
  current_session_id?: string
  user: {
    name: string
    avatar_url?: string
    handle: string
  }
}

interface OnlineStatusState {
  // 현재 사용자 온라인 상태
  currentUserStatus: OnlineStatus
  lastActivityTime: number | null
  
  // 스터디룸 참가자들의 온라인 상태
  roomParticipants: ParticipantOnlineStatus[]
  currentRoomId: string | null
  
  // 친구들의 온라인 상태
  friends: FriendOnlineStatus[]
  
  // 온라인 상태 체크 설정
  checkInterval: number // ms
  offlineThreshold: number // ms (30초)
  
  // 상태 관리
  isInitialized: boolean
  lastUpdateTime: number | null
}

interface OnlineStatusActions {
  // 현재 사용자 상태 관리
  setCurrentUserStatus: (status: OnlineStatus) => void
  updateLastActivity: () => void
  checkCurrentUserOnline: () => boolean
  
  // 스터디룸 참가자 관리
  setRoomParticipants: (roomId: string, participants: ParticipantOnlineStatus[]) => void
  updateParticipantStatus: (userId: string, status: Partial<ParticipantOnlineStatus>) => void
  removeParticipant: (userId: string) => void
  clearRoomParticipants: () => void
  
  // 친구 온라인 상태 관리
  setFriends: (friends: FriendOnlineStatus[]) => void
  updateFriendStatus: (userId: string, status: Partial<FriendOnlineStatus>) => void
  removeFriend: (userId: string) => void
  clearFriends: () => void
  
  // 온라인 상태 계산
  getOnlineParticipants: () => ParticipantOnlineStatus[]
  getOfflineParticipants: () => ParticipantOnlineStatus[]
  isUserOnline: (userId: string) => boolean
  
  // 친구 온라인 상태 계산
  getOnlineFriends: () => FriendOnlineStatus[]
  getOfflineFriends: () => FriendOnlineStatus[]
  getFocusingFriends: () => FriendOnlineStatus[]
  isFriendOnline: (userId: string) => boolean
  getFriendStatus: (userId: string) => FriendActivityStatus | null
  
  // 설정 관리
  setCheckInterval: (interval: number) => void
  setOfflineThreshold: (threshold: number) => void
  
  // 초기화
  initialize: () => void
  reset: () => void
}

type OnlineStatusStore = OnlineStatusState & OnlineStatusActions

const initialState: OnlineStatusState = {
  currentUserStatus: 'checking',
  lastActivityTime: null,
  roomParticipants: [],
  currentRoomId: null,
  friends: [],
  checkInterval: 10000, // 10초마다 체크
  offlineThreshold: 30000, // 30초
  isInitialized: false,
  lastUpdateTime: null
}

export const useOnlineStatusStore = create<OnlineStatusStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 현재 사용자 상태 관리
      setCurrentUserStatus: (status: OnlineStatus) => {
        set({ currentUserStatus: status })
      },
      
      updateLastActivity: () => {
        const now = Date.now()
        set({ lastActivityTime: now })
        
        // 현재 사용자를 온라인으로 설정
        if (get().currentUserStatus !== 'online') {
          set({ currentUserStatus: 'online' })
        }
      },
      
      checkCurrentUserOnline: () => {
        const { lastActivityTime, offlineThreshold } = get()
        if (!lastActivityTime) return false
        
        const now = Date.now()
        const timeDiff = now - lastActivityTime
        
        return timeDiff <= offlineThreshold
      },
      
      // 스터디룸 참가자 관리
      setRoomParticipants: (roomId: string, participants: ParticipantOnlineStatus[]) => {
        const currentState = get()
        
        // 중복 업데이트 방지: 참가자 목록이 동일하면 업데이트하지 않음
        const currentParticipantIds = currentState.roomParticipants.map(p => p.participant_id).sort().join(',')
        const newParticipantIds = participants.map(p => p.participant_id).sort().join(',')
        
        if (currentParticipantIds === newParticipantIds && currentState.currentRoomId === roomId) {
          return // 동일한 데이터면 업데이트하지 않음
        }
        
        const processedParticipants = participants.map(participant => {
          if (!participant.is_connected) {
            return { ...participant, online_status: 'offline' as OnlineStatus }
          }
          
          const lastActivity = new Date(participant.last_activity)
          const now = new Date()
          const timeDiff = now.getTime() - lastActivity.getTime()
          
          return {
            ...participant,
            online_status: timeDiff <= get().offlineThreshold ? 'online' as OnlineStatus : 'offline' as OnlineStatus
          }
        })
        
        set({ 
          roomParticipants: processedParticipants,
          currentRoomId: roomId,
          lastUpdateTime: Date.now()
        })
      },
      
      updateParticipantStatus: (userId: string, status: Partial<ParticipantOnlineStatus>) => {
        set(state => ({
          roomParticipants: state.roomParticipants.map(participant =>
            participant.user_id === userId
              ? {
                  ...participant,
                  ...status,
                  online_status: (() => {
                    const updatedParticipant = { ...participant, ...status }
                    if (!updatedParticipant.is_connected) return 'offline' as OnlineStatus
                    
                    const lastActivity = new Date(updatedParticipant.last_activity)
                    const now = new Date()
                    const timeDiff = now.getTime() - lastActivity.getTime()
                    
                    return timeDiff <= get().offlineThreshold ? 'online' as OnlineStatus : 'offline' as OnlineStatus
                  })()
                }
              : participant
          )
        }))
      },
      
      removeParticipant: (userId: string) => {
        set(state => ({
          roomParticipants: state.roomParticipants.filter(p => p.user_id !== userId)
        }))
      },
      
      clearRoomParticipants: () => {
        set({ roomParticipants: [], currentRoomId: null })
      },
      
      // 친구 온라인 상태 관리
      setFriends: (friends: FriendOnlineStatus[]) => {
        const processedFriends = friends.map(friend => {
          const lastActivity = new Date(friend.last_activity)
          const now = new Date()
          const timeDiff = now.getTime() - lastActivity.getTime()
          
          // 30초 이상 활동이 없으면 오프라인
          if (timeDiff > get().offlineThreshold) {
            return { ...friend, activity_status: 'offline' as FriendActivityStatus }
          }
          
          // 현재 상태가 있으면 그대로 유지 (focusing, break, away)
          if (friend.activity_status && friend.activity_status !== 'online' && friend.activity_status !== 'offline') {
            return friend
          }
          
          // 기본적으로 온라인
          return { ...friend, activity_status: 'online' as FriendActivityStatus }
        })
        
        set({ 
          friends: processedFriends,
          lastUpdateTime: Date.now()
        })
      },
      
      updateFriendStatus: (userId: string, status: Partial<FriendOnlineStatus>) => {
        set(state => ({
          friends: state.friends.map(friend =>
            friend.user_id === userId
              ? {
                  ...friend,
                  ...status,
                  activity_status: (() => {
                    const updatedFriend = { ...friend, ...status }
                    const lastActivity = new Date(updatedFriend.last_activity)
                    const now = new Date()
                    const timeDiff = now.getTime() - lastActivity.getTime()
                    
                    // 30초 이상 활동이 없으면 오프라인
                    if (timeDiff > get().offlineThreshold) {
                      return 'offline' as FriendActivityStatus
                    }
                    
                    // 현재 상태가 있으면 그대로 유지 (focusing, break, away)
                    if (updatedFriend.activity_status && updatedFriend.activity_status !== 'online' && updatedFriend.activity_status !== 'offline') {
                      return updatedFriend.activity_status
                    }
                    
                    // 기본적으로 온라인
                    return 'online' as FriendActivityStatus
                  })()
                }
              : friend
          )
        }))
      },
      
      removeFriend: (userId: string) => {
        set(state => ({
          friends: state.friends.filter(f => f.user_id !== userId)
        }))
      },
      
      clearFriends: () => {
        set({ friends: [] })
      },
      
      // 온라인 상태 계산
      getOnlineParticipants: () => {
        const { roomParticipants } = get()
        return roomParticipants.filter(p => p.online_status === 'online')
      },
      
      getOfflineParticipants: () => {
        const { roomParticipants } = get()
        return roomParticipants.filter(p => p.online_status === 'offline')
      },
      
      isUserOnline: (userId: string) => {
        const participant = get().roomParticipants.find(p => p.user_id === userId)
        return participant?.online_status === 'online'
      },
      
      // 친구 온라인 상태 계산
      getOnlineFriends: () => {
        const { friends } = get()
        return friends.filter(f => f.activity_status === 'online')
      },
      
      getOfflineFriends: () => {
        const { friends } = get()
        return friends.filter(f => f.activity_status === 'offline')
      },
      
      getFocusingFriends: () => {
        const { friends } = get()
        return friends.filter(f => f.activity_status === 'focusing')
      },
      
      isFriendOnline: (userId: string) => {
        const friend = get().friends.find(f => f.user_id === userId)
        return friend?.activity_status === 'online' || friend?.activity_status === 'focusing'
      },
      
      getFriendStatus: (userId: string) => {
        const friend = get().friends.find(f => f.user_id === userId)
        return friend?.activity_status || null
      },
      
      // 온라인 상태 계산 헬퍼 함수
      calculateOnlineStatus: (participant: ParticipantOnlineStatus): OnlineStatus => {
        if (!participant.is_connected) return 'offline'
        
        const lastActivity = new Date(participant.last_activity)
        const now = new Date()
        const timeDiff = now.getTime() - lastActivity.getTime()
        
        return timeDiff <= get().offlineThreshold ? 'online' : 'offline'
      },
      
      // 친구 활동 상태 계산 헬퍼 함수
      calculateFriendActivityStatus: (friend: FriendOnlineStatus): FriendActivityStatus => {
        const lastActivity = new Date(friend.last_activity)
        const now = new Date()
        const timeDiff = now.getTime() - lastActivity.getTime()
        
        // 30초 이상 활동이 없으면 오프라인
        if (timeDiff > get().offlineThreshold) {
          return 'offline'
        }
        
        // 현재 상태가 있으면 그대로 유지 (focusing, break, away)
        if (friend.activity_status && friend.activity_status !== 'online' && friend.activity_status !== 'offline') {
          return friend.activity_status
        }
        
        // 기본적으로 온라인
        return 'online'
      },
      
      // 설정 관리
      setCheckInterval: (interval: number) => {
        set({ checkInterval: interval })
      },
      
      setOfflineThreshold: (threshold: number) => {
        set({ offlineThreshold: threshold })
      },
      
      // 초기화
      initialize: () => {
        const { updateLastActivity } = get()
        
        // 초기 활동 시간 설정
        updateLastActivity()
        
        // 주기적으로 온라인 상태 체크
        const interval = setInterval(() => {
          const { checkCurrentUserOnline, setCurrentUserStatus } = get()
          const isOnline = checkCurrentUserOnline()
          
          setCurrentUserStatus(isOnline ? 'online' : 'offline')
        }, get().checkInterval)
        
        // 참가자들의 온라인 상태도 주기적으로 업데이트
        const participantInterval = setInterval(() => {
          const { roomParticipants } = get()
          if (roomParticipants.length > 0) {
            const updatedParticipants = roomParticipants.map(participant => {
              if (!participant.is_connected) {
                return { ...participant, online_status: 'offline' as OnlineStatus }
              }
              
              const lastActivity = new Date(participant.last_activity)
              const now = new Date()
              const timeDiff = now.getTime() - lastActivity.getTime()
              
              return {
                ...participant,
                online_status: timeDiff <= get().offlineThreshold ? 'online' as OnlineStatus : 'offline' as OnlineStatus
              }
            })
            
            set({ roomParticipants: updatedParticipants })
          }
        }, get().checkInterval)
        
        // 친구들의 활동 상태도 주기적으로 업데이트
        const friendInterval = setInterval(() => {
          const { friends } = get()
          if (friends.length > 0) {
            const updatedFriends = friends.map(friend => {
              const lastActivity = new Date(friend.last_activity)
              const now = new Date()
              const timeDiff = now.getTime() - lastActivity.getTime()
              
              // 30초 이상 활동이 없으면 오프라인
              if (timeDiff > get().offlineThreshold) {
                return { ...friend, activity_status: 'offline' as FriendActivityStatus }
              }
              
              // 현재 상태가 있으면 그대로 유지 (focusing, break, away)
              if (friend.activity_status && friend.activity_status !== 'online' && friend.activity_status !== 'offline') {
                return friend
              }
              
              // 기본적으로 온라인
              return { ...friend, activity_status: 'online' as FriendActivityStatus }
            })
            
            set({ friends: updatedFriends })
          }
        }, get().checkInterval)
        
        set({ isInitialized: true })
        
        // 클린업 함수 반환 (컴포넌트에서 사용)
        return () => {
          clearInterval(interval)
          clearInterval(participantInterval)
          clearInterval(friendInterval)
        }
      },
      
      reset: () => {
        set(initialState)
      }
    }),
    {
      name: 'online-status-store',
      partialize: (state) => ({
        currentUserStatus: state.currentUserStatus,
        lastActivityTime: state.lastActivityTime,
        checkInterval: state.checkInterval,
        offlineThreshold: state.offlineThreshold
      })
    }
  )
)

// 편의 훅들
export const useOnlineStatus = () => {
  const store = useOnlineStatusStore()
  
  return {
    currentUserStatus: store.currentUserStatus,
    isCurrentUserOnline: store.currentUserStatus === 'online',
    updateLastActivity: store.updateLastActivity,
    checkCurrentUserOnline: store.checkCurrentUserOnline
  }
}

export const useRoomOnlineStatus = (roomId: string) => {
  const store = useOnlineStatusStore()
  
  return {
    participants: store.roomParticipants,
    onlineParticipants: store.getOnlineParticipants(),
    offlineParticipants: store.getOfflineParticipants(),
    isUserOnline: store.isUserOnline,
    setRoomParticipants: (participants: ParticipantOnlineStatus[]) => 
      store.setRoomParticipants(roomId, participants),
    updateParticipantStatus: store.updateParticipantStatus,
    removeParticipant: store.removeParticipant,
    clearRoomParticipants: store.clearRoomParticipants
  }
}

export const useFriendsOnlineStatus = () => {
  const store = useOnlineStatusStore()
  
  return {
    friends: store.friends,
    onlineFriends: store.getOnlineFriends(),
    offlineFriends: store.getOfflineFriends(),
    focusingFriends: store.getFocusingFriends(),
    isFriendOnline: store.isFriendOnline,
    getFriendStatus: store.getFriendStatus,
    setFriends: store.setFriends,
    updateFriendStatus: store.updateFriendStatus,
    removeFriend: store.removeFriend,
    clearFriends: store.clearFriends
  }
}
