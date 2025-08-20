'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  onFocusScoreUpdate,
  onSessionStart,
  onSessionComplete
}: StudyRoomFocusSessionProps) {
  // 집중도 세션 상태
  const sessionState = useFocusSessionState()
  const sessionActions = useFocusSessionActions()
  const sessionSync = useFocusSessionSync()

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
      
      if (sessionId && sessionUserId === currentUserId && sessionRoomId === roomId) {
        console.log('StudyRoomFocusSession: 현재 사용자의 세션으로 UI 상태 업데이트')
        
        // 1. Zustand 스토어 상태를 서버 세션과 동기화
        sessionActions.startSession()
        
        // 2. 웹캠 권한 요청 및 스트림 생성 (경쟁 자동 시작용)
        console.log('StudyRoomFocusSession: 경쟁 자동 시작을 위해 웹캠 권한 요청')
        try {
          // 웹캠 스트림 생성 (createDirectMediaStream을 직접 호출하지 않고 권한만 요청)
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } }
          })
          
          if (stream) {
            console.log('StudyRoomFocusSession: 경쟁용 웹캠 스트림 생성 성공')
            setDirectMediaStream(stream)
            setShowWebcam(true) // 웹캠 UI 표시
            setVideoStreamConnected(true) // 비디오 스트림 연결 상태 업데이트
          } else {
            console.warn('StudyRoomFocusSession: 경쟁용 웹캠 스트림 생성 실패')
          }
        } catch (error) {
          console.error('StudyRoomFocusSession: 경쟁용 웹캠 권한 요청 실패:', error)
        }
        
        console.log('StudyRoomFocusSession: 자동 세션 시작 완료, sessionId:', sessionId)
      } else {
        console.log('StudyRoomFocusSession: 세션 조건 불일치 - UI 업데이트 건너뜀')
      }
    }, [currentUserId, roomId, sessionActions])
  })

  // ✨ 경쟁 자동 세션 시작 이벤트 처리 (커스텀 이벤트 - 백업용)
  useEffect(() => {
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
        
        // 추가로 세션 ID 설정이 필요할 수 있음 (별도 액션이 있는지 확인 필요)
        console.log('StudyRoomFocusSession: 자동 세션 시작 완료, sessionId:', sessionId)
      } else {
        console.log('StudyRoomFocusSession: 세션 조건 불일치 - UI 업데이트 건너뜀')
      }
    }

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('focus-session-auto-started', handleAutoSessionStart)
    
    return () => {
      window.removeEventListener('focus-session-auto-started', handleAutoSessionStart)
    }
  }, [currentUserId, roomId, sessionActions])

  // 직접 MediaStream 관리 (useMediaStream 훅 문제 우회)
  const [directMediaStream, setDirectMediaStream] = useState<MediaStream | null>(null)
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

  // 직접 MediaStream 정리 함수
  const cleanupDirectMediaStream = useCallback(() => {
    if (directMediaStream) {
      console.log('직접 MediaStream 정리')
      directMediaStream.getTracks().forEach(track => {
        track.stop()
        console.log(`트랙 정리: ${track.kind} - ${track.label}`)
      })
      setDirectMediaStream(null)
      setVideoStreamConnected(false)
    }
  }, [directMediaStream])

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
      
      // 3. 세션 ID 확인
      if (!sessionSync.currentSessionId) {
        console.warn('세션 ID가 없어서 서버 업데이트 불가')
        return
      }
      
      const timestamp = new Date().toISOString()
      
      // 4. 병렬로 API 호출 (성능 최적화)
      const [studyRoomResult, focusScoreResult] = await Promise.allSettled([
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
      console.log('🎥 웹소켓 연결됨 - 자동으로 카메라 시작')
      
      const startCameraAutomatically = async () => {
        try {
          const stream = await createDirectMediaStream()
          if (stream) {
            console.log('✅ 웹소켓 연결 후 카메라 자동 시작 성공')
            setShowWebcam(true)
            setVideoStreamConnected(true)
          } else {
            console.warn('❌ 웹소켓 연결 후 카메라 자동 시작 실패')
          }
        } catch (error) {
          console.error('❌ 웹소켓 연결 후 카메라 자동 시작 오류:', error)
        }
      }

      startCameraAutomatically()
    }
  }, [wsConnected, sessionState.isRunning, directMediaStream, createDirectMediaStream, competitionState.competition.isActive])

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

      // 3. 미디어 스트림 시작
      console.log('4. 미디어 스트림 시작 시도')
      
      // 기존 스트림 정리
      console.log('3. 기존 스트림 정리...')
      cleanupDirectMediaStream()
      if (microphoneStream.stream) {
        console.log('기존 마이크 스트림 정리')
        await microphoneStream.stopStream()
      }
      
      // 비디오 스트림 직접 생성
      try {
        console.log('=== 직접 비디오 스트림 생성 프로세스 ===')
        
        // 1. 카메라 권한 재확인
        console.log('1. 카메라 권한 재확인 중...')
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })
        console.log('현재 카메라 권한 상태:', cameraPermission.state)
        
        if (cameraPermission.state === 'denied') {
          throw new Error('카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
        }
        
        // 2. 직접 MediaStream 생성
        console.log('2. 직접 MediaStream 생성 시작...')
        const stream = await createDirectMediaStream()
        
        if (!stream) {
          throw new Error('직접 MediaStream 생성에 실패했습니다.')
        }
        
        // 3. 스트림 검증
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()
        
        console.log('3. 스트림 검증 완료:', {
          streamId: stream.id,
          videoTracksCount: videoTracks.length,
          audioTracksCount: audioTracks.length,
          streamActive: stream.active
        })
        
        // 4. 비디오 트랙 상태 검사
        if (videoTracks.length === 0) {
          if (audioTracks.length > 0) {
            console.warn('비디오 트랙이 없지만 오디오 트랙은 있습니다. 오디오만으로 진행합니다.')
          } else {
            throw new Error('비디오와 오디오 트랙 모두 가져올 수 없습니다. 카메라와 마이크 연결을 확인해주세요.')
          }
        } else {
          // 비디오 트랙 상태 상세 확인
          const videoTrack = videoTracks[0]
          console.log('비디오 트랙 상태:', {
            id: videoTrack.id,
            kind: videoTrack.kind,
            label: videoTrack.label,
            enabled: videoTrack.enabled,
            readyState: videoTrack.readyState,
            muted: videoTrack.muted
          })
          
          if (videoTrack.readyState === 'ended') {
            throw new Error('비디오 트랙이 종료된 상태입니다. 카메라 연결을 확인해주세요.')
          }
          
          console.log('비디오 트랙 상태 양호')
        }
        
        setShowWebcam(true)
        console.log('직접 비디오 스트림 생성 프로세스 완료')
        
      } catch (videoError) {
        console.error('직접 비디오 스트림 생성 실패:', videoError)
        console.error('직접 스트림 상태:', {
          hasDirectStream: !!directMediaStream,
          directStreamError,
          directStreamLoading
        })
        
        // 에러 타입에 따른 상세 처리
        let errorMessage = '비디오 스트림을 시작할 수 없습니다.'
        
        if (videoError instanceof Error) {
          if (videoError.message.includes('Permission denied') || videoError.message.includes('권한')) {
            errorMessage = '카메라 권한이 필요합니다. 브라우저에서 카메라 권한을 허용해주세요.'
          } else if (videoError.message.includes('NotFoundError') || videoError.message.includes('카메라')) {
            errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
          } else if (videoError.message.includes('NotReadableError')) {
            errorMessage = '카메라가 다른 애플리케이션에서 사용 중일 수 있습니다.'
          } else {
            errorMessage = videoError.message
          }
        }
        
        console.error('최종 에러 메시지:', errorMessage)
        alert(errorMessage) // 사용자에게 명확한 안내
        
        sessionActions.stopSession()
        return
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

export default StudyRoomFocusSession