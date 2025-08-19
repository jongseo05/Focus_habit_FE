'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Target, Clock, Users } from 'lucide-react'
import type { CreateStudyRoomData } from '@/types/social'
import { useUser } from '@/hooks/useAuth'

interface CreateStudyRoomFormProps {
  onClose: () => void
  onSuccess: (room: any) => void
}

export default function CreateStudyRoomForm({ onClose, onSuccess }: CreateStudyRoomFormProps) {
  const { data: user } = useUser()
  const [formData, setFormData] = useState<CreateStudyRoomData>({
    host_id: '',
    name: '',
    description: '',
    max_participants: 5,
    session_type: 'study',
    goal_minutes: 60
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 사용자 정보가 로드되면 host_id 설정
  useEffect(() => {
    if (user?.id) {
      setFormData(prev => ({
        ...prev,
        host_id: user.id
      }))
    }
  }, [user?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    console.log('=== 폼 제출 시작 ===')
    
    if (!user?.id) {
      console.error('사용자 ID가 없습니다')
      setError('사용자 정보를 가져올 수 없습니다. 다시 로그인해주세요.')
      return
    }

    setLoading(true)
    setError('')

    const requestData = {
      ...formData,
      host_id: user.id
    }
    
    console.log('전송할 데이터:', requestData)
    console.log('사용자 정보:', user)
    console.log('API 엔드포인트:', '/api/social/study-room-debug')

    try {
      console.log('fetch 요청 시작...')
      const response = await fetch('/api/social/study-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      console.log('fetch 요청 완료')
      console.log('응답 상태:', response.status)
      console.log('응답 헤더:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        console.log('응답이 성공적이지 않음, 에러 데이터 읽기 시도...')
        const errorData = await response.json()
        console.error('API 에러:', errorData)
        throw new Error(errorData.error || '스터디룸 생성에 실패했습니다.')
      }

             console.log('응답이 성공적, 데이터 읽기 시도...')
      const responseData = await response.json()
      console.log('응답 데이터:', responseData)
      
      // API 응답 구조에 맞게 룸 데이터 추출
      // createSimpleSuccessResponse는 { success: true, data: room, message: "..." } 형태
      const room = responseData.data
      console.log('생성된 룸:', room)
      
      // room_id가 존재하는지 확인
      if (!room || !room.room_id) {
        console.error('룸 데이터가 올바르지 않습니다:', room)
        console.error('전체 응답 데이터:', responseData)
        throw new Error('생성된 룸 정보를 가져올 수 없습니다. 서버 응답을 확인해주세요.')
      }
      
      // room_id가 유효한 UUID 형식인지 확인
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(room.room_id)) {
        console.error('유효하지 않은 room_id 형식:', room.room_id)
        throw new Error('생성된 룸 ID가 올바르지 않습니다. 다시 시도해주세요.')
      }
      
      console.log('룸 페이지로 이동 시도:', `/social/room/${room.room_id}`)
      // 성공 시 룸 페이지로 직접 이동
      window.location.href = `/social/room/${room.room_id}`
    } catch (err) {
      console.error('=== 전체 에러 ===')
      console.error('에러 타입:', typeof err)
      console.error('에러 메시지:', err)
      console.error('에러 스택:', err instanceof Error ? err.stack : '스택 없음')
      setError(err instanceof Error ? err.message : '스터디룸 생성에 실패했습니다.')
    } finally {
      console.log('로딩 상태 해제')
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateStudyRoomData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">새 스터디룸 만들기</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 룸 이름 */}
            <div className="space-y-2">
              <Label htmlFor="name">룸 이름 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="예: 오늘 밤 공부방"
                required
              />
            </div>

            {/* 룸 설명 */}
            <div className="space-y-2">
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="룸에 대한 간단한 설명을 입력하세요"
                rows={3}
              />
            </div>

            {/* 세션 타입 */}
            <div className="space-y-2">
              <Label htmlFor="session_type">세션 타입</Label>
              <Select
                value={formData.session_type}
                onValueChange={(value) => handleInputChange('session_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="세션 타입을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">공부</SelectItem>
                  <SelectItem value="work">업무</SelectItem>
                  <SelectItem value="reading">독서</SelectItem>
                  <SelectItem value="coding">코딩</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 목표 시간 */}
            <div className="space-y-2">
              <Label htmlFor="goal_minutes">목표 시간 (분)</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <Input
                  id="goal_minutes"
                  type="number"
                  min="15"
                  max="480"
                  value={formData.goal_minutes}
                  onChange={(e) => handleInputChange('goal_minutes', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500">분</span>
              </div>
            </div>

            {/* 최대 참가자 수 */}
            <div className="space-y-2">
              <Label htmlFor="max_participants">최대 참가자 수</Label>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                <Input
                  id="max_participants"
                  type="number"
                  min="2"
                  max="50"
                  value={formData.max_participants}
                  onChange={(e) => handleInputChange('max_participants', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-500">명</span>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* 버튼들 */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !formData.name.trim()}
              >
                {loading ? '생성 중...' : '스터디룸 만들기'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
