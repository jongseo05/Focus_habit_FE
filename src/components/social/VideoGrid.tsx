'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Video } from 'lucide-react'
import type { RoomParticipant } from '@/types/social'

interface VideoGridProps {
  participants: RoomParticipant[]
  currentUserId: string
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  onParticipantClick?: (participantId: string) => void
}

interface ParticipantWithUser extends RoomParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

// 개별 비디오 타일 컴포넌트
function VideoTile({ 
  participant, 
  index, 
  currentUserId, 
  localStream, 
  remoteStreams, 
  gridLayout, 
  onParticipantClick 
}: {
  participant: ParticipantWithUser
  index: number
  currentUserId: string
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  gridLayout: '1' | '2' | '3' | '4'
  onParticipantClick?: (participantId: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isLocal = participant.user_id === currentUserId
  const stream = isLocal ? localStream : remoteStreams.get(participant.user_id)

  // 원격 스트림 연결
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div
      className={`relative cursor-pointer w-full h-full ${
        gridLayout === '3' && index === 2 ? 'col-span-2' : ''
      }`}
      onClick={() => onParticipantClick?.(participant.participant_id)}
    >
      <Card className="h-full bg-gradient-to-br from-blue-100 to-blue-200 border-0 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl">
        <CardContent className="p-0 h-full">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isLocal}
              className="w-full h-full object-cover scale-x-[-1] rounded-xl"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
              <Avatar className="h-20 w-20 border-4 border-white/20 shadow-xl">
                <AvatarImage src={participant.user.avatar_url} />
                <AvatarFallback className="bg-white/90 text-blue-500 text-2xl font-bold">
                  {participant.user.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          
          {/* 로컬 사용자 표시 */}
          {isLocal && (
            <div className="absolute top-3 left-3">
              <Badge variant="default" className="bg-blue-400 text-white border-0 shadow-lg px-3 py-1 text-sm font-medium">
                나
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function VideoGrid({ 
  participants, 
  currentUserId, 
  localStream, 
  remoteStreams, 
  onParticipantClick 
}: VideoGridProps) {
  const [gridLayout, setGridLayout] = useState<'1' | '2' | '3' | '4'>('1')

  // 참가자 수에 따른 그리드 레이아웃 결정
  useEffect(() => {
    const participantCount = participants.length
    if (participantCount <= 1) {
      setGridLayout('1')
    } else if (participantCount === 2) {
      setGridLayout('2')
    } else if (participantCount === 3) {
      setGridLayout('3')
    } else {
      setGridLayout('4')
    }
  }, [participants.length])

  // 그리드 레이아웃별 클래스 결정
  const getGridClasses = () => {
    switch (gridLayout) {
      case '1':
        return 'grid-cols-1'
      case '2':
        return 'grid-cols-2'
      case '3':
        return 'grid-cols-2'
      case '4':
        return 'grid-cols-2'
      default:
        return 'grid-cols-1'
    }
  }

  // 3명일 때 특별한 레이아웃 처리
  const getSpecialLayout = () => {
    if (gridLayout === '3') {
      return 'grid-rows-2'
    }
    return ''
  }

  if (participants.length === 0) {
    return (
      <Card className="bg-white border-0 shadow-lg rounded-xl">
        <CardContent className="p-0">
          <div className="h-[416px] bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Video className="h-20 w-20 mx-auto text-blue-500 mb-4" />
              <p className="text-lg text-blue-700 font-medium">아직 참가자가 없습니다</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-0 shadow-lg rounded-xl">
      <CardContent className="p-0">
        <div className={`grid ${getGridClasses()} ${getSpecialLayout()} gap-6 h-[416px] w-full p-6`}>
          {participants.map((participant, index) => (
            <VideoTile
              key={participant.participant_id}
              participant={participant as ParticipantWithUser}
              index={index}
              currentUserId={currentUserId}
              localStream={localStream}
              remoteStreams={remoteStreams}
              gridLayout={gridLayout}
              onParticipantClick={onParticipantClick}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
