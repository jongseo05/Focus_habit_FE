'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, UserPlus, UserMinus, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useFriendsOnlineStatus } from '@/stores/onlineStatusStore'

interface FriendsListProps {
  onAddFriend?: () => void
  onFriendAdded?: () => void
}

// 친구 검색 결과 컴포넌트
function AddFriendResults({ 
  searchTerm, 
  searchResults, 
  isSearching,
  sendRequestMutation, 
  handleSendRequest 
}: {
  searchTerm: string
  searchResults: any[]
  isSearching: boolean
  sendRequestMutation: any
  handleSendRequest: (userId: string, userName: string) => void
}) {
  if (searchTerm.trim().length >= 2 && isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="space-y-4 w-full max-w-sm">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (searchResults && searchResults.length > 0) {
    return (
      <div className="space-y-3">
        {searchResults.map((user) => (
          <div
            key={user.user_id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url} alt={user.display_name} />
                <AvatarFallback>
                  {user.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{user.display_name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    @{user.handle}
                  </Badge>
                </div>
                {user.bio && (
                  <p className="text-sm text-gray-500">{user.bio}</p>
                )}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendRequest(user.user_id, user.display_name)}
              disabled={sendRequestMutation.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              친구 추가
            </Button>
          </div>
        ))}
      </div>
    )
  }

  if (searchTerm.trim().length >= 2 && !isSearching) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="text-center">
          <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">검색 결과가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <div className="text-center">
        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">친구를 검색해보세요.</p>
      </div>
    </div>
  )
}

export function FriendsList({ onAddFriend, onFriendAdded }: FriendsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddFriendMode, setShowAddFriendMode] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const queryClient = useQueryClient()

  // 전역 친구 온라인 상태 사용
  const { 
    friends, 
    setFriends, 
    getFriendStatus,
    isFriendOnline 
  } = useFriendsOnlineStatus()

  // 친구 목록 조회
  const { data: friendsData, isLoading, error } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const response = await fetch('/api/social/friends')
      if (!response.ok) {
        throw new Error('친구 목록을 불러오는데 실패했습니다.')
      }
      return response.json()
    }
  })

  // 친구 목록을 전역 스토어에 동기화
  useEffect(() => {
    if (friendsData?.friends && friendsData.friends.length > 0) {
      const friendsWithStatus = friendsData.friends.map((friend: any) => ({
        user_id: friend.friend_id,
        activity_status: friend.activity_status || 'offline',
        current_focus_score: friend.current_focus_score,
        last_activity: friend.last_activity || new Date().toISOString(),
        current_session_id: friend.current_session_id,
        user: {
          name: friend.friend_name,
          avatar_url: friend.friend_avatar,
          handle: friend.friend_handle
        }
      }))
      setFriends(friendsWithStatus)
    }
  }, [friendsData, setFriends])

  // 친구 검색
  const handleSearchChange = async (value: string) => {
    setSearchTerm(value)
    
    if (value.trim().length >= 2) {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/social/friends/search?search=${encodeURIComponent(value)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('친구 검색 실패:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    } else {
      setSearchResults([])
      setIsSearching(false)
    }
  }

  // 검색창 렌더링을 위한 독립적인 상태
  const [inputValue, setInputValue] = useState('')
  
  // 검색창 입력 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    handleSearchChange(value)
  }

  // 친구 요청 전송
  const sendRequestMutation = useMutation({
    mutationFn: async ({ to_user_id, message }: { to_user_id: string; message?: string }) => {
      const response = await fetch('/api/social/friends/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to_user_id, message }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '친구 요청 전송에 실패했습니다.')
      }
      
      return response.json()
    }
  })

  // 친구 삭제
  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const response = await fetch(`/api/social/friends/${friendId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('친구 삭제에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      toast.success('친구가 삭제되었습니다.')
    },
    onError: (error: any) => {
      toast.error(error.message || '친구 삭제에 실패했습니다.')
    }
  })

  const handleSendRequest = async (userId: string, userName: string) => {
    try {
      await sendRequestMutation.mutateAsync({
        to_user_id: userId,
        message: undefined
      })
      toast.success(`${userName}님에게 친구 요청을 보냈습니다.`)
      // 친구 추가 모드 종료
      setShowAddFriendMode(false)
      setSearchTerm('')
      onFriendAdded?.()
    } catch (error: any) {
      toast.error(error.message || '친구 요청 전송에 실패했습니다.')
    }
  }

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (confirm(`${friendName}님을 친구 목록에서 삭제하시겠습니까?`)) {
      removeFriendMutation.mutate(friendId)
    }
  }

  const handleAddFriendMode = () => {
    setShowAddFriendMode(true)
    setSearchTerm('')
    setSearchResults([])
    onAddFriend?.()
  }

  // 상태 색상 및 텍스트 함수 (전역 상태 사용)
  const getStatusColor = (userId: string) => {
    const status = getFriendStatus(userId)
    switch (status) {
      case 'focusing':
        return 'bg-red-500'
      case 'online':
        return 'bg-green-500'
      case 'break':
        return 'bg-yellow-500'
      case 'away':
        return 'bg-orange-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getStatusText = (userId: string) => {
    const status = getFriendStatus(userId)
    switch (status) {
      case 'focusing':
        return '집중 중'
      case 'online':
        return '온라인'
      case 'break':
        return '휴식 중'
      case 'away':
        return '자리 비움'
      default:
        return '오프라인'
    }
  }

  const formatLastActivity = (lastActivity?: string) => {
    if (!lastActivity) return '알 수 없음'
    
    const now = new Date()
    const activity = new Date(lastActivity)
    const diffMs = now.getTime() - activity.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}시간 전`
    return `${Math.floor(diffMins / 1440)}일 전`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            친구 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="space-y-4 w-full max-w-sm">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            친구 목록
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="min-h-[200px] flex items-center justify-center">
            <p className="text-red-500">친구 목록을 불러오는데 실패했습니다.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            친구 목록 ({friendsData?.total_count || 0})
          </CardTitle>
          {!showAddFriendMode && onAddFriend && (
            <Button onClick={handleAddFriendMode} variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              친구 추가
            </Button>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={showAddFriendMode ? "추가할 친구를 검색하세요..." : "친구 검색..."}
            value={inputValue}
            onChange={handleInputChange}
            className="pl-10"
            disabled={false}
          />
        </div>
        {inputValue.trim().length > 0 && inputValue.trim().length < 2 && showAddFriendMode && (
          <p className="text-sm text-gray-500 mt-1">최소 2자 이상 입력해주세요</p>
        )}
      </CardHeader>
      
      <CardContent>
        {showAddFriendMode ? (
          // 친구 추가 모드
          <div className="min-h-[200px]">
            <AddFriendResults
              searchTerm={searchTerm}
              searchResults={searchResults}
              isSearching={isSearching}
              sendRequestMutation={sendRequestMutation}
              handleSendRequest={handleSendRequest}
            />
          </div>
        ) : friendsData?.friends && friendsData.friends.length > 0 ? (
          <div className="space-y-3">
            {friendsData.friends.map((friend: any) => (
              <div
                key={friend.friendship_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.friend_avatar} alt={friend.friend_name} />
                      <AvatarFallback>
                        {friend.friend_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(friend.friend_id)}`} />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{friend.friend_name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {getStatusText(friend.friend_id)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      @{friend.friend_handle}
                    </p>
                    <p className="text-xs text-gray-400">
                      마지막 활동: {formatLastActivity(friend.last_activity)}
                    </p>
                    {friend.current_focus_score !== undefined && (
                      <p className="text-xs text-blue-600">
                        현재 집중도: {friend.current_focus_score}%
                      </p>
                    )}
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFriend(friend.friend_id, friend.friend_name)}
                  disabled={removeFriendMutation.isPending}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
                 ) : (
           <div className="min-h-[200px] flex items-center justify-center">
             <div className="text-center">
               <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
               <p className="text-gray-500 mb-2">
                 {searchTerm ? '검색 결과가 없습니다.' : '아직 친구가 없습니다.'}
               </p>
               {!searchTerm && onAddFriend && (
                 <Button onClick={handleAddFriendMode} variant="outline">
                   <UserPlus className="h-4 w-4 mr-2" />
                   친구 추가하기
                 </Button>
               )}
             </div>
           </div>
         )}
      </CardContent>
    </Card>
  )
}
