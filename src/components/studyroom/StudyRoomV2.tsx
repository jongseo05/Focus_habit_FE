// =====================================================
// 개선된 스터디룸 메인 컴포넌트
// =====================================================

'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Brain, 
  Trophy, 
  MessageSquare, 
  Settings, 
  LogOut,
  Crown,
  Wifi,
  WifiOff
} from 'lucide-react'
import { StudyRoomProvider } from './core/StudyRoomProvider'
import { FocusSessionPanel } from './session/FocusSessionPanel'
import { ParticipantsPanel } from './participants/ParticipantsPanel'
import { NotificationPanel } from './notifications/NotificationPanel'
import { EncouragementModal } from './modals/EncouragementModal'
import type { StudyRoom } from '@/types/social'

interface StudyRoomV2Props {
  room: StudyRoom
  userId: string
  onClose?: () => void
  onRoomEnd?: () => void
}

export function StudyRoomV2({ room, userId, onClose, onRoomEnd }: StudyRoomV2Props) {
  const [activeTab, setActiveTab] = useState('session')
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [encouragementTarget, setEncouragementTarget] = useState<{
    userId: string
    userName: string
  } | null>(null)

  // 격려 메시지 모달 열기
  const handleSendEncouragement = useCallback((targetUserId: string, userName: string) => {
    setEncouragementTarget({ userId: targetUserId, userName })
    setShowEncouragementModal(true)
  }, [])

  // 격려 메시지 모달 닫기
  const handleCloseEncouragementModal = useCallback(() => {
    setShowEncouragementModal(false)
    setEncouragementTarget(null)
  }, [])

  return (
    <StudyRoomProvider room={room} userId={userId}>
      <StudyRoomContent
        room={room}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSendEncouragement={handleSendEncouragement}
        onClose={onClose}
        onRoomEnd={onRoomEnd}
      />
      
      {/* 격려 메시지 모달 */}
      {showEncouragementModal && encouragementTarget && (
        <EncouragementModal
          targetUserId={encouragementTarget.userId}
          targetUserName={encouragementTarget.userName}
          onClose={handleCloseEncouragementModal}
        />
      )}
    </StudyRoomProvider>
  )
}

// 내부 컨텐츠 컴포넌트 (Context 사용)
interface StudyRoomContentProps {
  room: StudyRoom
  activeTab: string
  setActiveTab: (tab: string) => void
  onSendEncouragement: (userId: string, userName: string) => void
  onClose?: () => void
  onRoomEnd?: () => void
}

function StudyRoomContent({
  room,
  activeTab,
  setActiveTab,
  onSendEncouragement,
  onClose,
  onRoomEnd
}: StudyRoomContentProps) {
  const { 
    participants, 
    isHost, 
    notifications, 
    leaveRoom, 
    endRoom, 
    loading,
    error 
  } = useStudyRoomContext()

  // 방 나가기 처리
  const handleLeaveRoom = useCallback(async () => {
    await leaveRoom()
    if (onClose) {
      onClose()
    }
  }, [leaveRoom, onClose])

  // 방 종료 처리 (호스트만)
  const handleEndRoom = useCallback(async () => {
    await endRoom()
    if (onRoomEnd) {
      onRoomEnd()
    }
  }, [endRoom, onRoomEnd])

  // 온라인 참가자 수 계산
  const onlineCount = participants.filter(p => {
    if (!p.last_activity) return false
    const lastActivity = new Date(p.last_activity).getTime()
    const now = Date.now()
    return now - lastActivity < 60000 // 1분 이내
  }).length

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {room.name}
                {isHost && <Crown className="h-5 w-5 text-yellow-500" />}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{participants.length}명 참가</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span>{onlineCount}명 온라인</span>
                </div>
                {room.description && (
                  <span className="text-gray-400">• {room.description}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 상태 배지 */}
            <Badge variant="secondary">
              {room.session_type === 'study' ? '학습' : 
               room.session_type === 'work' ? '업무' : 
               room.session_type === 'reading' ? '독서' : '기타'}
            </Badge>
            
            {room.goal_minutes && (
              <Badge variant="outline">
                목표: {room.goal_minutes}분
              </Badge>
            )}

            {/* 액션 버튼 */}
            {isHost ? (
              <Button 
                onClick={handleEndRoom} 
                variant="destructive" 
                size="sm"
                disabled={loading}
              >
                방 종료
              </Button>
            ) : (
              <Button 
                onClick={handleLeaveRoom} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <LogOut className="h-4 w-4 mr-1" />
                나가기
              </Button>
            )}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* 왼쪽: 메인 패널 */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="session" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  집중 세션
                </TabsTrigger>
                <TabsTrigger value="challenges" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  챌린지
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  채팅
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 h-[calc(100%-3rem)]">
                <TabsContent value="session" className="h-full">
                  <FocusSessionPanel 
                    onSessionComplete={(data) => {
                      console.log('세션 완료:', data)
                    }}
                  />
                </TabsContent>

                <TabsContent value="challenges" className="h-full">
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="text-center text-gray-500">
                        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">챌린지 기능</h3>
                        <p>곧 출시될 예정입니다!</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chat" className="h-full">
                  <Card className="h-full">
                    <CardContent className="p-6">
                      <div className="text-center text-gray-500">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">실시간 채팅</h3>
                        <p>곧 출시될 예정입니다!</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* 오른쪽: 사이드바 */}
          <div className="space-y-6">
            {/* 참가자 패널 */}
            <ParticipantsPanel 
              onSendEncouragement={onSendEncouragement}
              onViewProfile={(userId) => {
                console.log('프로필 보기:', userId)
              }}
            />

            {/* 알림 패널 */}
            <NotificationPanel notifications={notifications} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Context import 추가
import { useStudyRoomContext } from './core/StudyRoomProvider'
