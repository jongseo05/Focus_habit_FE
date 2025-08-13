'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Users, 
  Clock, 
  Crown, 
  Video,
  Mic,
  MicOff,
  VideoOff,
  Settings,
  LogOut,
  Plus,
  Hash,
  Activity
} from 'lucide-react'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { FocusScoreChart } from './FocusScoreChart'
import type { 
  StudyRoom, 
  RoomParticipant, 
  CreateStudyRoomData,
  FocusUpdateMessage,
  RoomJoinMessage,
  EncouragementMessageWS
} from '@/types/social'

interface StudyRoomProps {
  room?: StudyRoom
  onClose?: () => void
}

interface ParticipantWithUser extends RoomParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

export function StudyRoom({ room, onClose }: StudyRoomProps) {
  const { data: user } = useUser()
  const leaveRoomMutation = useLeaveStudyRoom()
  const endRoomMutation = useEndStudyRoom()
  const [participants, setParticipants] = useState<ParticipantWithUser[]>([])
  const [currentFocusScore, setCurrentFocusScore] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(!room)
  const [loading, setLoading] = useState(true)
  const [roomForm, setRoomForm] = useState<CreateStudyRoomData>({
    host_id: user?.id || '',
    name: '',
    description: '',
    max_participants: 10,
    session_type: 'study',
    goal_minutes: 60
  })
  const [showVideo, setShowVideo] = useState(false)
  const [showMic, setShowMic] = useState(false)
  const [focusUpdateInterval, setFocusUpdateInterval] = useState<NodeJS.Timeout | null>(null)
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: 'join' | 'leave'}>>([])

  // 참가자 목록 로드
  const loadParticipants = useCallback(async () => {
    try {
      setLoading(true)
      console.log('참가자 목록 로드 시작, room_id:', room?.room_id)
      
      const response = await fetch(`/api/social/study-room/${room?.room_id}/participants`)
      console.log('참가자 API 응답 상태:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('참가자 API 응답 데이터:', data)
        console.log('참가자 목록:', data.participants)
        
        setParticipants(data.participants || [])
      } else {
        const errorData = await response.json()
        console.error('참가자 API 에러:', errorData)
      }
    } catch (error) {
      console.error('참가자 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [room?.room_id])

  const handleLeaveRoom = useCallback(async () => {
    try {
      setLoading(true)
      
      // Realtime으로 퇴장 알림 전송은 useSocialRealtime 훅 호출 후에 처리
      await leaveRoomMutation.mutateAsync({ roomId: room?.room_id! })

      // 나가기 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 나가기 실패:', error)
      alert('스터디룸 나가기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, onClose, leaveRoomMutation])

  const handleEndRoom = useCallback(async () => {
    if (!confirm('정말로 스터디룸을 종료하시겠습니까? 모든 참가자가 퇴장됩니다.')) {
      return
    }

    try {
      setLoading(true)
      await endRoomMutation.mutateAsync({ roomId: room?.room_id! })
      
      alert('스터디룸이 성공적으로 종료되었습니다.')
      
      // 종료 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 종료 실패:', error)
      alert('스터디룸 종료에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, onClose, endRoomMutation])

  // WebSocket 메시지 핸들러들
  const handleRoomJoin = useCallback((data: RoomJoinMessage['data']) => {
    // 새 참가자 입장 로직
    console.log('새 참가자 입장:', data)
    // 참가자 목록 새로고침
    loadParticipants()
    
    // 알림 추가
    setNotifications(prev => [...prev, {
      id: Date.now().toString(),
      message: `${data.user_name}님이 입장했습니다!`,
      type: 'join'
    }])
  }, [loadParticipants])

  const handleRoomLeave = useCallback((data: { user_id: string }) => {
    // 참가자 퇴장 로직
    console.log('참가자 퇴장:', data)
    // 참가자 목록 새로고침
    loadParticipants()
    
    // 알림 추가
    const leavingParticipant = participants.find(p => p.user_id === data.user_id)
    if (leavingParticipant) {
      setNotifications(prev => [...prev, {
        id: Date.now().toString(),
        message: `${leavingParticipant.user.name}님이 퇴장했습니다.`,
        type: 'leave'
      }])
    }
  }, [loadParticipants, participants])

  const handleFocusUpdate = useCallback((data: FocusUpdateMessage['data']) => {
    // 다른 참가자의 집중도 업데이트
    setParticipants(prev => prev.map(p => 
      p.user_id === data.user_id 
        ? { ...p, current_focus_score: data.focus_score }
        : p
    ))
  }, [])

  const handleEncouragement = useCallback((data: EncouragementMessageWS['data']) => {
    // 격려 메시지 표시 - 기능 제거됨
    console.log('격려 메시지 수신 (기능 비활성화):', data)
  }, [])

  // 소셜 Realtime 연결
  const { 
    isConnected, 
    joinRoom, 
    leaveRoom, 
    sendFocusUpdate: sendFocusUpdateWS, 
    sendEncouragement: sendEncouragementWS 
  } = useSocialRealtime({
    roomId: room?.room_id,
    userId: user?.id,
    onFocusUpdate: handleFocusUpdate,
    onRoomJoin: handleRoomJoin,
    onRoomLeave: handleRoomLeave,
    onEncouragement: handleEncouragement
  })

  // Realtime 연결 후 룸 입장
  useEffect(() => {
    if (room?.room_id && user && isConnected) {
      joinRoom(user.user_metadata?.name || 'Unknown', user.user_metadata?.avatar_url)
      // 룸 입장 후 참가자 목록은 이미 위의 useEffect에서 로드됨
    }
  }, [room?.room_id, user, isConnected, joinRoom])

  // 참가자 목록 로드 및 호스트 확인
  useEffect(() => {
    if (room?.room_id) {
      // 룸 입장 시 한 번만 참가자 목록 로드
      loadParticipants()
      
      // 호스트 여부 확인 (room.host_id와 user.id 비교)
      if (room.host_id && user?.id) {
        setIsHost(room.host_id === user.id)
        console.log('호스트 확인:', { roomHostId: room.host_id, userId: user.id, isHost: room.host_id === user.id })
      }
    }
  }, [room?.room_id, room?.host_id, user?.id, loadParticipants])

  // handleLeaveRoom을 useSocialRealtime 훅 호출 후에 다시 정의
  const handleLeaveRoomWithRealtime = useCallback(async () => {
    try {
      setLoading(true)
      
      // Realtime으로 퇴장 알림 전송
      leaveRoom()
      
      await leaveRoomMutation.mutateAsync({ roomId: room?.room_id! })

      // 나가기 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 나가기 실패:', error)
      alert('스터디룸 나가기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, onClose, leaveRoom, leaveRoomMutation])

  // 알림 자동 제거 (5초 후)
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1))
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [notifications])

  // 스터디룸 생성
  const handleCreateRoom = async () => {
    if (!user) return

    try {
      const response = await fetch('/api/social/study-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...roomForm,
          host_id: user.id
        })
      })

      if (response.ok) {
        const newRoom = await response.json()
        // 룸 생성 후 해당 룸으로 이동
        window.location.href = `/social/room/${newRoom.room_id}`
      }
    } catch (error) {
      console.error('스터디룸 생성 실패:', error)
    }
  }

  // 스터디룸 참가
  const handleJoinRoom = async (roomId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/social/study-room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      })

      if (response.ok) {
        // 룸 참가 성공 - Realtime으로 입장 알림
        joinRoom(user.user_metadata?.name || 'Unknown', user.user_metadata?.avatar_url)
      }
    } catch (error) {
      console.error('스터디룸 참가 실패:', error)
    }
  }

  // 집중도 업데이트 전송 (API + Realtime)
  const sendFocusUpdate = useCallback(async (focusScore: number) => {
    if (!room || !user) return
    
    try {
      // API를 통해 집중도 업데이트
      const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_score: focusScore })
      })
      
      if (response.ok) {
        // API 업데이트 성공 후 Realtime으로 브로드캐스트
        sendFocusUpdateWS(focusScore)
        
        // 로컬 상태도 업데이트
        setCurrentFocusScore(focusScore)
      }
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
    }
  }, [room, user, sendFocusUpdateWS])

  // 격려 메시지 전송 (Realtime) - 기능 제거됨
  const sendEncouragement = useCallback((toUserId: string) => {
    console.log('격려 메시지 전송 (기능 비활성화):', toUserId)
  }, [])

  // 집중도 시뮬레이션 (실제로는 ML 모델에서 받아올 값)
  useEffect(() => {
    if (room && isConnected) {
      const interval = setInterval(() => {
        const newFocusScore = Math.floor(Math.random() * 100)
        sendFocusUpdate(newFocusScore)
      }, 5000) // 5초마다 업데이트

      setFocusUpdateInterval(interval)
    }

    return () => {
      if (focusUpdateInterval) {
        clearInterval(focusUpdateInterval)
      }
    }
  }, [room?.room_id, isConnected, sendFocusUpdate])

  // 스터디룸 생성 폼
  if (showCreateRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              새로운 스터디룸 만들기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">룸 이름</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 오늘 밤 공부방"
                className="w-full p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">설명</label>
              <textarea
                value={roomForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRoomForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="룸에 대한 설명을 입력하세요"
                rows={3}
                className="w-full p-2 border rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">최대 참가자 수</label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={roomForm.max_participants}
                  onChange={(e) => setRoomForm(prev => ({ ...prev, max_participants: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">목표 시간 (분)</label>
                <input
                  type="number"
                  min="15"
                  value={roomForm.goal_minutes}
                  onChange={(e) => setRoomForm(prev => ({ ...prev, goal_minutes: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">세션 타입</label>
              <select
                value={roomForm.session_type}
                onChange={(e) => setRoomForm(prev => ({ ...prev, session_type: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="study">공부</option>
                <option value="work">업무</option>
                <option value="reading">독서</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateRoom} className="flex-1">
                스터디룸 생성
              </Button>
              <Button variant="outline" onClick={() => setShowCreateRoom(false)}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 스터디룸 메인 화면
  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>스터디룸</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateRoom(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              새 스터디룸 만들기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 실시간 알림 */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.slice(-3).map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg text-sm text-white max-w-xs ${
                notification.type === 'join' ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 룸 헤더 */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <Hash className="h-6 w-6 text-blue-500" />
                      {room.name}
                    </CardTitle>
                    <p className="text-gray-600 mt-1">{room.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {room.current_participants}/{room.max_participants}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {room.goal_minutes}분
                    </div>
                    <Badge variant="secondary">{room.session_type}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Realtime 연결 상태 */}
                  <div className={`flex items-center gap-1 text-xs ${
                    isConnected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {isConnected ? '실시간 연결됨' : '연결 중...'}
                  </div>
                 
                  {isHost && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleEndRoom}
                      disabled={loading}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      스터디룸 종료
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLeaveRoomWithRealtime}
                    disabled={loading}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    나가기
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* 헤더 하단에 참가자 목록과 컨트롤을 한 줄로 통합 */}
            <CardContent className="pt-0">
              <div className="flex items-center justify-between pt-4 border-t">
                {/* 참가자 목록 */}
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <Users className="h-4 w-4 text-blue-500" />
                    참가자 목록
                  </h3>
                  <div className="flex items-center gap-4">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-500">로딩 중...</span>
                      </div>
                    ) : participants.length === 0 ? (
                      <span className="text-sm text-gray-500">아직 참가자가 없습니다</span>
                    ) : (
                      participants.slice(0, 5).map((participant) => (
                        <div key={participant.participant_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={participant.user.avatar_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                              {participant.user.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{participant.user.name}</span>
                            {participant.is_host && <Crown className="h-4 w-4 text-yellow-500" />}
                          </div>
                        </div>
                      ))
                    )}
                    {participants.length > 5 && (
                      <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-gray-100 border border-gray-200">
                        <span className="text-sm font-medium text-gray-600">+{participants.length - 5}명</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 컨트롤 */}
                <div className="flex items-center gap-3 ml-8">
                  <Button
                    variant={showVideo ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowVideo(!showVideo)}
                    className="h-10 px-4"
                  >
                    {showVideo ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    variant={showMic ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowMic(!showMic)}
                    className="h-10 px-4"
                  >
                    {showMic ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  
                  <Button variant="outline" size="sm" className="h-10 px-4">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 메인 화면 */}
            <div className="lg:col-span-4 space-y-6">
              {/* 비디오 화면 */}
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                    {showVideo ? (
                      <div className="text-center">
                        <Video className="h-12 w-12 mx-auto text-blue-500 mb-2" />
                        <p className="text-sm text-gray-600">화상 공유 준비 중...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <VideoOff className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">화상 공유가 비활성화되어 있습니다</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setShowVideo(true)}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          화상 공유 시작
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 집중도 차트 */}
              <FocusScoreChart 
                participants={participants}
                currentUserId={user?.id}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
