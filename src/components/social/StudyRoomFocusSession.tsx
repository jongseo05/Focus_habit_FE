'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VideoGrid } from './VideoGrid'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, Clock, Target, Brain, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { useFocusSessionState, useFocusSessionActions, useFocusSessionSync } from '@/stores/focusSessionStore'
import { useMicrophoneStream } from '@/hooks/useMediaStream'
import { useFocusAnalysisWebSocket } from '@/hooks/useFocusAnalysisWebSocket'
import { useOnlineStatus, useRoomOnlineStatus } from '@/stores/onlineStatusStore'
import { useStudyRoomPresence } from '@/hooks/useStudyRoomPresence'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { useCompetition } from '@/hooks/useCompetition'
import { RoomPresenceIndicator } from '@/components/studyroom/RoomPresenceIndicator'
import HybridAudioPipeline from '@/components/HybridAudioPipeline'
import WebcamAnalysisDisplay from '@/components/WebcamAnalysisDisplay'
import CameraPermissionLayer from '@/components/CameraPermissionLayer'
import MicrophonePermissionLayer from '@/components/MicrophonePermissionLayer'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUserPreferencesStore } from '@/stores/userPreferencesStore'
import { Switch } from '@/components/ui/switch'

interface StudyRoomFocusSessionProps {
  roomId: string
  currentUserId: string
  participants?: Array<{
    participant_id: string
    user_id: string
    is_connected: boolean
    last_activity: string
    user: {
      name: string
      avatar_url?: string
    }
  }>
  // WebRTC 비디오 공유 스트림 (상위 StudyRoom에서 전달)
  localStream?: MediaStream | null
  remoteStreams?: Map<string, MediaStream> | null
  onFocusScoreUpdate?: (score: number) => void
  onSessionStart?: (startTime: number) => void
  onSessionComplete?: (sessionData: {
    duration: number
    sessionType?: string
  }) => void
}

/**
 * 스터디룸 집중도 세션 컴포넌트 (최적화된 버전)
 * - 기존 훅들을 재사용하여 중복 코드 제거
 * - 더 간단한 상태 관리와 명확한 책임 분리
 * - 권한 관리 단순화
 */
