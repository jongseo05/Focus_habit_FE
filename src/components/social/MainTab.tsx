'use client'

import { Card, CardContent } from '@/components/ui/card'
import { VideoOff } from 'lucide-react'
import { VideoGrid } from './VideoGrid'
import { FocusScoreChart } from './FocusScoreChart'
import type { RoomParticipant } from '@/types/social'

interface ParticipantWithUser extends RoomParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

interface MainTabProps {
  participants: ParticipantWithUser[]
  currentUserId: string
  localStream: MediaStream | null
  remoteStreams: { [key: string]: MediaStream }
  videoError: string | null
  isConnecting: boolean
  onParticipantClick: (participantId: string) => void
}

export function MainTab({
  participants,
  currentUserId,
  localStream,
  remoteStreams,
  videoError,
  isConnecting,
  onParticipantClick
}: MainTabProps) {
  return (
    <div className="space-y-6">
      {/* 비디오 화면 */}
      <VideoGrid
        participants={participants}
        currentUserId={currentUserId}
        localStream={localStream}
        remoteStreams={remoteStreams}
        onParticipantClick={onParticipantClick}
      />
      
      {/* 비디오 에러 표시 */}
      {videoError && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <VideoOff className="h-5 w-5" />
              <span className="text-sm font-medium">비디오 연결 오류: {videoError}</span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 연결 상태 표시 */}
      {isConnecting && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              <span className="text-sm font-medium">비디오 연결 중...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 집중도 차트 */}
      <FocusScoreChart 
        participants={participants}
        currentUserId={currentUserId}
      />
    </div>
  )
}
