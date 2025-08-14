'use client'

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
  LogOut,
  Hash
} from 'lucide-react'
import type { StudyRoom, ParticipantWithUser } from '@/types/social'

interface StudyRoomHeaderProps {
  room: StudyRoom
  participants: ParticipantWithUser[]
  isHost: boolean
  isConnected: boolean
  loading: boolean
  currentUserId?: string
  videoRoom: {
    isVideoEnabled: boolean
    isAudioEnabled: boolean
    isConnecting: boolean
    toggleVideo: () => void
    toggleAudio: () => void
  }
  onLeaveRoom: () => void
  onEndRoom: () => void
}

export function StudyRoomHeader({
  room,
  participants,
  isHost,
  isConnected,
  loading,
  currentUserId,
  videoRoom,
  onLeaveRoom,
  onEndRoom
}: StudyRoomHeaderProps) {
  console.log('StudyRoomHeader 렌더링:', { 
    participantsCount: participants.length, 
    participants, 
    loading, 
    roomId: room.room_id 
  })
  
  return (
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
                onClick={onEndRoom}
                disabled={false}
              >
                <LogOut className="h-4 w-4 mr-1" />
                스터디룸 종료
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onLeaveRoom}
              disabled={false}
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
                  <span className="text-sm text-gray-500">참가자 목록 로딩 중...</span>
                </div>
              ) : participants.length === 0 ? (
                <span className="text-sm text-gray-500">아직 참가자가 없습니다</span>
              ) : (
                participants.slice(0, 5).map((participant) => {
                  // 현재 사용자의 실제 비디오/마이크 상태 확인
                  const isCurrentUser = participant.user_id === currentUserId
                  const actualVideoState = isCurrentUser ? videoRoom.isVideoEnabled : participant.is_video_on
                  const actualMicState = isCurrentUser ? videoRoom.isAudioEnabled : participant.is_mic_on
                  
                  return (
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
                      
                      {/* 비디오/오디오 상태 표시 */}
                      <div className="flex items-center gap-1 ml-auto">
                        <Badge 
                          variant={actualVideoState ? "default" : "secondary"}
                          className="h-5 px-1"
                        >
                          {actualVideoState ? (
                            <Video className="h-3 w-3" />
                          ) : (
                            <VideoOff className="h-3 w-3" />
                          )}
                        </Badge>
                        
                        <Badge 
                          variant={actualMicState ? "default" : "secondary"}
                          className="h-5 px-1"
                        >
                          {actualMicState ? (
                            <Mic className="h-3 w-3" />
                          ) : (
                            <MicOff className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    </div>
                  )
                })
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
              variant={videoRoom.isVideoEnabled ? "default" : "outline"}
              size="sm"
              onClick={videoRoom.toggleVideo}
              className="h-10 px-4"
              disabled={videoRoom.isConnecting}
            >
              {videoRoom.isVideoEnabled ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            
            <Button
              variant={videoRoom.isAudioEnabled ? "default" : "outline"}
              size="sm"
              onClick={videoRoom.toggleAudio}
              className="h-10 px-4"
              disabled={!videoRoom.isVideoEnabled}
            >
              {videoRoom.isAudioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
