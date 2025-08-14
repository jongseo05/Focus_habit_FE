'use client'

import { useState } from 'react'
import { useFriendSearch, useSendFriendRequest } from '@/hooks/useSocial'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, UserPlus, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface FriendSearchProps {
  onClose?: () => void
  mode?: 'search' | 'add'
}

export function FriendSearch({ onClose, mode = 'search' }: FriendSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [message, setMessage] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  
  const searchMutation = useFriendSearch()
  const sendRequestMutation = useSendFriendRequest()

  const handleSearch = async () => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      toast.error('검색어는 최소 2자 이상이어야 합니다.')
      return
    }

    try {
      const result = await searchMutation.mutateAsync(searchTerm)
      if (result.results.length === 0) {
        toast.info('검색 결과가 없습니다.')
      }
    } catch (error) {
      toast.error('검색에 실패했습니다.')
    }
  }

  const handleSendRequest = async (userId: string, userName: string) => {
    try {
      await sendRequestMutation.mutateAsync({
        to_user_id: userId,
        message: message.trim() || undefined
      })
      toast.success(`${userName}님에게 친구 요청을 보냈습니다.`)
      setMessage('')
      setSelectedUser(null)
      
      // 친구 추가 모드에서 요청 성공 시 모달 닫기
      if (mode === 'add') {
        onClose?.()
      }
    } catch (error: any) {
      toast.error(error.message || '친구 요청 전송에 실패했습니다.')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Search className="h-5 w-5" />
          {mode === 'add' ? '친구 추가' : '친구 검색'}
        </h2>
        {onClose && (
          <Button onClick={onClose} variant="ghost" size="sm">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={mode === 'add' ? "추가할 친구를 검색하세요..." : "사용자명 또는 핸들로 검색..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={handleSearch}
          disabled={searchMutation.isPending || !searchTerm.trim()}
        >
          검색
        </Button>
      </div>
      
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
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url} alt={user.display_name} />
                      <AvatarFallback>
                        {user.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {user.current_focus_score !== undefined && (
                      <div className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${getStatusColor('online')}`} />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{user.display_name}</h4>
                      {user.current_focus_score !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          {getStatusText('online')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      @{user.handle}
                    </p>
                    {user.bio && (
                      <p className="text-sm text-gray-600 mt-1">
                        {user.bio}
                      </p>
                    )}
                    {user.current_focus_score !== undefined && (
                      <p className="text-xs text-blue-600">
                        현재 집중도: {user.current_focus_score}%
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
                      onClick={() => setSelectedUser(user)}
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
             <p className="text-gray-500">
               {mode === 'add' ? '추가할 친구를 검색해보세요.' : '사용자명이나 핸들로 검색해보세요.'}
             </p>
           </div>
         )}
      </div>

      {/* 친구 요청 메시지 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {selectedUser.display_name}님에게 친구 요청
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                메시지 (선택사항)
              </label>
              <Input
                placeholder="친구 요청 메시지를 입력하세요..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">
                {message.length}/100
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUser(null)
                  setMessage('')
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => handleSendRequest(selectedUser.user_id, selectedUser.display_name)}
                disabled={sendRequestMutation.isPending}
              >
                요청 보내기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
