'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, UserPlus, Check, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useFriendsOnlineStatus } from '@/stores/onlineStatusStore'

interface FriendSearchProps {
  onUserSelect?: (user: any) => void
  mode?: 'search' | 'add'
  onClose?: () => void
}

// 검색 결과 영역을 별도 컴포넌트로 분리
function SearchResults({ 
  searchTerm, 
  searchResults, 
  isSearching,
  sendRequestMutation, 
  setSelectedUser, 
  mode 
}: {
  searchTerm: string
  searchResults: any[]
  isSearching: boolean
  sendRequestMutation: any
  setSelectedUser: (user: any) => void
  mode: 'search' | 'add'
}) {
  // 전역 친구 온라인 상태 사용
  const { getFriendStatus } = useFriendsOnlineStatus()

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
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url} alt={user.display_name} />
                  <AvatarFallback>
                    {user.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor(user.user_id)}`} />
              </div>
              
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
                <p className="text-xs text-gray-400">
                  {getStatusText(user.user_id)}
                </p>
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
              ) : mode === 'add' ? (
                <Button
                  size="sm"
                  onClick={() => sendRequestMutation.mutate({ to_user_id: user.user_id })}
                  disabled={sendRequestMutation.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  친구 요청
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedUser(user)}
                >
                  선택
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (searchTerm.trim().length >= 2 && !isSearching) {
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
      <p className="text-gray-500">검색할 사용자를 입력해보세요.</p>
    </div>
  )
}

export function FriendSearch({ onUserSelect, mode = 'search', onClose }: FriendSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const queryClient = useQueryClient()

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
    },
    onSuccess: () => {
      toast.success('친구 요청을 보냈습니다.')
      queryClient.invalidateQueries({ queryKey: ['friends'] })
    },
    onError: (error: any) => {
      toast.error(error.message || '친구 요청 전송에 실패했습니다.')
    }
  })

  // 실시간 검색을 위한 처리
  const handleSearchChange = async (value: string) => {
    setSearchTerm(value)
    
    if (value.trim().length >= 2) {
      setIsSearching(true)
      try {
        const response = await fetch(`/api/social/friends/search?search=${encodeURIComponent(value.trim())}`)
        if (response.ok) {
          const result = await response.json()
          // 표준 API 응답 구조에 맞게 데이터 추출
          if (result.success && result.data) {
            setSearchResults(Array.isArray(result.data.results) ? result.data.results : Array.isArray(result.data) ? result.data : [])
          } else {
            setSearchResults([])
          }
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

  // 검색창 입력 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    handleSearchChange(value)
  }

  // 사용자 선택 처리
  const handleUserSelect = (user: any) => {
    setSelectedUser(user)
    onUserSelect?.(user)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          {mode === 'add' ? '친구 추가' : '사용자 검색'}
        </CardTitle>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="사용자명 또는 핸들로 검색..."
            value={searchTerm}
            onChange={handleInputChange}
            className="pl-10"
          />
        </div>
        {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
          <p className="text-sm text-gray-500">최소 2자 이상 입력해주세요</p>
        )}
      </CardHeader>
      
      <CardContent>
        {selectedUser ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.avatar_url} alt={selectedUser.display_name} />
                  <AvatarFallback>
                    {selectedUser.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium">{selectedUser.display_name}</h4>
                  <p className="text-sm text-gray-500">@{selectedUser.handle}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedUser(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <SearchResults
            searchTerm={searchTerm}
            searchResults={searchResults}
            isSearching={isSearching}
            sendRequestMutation={sendRequestMutation}
            setSelectedUser={handleUserSelect}
            mode={mode}
          />
        )}
      </CardContent>
    </Card>
  )
}
