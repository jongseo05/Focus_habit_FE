'use client'

import { useEffect, useState, useRef } from 'react'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { useVideoRoom } from '@/hooks/useVideoRoom'
import { useFocusSessionState, useFocusSessionActions } from '@/stores/focusSessionStore'
import { useChallenge } from '@/hooks/useChallenge'
import { useStudyRoomState } from '@/hooks/useStudyRoomState'
import { useStudyRoomLogic } from '@/hooks/useStudyRoomLogic'
import { useStudyRoomRealtime } from '@/hooks/useStudyRoomRealtime'
import React from 'react'
import { useStudyRoomStateRestoration } from '@/hooks/useStudyRoomStateRestoration'
import { useGroupChallengeAutoUpdate } from '@/hooks/useGroupChallengeAutoUpdate'
import { useCompetition } from '@/hooks/useCompetition'
import { StateRestorationNotification } from './StateRestorationNotification'
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
  const [showRestorationNotification, setShowRestorationNotification] = React.useState(true)
  
  // focusSessionStore 사용으로 통일 - 맨 먼저 선언
  const sessionState = useFocusSessionState()
  const sessionActions = useFocusSessionActions()
  
  // 상태 복원 훅
  const stateRestoration = useStudyRoomStateRestoration({
    roomId: room?.room_id,
    autoRestore: false // 사용자 선택으로만 복원
  })
  
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

  // 경쟁 기능 훅
  const competition = useCompetition({
    roomId: room?.room_id || '',
    isHost: state.isHost
  })

  // 🎭 경쟁 종료 시 전체 UI 상태 초기화 (완전한 리셋)
  useEffect(() => {
    const handleCompetitionEnded = () => {
      console.log('🏁 StudyRoom: 경쟁 종료 감지, 전체 UI 상태 초기화')
      
      // 1. 집중도 차트 데이터 초기화
      state.setFocusHistoryMap({})
      
      // 2. 집중도 세션 시작 시간 초기화
      state.setFocusSessionStartTime(null)
      
      // 3. 집중세션 종료 (경쟁과 동기화)
      if (state.isFocusSessionRunning) {
        console.log('🛑 경쟁 종료로 집중세션도 자동 종료')
        state.setIsFocusSessionRunning(false)
        state.setIsFocusSessionPaused(false)
        state.setFocusSessionElapsed(0)
      }
      
      // 4. 경쟁 관련 로컬 상태 강제 새로고침 트리거
      setTimeout(() => {
        // 참가자 목록 강제 새로고침 (최신 상태 반영)
        window.dispatchEvent(new CustomEvent('force-participants-refresh'))
        console.log('🔄 참가자 목록 강제 새로고침 트리거')
      }, 1000) // 1초 후 새로고침
      
      console.log('📊 전체 UI 상태 초기화 완료')
    }

    const handleCompetitionStarted = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log('🚀 StudyRoom: 새 경쟁 시작 감지', customEvent.detail)
      
      // 새 경쟁 시작 시에도 깨끗한 상태로 시작
      state.setFocusHistoryMap({})
      state.setFocusSessionStartTime(Date.now()) // 경쟁 시작 시간으로 설정
      
      // 집중세션도 자동으로 시작 (focusSessionStore 사용)
      if (!sessionState.isRunning) {
        console.log('🚀 경쟁 시작으로 집중세션 자동 시작')
        sessionActions.startSession()
      }
      
      // 경쟁 상태도 강제로 업데이트
      console.log('🔄 경쟁 상태 강제 새로고침 요청')
      setTimeout(() => {
        competition.fetchCompetitionStatus()
      }, 1000) // 1초 후에 상태 갱신
    }

    // 경쟁 점수 업데이트 이벤트 핸들러
    const handleCompetitionScoreUpdate = (event: Event) => {
      const customEvent = event as CustomEvent
      const { userId, score, timestamp } = customEvent.detail
      console.log('🏆 StudyRoom: 경쟁 점수 업데이트 감지:', { userId, score, timestamp })
      
      // 경쟁 상태가 활성화되어 있으면 즉시 새로고침
      if (competition.competition.isActive) {
        console.log('🔄 경쟁 활성화 상태 - 점수 업데이트 후 상태 새로고침')
        setTimeout(() => {
          competition.fetchCompetitionStatus()
        }, 500) // 0.5초 후 새로고침으로 점수 반영
      }
    }

    window.addEventListener('focus-session-auto-ended', handleCompetitionEnded)
    window.addEventListener('focus-session-auto-started', handleCompetitionStarted)
    window.addEventListener('competition-score-updated', handleCompetitionScoreUpdate)
    
    return () => {
      window.removeEventListener('focus-session-auto-ended', handleCompetitionEnded)
      window.removeEventListener('focus-session-auto-started', handleCompetitionStarted)
      window.removeEventListener('competition-score-updated', handleCompetitionScoreUpdate)
    }
    
  }, [
    state.setFocusHistoryMap, 
    state.setFocusSessionStartTime,
    sessionState.isRunning,
    sessionActions,
    competition
  ])



  // 집중세션 타이머 업데이트 (focusSessionStore 사용)
  useEffect(() => {
    if (sessionState.isRunning) {
      const interval = setInterval(() => {
        if (competition.competition.isActive) {
          // 경쟁 중일 때는 경쟁 타이머와 동기화
          const competitionDuration = competition.competition.duration || 25 // 기본 25분
          const timeLeft = competition.competition.timeLeft || 0 // 남은 시간(초)
          const elapsedSeconds = (competitionDuration * 60) - timeLeft // 경과 시간(초)
          
          // focusSessionStore의 elapsed 업데이트
          sessionActions.setElapsed(elapsedSeconds)
          console.log('🔄 경쟁 모드: 타이머 동기화', { elapsedSeconds, timeLeft })
        } else {
          // 일반 모드일 때는 독립적으로 타이머 실행
          if (sessionState.startTime) {
            const now = Date.now()
            const elapsedSeconds = Math.floor((now - sessionState.startTime) / 1000)
            sessionActions.setElapsed(elapsedSeconds)
            console.log('⏱️ 일반 모드: 독립 타이머', { elapsedSeconds })
          }
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [
    sessionState.isRunning,
    sessionState.startTime,
    sessionActions,
    competition.competition.isActive,
    competition.competition.duration,
    competition.competition.timeLeft
  ])

  // 집중 세션 참가자 (하위 컴포넌트 이벤트 수신)
  const [sessionParticipantIds, setSessionParticipantIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (detail.roomId && room?.room_id && detail.roomId !== room.room_id) return
      setSessionParticipantIds(new Set(detail.participantIds || []))
    }
    window.addEventListener('studyroom-session-participants-changed', handler)
    return () => window.removeEventListener('studyroom-session-participants-changed', handler)
  }, [room?.room_id])

  // directMediaStream fallback (현재는 debug 용 - 필요시 StudyRoomFocusSession이 localStream을 재사용하므로 유지)
  const [directFallbackStream, setDirectFallbackStream] = useState<MediaStream | null>(null)
  useEffect(() => {
    const handleReady = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (detail.roomId && room?.room_id && detail.roomId !== room.room_id) return
      if (videoRoom.localStream) return // 이미 WebRTC localStream 확보되면 무시
      if (detail.stream) {
        console.log('[StudyRoom] direct stream ready 이벤트 수신 & fallback 적용', detail)
        setDirectFallbackStream(detail.stream as MediaStream)
      } else {
        console.log('[StudyRoom] direct stream ready detail.stream 없음', detail)
      }
    }
    const handleUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (detail.roomId && room?.room_id && detail.roomId !== room.room_id) return
      if (videoRoom.localStream) return
      if (detail.stream) {
        console.log('[StudyRoom] direct stream updated 이벤트 수신 & fallback 갱신', detail)
        setDirectFallbackStream(detail.stream as MediaStream)
      }
    }
    window.addEventListener('studyroom-direct-stream-ready', handleReady)
    window.addEventListener('studyroom-direct-stream-updated', handleUpdated)
    return () => {
      window.removeEventListener('studyroom-direct-stream-ready', handleReady)
      window.removeEventListener('studyroom-direct-stream-updated', handleUpdated)
    }
  }, [room?.room_id, videoRoom.localStream])

  // 비디오 자동 시작 디바운스용 ref (Hook은 컴포넌트 최상위에서 선언)
  const startVideoInProgressRef = useRef(false)
  const lastStartAttemptRef = useRef(0)

  // (중복 선언 제거됨)

  // 자동 챌린지 업데이트 훅
  const challengeAutoUpdate = useGroupChallengeAutoUpdate({
    roomId: room?.room_id
  })

  // 경쟁이 활성화되어 있을 때 세션 시작 시간 자동 설정 및 집중세션 자동 시작
  useEffect(() => {
    if (competition.competition.isActive) {
      // 경쟁 진행 시간을 기반으로 시작 시간 계산
      const now = Date.now()
      const competitionDuration = competition.competition.duration || 25 // 기본 25분
      const timeLeft = competition.competition.timeLeft || 0 // 남은 시간(초)
      const elapsedSeconds = (competitionDuration * 60) - timeLeft // 경과 시간(초)
      const competitionStartTime = now - (elapsedSeconds * 1000) // 시작 시간
        
      console.log('🏁 경쟁이 활성화되어 세션 상태 동기화:', {
        competitionDuration,
        timeLeft,
        elapsedSeconds,
        currentSessionRunning: state.isFocusSessionRunning,
        currentStartTime: state.focusSessionStartTime
      })
      
      // 세션 시작 시간 설정 (처음 또는 큰 차이가 있을 때만)
      if (!state.focusSessionStartTime || Math.abs(state.focusSessionStartTime - competitionStartTime) > 5000) {
        console.log('🔄 세션 시작 시간 동기화:', new Date(competitionStartTime).toISOString())
        state.setFocusSessionStartTime(competitionStartTime)
      }
      
      // 집중세션 자동 시작 (focusSessionStore 사용)
      if (!sessionState.isRunning) {
        console.log('🚀 경쟁이 활성화되어 집중세션 자동 시작')
        sessionActions.startSession()
      }
      
      // 경과 시간 지속적으로 동기화 (focusSessionStore 사용)
      sessionActions.setElapsed(elapsedSeconds)
    }
  }, [
    competition.competition.isActive, 
    competition.competition.duration, 
    competition.competition.timeLeft, 
    state.focusSessionStartTime, 
    state.setFocusSessionStartTime,
    state.isFocusSessionRunning,
    state.setIsFocusSessionRunning,
    state.setFocusSessionElapsed
  ])

  // StudyRoomFocusSession 측에서 요청하는 카메라 자동 시작 이벤트 처리
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (detail.roomId && room?.room_id && detail.roomId !== room.room_id) return
      if (videoRoom.localStream) return
      const now = Date.now()
      if (startVideoInProgressRef.current && now - lastStartAttemptRef.current < 2000) return
      startVideoInProgressRef.current = true
      lastStartAttemptRef.current = now
      videoRoom.startVideo()
        .then(() => console.log('[StudyRoom] startVideo 성공'))
        .catch(err => console.warn('자동 비디오 시작 실패:', err))
        .finally(() => setTimeout(() => { startVideoInProgressRef.current = false }, 1500))
    }
    window.addEventListener('studyroom-request-start-video', handler)
    return () => window.removeEventListener('studyroom-request-start-video', handler)
  }, [room?.room_id, videoRoom.localStream, videoRoom.startVideo])

  // ================= Development Diagnostics =================
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as any).__studyRoomDebug = () => {
      const participantsSnapshot = state.participants.map(p => ({
        participant_id: p.participant_id,
        user_id: p.user_id,
        name: p.user?.name,
        is_connected: p.is_connected,
        hasRemoteStream: videoRoom.remoteStreams.has(p.user_id)
      }))
      const localTracks = videoRoom.localStream ? videoRoom.localStream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label
      })) : []
      const diagnostic = {
        roomId: room?.room_id,
        currentUserId: user?.id,
        participantCount: state.participants.length,
        participantUserIds: state.participants.map(p => p.user_id),
        hasCurrentUserInParticipants: !!state.participants.find(p => p.user_id === user?.id),
        sessionParticipantIds: Array.from(sessionParticipantIds),
        hasLocalStream: !!videoRoom.localStream,
        localStreamId: videoRoom.localStream?.id,
        localTracks,
        remoteStreamIds: Array.from(videoRoom.remoteStreams.keys()),
        isVideoEnabled: videoRoom.isVideoEnabled,
        isAudioEnabled: videoRoom.isAudioEnabled,
        focusSessionRunning: state.focusSessionStartTime != null, // proxy indicator
      }
      // Pretty logs
      console.group('%cStudyRoom Debug Snapshot','color:#2563eb;font-weight:bold;')
      console.table(participantsSnapshot)
      console.log('Diagnostic:', diagnostic)
      console.groupEnd()
      return diagnostic
    }
    ;(window as any).__logLocalTracks = () => (videoRoom.localStream?.getTracks().forEach(t => console.log('track', t.kind, t.id, t.label, t.readyState, 'enabled=', t.enabled)), true)
    console.info('%c[StudyRoom] 디버그 함수 등록: __studyRoomDebug(), __logLocalTracks()','color:#2563eb')
    const autoDump = () => {
      ;(window as any).__studyRoomDebug?.()
    }
    window.addEventListener('studyroom-debug-dump', autoDump)
    return () => window.removeEventListener('studyroom-debug-dump', autoDump)
  }, [room?.room_id, user?.id, state.participants, sessionParticipantIds, videoRoom.localStream, videoRoom.remoteStreams, videoRoom.isVideoEnabled, videoRoom.isAudioEnabled, state.focusSessionStartTime])

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
              {/* 상태 복원 알림 */}
      <StateRestorationNotification
        canRestore={stateRestoration.canRestore}
        hasRestored={stateRestoration.hasRestored}
        onRestore={stateRestoration.restoreState}
        onDismiss={async () => {
          // 복원 거부 시 저장된 상태들 정리 (서버 경쟁도 종료)
          await stateRestoration.clearState()
          setShowRestorationNotification(false)
        }}
        isVisible={showRestorationNotification && (stateRestoration.canRestore || stateRestoration.hasRestored)}
      />
        
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
              sessionParticipantIds={sessionParticipantIds}
            />
          </div>

          {/* 집중도 세션 - 전체 너비 */}
          <div className="w-full">
            <StudyRoomFocusSession
              roomId={room?.room_id || ''}
              currentUserId={user?.id || ''}
              participants={state.participants}
              localStream={videoRoom.localStream}
              remoteStreams={videoRoom.remoteStreams}
              onFocusScoreUpdate={(score: number) => {
                // 집중도 업데이트 시 히스토리에 추가
                console.log('🎯 StudyRoom에서 집중도 업데이트 받음:', { userId: user?.id, score })
                if (user?.id) {
                  state.updateFocusHistory(user.id, score, 0.8)
                  console.log('📊 현재 사용자 집중도 히스토리 업데이트 완료')
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
              participants={
                // 경쟁이 활성화된 경우 경쟁 참가자들의 데이터 사용
                competition.competition.isActive && competition.competition.participants.length > 0 
                  ? (() => {
                      console.log('🏆 경쟁 활성화됨, 참가자 데이터 매핑 시작:', {
                        competitionParticipants: competition.competition.participants,
                        focusHistoryMap: state.focusHistoryMap,
                        focusHistoryKeys: Object.keys(state.focusHistoryMap)
                      })
                      
                      return competition.competition.participants.map((participant: any) => {
                        const userId = participant.user_id
                        const focusHistory = state.focusHistoryMap[userId] || []
                        
                        console.log(`📊 참가자 ${userId} 차트 데이터:`, {
                          userId,
                          userName: participant.user?.name || participant.user?.display_name,
                          focusHistoryLength: focusHistory.length,
                          currentScore: participant.current_score,
                          focusHistory: focusHistory.slice(-5) // 최근 5개만 로그
                        })
                        
                        return {
                          userId,
                          userName: participant.user?.name || participant.user?.display_name || 'Unknown',
                          focusHistory,
                          currentScore: participant.current_score || 0,
                          isOnline: true
                        }
                      })
                    })()
                  // 일반 스터디룸 참가자들의 데이터 사용
                  : state.participants.map(participant => ({
                      userId: participant.user_id,
                      userName: participant.user.name,
                      focusHistory: state.focusHistoryMap[participant.user_id] || [], // 실제 집중도 히스토리
                      currentScore: participant.current_focus_score || 0, // 실제 현재 집중도 점수
                      isOnline: participant.is_connected
                    }))
              }
              timeRange={10}
              sessionStartTime={state.focusSessionStartTime || undefined} // 세션 시작 시간 전달
            />
          </div>

          {/* 집중도 대결 패널 - 전체 너비 */}
          <div className="w-full">
            <CompetitionPanel
              isHost={state.isHost}
              isCompetitionActive={competition.competition.isActive}
              isBreakTime={false}
              competitionTimeLeft={competition.competition.timeLeft}
              competitionDuration={competition.settings.duration}
              breakDuration={competition.settings.breakDuration}
              competitionScores={(() => {
                // 경쟁이 활성화된 경우 참가자별 점수 매핑
                if (competition.competition.isActive && competition.competition.participants.length > 0) {
                  return competition.competition.participants.reduce((acc: Record<string, number>, p: any) => {
                    // 현재 집중도 점수를 실시간 참가자 데이터에서 가져오기
                    const currentParticipant = state.participants.find(sp => sp.user_id === p.user_id)
                    const realTimeScore = currentParticipant?.current_focus_score || 0
                    
                    // 경쟁 점수 우선, 없으면 실시간 점수 사용
                    const score = p.totalFocusScore || p.current_score || realTimeScore
                    
                    console.log(`🏆 경쟁 점수 매핑 - ${p.user_id}:`, {
                      totalFocusScore: p.totalFocusScore,
                      current_score: p.current_score,
                      realTimeScore,
                      finalScore: score
                    })
                    
                    return {
                      ...acc,
                      [p.user_id]: score
                    }
                  }, {})
                }
                
                // 경쟁이 없으면 일반 참가자 점수 사용
                return state.participants.reduce((acc: Record<string, number>, p) => ({
                  ...acc,
                  [p.user_id]: p.current_focus_score || 0
                }), {})
              })()}
              competitionHistory={state.competitionHistory}
              participants={(() => {
                if (competition.competition.isActive && competition.competition.participants.length > 0) {
                  // 경쟁 활성화 시 실시간 참가자 데이터와 경쟁 데이터 병합
                  return competition.competition.participants.map((p: any) => {
                    // 실시간 참가자 데이터에서 현재 점수 가져오기
                    const realTimeParticipant = state.participants.find(sp => sp.user_id === p.user_id)
                    const currentScore = realTimeParticipant?.current_focus_score || p.totalFocusScore || p.current_score || 0
                    
                    console.log(`🏆 경쟁 참가자 점수 병합 - ${p.user_id}:`, {
                      realTimeScore: realTimeParticipant?.current_focus_score,
                      competitionTotalScore: p.totalFocusScore,
                      competitionCurrentScore: p.current_score,
                      finalScore: currentScore
                    })
                    
                    return {
                      user_id: p.user_id,
                      user: {
                        display_name: (p.user as any)?.display_name || (realTimeParticipant?.user as any)?.display_name || `사용자-${p.user_id?.slice(-4)}`,
                        avatar_url: (p.user as any)?.avatar_url || (realTimeParticipant?.user as any)?.avatar_url || '',
                        name: (p.user as any)?.name || (realTimeParticipant?.user as any)?.name || (p.user as any)?.display_name || (realTimeParticipant?.user as any)?.display_name || `사용자-${p.user_id?.slice(-4)}`
                      },
                      participant_id: `comp-${p.user_id}`,
                      room_id: room?.room_id || '',
                      is_host: false,
                      joined_at: new Date().toISOString(),
                      left_at: undefined,
                      focus_score: currentScore,
                      last_activity: new Date().toISOString(),
                      is_connected: realTimeParticipant?.is_connected || true,
                      is_video_enabled: false,
                      is_audio_enabled: false,
                      camera_updated_at: new Date().toISOString(),
                      current_focus_score: currentScore
                    }
                  }) as any
                }
                
                // 일반 참가자 목록 (경쟁이 비활성화된 경우)
                return state.participants
              })()}
              showCompetitionSettings={competition.settings.showSettings}
              activeTab={competition.settings.activeTab}
              customHours={competition.settings.customHours}
              customMinutes={competition.settings.customMinutes}
              hasPendingInvitation={false}
              onShowCompetitionSettings={competition.setShowCompetitionSettings}
              onActiveTabChange={competition.onActiveTabChange}
              onCompetitionDurationChange={competition.onCompetitionDurationChange}
              onBreakDurationChange={competition.onBreakDurationChange}
              onCustomHoursChange={competition.onCustomHoursChange}
              onCustomMinutesChange={competition.onCustomMinutesChange}
              onStartCompetition={() => {
                // 활성 탭에 따라 올바른 시간 전달
                const duration = competition.settings.activeTab === 'custom' 
                  ? (competition.settings.customHours * 60) + competition.settings.customMinutes
                  : competition.settings.duration
                return competition.onStartCompetition(duration)
              }}
              onEndCompetition={competition.onEndCompetition}
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