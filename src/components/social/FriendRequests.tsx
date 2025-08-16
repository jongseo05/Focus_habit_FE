'use client'

import { useFriendRequests, useRespondToFriendRequest } from '@/hooks/useSocial'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Check, X, UserPlus, Clock } from 'lucide-react'
import { toast } from 'sonner'

export function FriendRequests() {
  const { data: requestsData, isLoading, error } = useFriendRequests()
  const { acceptRequest, rejectRequest } = useRespondToFriendRequest()

  const handleRespond = async (requestId: string, status: 'accepted' | 'rejected', userName: string) => {
    try {
      if (status === 'accepted') {
        await acceptRequest.mutateAsync({ requestId })
      } else {
        await rejectRequest.mutateAsync({ requestId })
      }
      toast.success(
        status === 'accepted' 
          ? `${userName}님의 친구 요청을 수락했습니다.` 
          : `${userName}님의 친구 요청을 거절했습니다.`
      )
    } catch (error) {
      toast.error('요청 처리에 실패했습니다.')
    }
  }

  const formatRequestTime = (createdAt: string) => {
    const now = new Date()
    const requestTime = new Date(createdAt)
    const diffMs = now.getTime() - requestTime.getTime()
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
            <UserPlus className="h-5 w-5" />
            친구 요청
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
            <UserPlus className="h-5 w-5" />
            친구 요청
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">친구 요청 목록을 불러오는데 실패했습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          친구 요청 ({requestsData?.length || 0})
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {requestsData && requestsData.length > 0 ? (
          <div className="space-y-3">
            {requestsData.map((request) => (
              <div
                key={request.request_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.from_user_avatar} alt={request.from_user_name} />
                    <AvatarFallback>
                      {request.from_user_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{request.from_user_name}</h4>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatRequestTime(request.created_at)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      @{request.from_user_handle}
                    </p>
                    {request.message && (
                      <p className="text-sm text-gray-600 mt-1">
                        &quot;{request.message}&quot;
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleRespond(request.request_id, 'accepted', request.from_user_name)}
                    disabled={acceptRequest.isPending}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    수락
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespond(request.request_id, 'rejected', request.from_user_name)}
                    disabled={rejectRequest.isPending}
                    className="text-red-500 border-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" />
                    거절
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">새로운 친구 요청이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
