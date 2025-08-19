'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { StudyRoom } from '@/components/social/StudyRoom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { StudyRoom as StudyRoomType } from '@/types/social'

export default function StudyRoomPage() {
  const params = useParams()
  const router = useRouter()
  const [room, setRoom] = useState<StudyRoomType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  const roomId = params.roomId as string

  // useEffect를 조건부 반환문 이전에 배치 (React Hook 규칙 준수)
  useEffect(() => {
    if (roomId && roomId !== 'undefined') {
      fetchRoomDetails()
    }
  }, [roomId])

  const fetchRoomDetails = async () => {
    try {
      setLoading(true)
      
      // 먼저 디버깅 API로 룸 존재 여부 확인
      const debugResponse = await fetch(`/api/social/debug-room/${roomId}`)
      const debugData = await debugResponse.json()
      setDebugInfo(debugData)
      
      // 원래 룸 조회 API 호출
      const response = await fetch(`/api/social/study-room/${roomId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        
        if (response.status === 404) {
          setError(`스터디룸을 찾을 수 없습니다. (roomId: ${roomId})`)
        } else {
          setError(`스터디룸 정보를 불러오는데 실패했습니다. (상태: ${response.status}, 에러: ${JSON.stringify(errorData)})`)
        }
        return
      }

      const roomData = await response.json()
      setRoom(roomData)
    } catch (error) {
      setError(`스터디룸 정보를 불러오는데 실패했습니다. (에러: ${error instanceof Error ? error.message : String(error)})`)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    router.push('/social')
  }

  // roomId가 undefined인 경우 즉시 오류 표시
  if (!roomId || roomId === 'undefined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-red-600 mb-6">
              <h2 className="text-xl font-bold mb-2">잘못된 스터디룸 접근</h2>
              <p className="font-medium mb-4">
                스터디룸 ID가 올바르지 않습니다. (roomId: {roomId || 'undefined'})
              </p>
              
              <div className="bg-gray-50 p-4 rounded-md text-left">
                <h3 className="font-semibold mb-2">문제 원인:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>요청한 roomId:</strong> {roomId || 'undefined'}</p>
                  <p><strong>현재 URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
                  <p><strong>시간:</strong> {new Date().toLocaleString()}</p>
                </div>
                
                <div className="mt-4">
                  <p className="text-sm text-gray-600">
                    이 문제는 보통 스터디룸 생성 후 리다이렉트 과정에서 발생합니다.
                    스터디룸 목록으로 돌아가서 다시 시도해주세요.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center">
              <Button onClick={handleClose} className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="h-4 w-4 mr-2" />
                스터디룸 목록으로 돌아가기
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">스터디룸 정보를 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-red-600 mb-6">
              <h2 className="text-xl font-bold mb-2">스터디룸 로드 실패</h2>
              <p className="font-medium mb-4">{error}</p>
              
                             <div className="bg-gray-50 p-4 rounded-md text-left">
                 <h3 className="font-semibold mb-2">디버그 정보:</h3>
                 <div className="text-sm space-y-1">
                   <p><strong>요청한 roomId:</strong> {roomId}</p>
                   <p><strong>현재 URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
                   <p><strong>시간:</strong> {new Date().toLocaleString()}</p>
                 </div>
                 
                 {debugInfo && (
                   <div className="mt-4">
                     <h4 className="font-semibold mb-2">데이터베이스 상태:</h4>
                     <div className="space-y-2">
                       <div>
                         <strong>단순 조회 결과:</strong>
                         <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                           {JSON.stringify(debugInfo.simpleRoom, null, 2)}
                         </pre>
                       </div>
                       <div>
                         <strong>활성 룸 목록:</strong>
                         <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                           {JSON.stringify(debugInfo.allActiveRooms, null, 2)}
                         </pre>
                       </div>
                       <div>
                         <strong>최근 룸 목록:</strong>
                         <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                           {JSON.stringify(debugInfo.recentRooms, null, 2)}
                         </pre>
                       </div>
                     </div>
                   </div>
                 )}
               </div>
            </div>
            
            <div className="flex gap-3">
              <Button onClick={() => router.push('/social')} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                소셜 페이지로 돌아가기
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()} 
                className="flex-1"
              >
                다시 시도
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">스터디룸을 찾을 수 없습니다.</p>
            <Button onClick={() => router.push('/social')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              소셜 페이지로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            소셜 페이지로 돌아가기
          </Button>
        </div>
        <StudyRoom room={room} onClose={handleClose} />
      </div>
    </div>
  )
}
