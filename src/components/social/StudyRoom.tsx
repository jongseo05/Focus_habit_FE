'use client'

import { useEffect } from 'react'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { useVideoRoom } from '@/hooks/useVideoRoom'
import { useChallenge } from '@/hooks/useChallenge'
import { useStudyRoomState } from '@/hooks/useStudyRoomState'
import { useStudyRoomLogic } from '@/hooks/useStudyRoomLogic'
import { useStudyRoomRealtime } from '@/hooks/useStudyRoomRealtime'
import { useGroupChallengeAutoUpdate } from '@/hooks/useGroupChallengeAutoUpdate'
import MultiParticipantFocusChart from '../MultiParticipantFocusChart'
import { VideoGrid } from './VideoGrid'
import { ChallengeHUD } from './ChallengeHUD'
import { ChallengeResultPanel } from './ChallengeResultPanel'
import { ChallengeInvitationPanel } from './ChallengeInvitationPanel'
import { GroupChallengePanel } from './GroupChallengePanel'
import { StudyRoomFocusSession } from './StudyRoomFocusSession'
import { StudyRoomNotifications } from './studyroom/StudyRoomNotifications'
import { StudyRoomEmpty } from './studyroom/StudyRoomEmpty'
import { StudyRoomCreateForm } from './studyroom/StudyRoomCreateForm'
import { CompetitionPanel } from './studyroom/CompetitionPanel'
import {
  StudyRoomV2,
  StudyRoomProvider,
  FocusSessionPanel,
  ParticipantsPanel,
  NotificationPanel,
  StudyRoomHeader
} from '../studyroom'
import type { StudyRoom } from '@/types/social'

interface StudyRoomProps {
  room?: StudyRoom
  onClose?: () => void
}

/**
 * 메인 스터디룸 컴포넌트
 * - 리팩토링된 아키텍처로 관심사 분리
 * - 상태 관리, 비즈니스 로직, 실시간 기능을 별도 훅으로 분리
 * - 컴포넌트 합성 패턴 사용
 */
