'use client'

import { useState } from 'react'
import { useFriends, useRemoveFriend, useFriendSearch, useSendFriendRequest } from '@/hooks/useSocial'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, UserMinus, Users, UserPlus, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface FriendsListProps {
  onAddFriend?: () => void
  onFriendAdded?: () => void
}

// 검색 결과 영역을 별도 컴포넌트로 분리
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
        {searchResults.map((user: any) => (
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
                <h4 className="font-medium">{user.display_name}</h4>
                <p className="text-sm text-gray-500">
                  @{user.handle}
                </p>
                {user.bio && (
                  <p className="text-sm text-gray-600 mt-1">
                    {user.bio}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              {user.is_friend ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  친구
                </Badge>
              ) : user.has_pending_request ? (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  요청 대기 중
                </Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleSendRequest(user.user_id, user.display_name)}
                  disabled={sendRequestMutation.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  친구 요청
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (searchTerm.trim().length >= 2 && searchResults && searchResults.length === 0) {
    return (
      <div className="text-center py-8">
        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">검색 결과가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500">추가할 친구를 검색해보세요.</p>
    </div>
  )
}

export function FriendsList({ onAddFriend, onFriendAdded }: FriendsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showAddFriendMode, setShowAddFriendMode] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  
  const { data: friendsData, isLoading, error } = useFriends()
  const removeFriendMutation = useRemoveFriend()
  const sendRequestMutation = useSendFriendRequest()

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    try {
      await removeFriendMutation.mutateAsync({ friendId })
      toast.success(`${friendName}님을 친구 목록에서 삭제했습니다.`)
      onFriendAdded?.() // 친구 목록 새로고침
    } catch (error) {
      toast.error('친구 삭제에 실패했습니다.')
    }
  }

  const handleAddFriendMode = () => {
    setShowAddFriendMode(true)
    setSearchTerm('')
  }

  // 실시간 검색을 위한 처리
  const handleSearchChange = async (value: string) => {
    setSearchTerm(value)
    
    if (value.trim().length >= 2) {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/social/friends/search?q=${encodeURIComponent(value.trim())}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        } else {
          setSearchResults([])
        }
      } catch (error) {
        console.error('친구 검색 중 오류 발생:', error)
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

  const getStatusColor = (status?: string) => {
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

  const getStatusText = (status?: string) => {
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
          {/* 친구가 있을 때만 오른쪽 위에 버튼 표시 */}
          {friendsData?.friends && friendsData.friends.length > 0 && !showAddFriendMode && onAddFriend && (
            <Button onClick={handleAddFriendMode} size="sm" variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              친구 추가
            </Button>
          )}
          {showAddFriendMode && (
            <Button onClick={() => setShowAddFriendMode(false)} size="sm" variant="outline">
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
          )}
        </div>
        
        <div>
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
        </div>
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
            {friendsData.friends.map((friend) => (
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
                    <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(friend.activity_status)}`} />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{friend.friend_name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {getStatusText(friend.activity_status)}
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
