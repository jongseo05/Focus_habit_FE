'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Video } from 'lucide-react'
import type { RoomParticipant, ParticipantWithUser } from '@/types/social'

interface VideoGridProps {
  participants: ParticipantWithUser[]
  currentUserId: string
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream> | null
  onParticipantClick?: (participantId: string) => void
  // 집중 세션에 참여 중인 user_id 목록 (선택)
  sessionParticipantIds?: Set<string> | string[]
}



// 개별 비디오 타일 컴포넌트
function VideoTile({ 
  participant, 
  index, 
  currentUserId, 
  localStream, 
  remoteStreams, 
  gridLayout, 
  onParticipantClick,
  sessionParticipantIds
}: {
  participant: ParticipantWithUser
  index: number
  currentUserId: string
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream> | null
  gridLayout: '1' | '2' | '3' | '4'
  onParticipantClick?: (participantId: string) => void
  sessionParticipantIds?: Set<string> | string[]
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isLocal = participant.user_id === currentUserId
  const stream = isLocal ? localStream : (remoteStreams && remoteStreams instanceof Map ? remoteStreams.get(participant.user_id) : null)
  const inSession = sessionParticipantIds ? (sessionParticipantIds instanceof Set ? sessionParticipantIds.has(participant.user_id) : (sessionParticipantIds as string[]).includes(participant.user_id)) : false

  // 원격 스트림 연결
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div
      className="relative cursor-pointer w-full h-full"
      onClick={() => onParticipantClick?.(participant.participant_id)}
    >
      <Card className={`h-full bg-gradient-to-br from-blue-100 to-blue-200 border-0 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl relative ${inSession ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : ''}`}>
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
          {inSession && (
            <div className="absolute top-3 right-3">
              <Badge variant="outline" className="bg-white/80 backdrop-blur text-blue-600 border-blue-400 shadow px-2 py-0.5 text-xs font-semibold">
                세션
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
  remoteStreams = new Map(), 
  onParticipantClick,
  sessionParticipantIds
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
    } else if (participantCount === 4) {
      setGridLayout('4')
    } else {
      // 5명 이상일 때는 3열로 배치
      setGridLayout('4') // 4번 레이아웃을 3열로 사용
    }
  }, [participants.length])

  // 그리드 레이아웃별 클래스 결정
  const getGridClasses = () => {
    const participantCount = participants.length
    
    switch (gridLayout) {
      case '1':
        return 'grid-cols-1'
      case '2':
        return 'grid-cols-2'
      case '3':
        return 'grid-cols-3' // 3명일 때 가로로 3명 배치
      case '4':
        if (participantCount === 4) {
          return 'grid-cols-2 grid-rows-2' // 4명일 때 2x2 정사각형 배치
        } else {
          return 'grid-cols-3' // 5명 이상일 때 3열로 배치
        }
      default:
        return 'grid-cols-1'
    }
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
        <div className={`grid ${getGridClasses()} gap-6 h-[416px] w-full p-6`}>
      {participants.map((participant, index) => (
            <VideoTile
              key={participant.participant_id}
              participant={participant as ParticipantWithUser}
              index={index}
              currentUserId={currentUserId}
              localStream={localStream}
              remoteStreams={remoteStreams || new Map()}
              gridLayout={gridLayout}
              onParticipantClick={onParticipantClick}
        sessionParticipantIds={sessionParticipantIds}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