export function StudyRoom({ room, onClose }: StudyRoomProps) {
  const { data: user } = useUser()
  
  // 상태 관리 훅
  const state = useStudyRoomState({ 
    room, 
    userId: user?.id 
  })
  
  // 비즈니스 로직 훅
  const logic = useStudyRoomLogic({
    room,
    userId: user?.id,
    addNotification: state.addNotification,
    setCurrentGroupChallenges: state.setCurrentGroupChallenges,
    setGroupChallengeProgressMap: state.setGroupChallengeProgressMap,
    setCurrentInvitation: state.setCurrentInvitation,
    setShowInvitationPanel: state.setShowInvitationPanel,
    setCompetitionHistory: state.setCompetitionHistory
  })
  
  // 실시간 기능 훅
  const realtime = useStudyRoomRealtime({
    room,
    userId: user?.id,
    setParticipants: state.setParticipants,
    addNotification: state.addNotification,
    setCurrentFocusScore: state.setCurrentFocusScore,
    setIsHost: state.setIsHost,
    updateFocusHistory: state.updateFocusHistory,
    initialLoadDoneRef: state.initialLoadDoneRef,
    currentRoomIdRef: state.currentRoomIdRef,
    lastParticipantCountRef: state.lastParticipantCountRef
  })
  
  // 기존 훅들
  const leaveRoomMutation = useLeaveStudyRoom()
  const endRoomMutation = useEndStudyRoom()
  
  // 비디오룸 훅
  const videoRoom = useVideoRoom({
    roomId: room?.room_id || '',
    userId: user?.id || '',
    participants: state.participants
  })

  // 챌린지 훅
  const challenge = useChallenge({
    roomId: room?.room_id || '',
    userId: user?.id || ''
  })

  // 자동 챌린지 업데이트 훅
  const challengeAutoUpdate = useGroupChallengeAutoUpdate({
    roomId: room?.room_id
  })

  // 초기 데이터 로드
  useEffect(() => {
    if (room?.room_id && user?.id) {
      logic.loadCompetitionHistory()
      logic.loadChallengeInvitation()
      logic.loadGroupChallenge()
    }
  }, [room?.room_id, user?.id])

  // 룸이 없는 경우 빈 상태 표시
  if (!room && !state.showCreateRoom) {
    return <StudyRoomEmpty onCreateRoom={() => state.setShowCreateRoom(true)} />
  }

  // 룸 생성 폼 표시
  if (state.showCreateRoom) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <StudyRoomCreateForm
          roomForm={state.roomForm}
          onRoomFormChange={state.setRoomForm}
          onCreateRoom={logic.handleCreateRoom}
          onCancel={() => state.setShowCreateRoom(false)}
        />
      </div>
    )
  }

  // 메인 스터디룸 UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 헤더 */}
      {room && (
        <StudyRoomHeader
          room={room}
          participants={state.participants}
          isHost={state.isHost}
          isConnected={true}
          loading={state.loading}
          currentUserId={user?.id}
          videoRoom={videoRoom}
          onClose={onClose}
          onEndRoom={() => {
            if (room?.room_id) {
              endRoomMutation.mutate({ roomId: room.room_id })
            }
          }}
          onLeaveRoom={() => {
            if (room?.room_id) {
              leaveRoomMutation.mutate({ roomId: room.room_id })
            }
          }}
        />
      )}

      {/* 알림 */}
      <StudyRoomNotifications
        notifications={state.notifications}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* 비디오 그리드 - 전체 너비 */}
          <div className="w-full">
            <VideoGrid
              participants={state.participants}
              currentUserId={user?.id || ''}
              localStream={videoRoom.localStream}
              remoteStreams={videoRoom.remoteStreams}
              onParticipantClick={(participantId) => {
                // 참가자 클릭 핸들러
              }}
            />
          </div>

          {/* 집중도 세션 - 전체 너비 */}
          <div className="w-full">
            <StudyRoomFocusSession
              roomId={room?.room_id || ''}
              currentUserId={user?.id || ''}
              participants={state.participants}
              onFocusScoreUpdate={(score: number) => {
                // 집중도 업데이트 시 히스토리에 추가
                if (user?.id) {
                  state.updateFocusHistory(user.id, score, 0.8)
                }
              }}
              onSessionStart={(startTime: number) => {
                // 세션 시작 시간 저장
                state.setFocusSessionStartTime(startTime)
              }}
              onSessionComplete={async (sessionData) => {
                // 세션 완료 처리
              }}
            />
          </div>

          {/* 집중도 차트 - 전체 너비 */}
          <div className="w-full">
            <MultiParticipantFocusChart
              participants={state.participants.map(participant => ({
                userId: participant.user_id,
                userName: participant.user.name,
                focusHistory: state.focusHistoryMap[participant.user_id] || [], // 실제 집중도 히스토리
                currentScore: participant.current_focus_score || 0, // 실제 현재 집중도 점수
                isOnline: participant.is_connected
              }))}
              timeRange={10}
              sessionStartTime={state.focusSessionStartTime || undefined} // 세션 시작 시간 전달
            />
          </div>

          {/* 집중도 대결 패널 - 전체 너비 */}
          <div className="w-full">
            <CompetitionPanel
              isHost={state.isHost}
              isCompetitionActive={false}
              isBreakTime={false}
              competitionTimeLeft={0}
              competitionDuration={25}
              breakDuration={5}
              competitionScores={{}}
              competitionHistory={state.competitionHistory}
              participants={state.participants}
              showCompetitionSettings={false}
              activeTab="pomodoro"
              customHours={0}
              customMinutes={30}
              hasPendingInvitation={false}
              onShowCompetitionSettings={() => {}}
              onActiveTabChange={() => {}}
              onCompetitionDurationChange={() => {}}
              onBreakDurationChange={() => {}}
              onCustomHoursChange={() => {}}
              onCustomMinutesChange={() => {}}
              onStartCompetition={() => {
                // 대결 시작 처리
              }}
              onEndCompetition={() => {}}
            />
          </div>

          {/* 그룹 챌린지 패널 - 전체 너비 */}
          {state.currentGroupChallenges && state.currentGroupChallenges.length > 0 && (
            <div className="w-full">
              <GroupChallengePanel
                roomId={room?.room_id || ''}
                participants={state.participants}
                isHost={state.isHost}
                currentChallenges={state.currentGroupChallenges}
                challengeProgressMap={state.groupChallengeProgressMap}
                currentUserId={user?.id || ''}
                onCreateChallenge={logic.createGroupChallenge}
                onJoinChallenge={logic.joinGroupChallenge}
                onLeaveChallenge={logic.leaveGroupChallenge}
                onDeleteChallenge={logic.deleteGroupChallenge}
              />
            </div>
          )}

          {/* 챌린지 HUD */}
          {state.showChallengeHUD && (
            <div className="w-full">
              <ChallengeHUD
                challenge={{
                  challenge_id: '',
                  room_id: room?.room_id || '',
                  mode: 'pomodoro',
                  config: { work: 25, break: 5 },
                  state: 'active',
                  start_at: new Date().toISOString(),
                  end_at: undefined,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }}
                participants={state.participants}
                currentUserId={user?.id || ''}
                currentFocusScore={state.currentFocusScore}
                currentScores={state.competitionScores}
                timeLeft={state.competitionTimeLeft}
                isBreakTime={false}
                onClose={() => state.setShowChallengeHUD(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* 오버레이 컴포넌트들 */}
      {state.showResultPanel && (
        <ChallengeResultPanel
          challenge={{
            challenge_id: '',
            room_id: room?.room_id || '',
            mode: 'pomodoro',
            config: { work: 25, break: 5 },
            state: 'ended',
            start_at: new Date().toISOString(),
            end_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }}
          participants={state.participants}
          finalScores={state.finalScores}
          badges={state.challengeBadges}
          onClose={() => state.setShowResultPanel(false)}
        />
      )}

      {state.showInvitationPanel && state.currentInvitation && (
        <ChallengeInvitationPanel
          invitation={state.currentInvitation}
          participants={state.participants}
          currentUserId={user?.id || ''}
          onAccept={() => {
            // 초대 수락 처리
          }}
          onReject={() => {
            // 초대 거절 처리
          }}
          onExpire={() => {
            // 초대 만료 처리
          }}
        />
      )}
    </div>
  )
}

export default StudyRoom