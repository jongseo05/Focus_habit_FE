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

export function FriendsList({ onAddFriend, onFriendAdded }: FriendsListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [showAddFriendMode, setShowAddFriendMode] = useState(false)
  
  const { data: friendsData, isLoading, error } = useFriends(searchTerm)
  const removeFriendMutation = useRemoveFriend()
  const searchMutation = useFriendSearch()
  const sendRequestMutation = useSendFriendRequest()

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    try {
      await removeFriendMutation.mutateAsync(friendId)
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

  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      toast.error('검색어는 최소 2자 이상이어야 합니다.')
      return
    }

    try {
      setIsSearching(true)
      const result = await searchMutation.mutateAsync(searchTerm)
      if (result.results.length === 0) {
        toast.info('검색 결과가 없습니다.')
      }
    } catch (error) {
      toast.error('검색에 실패했습니다.')
    } finally {
      setIsSearching(false)
    }
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
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
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
          <p className="text-red-500">친구 목록을 불러오는데 실패했습니다.</p>
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
        
                 <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
             <Input
               placeholder={showAddFriendMode ? "추가할 친구를 검색하세요..." : "친구 검색..."}
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               onKeyPress={(e) => {
                 if (e.key === 'Enter' && showAddFriendMode) {
                   handleSearch()
                 }
               }}
               className="pl-10"
             />
           </div>
           {showAddFriendMode && (
             <Button 
               onClick={handleSearch}
               disabled={searchMutation.isPending || !searchTerm.trim()}
               size="sm"
             >
               검색
             </Button>
           )}
         </div>
      </CardHeader>
      
             <CardContent>
         {showAddFriendMode ? (
           // 친구 추가 모드
           <div>
             {searchMutation.isPending ? (
               <div className="space-y-4">
                 <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                 <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                 <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
               </div>
             ) : searchMutation.data?.results && searchMutation.data.results.length > 0 ? (
               <div className="space-y-3">
                 {searchMutation.data.results.map((user: any) => (
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
             ) : searchMutation.data?.results && searchMutation.data.results.length === 0 ? (
               <div className="text-center py-8">
                 <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                 <p className="text-gray-500">검색 결과가 없습니다.</p>
               </div>
             ) : (
               <div className="text-center py-8">
                 <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                 <p className="text-gray-500">추가할 친구를 검색해보세요.</p>
               </div>
             )}
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
           <div className="text-center py-8">
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
         )}
      </CardContent>
    </Card>
  )
}