export const StudyRoomFocusSession = React.memo(function StudyRoomFocusSession({
  roomId,
  currentUserId,
  participants = [],
  localStream = null,
  remoteStreams = null,
  onFocusScoreUpdate,
  onSessionStart,
  onSessionComplete
}: StudyRoomFocusSessionProps) {
  // 집중도 세션 상태
  const sessionState = useFocusSessionState()
  const sessionActions = useFocusSessionActions()
  const sessionSync = useFocusSessionSync()

  // === 세션 참가자 추적 (focus_session_started/ended 기반) ===
  const [sessionParticipantIds, setSessionParticipantIds] = useState<Set<string>>(new Set())
  const addParticipant = useCallback((uid: string) => {
    setSessionParticipantIds(prev => {
      if (prev.has(uid)) return prev
      const next = new Set(prev)
      next.add(uid)
      return next
    })
  }, [])
  const removeParticipant = useCallback((uid: string) => {
    setSessionParticipantIds(prev => {
      if (!prev.has(uid)) return prev
      const next = new Set(prev)
      next.delete(uid)
      return next
    })
  }, [])
  const clearParticipants = useCallback(() => setSessionParticipantIds(new Set()), [])

  // ✨ 새로운 스터디룸 실시간 입장/퇴장 상태 관리
  const roomPresence = useStudyRoomPresence({
    roomId,
    userId: currentUserId,
    enabled: true
  })

  // ✨ 경쟁 상태 관리 (이미 활성화된 경쟁 확인용)
  const competitionState = useCompetition({
    roomId,
    isHost: false // 일반 참여자로 취급
  })

  // ✨ 소셜 실시간 이벤트 (집중세션 시작 이벤트 수신용)
  const socialRealtime = useSocialRealtime({
  onFocusSessionStarted: useCallback(async (payload: any) => {
      console.log('StudyRoomFocusSession: 집중세션 시작 이벤트 수신 (소셜 실시간):', payload)
      
      // 페이로드에서 세션 데이터 추출
      const sessionUserId = payload?.user_id
      const sessionRoomId = payload?.room_id
      const sessionId = payload?.id
      
      console.log('StudyRoomFocusSession: 세션 데이터 확인:', {
        sessionId,
        sessionUserId,
        sessionRoomId,
        currentUserId,
        roomId
      })
      
      // 모든 참가자(현재 룸, 온라인/프레즌스 충족)는 자동 시작 대상
      if (sessionId && sessionRoomId === roomId) {
        const isSelf = sessionUserId === currentUserId
        // 이미 참여 중이면 무시
        if (!sessionParticipantIds.has(sessionUserId)) addParticipant(sessionUserId)

        // 본인 아닌 타인이 시작했어도 자동 세션 동기화 (로컬 UI용)
        if (!sessionState.isRunning) {
          console.log('StudyRoomFocusSession: 세션 자동 동기화 시작 (initiated by another user)')
          sessionActions.startSession()
        }

        // 사용자 환경설정 확인 (타인 시작 시 자동 카메라)
        const autoStartPref = useUserPreferencesStore.getState().preferences.autoStartCameraOnSession
        const shouldAutoStartCamera = (isSelf || autoStartPref)

        if (shouldAutoStartCamera) {
          console.log('StudyRoomFocusSession: 자동 웹캠 활성화 조건 충족 (isSelf=%s, pref=%s)', isSelf, autoStartPref)
          try {
            // 우선 WebRTC localStream 없으면 비디오룸 시작 (상위 전달 localStream 활용 가정)
            if (!localStream) {
              // 비디오룸 훅이 이 컴포넌트에 직접 없으므로 커스텀 이벤트로 상위에 startVideo 요청
              window.dispatchEvent(new CustomEvent('studyroom-request-start-video', { detail: { roomId } }))
            }
            // 분석용 directMediaStream 없으면 생성 (중복 스트림 방지 TODO: WebRTC 스트림 재사용 리팩터)
            if (!directMediaStream) {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } }
              })
              if (stream) {
                setDirectMediaStream(stream)
                setShowWebcam(true)
                setVideoStreamConnected(true)
              }
            }
          } catch (e) {
            console.warn('웹캠 자동 시작 실패:', e)
            if (!isSelf && autoStartPref) {
              // 권한 거부 시 자동 시작 비활성화하여 반복 팝업 방지
              useUserPreferencesStore.getState().setAutoStartCameraOnSession(false)
            }
          }
        }
        console.log('StudyRoomFocusSession: 자동 세션 동기화 완료')
      }
    }, [currentUserId, roomId, sessionActions, addParticipant, sessionState.isRunning, sessionParticipantIds])
    ,
    onFocusSessionEnded: useCallback((payload: any) => {
      const endedUserId = payload?.ended_by || payload?.user_id
      const sessionId = payload?.id || payload?.session_id
      const currentSessionId = sessionSync.currentSessionId

      if (endedUserId) removeParticipant(endedUserId)

      // 나의 세션 전체 종료 판단만 여기서 (스트림 정리는 아래 추가 effect에서 directMediaStream 선언 후 처리)
      if (sessionId && currentSessionId && sessionId === currentSessionId) {
        if (sessionState.isRunning) sessionActions.stopSession()
        if (sessionSync.clearCurrentSession) sessionSync.clearCurrentSession()
        clearParticipants()
        // 스트림/UI 정리는 별도 effect 트리거용 상태 변화로 충분
        setShowWebcam(false)
        setShowAudioPipeline(false)
      }
    }, [removeParticipant, sessionSync.currentSessionId, sessionState.isRunning, sessionActions, sessionSync, clearParticipants])
  })

  // ✨ 경쟁 자동 세션 시작 이벤트 처리 (커스텀 이벤트 - 백업용)
  useEffect(() => {
  // 함수 형태 isSessionActive()를 호출해야 실제 활성 여부 확인 가능
  const isActiveFn = sessionState?.isSessionActive as unknown as (() => boolean) | undefined
    const handleAutoSessionStart = (event: Event) => {
      const customEvent = event as CustomEvent
      const eventData = customEvent.detail
      console.log('StudyRoomFocusSession: 자동 세션 시작 이벤트 수신 (커스텀 이벤트):', eventData)
      
      // 이벤트 데이터 구조 확인 및 추출
      const sessionData = eventData?.sessionData || eventData
      const sessionId = eventData?.sessionId || sessionData?.id
      const sessionUserId = sessionData?.user_id
      const sessionRoomId = eventData?.roomId || sessionData?.room_id
      
      console.log('StudyRoomFocusSession: 이벤트 데이터 파싱:', {
        sessionId,
        sessionUserId,
        sessionRoomId,
        currentUserId,
        roomId
      })
      
      if (sessionId && sessionUserId === currentUserId && sessionRoomId === roomId) {
        console.log('StudyRoomFocusSession: 현재 사용자의 자동 세션으로 UI 상태 업데이트')
        
        // Zustand 스토어 상태를 서버 세션과 동기화 - startSession 호출
  sessionActions.startSession()
  addParticipant(currentUserId)
        // 서버 세션 ID/데이터 저장 (isSessionActive 작동 위해)
        try {
          if (sessionSync?.setCurrentSession && sessionData) {
            sessionSync.setCurrentSession(sessionId, {
              session_id: sessionId,
              started_at: sessionData.started_at || new Date().toISOString(),
              goal_min: sessionData.goal_min ?? null,
              context_tag: sessionData.context_tag ?? '스터디룸 집중 세션',
              session_type: sessionData.session_type ?? 'study_room',
              notes: sessionData.notes ?? null,
              focus_score: sessionData.focus_score ?? null
            })
            console.log('StudyRoomFocusSession: setCurrentSession 호출 완료')
          } else {
            console.log('StudyRoomFocusSession: setCurrentSession 사용 불가 (sessionSync 혹은 sessionData 부족)')
          }
        } catch (e) {
          console.warn('StudyRoomFocusSession: setCurrentSession 중 오류', e)
        }
        
        // 추가로 세션 ID 설정이 필요할 수 있음 (별도 액션이 있는지 확인 필요)
        console.log('StudyRoomFocusSession: 자동 세션 시작 완료, sessionId:', sessionId)
      } else {
        console.log('StudyRoomFocusSession: 세션 조건 불일치 - UI 업데이트 건너뜀')
      }
    }

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('focus-session-auto-started', handleAutoSessionStart)
    // 경쟁 종료/세션 자동 종료 이벤트 -> UI 리셋 
    const handleAutoSessionEnded = (event: Event) => {
      const customEvent = event as CustomEvent
      const detail = customEvent.detail
      console.log('StudyRoomFocusSession: 자동 세션 종료 이벤트 수신:', detail)
      // 현재 사용자가 경쟁 세션 중이라면 세션 상태 종료 처리
  // currentSessionId 누락 상황에서도 isRunning이면 강제 종료
      if (sessionState?.isRunning) {
        // 세션 종료 (store에 stopSession 메서드 존재)
        if (typeof sessionActions.stopSession === 'function') {
          sessionActions.stopSession()
        } else if (typeof sessionActions.pauseSession === 'function') {
          // fallback
          sessionActions.pauseSession()
        }
        // 서버 세션 정보도 정리
        try {
          // sessionSync는 훅 상단에서 이미 정의되어 있음
          // @ts-ignore 안전 호출
          if (sessionSync?.clearCurrentSession) sessionSync.clearCurrentSession()
        } catch (e) {
          console.warn('세션 정리 중 경고:', e)
        }
        clearParticipants()
        
        // 🚀 경쟁 종료 시에도 웹캠 그리드는 유지 (집중도 분석만 중지)
        // 오디오 파이프라인만 중지 (음성 분석 종료)
        setShowAudioPipeline(false)
        
        // 웹캠은 스터디룸에서 계속 사용하므로 유지
        // setShowWebcam(false) <- 이 줄 제거
        // directMediaStream 중지하지 않음 <- 웹캠 그리드에서 계속 사용
        
        console.log('StudyRoomFocusSession: 경쟁 종료로 집중도 분석만 중지, 웹캠은 유지')
      }
    }
    window.addEventListener('focus-session-auto-ended', handleAutoSessionEnded)
    
    return () => {
      window.removeEventListener('focus-session-auto-started', handleAutoSessionStart)
      window.removeEventListener('focus-session-auto-ended', handleAutoSessionEnded)
    }
  }, [currentUserId, roomId, sessionActions, sessionState?.isRunning, sessionSync, clearParticipants])

  // directMediaStream 선언 이후에 스트림 정리 관련 effect들을 배치해야 하므로 아래로 이동

  // 직접 MediaStream 관리 (useMediaStream 훅 문제 우회)
  const [directMediaStream, setDirectMediaStream] = useState<MediaStream | null>(null)
  // 경쟁 종료 broadcast (competition_ended) 대비: 상위 훅이 별도 이벤트 던지지 못하는 경우 직접 수신 (전역 custom event 사용 가정)
  useEffect(() => {
    const handler = () => {
      if (sessionState.isRunning) sessionActions.stopSession()
      if (sessionSync.clearCurrentSession) sessionSync.clearCurrentSession()
      clearParticipants()
      if (directMediaStream) {
        directMediaStream.getTracks().forEach(t => t.stop())
        setDirectMediaStream(null)
      }
      setShowWebcam(false)
      setShowAudioPipeline(false)
    }
    window.addEventListener('studyroom-competition-ended', handler)
    return () => window.removeEventListener('studyroom-competition-ended', handler)
  }, [sessionState.isRunning, sessionActions, sessionSync, clearParticipants, directMediaStream])
  const [directStreamError, setDirectStreamError] = useState<string | null>(null)
  const [directStreamLoading, setDirectStreamLoading] = useState(false)
  
  // 기존 훅은 마이크 전용으로만 사용
  const microphoneStream = useMicrophoneStream()

  // UI 상태
  const [showWebcam, setShowWebcam] = useState(false)
  const [showAudioPipeline, setShowAudioPipeline] = useState(false)
  const [goalMinutes, setGoalMinutes] = useState(30)

  // 권한 관리 상태
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [showCameraPermission, setShowCameraPermission] = useState(false)
  const [showMicrophonePermission, setShowMicrophonePermission] = useState(false)

  // 전역 온라인 상태 사용
  const { isCurrentUserOnline } = useOnlineStatus()
  const { setRoomParticipants } = useRoomOnlineStatus(roomId)

  // 참가자 데이터를 메모이제이션 (최적화)
  const participantsWithStatus = useMemo(() => {
    return participants.map(participant => ({
      ...participant,
      online_status: 'checking' as const
    }))
  }, [participants.map(p => p.participant_id).join(',')]) // 참가자 ID만 비교하여 불필요한 재계산 방지

  // 세션 참여자 필터링된 참가자 목록
  const sessionParticipants = useMemo(() => {
    if (!sessionParticipantIds.size) return []
    return participants.filter(p => sessionParticipantIds.has(p.user_id)) as any
  }, [participants, sessionParticipantIds])

  // 상위 VideoGrid 하이라이트 용도로 sessionParticipantIds 브로드캐스트
  useEffect(() => {
    const detail = { roomId, participantIds: Array.from(sessionParticipantIds) }
    window.dispatchEvent(new CustomEvent('studyroom-session-participants-changed', { detail }))
  }, [sessionParticipantIds, roomId])

  // 세션 참여자용 스트림 필터링 (원본 remoteStreams 에서 필요한 것만 추출)
  const sessionRemoteStreams = useMemo(() => {
    if (!remoteStreams) return new Map<string, MediaStream>()
    const filtered = new Map<string, MediaStream>()
    sessionParticipantIds.forEach(uid => {
      if (uid !== currentUserId) {
        const s = remoteStreams.get(uid)
        if (s) filtered.set(uid, s)
      }
    })
    return filtered
  }, [remoteStreams, sessionParticipantIds, currentUserId])

  // 참가자 데이터를 전역 스토어에 동기화 (최적화)
  useEffect(() => {
    if (participants.length > 0) {
      setRoomParticipants(participants.map(p => ({
        user_id: p.user_id,
        participant_id: p.participant_id,
        name: p.user.name,
        avatar_url: p.user.avatar_url,
        is_connected: p.is_connected,
        last_activity: p.last_activity,
        online_status: 'checking' as const,
        user: p.user
      })))
    }
  }, [roomId, participants, setRoomParticipants])

  // 비디오 프레임 캡처 및 전송 로직
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 비디오 스트림 연결 상태 추적
  const [videoStreamConnected, setVideoStreamConnected] = useState(false)
  const [videoStreamError, setVideoStreamError] = useState<string | null>(null)

  // 직접 MediaStream 생성 함수
  const createDirectMediaStream = useCallback(async (): Promise<MediaStream | null> => {
    if (directMediaStream && directMediaStream.getVideoTracks().some(t => t.readyState === 'live')) {
      console.log('직접 스트림 이미 존재 - 재사용')
      return directMediaStream
    }
    try {
      setDirectStreamLoading(true)
      setDirectStreamError(null)
      
      console.log('직접 MediaStream 생성 시작')
      
      // 점진적 품질 다운그레이드
      const constraints = [
        { video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, frameRate: { ideal: 30, min: 15 } } },
        { video: { width: { ideal: 640, min: 320 }, height: { ideal: 480, min: 240 }, frameRate: { ideal: 24, min: 10 } } },
        { video: { width: 320, height: 240, frameRate: 15 } },
        { video: true }
      ]
      
      for (let i = 0; i < constraints.length; i++) {
        try {
          console.log(`직접 스트림 생성 시도 ${i + 1}/${constraints.length}:`, constraints[i])
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints[i])
          
          if (stream && stream.getTracks().length > 0) {
            console.log('직접 스트림 생성 성공:', {
              streamId: stream.id,
              active: stream.active,
              videoTracks: stream.getVideoTracks().length,
              audioTracks: stream.getAudioTracks().length,
              tracks: stream.getTracks().map(t => ({
                kind: t.kind,
                label: t.label,
                enabled: t.enabled,
                readyState: t.readyState
              }))
            })
            
            setDirectMediaStream(stream)
            setDirectStreamLoading(false)
            return stream
          }
        } catch (error) {
          console.warn(`직접 스트림 생성 시도 ${i + 1} 실패:`, error)
          continue
        }
      }
      
      throw new Error('모든 품질에서 스트림 생성 실패')
      
    } catch (error) {
      console.error('직접 MediaStream 생성 실패:', error)
      setDirectStreamError(error instanceof Error ? error.message : '스트림 생성 실패')
      setDirectStreamLoading(false)
      return null
    }
  }, [])

  // WebRTC 우선 확보 후 fallback 로직 (중복 방지)
  const ensureVideoStream = useCallback(async () => {
    try {
      // 1) WebRTC localStream 시도 (상위 요청 이벤트)
      if (!localStream) {
        window.dispatchEvent(new CustomEvent('studyroom-request-start-video', { detail: { roomId, reason: 'ensure-video-stream' } }))
        const ok = await new Promise<boolean>(resolve => {
          const start = performance.now()
            ;(function waitLoop() {
              if (localStreamRef.current) return resolve(true)
              if (performance.now() - start > 1500) return resolve(false)
              setTimeout(waitLoop, 100)
            })()
        })
        if (ok && localStreamRef.current) {
          console.log('✅ WebRTC localStream 확보 성공 (ensure)')
          setDirectMediaStream(prev => prev || localStreamRef.current!)
          setShowWebcam(true)
          setVideoStreamConnected(true)
          return localStreamRef.current
        }
      } else {
        console.log('✅ 이미 WebRTC localStream 존재')
        if (!directMediaStream) {
          setDirectMediaStream(localStream)
          setShowWebcam(true)
          setVideoStreamConnected(true)
        }
        return localStream
      }
      // 2) fallback
      console.log('⚠️ WebRTC localStream 미확보 → fallback getUserMedia 실행')
      const stream = await createDirectMediaStream()
      if (stream) {
        setShowWebcam(true)
        setVideoStreamConnected(true)
        return stream
      }
      return null
    } catch (e) {
      console.warn('ensureVideoStream 실패', e)
      return null
    }
  }, [localStream, createDirectMediaStream, directMediaStream, roomId])

  // 직접 MediaStream 정리 함수
  const cleanupDirectMediaStream = useCallback(() => {
    if (directMediaStream) {
      // WebRTC localStream과 동일 객체인 경우 stop하면 비디오룸도 끊기므로 구분
      if (directMediaStream === localStream) {
        console.log('directMediaStream은 WebRTC localStream 재사용 중 - stop 생략')
      } else {
        console.log('직접 MediaStream 정리 (standalone)')
        directMediaStream.getTracks().forEach(track => {
          track.stop()
          console.log(`트랙 정리: ${track.kind} - ${track.label}`)
        })
      }
      setDirectMediaStream(null)
      setVideoStreamConnected(false)
    }
  }, [directMediaStream, localStream])

  // 집중도 점수 업데이트 통합 함수 (중복 제거)
  const updateFocusScore = useCallback(async (score: number, confidence: number) => {
    try {
      console.log('🔥 집중도 점수 통합 업데이트 시작:', { score, confidence })
      
      // 1. 로컬 상태 업데이트
      sessionActions.updateFocusScore(score)
      
      // 2. 부모 컴포넌트에 집중도 업데이트 알림
      if (onFocusScoreUpdate) {
        console.log('🔥 onFocusScoreUpdate 콜백 호출:', score)
        onFocusScoreUpdate(score)
      } else {
        console.warn('⚠️ onFocusScoreUpdate 콜백이 없음')
      }
      
      // 2.5. 경쟁 중이면 즉시 점수 업데이트 이벤트 발생
      if (competitionState.competition.isActive) {
        console.log('🏆 경쟁 중 - 즉시 점수 업데이트 이벤트 발생:', score)
        // 경쟁 점수 업데이트를 위한 커스텀 이벤트
        window.dispatchEvent(new CustomEvent('competition-score-updated', {
          detail: {
            userId: currentUserId,
            score: score,
            timestamp: new Date().toISOString()
          }
        }))
      }
      
      // 3. 세션 ID 확인
      if (!sessionSync.currentSessionId) {
        console.warn('세션 ID가 없어서 서버 업데이트 불가')
        return
      }
      
      const timestamp = new Date().toISOString()
      
      // 4. 병렬로 API 호출 (성능 최적화)
      const [studyRoomResult, focusScoreResult, competitionResult] = await Promise.allSettled([
        // 스터디룸 세션 업데이트
        fetch('/api/social/study-room-focus-session', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionSync.currentSessionId,
            focus_score: score,
            room_id: roomId,
            timestamp
          })
        }),
        
        // focus_sample 테이블에 상세 데이터 저장
        fetch('/api/focus-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionSync.currentSessionId,
            focusScore: score,
            timestamp,
            confidence,
            analysisMethod: 'webcam_analysis'
          })
        }),
        
        // 경쟁 중이면 룸 집중도 점수도 업데이트 (경쟁 점수 반영)
        fetch(`/api/social/study-room/${roomId}/focus-score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focus_score: score })
        })
      ])
      
      // 5. 결과 처리
      if (studyRoomResult.status === 'fulfilled' && studyRoomResult.value.ok) {
        console.log('스터디룸 집중도 점수 업데이트 성공:', score)
      } else {
        console.error('스터디룸 집중도 점수 업데이트 실패:', 
          studyRoomResult.status === 'rejected' ? studyRoomResult.reason : studyRoomResult.value.statusText)
      }
      
      if (focusScoreResult.status === 'fulfilled' && focusScoreResult.value.ok) {
        console.log('focus_sample 저장 성공:', score)
      } else {
        console.error('focus_sample 저장 실패:', 
          focusScoreResult.status === 'rejected' ? focusScoreResult.reason : focusScoreResult.value.statusText)
      }
      
      if (competitionResult.status === 'fulfilled' && competitionResult.value.ok) {
        console.log('경쟁 집중도 점수 업데이트 성공:', score)
      } else {
        console.warn('경쟁 집중도 점수 업데이트 실패 (경쟁 중이 아닐 수 있음):', 
          competitionResult.status === 'rejected' ? competitionResult.reason : competitionResult.value.statusText)
      }
      
    } catch (error) {
      console.error('집중도 점수 업데이트 중 오류:', error)
    }
  }, [sessionActions, sessionSync.currentSessionId, roomId, onFocusScoreUpdate])

  // WebSocket 집중도 분석 (메모이제이션된 설정)
  const websocketConfig = useMemo(() => ({
    userId: currentUserId,
    enabled: sessionState.isRunning && isCurrentUserOnline, // WebSocket 다시 활성화
    onFocusScoreUpdate: (score: number, confidence: number) => {
      console.log('🔥 WebSocket 집중도 분석 응답 수신:', { score, confidence, timestamp: new Date().toISOString() })
      updateFocusScore(score, confidence)
    },
    onError: (error: any) => {
      console.error('❌ WebSocket 집중도 분석 오류:', error)
    }
  }), [currentUserId, sessionState.isRunning, isCurrentUserOnline, updateFocusScore])

  const {
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    lastFocusScore: wsFocusScore,
    sendFrame: wsSendFrame,
    connect: wsConnect,
    disconnect: wsDisconnect
  } = useFocusAnalysisWebSocket(websocketConfig)

  // ✨ 웹소켓 연결과 동시에 카메라 자동 시작
  useEffect(() => {
    console.log('🔄 웹소켓 연결 상태 변경 감지:', {
      wsConnected,
      sessionRunning: sessionState.isRunning,
      hasDirectStream: !!directMediaStream,
      competitionActive: competitionState.competition.isActive
    })

    // 웹소켓이 연결되고 세션이 실행 중이며 카메라가 아직 시작되지 않은 경우
    if (wsConnected && sessionState.isRunning && !directMediaStream) {
      console.log('🎥 웹소켓 연결됨 - ensureVideoStream 실행')
      ensureVideoStream()
    }
  }, [wsConnected, sessionState.isRunning, directMediaStream, ensureVideoStream, competitionState.competition.isActive])

  // 비디오 프레임 캡처 및 전송
  const captureAndSendFrame = useCallback(() => {
    // 직접 관리하는 스트림 사용
    const hasVideoStream = !!directMediaStream
    const videoTracks = directMediaStream?.getVideoTracks() || []
    const hasVideoTrack = videoTracks.length > 0 && videoTracks.some(t => t.enabled && t.readyState === 'live')
    
    console.log('프레임 캡처 시도 (직접 스트림):', {
      hasVideoRef: !!videoRef.current,
      hasCanvasRef: !!canvasRef.current,
      wsConnected,
      hasVideoStream,
      hasVideoTrack,
      videoTracksCount: videoTracks.length,
      streamActive: directMediaStream?.active,
      streamId: directMediaStream?.id
    })
    
    if (!videoRef.current || !canvasRef.current || !wsConnected || !hasVideoStream || !hasVideoTrack) {
      console.log('프레임 캡처 조건 미충족 - 상세 상태:', {
        videoTrackStates: videoTracks.map(t => ({ 
          kind: t.kind, 
          enabled: t.enabled, 
          readyState: t.readyState,
          label: t.label 
        }))
      })
      
      // 비디오 트랙이 없으면 오디오만 모드로 전환
      if (!hasVideoTrack && wsConnected) {
        console.log('비디오 트랙이 없어 오디오 전용 모드로 동작합니다')
      }
      
      return
    }

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        console.error('Canvas 2D context를 가져올 수 없습니다')
        return
      }

      // 비디오 준비 상태 확인
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        console.log('비디오가 아직 준비되지 않음:', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        })
        return
      }

      // 캔버스 크기 설정 (최적화: 640x480 최대)
      const maxWidth = 640
      const maxHeight = 480
      const aspectRatio = video.videoWidth / video.videoHeight

      let canvasWidth = video.videoWidth
      let canvasHeight = video.videoHeight

      if (canvasWidth > maxWidth) {
        canvasWidth = maxWidth
        canvasHeight = maxWidth / aspectRatio
      }

      if (canvasHeight > maxHeight) {
        canvasHeight = maxHeight
        canvasWidth = maxHeight * aspectRatio
      }

      canvas.width = canvasWidth
      canvas.height = canvasHeight

      // 비디오 프레임을 캔버스에 그리기
      ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight)

      // Base64로 인코딩 (JPEG 압축으로 용량 최적화)
      const frameData = canvas.toDataURL('image/jpeg', 0.7)

      console.log('프레임 캡처 성공:', {
        canvasSize: `${canvasWidth}x${canvasHeight}`,
        dataSize: `${Math.round(frameData.length / 1024)}KB`,
        timestamp: new Date().toISOString()
      })

      // WebSocket으로 프레임 전송
      if (wsSendFrame) {
        wsSendFrame(frameData)
        console.log('프레임 전송 완료')
      } else {
        console.warn('wsSendFrame 함수가 없습니다.')
      }
    } catch (error) {
      console.error('프레임 캡처 및 전송 오류:', error)
    }
  }, [wsConnected, directMediaStream, wsSendFrame])

  // 직접 스트림을 비디오 요소에 연결
  useEffect(() => {
  if (directMediaStream && videoRef.current) {
      console.log('비디오 요소에 직접 스트림 연결:', {
        streamId: directMediaStream.id,
        videoElement: !!videoRef.current
      })
      
      const videoElement = videoRef.current
      videoElement.srcObject = directMediaStream
      
      // 비디오 로드 및 재생 시도
      videoElement.load()
      
      const attemptPlay = async () => {
        try {
          await videoElement.play()
          console.log('비디오 재생 시작됨')
          setVideoStreamConnected(true)
          setVideoStreamError(null)
        } catch (error) {
          console.warn('비디오 자동재생 실패, 사용자 상호작용 필요:', error)
          setVideoStreamError('비디오 재생을 위해 화면을 클릭해주세요')
        }
      }
      
      // 메타데이터 로드 후 재생 시도
      videoElement.onloadedmetadata = attemptPlay
      
      // 정리 함수
      return () => {
        if (videoElement.srcObject) {
          videoElement.srcObject = null
        }
      }
    } else if (!directMediaStream && videoRef.current) {
      // 스트림이 없으면 연결 해제
      videoRef.current.srcObject = null
      setVideoStreamConnected(false)
    }
  }, [directMediaStream])

  // 프레임 캡처 시작/중지 (직접 스트림 사용)
  useEffect(() => {
    const hasDirectVideoTrack = directMediaStream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live') || false
    
    console.log('🎥 프레임 캡처 조건 확인 (직접 스트림):', {
      sessionRunning: sessionState.isRunning,
      videoStreamConnected,
      hasDirectVideoTrack,
      wsConnected,
      directStreamExists: !!directMediaStream,
      videoTracks: directMediaStream?.getVideoTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        label: t.label
      })) || [],
      interval: !!frameIntervalRef.current,
      directStreamId: directMediaStream?.id
    })
    
    if (sessionState.isRunning && videoStreamConnected && hasDirectVideoTrack && wsConnected) {
      console.log('🎬 프레임 캡처 시작! 5초마다 전송')
      
      // 5초마다 프레임 캡처 및 전송
      frameIntervalRef.current = setInterval(() => {
        console.log('⏰ 인터벌 타이머 - 프레임 캡처 시도')
        captureAndSendFrame()
      }, 5000)
      
      // 첫 번째 프레임 즉시 캡처
      console.log('🚀 첫 번째 프레임 즉시 캡처 시도')
      setTimeout(() => {
        console.log('🎯 첫 번째 프레임 캡처 실행')
        captureAndSendFrame()
      }, 100)
    } else {
      console.log('❌ 프레임 캡처 조건 미충족:', {
        sessionRunning: sessionState.isRunning ? '✅' : '❌',
        videoStreamConnected: videoStreamConnected ? '✅' : '❌',
        hasDirectVideoTrack: hasDirectVideoTrack ? '✅' : '❌',
        wsConnected: wsConnected ? '✅' : '❌'
      })
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
        console.log('🧹 기존 프레임 캡처 인터벌 정리')
      }
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
        console.log('프레임 캡처 인터벌 정리 (cleanup)')
      }
    }
  }, [sessionState.isRunning, videoStreamConnected, directMediaStream, wsConnected, captureAndSendFrame])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      console.log('StudyRoomFocusSession 컴포넌트 정리')
      cleanupDirectMediaStream()
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
    }
  }, [cleanupDirectMediaStream])

  // 집중도 세션 시작 (메모이제이션)
  const handleStartSession = useCallback(async () => {
    console.log('=== 세션 시작 함수 호출됨 ===')
    
    try {
      // ✨ 새로운 단계: 세션 시작 자격 검증
      console.log('0. 세션 시작 자격 검증 중...')
      
      if (!roomPresence.isPresent) {
        alert('세션을 시작하려면 스터디룸에 입장해야 합니다.')
        return
      }

      if (!isCurrentUserOnline) {
        alert('세션을 시작하려면 온라인 상태여야 합니다.')
        return
      }

      // 실시간 참가자 상태 확인
      const eligibilityResult = await roomPresence.checkSessionEligibility()
      
      console.log('🔍 세션 시작 자격 검증 결과:', {
        canStart: eligibilityResult.canStart,
        onlineAndPresent: eligibilityResult.onlineAndPresent,
        totalPresent: eligibilityResult.totalPresent,
        message: eligibilityResult.message,
        isCurrentUserPresent: roomPresence.isPresent,
        isCurrentUserOnline: isCurrentUserOnline
      })
      
      if (!eligibilityResult.canStart) {
        alert(eligibilityResult.message)
        return
      }

      console.log(`✅ 세션 시작 자격 확인 완료: ${eligibilityResult.onlineAndPresent}명의 참가자가 참여 가능`)
      
      console.log('=== 세션 시작 프로세스 시작 ===')
      
      const startTime = Date.now()
      
      // 1. 로컬 세션 시작
      console.log('1. 로컬 세션 시작')
  sessionActions.startSession()
  addParticipant(currentUserId)
      
      // 세션 시작 시간을 부모에 알림
      if (onSessionStart) {
        onSessionStart(startTime)
      }

      // 2. 스터디룸 전용 API를 통해 세션 생성
      console.log('2. 스터디룸 세션 API 호출')
      const response = await fetch('/api/social/study-room-focus-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: roomId,
          goal_min: goalMinutes,
          context_tag: '스터디룸 집중 세션',
          session_type: 'study_room',
          notes: `스터디룸 ${roomId}에서 진행한 집중 세션`
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Session creation failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          requestBody: {
            room_id: roomId,
            goal_min: goalMinutes,
            context_tag: '스터디룸 집중 세션',
            session_type: 'study_room',
            notes: `스터디룸 ${roomId}에서 진행한 집중 세션`
          }
        })
        sessionActions.stopSession()
        return
      }

      const result = await response.json()
      console.log('3. 세션 생성 성공:', result.data.session_id)
  sessionSync.setCurrentSession(result.data.session_id, result.data)
  addParticipant(currentUserId)

      // 3. 미디어 스트림: WebRTC localStream 우선 시도 → 일정 시간 내 미도착 시 직접 캡처 fallback
      window.dispatchEvent(new CustomEvent('studyroom-request-start-video', { detail: { roomId, reason: 'focus-session-start' } }))
      console.log('4. WebRTC localStream 대기 후 fallback 준비')

      const waitForLocalStream = async (timeoutMs = 2000) => {
        const start = performance.now()
        while (performance.now() - start < timeoutMs) {
          if (localStreamRef.current) return true
          await new Promise(r => setTimeout(r, 100))
        }
        return false
      }

      const localStreamRef = { current: localStream }
      // 최신 props 반영 위한 작은 effect 없이 즉시 참조 업데이트
      localStreamRef.current = localStream
      const hasLocal = await waitForLocalStream()

      if (hasLocal && localStreamRef.current) {
        console.log('✅ WebRTC localStream 확보 - 직접 스트림 재사용')
        setDirectMediaStream(localStreamRef.current)
        setShowWebcam(true)
        setVideoStreamConnected(true)
      } else {
        console.log('⚠️ localStream 미도착 - fallback getUserMedia 시도')
        cleanupDirectMediaStream()
        if (microphoneStream.stream) {
          console.log('기존 마이크 스트림 정리')
          await microphoneStream.stopStream()
        }
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (perm.state === 'denied') throw new Error('카메라 권한이 거부되었습니다.')
          const stream = await createDirectMediaStream()
          if (!stream) throw new Error('직접 MediaStream 생성 실패')
          const vt = stream.getVideoTracks()
          if (vt.length === 0) console.warn('비디오 트랙 없음 - 오디오만 진행')
          setShowWebcam(true)
          console.log('✅ fallback 스트림 확보')
        } catch (videoError) {
          console.error('fallback 스트림 생성 실패:', videoError)
          sessionActions.stopSession()
          alert(videoError instanceof Error ? videoError.message : '비디오 스트림 시작 실패')
          return
        }
      }
      
      // 오디오 스트림 시작
      try {
        await microphoneStream.startStream()
        console.log('6. 오디오 스트림 시작 완료:', {
          hasStream: !!microphoneStream.stream,
          audioTracks: microphoneStream.stream?.getAudioTracks().length || 0
        })
        setShowAudioPipeline(true)
      } catch (audioError) {
        console.warn('오디오 스트림 시작 실패 (비디오만으로 진행):', audioError)
      }

      // 7. WebSocket 연결
      console.log('7. WebSocket 연결 조건 확인:', {
        hasAllPermissions: true,
        isCurrentUserOnline,
        hasDirectStream: !!directMediaStream,
        hasMicrophoneStream: !!microphoneStream.stream
      })
      
      if (isCurrentUserOnline && (directMediaStream || microphoneStream.stream)) {
        // 미디어 스트림이 안정화될 때까지 잠시 대기
        console.log('8. 미디어 스트림 안정화 대기 중...')
        
        const waitForMediaStream = () => {
          return new Promise<void>((resolve) => {
            let attempts = 0
            const maxAttempts = 30 // 3초 최대 대기
            
            const checkStream = () => {
              attempts++
              const videoTracks = directMediaStream?.getVideoTracks() || []
              const audioTracks = (directMediaStream?.getAudioTracks() || []).concat(microphoneStream.stream?.getAudioTracks() || [])
              
              const hasActiveVideoTrack = videoTracks.some(track => 
                track.enabled && track.readyState === 'live'
              )
              const hasActiveAudioTrack = audioTracks.some(track => 
                track.enabled && track.readyState === 'live'
              )
              
              console.log(`스트림 안정성 확인 ${attempts}/${maxAttempts}:`, {
                hasActiveVideoTrack,
                hasActiveAudioTrack,
                videoTracksCount: videoTracks.length,
                audioTracksCount: audioTracks.length
              })
              
              if (hasActiveVideoTrack || hasActiveAudioTrack || attempts >= maxAttempts) {
                console.log('스트림 안정화 완료 또는 최대 대기 시간 도달')
                resolve()
              } else {
                setTimeout(checkStream, 100)
              }
            }
            
            checkStream()
          })
        }
        
        await waitForMediaStream()
        
        console.log('9. WebSocket 연결 시작')
        if (wsConnect) {
          wsConnect()
          console.log('WebSocket 연결 요청 완료')
        }
      } else {
        console.warn('WebSocket 연결 조건 미충족')
      }
      
      console.log('세션 시작 프로세스 완료')
      
    } catch (error) {
      console.error('세션 시작 실패:', error)
      sessionActions.stopSession()
      
      let errorMessage = '세션을 시작할 수 없습니다.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      alert(errorMessage)
    }
  }, [
    sessionActions, 
    sessionSync, 
    roomId, 
    goalMinutes, 
    cleanupDirectMediaStream,
    microphoneStream,
    createDirectMediaStream,
    directMediaStream,
    directStreamError,
    directStreamLoading,
    isCurrentUserOnline,
    wsConnect,
    onSessionStart
  ])

  // 마지막으로 브로드캐스트한 스트림 ID 추적 (무한 루프 방지)
  const lastBroadcastStreamIdRef = useRef<string | null>(null)

  // 상위 localStream 참조 최신화용 ref
  const localStreamRef = useRef<MediaStream | null>(localStream)
  useEffect(() => { localStreamRef.current = localStream }, [localStream])

  // WebRTC localStream 등장 시 directMediaStream 재사용 (중복 캡처 방지)
  useEffect(() => {
    if (!sessionState.isRunning) return
    if (!localStream) return
    if (directMediaStream) return // 이미 분석용 스트림 존재
    console.log('🔁 WebRTC localStream 발견 -> adopt')
    setDirectMediaStream(localStream)
    setShowWebcam(true)
    setVideoStreamConnected(true)
    if (localStream.id !== lastBroadcastStreamIdRef.current) {
      window.dispatchEvent(new CustomEvent('studyroom-direct-stream-ready', { detail: { roomId, stream: localStream, streamId: localStream.id, source: 'webrtc-adopt' } }))
      lastBroadcastStreamIdRef.current = localStream.id
    }
  }, [sessionState.isRunning, localStream, directMediaStream, roomId])

  // directMediaStream 생성/변경 시 상위에 공유 (fallback 표시 목적)
  useEffect(() => {
    if (!directMediaStream) return
    if (directMediaStream.id === lastBroadcastStreamIdRef.current) return // 이미 보낸 스트림
    window.dispatchEvent(new CustomEvent('studyroom-direct-stream-updated', { detail: { roomId, stream: directMediaStream, streamId: directMediaStream.id, source: directMediaStream === localStream ? 'webrtc' : 'direct' } }))
    lastBroadcastStreamIdRef.current = directMediaStream.id
  }, [directMediaStream, roomId, localStream])

  // 세션 종료
  const handleStopSession = useCallback(async () => {
    console.log('=== 세션 종료 시작 ===')
    
    try {
      // 1. 로컬 상태 업데이트
      sessionActions.stopSession()
      
      // 2. WebSocket 연결 해제
      if (wsDisconnect) {
        wsDisconnect()
        console.log('WebSocket 연결 해제 완료')
      }
      
      // 3. 미디어 스트림 정리
      cleanupDirectMediaStream()
      if (microphoneStream.stream) {
        await microphoneStream.stopStream()
        console.log('마이크 스트림 정리 완료')
      }
      
      // 4. 스터디룸 전용 세션 종료 API 호출
      const currentSessionId = sessionSync.currentSessionId
      if (currentSessionId) {
        console.log('스터디룸 세션 종료 API 호출:', currentSessionId)
        const response = await fetch(`/api/social/study-room-focus-session?session_id=${currentSessionId}&room_id=${roomId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('스터디룸 세션 종료 API 실패:', errorData)
        } else {
          const result = await response.json()
          console.log('스터디룸 세션 종료 성공:', result)
        }
      }
      
      // 5. UI 상태 리셋
      setShowWebcam(false)
      setShowAudioPipeline(false)
      
      // 6. 세션 완료 콜백 호출
      if (onSessionComplete && sessionState.elapsed > 0) {
        onSessionComplete({
          duration: sessionState.elapsed,
          sessionType: 'study_room'
        })
      }
      
      console.log('세션 종료 완료')
      
    } catch (error) {
      console.error('세션 종료 중 오류:', error)
    }
  }, [
    sessionActions,
    wsDisconnect,
    cleanupDirectMediaStream,
    microphoneStream,
    sessionState.elapsed,
    onSessionComplete,
    sessionSync.currentSessionId,
    roomId
  ])

  return (
    <div className="space-y-6">
      {/* ✨ 새로운 실시간 참가자 상태 표시 */}
      <RoomPresenceIndicator
        totalPresent={roomPresence.presentParticipants.length}
        onlineAndPresent={roomPresence.onlineAndPresentCount}
        canStartSession={roomPresence.canStartSession}
        isCurrentUserPresent={roomPresence.isPresent}
      />

      {/* 세션 컨트롤 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            스터디룸 집중 세션
            <PreferenceAutoCamSwitch />
            {roomPresence.isPresent ? (
              <Badge variant="default" className="text-xs">
                룸 입장 중
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                룸 밖
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 목표 시간 설정 */}
          <div className="flex items-center gap-4">
            <Clock className="w-4 h-4" />
            <span>목표 시간:</span>
            <select 
              value={goalMinutes} 
              onChange={(e) => setGoalMinutes(Number(e.target.value))}
              disabled={sessionState.isRunning}
              className="border rounded px-2 py-1"
            >
              <option value={15}>15분</option>
              <option value={25}>25분</option>
              <option value={30}>30분</option>
              <option value={45}>45분</option>
              <option value={60}>60분</option>
              <option value={90}>90분</option>
            </select>
          </div>

          {/* 세션 상태 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>현재 집중도:</span>
              <Badge variant={sessionState.focusScore >= 70 ? "default" : "destructive"}>
                {sessionState.focusScore}%
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {wsConnected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={wsConnected ? "text-green-600" : "text-red-600"}>
                {wsConnected ? "연결됨" : "연결 안됨"}
              </span>
            </div>
          </div>

          {/* 세션 진행 상황 */}
          {sessionState.isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행 시간: {Math.floor(sessionState.elapsed / 60)}분 {sessionState.elapsed % 60}초</span>
                <span>목표: {goalMinutes}분</span>
              </div>
              <Progress 
                value={(sessionState.elapsed / (goalMinutes * 60)) * 100} 
                className="w-full"
              />
            </div>
          )}

          {/* 컨트롤 버튼 */}
          <div className="flex gap-2">
            {!sessionState.isRunning ? (
              <Button 
                onClick={handleStartSession}
                className="flex items-center gap-2"
                disabled={
                  directStreamLoading || 
                  !roomPresence.isPresent || 
                  !isCurrentUserOnline || 
                  !roomPresence.canStartSession
                }
              >
                <Play className="w-4 h-4" />
                {directStreamLoading ? '준비 중...' : 
                 !roomPresence.isPresent ? '룸에 입장하세요' :
                 !isCurrentUserOnline ? '온라인 상태가 아닙니다' :
                 !roomPresence.canStartSession ? '참가자 대기 중' :
                 '세션 시작'}
              </Button>
            ) : (
              <Button 
                onClick={handleStopSession}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                세션 종료
              </Button>
            )}
          </div>

          {/* 오류 메시지 */}
          {(directStreamError || videoStreamError) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {directStreamError || videoStreamError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

  {/* 별도 세션 전용 그리드 제거: 메인 VideoGrid에서 하이라이트 (StudyRoom 상위에서 전달) */}

      {/* 비디오 및 분석 영역 */}
      {showWebcam && (
        <Card>
          <CardHeader>
            <CardTitle>실시간 분석</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 웹캠 미리보기 */}
              <div className="space-y-2">
                <h3 className="font-medium">웹캠 피드</h3>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video bg-black rounded-lg"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* 분석 결과 */}
              <div className="space-y-2">
                <h3 className="font-medium">집중도 분석</h3>
                <WebcamAnalysisDisplay 
                  analysisResult={null}
                  focusFeatures={null}
                  lastFocusScore={sessionState.focusScore}
                  isConnected={wsConnected}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오디오 분석 */}
      {showAudioPipeline && microphoneStream.stream && (
        <Card>
          <CardHeader>
            <CardTitle>음성 분석</CardTitle>
          </CardHeader>
          <CardContent>
            <HybridAudioPipeline />
          </CardContent>
        </Card>
      )}

      {/* 권한 요청 레이어 */}
      {showCameraPermission && (
        <CameraPermissionLayer
          isVisible={showCameraPermission}
          isLoading={directStreamLoading}
          error={directStreamError}
          isPermissionDenied={cameraPermission === 'denied'}
          isPermissionGranted={cameraPermission === 'granted'}
          onRetry={async () => {
            setCameraPermission('unknown')
            setDirectStreamError(null)
            return true
          }}
          onClose={() => setShowCameraPermission(false)}
          onRequestPermission={async () => {
            const stream = await createDirectMediaStream()
            return !!stream
          }}
          onDismissError={() => setDirectStreamError(null)}
        />
      )}

      {showMicrophonePermission && (
        <MicrophonePermissionLayer
          isVisible={showMicrophonePermission}
          isLoading={microphoneStream.isLoading}
          error={microphoneStream.error}
          isPermissionDenied={microphonePermission === 'denied'}
          isPermissionGranted={microphonePermission === 'granted'}
          onRetry={async () => {
            setMicrophonePermission('unknown')
            return true
          }}
          onClose={() => setShowMicrophonePermission(false)}
          onRequestPermission={async () => {
            return await microphoneStream.requestPermission()
          }}
          onDismissError={() => {
            // 마이크 스트림 에러 처리
          }}
        />
      )}
    </div>
  )
})

// 분리된 자동 캠 스위치 (Zustand 구독 최소화)
const PreferenceAutoCamSwitch = React.memo(function PreferenceAutoCamSwitch() {
  const auto = useUserPreferencesStore(s => s.preferences.autoStartCameraOnSession)
  const setAuto = useUserPreferencesStore.getState().setAutoStartCameraOnSession
  return (
    <div className="ml-auto flex items-center gap-2 text-xs font-normal">
      <span>타인 시작 시 자동 캠</span>
      <Switch checked={auto} onCheckedChange={v => setAuto(v)} />
    </div>
  )
})

export default StudyRoomFocusSession