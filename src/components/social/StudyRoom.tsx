'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VideoOff, Play, Pause, Square } from 'lucide-react'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useVideoRoom } from '@/hooks/useVideoRoom'
import { useChallenge } from '@/hooks/useChallenge'
import { FocusScoreChart } from './FocusScoreChart'
import { VideoGrid } from './VideoGrid'
import { ChallengeHUD } from './ChallengeHUD'
import { ChallengeResultPanel } from './ChallengeResultPanel'
import { ChallengeInvitationPanel } from './ChallengeInvitationPanel'
import { GroupChallengePanel } from './GroupChallengePanel'
import {
  StudyRoomHeader,
  StudyRoomNotifications,
  StudyRoomCreateForm,
  CompetitionPanel,
  StudyRoomEmpty
} from '../studyroom'
import type { 
  StudyRoom, 
  RoomParticipant, 
  ParticipantWithUser,
  CreateStudyRoomData,
  FocusUpdateMessage,
  RoomJoinMessage,
  EncouragementMessageWS,
  Challenge,
  ChallengeParticipant,
  ChallengeInvitation,
  ChallengeInvitationCreatedPayload,
  ChallengeInvitationResponsePayload,
  ChallengeInvitationExpiredPayload,
  ChallengeStartedPayload,
  ChallengeEndedPayload,
  GroupChallenge,
  GroupChallengeProgress,
  CreateGroupChallengeData,
  GroupChallengeCreatedPayload,
  GroupChallengeProgressUpdatedPayload,
  GroupChallengeCompletedPayload,
  GroupChallengeDeletedPayload
} from '@/types/social'

interface StudyRoomProps {
  room?: StudyRoom
  onClose?: () => void
}



export function StudyRoom({ room, onClose }: StudyRoomProps) {
  const { data: user } = useUser()
  
  // 디버그: 사용자 ID 출력
  useEffect(() => {
    if (user?.id) {
      console.log('현재 사용자 ID:', user.id)
    }
  }, [user?.id])
  
  const leaveRoomMutation = useLeaveStudyRoom()
  const endRoomMutation = useEndStudyRoom()
  const [participants, setParticipants] = useState<ParticipantWithUser[]>([])
  const [currentFocusScore, setCurrentFocusScore] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(!room)
  const [loading, setLoading] = useState(false)
  const [roomForm, setRoomForm] = useState<CreateStudyRoomData>({
    host_id: user?.id || '',
    name: '',
    description: '',
    max_participants: 10,
    session_type: 'study',
    goal_minutes: 60
  })

  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: 'join' | 'leave'}>>([])
  const notificationIdCounter = useRef(0)
  
  // 고유한 알림 ID 생성 함수
  const generateNotificationId = useCallback(() => {
    return `notification-${++notificationIdCounter.current}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 초기 참가자 로드 완료 여부를 추적하는 ref
  const initialLoadDoneRef = useRef<boolean>(false)
  const currentRoomIdRef = useRef<string | undefined>(undefined)
  const lastParticipantCountRef = useRef<number>(0)

  // 집중도 대결 관련 상태 (챌린지 훅으로 대체)
  const [competitionDuration, setCompetitionDuration] = useState<number>(25) // 기본 25분
  const [competitionTimeLeft, setCompetitionTimeLeft] = useState<number>(0)
  const [competitionScores, setCompetitionScores] = useState<{[key: string]: number}>({})
  const [competitionHistory, setCompetitionHistory] = useState<Array<{
    round: number,
    duration: number,
    scores: {[key: string]: number},
    winner: string
  }>>([])
  const [showCompetitionSettings, setShowCompetitionSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'custom'>('pomodoro')
  const [customHours, setCustomHours] = useState<number>(0)
  const [customMinutes, setCustomMinutes] = useState<number>(30)
  const [isBreakTime, setIsBreakTime] = useState(false)
  const [breakDuration, setBreakDuration] = useState<number>(5) // 기본 5분 휴식
  
  // HUD 오버레이 관련 상태
  const [showChallengeHUD, setShowChallengeHUD] = useState(false)
  const [showResultPanel, setShowResultPanel] = useState(false)
  const [finalScores, setFinalScores] = useState<{[key: string]: number}>({})
  const [challengeBadges, setChallengeBadges] = useState<{[key: string]: string[]}>({})

  // 대결 초대 관련 상태
  const [currentInvitation, setCurrentInvitation] = useState<ChallengeInvitation | null>(null)
  const [showInvitationPanel, setShowInvitationPanel] = useState(false)

  // 그룹 챌린지 관련 상태
  const [currentGroupChallenges, setCurrentGroupChallenges] = useState<GroupChallenge[]>([])
  const [groupChallengeProgressMap, setGroupChallengeProgressMap] = useState<Record<string, GroupChallengeProgress>>({})

  // 집중세션 관련 상태
  const [isFocusSessionRunning, setIsFocusSessionRunning] = useState(false)
  const [isFocusSessionPaused, setIsFocusSessionPaused] = useState(false)
  const [focusSessionElapsed, setFocusSessionElapsed] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [focusSessionTimer, setFocusSessionTimer] = useState<NodeJS.Timeout | null>(null)

  // 비디오룸 훅
  const videoRoom = useVideoRoom({
    roomId: room?.room_id || '',
    userId: user?.id || '',
    participants
  })

  // 챌린지 훅
  const challenge = useChallenge({
    roomId: room?.room_id || '',
    userId: user?.id || ''
  })

  // 대결 기록 로드
  const loadCompetitionHistory = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/challenge-history?room_id=${room.room_id}&limit=20`)
      if (response.ok) {
        const data = await response.json()
        const historyData = data.history || []
        
        // 데이터베이스 형식을 로컬 형식으로 변환
        const convertedHistory = historyData.map((item: any, index: number) => ({
          round: historyData.length - index, // 역순으로 라운드 번호 부여
          duration: item.duration,
          scores: item.scores,
          winner: item.winner_id
        }))
        
        setCompetitionHistory(convertedHistory)
        console.log('대결 기록 로드 완료:', convertedHistory.length, '개')
      } else {
        console.error('대결 기록 로드 실패:', response.status)
      }
    } catch (error) {
      console.error('대결 기록 로드 중 오류:', error)
    }
  }, [room?.room_id])

  // 대결 초대 로드
  const loadChallengeInvitation = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/challenge-invitation?room_id=${room.room_id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.invitation) {
          setCurrentInvitation(data.invitation)
          setShowInvitationPanel(true)
          console.log('대결 초대 로드 완료:', data.invitation)
        } else {
          setCurrentInvitation(null)
          setShowInvitationPanel(false)
        }
      } else {
        console.error('대결 초대 로드 실패:', response.status)
      }
    } catch (error) {
      console.error('대결 초대 로드 중 오류:', error)
    }
  }, [room?.room_id])

  // 그룹 챌린지 로드
  const loadGroupChallenge = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/group-challenge?room_id=${room.room_id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.challenges && data.challenges.length > 0) {
          setCurrentGroupChallenges(data.challenges)
          setGroupChallengeProgressMap(data.progressMap || {})
          console.log('그룹 챌린지 로드 완료:', data.challenges)
        } else {
          setCurrentGroupChallenges([])
          setGroupChallengeProgressMap({})
        }
      } else {
        console.error('그룹 챌린지 로드 실패:', response.status)
      }
    } catch (error) {
      console.error('그룹 챌린지 로드 중 오류:', error)
    }
  }, [room?.room_id])

  // 그룹 챌린지 생성
  const createGroupChallenge = useCallback(async (data: CreateGroupChallengeData) => {
    try {
      console.log('그룹 챌린지 생성 요청 데이터:', data)
      console.log('현재 room 객체:', room)
      console.log('room?.room_id:', room?.room_id)
      
      const response = await fetch('/api/social/group-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('그룹 챌린지 생성 완료:', result.challenge)
        
        // 새 챌린지를 기존 목록에 추가
        setCurrentGroupChallenges(prev => [result.challenge, ...prev])
        
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '새로운 그룹 챌린지가 생성되었습니다!',
          type: 'join'
        }])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || '그룹 챌린지 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('그룹 챌린지 생성 실패:', error)
      throw error
    }
  }, [])

  // 그룹 챌린지 참여
  const joinGroupChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch('/api/social/group-challenge/participate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('그룹 챌린지 참여 완료:', result)
        
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '그룹 챌린지에 참여했습니다!',
          type: 'join'
        }])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || '그룹 챌린지 참여에 실패했습니다.')
      }
    } catch (error) {
      console.error('그룹 챌린지 참여 실패:', error)
      throw error
    }
  }, [])

  // 그룹 챌린지 탈퇴
  const leaveGroupChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/group-challenge/participate?challenge_id=${challengeId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        console.log('그룹 챌린지 탈퇴 완료:', result)
        
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '그룹 챌린지에서 탈퇴했습니다.',
          type: 'leave'
        }])
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || '그룹 챌린지 탈퇴에 실패했습니다.')
      }
    } catch (error) {
      console.error('그룹 챌린지 탈퇴 실패:', error)
      throw error
    }
  }, [])

     // 실제 대결 시작 (pending -> active) - 먼저 정의
  const startActualCompetition = useCallback(async (challengeId?: string) => {
    console.log('startActualCompetition 호출됨:', { challengeId, type: typeof challengeId, isHost })
    console.log('challengeId 값:', challengeId)
    console.log('challengeId가 문자열인지 확인:', typeof challengeId === 'string')
    
    let targetChallengeId: string
    if (challengeId && typeof challengeId === 'string') {
      targetChallengeId = challengeId
    } else if (challenge.currentChallenge?.challenge_id) {
      targetChallengeId = String(challenge.currentChallenge.challenge_id)
    } else if (currentInvitation?.challenge_id) {
      targetChallengeId = String(currentInvitation.challenge_id)
    } else {
      targetChallengeId = ''
    }
    
    console.log('targetChallengeId:', { targetChallengeId, type: typeof targetChallengeId })
    console.log('targetChallengeId 값:', targetChallengeId)
    
    if (!targetChallengeId) {
      alert('시작할 챌린지가 없습니다.')
      return
    }
    
    // 호스트 권한 확인 (실제 챌린지 시작 시에만)
    if (!isHost) {
      console.log('호스트가 아닌 사용자, 대결 시작 불가')
      return
    }

    try {
      // 챌린지 시작 (pending -> active)
      console.log('챌린지 시작 시도:', targetChallengeId)
      await challenge.startChallenge(targetChallengeId)
      
      // 뽀모도로 모드일 때는 공부 시간만, 커스텀 모드일 때는 총 시간
      const timeLeft = activeTab === 'pomodoro' 
        ? competitionDuration * 60  // 공부 시간만
        : (customHours * 60 + customMinutes) * 60  // 총 시간
      
      // HUD 오버레이 표시
      console.log('HUD 표시 시작:', { 
        challengeId: targetChallengeId, 
        timeLeft,
        activeTab,
        competitionDuration,
        customHours,
        customMinutes,
        calculatedTimeLeft: activeTab === 'pomodoro' ? competitionDuration * 60 : (customHours * 60 + customMinutes) * 60
      })
      setShowChallengeHUD(true)
      setCompetitionTimeLeft(timeLeft)
      
      // 모든 참가자의 점수를 0으로 초기화
      const initialScores: {[key: string]: number} = {}
      participants.forEach(p => {
        initialScores[p.user_id] = 0
      })
      setCompetitionScores(initialScores)
      
      console.log('대결이 시작되었습니다!')
      
      // 모든 참가자에게 대결 시작을 알림 (Realtime)
      try {
        const supabase = supabaseBrowser()
        supabase
          .channel(`social_room:${room?.room_id}`)
          .send({
            type: 'broadcast',
            event: 'challenge_started',
            payload: {
              challenge_id: targetChallengeId,
              room_id: room?.room_id,
              timestamp: new Date().toISOString()
            }
          })
      } catch (error) {
        console.warn('대결 시작 알림 전송 실패:', error)
      }
    } catch (error) {
      console.error('대결 시작 실패:', error)
      alert('대결 시작에 실패했습니다.')
    }
  }, [challenge.currentChallenge, challenge, activeTab, competitionDuration, customHours, customMinutes, participants, isHost, room?.room_id, currentInvitation])

  // 집중세션 관련 함수들
  const startFocusSession = useCallback(async () => {
    if (!isHost) {
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '호스트만 집중세션을 시작할 수 있습니다.',
        type: 'leave'
      }])
      return
    }

    try {
      console.log('🚀 집중세션 시작')
      
      // 1. 로컬 세션 시작
      setIsFocusSessionRunning(true)
      setIsFocusSessionPaused(false)
      setFocusSessionElapsed(0)
      
      // 2. 데이터베이스에 세션 생성
      const supabase = supabaseBrowser()
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !currentUser) {
        alert('사용자 인증에 실패했습니다. 다시 로그인해주세요.')
        return
      }
      
      const { data: newSession, error: sessionError } = await supabase
        .from('focus_session')
        .insert({
          user_id: currentUser.id,
          started_at: new Date().toISOString(),
          goal_min: 30,
          context_tag: '스터디룸 집중 세션',
          session_type: 'study'
        })
        .select()
        .single()
      
      if (sessionError) {
        console.error('Session creation failed:', sessionError)
        alert(`세션 생성에 실패했습니다: ${sessionError.message}`)
        return
      }
      
      console.log('✅ 데이터베이스 세션 생성 성공:', newSession)
      setCurrentSessionId(newSession.session_id)
      
      // 3. 모든 참가자에게 집중세션 시작 알림 전송 (Realtime)
      try {
        supabase
          .channel(`social_room:${room?.room_id}`)
          .send({
            type: 'broadcast',
            event: 'focus_session_started',
            payload: {
              session_id: newSession.session_id,
              room_id: room?.room_id,
              started_by: currentUser.id,
              timestamp: new Date().toISOString()
            }
          })
        console.log('집중세션 시작 broadcast 이벤트 전송 완료')
      } catch (error) {
        console.warn('집중세션 시작 알림 전송 실패:', error)
      }
      
      // 4. 타이머 시작
      const timer = setInterval(() => {
        setFocusSessionElapsed(prev => prev + 1)
      }, 1000)
      setFocusSessionTimer(timer)
      
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '집중세션이 시작되었습니다!',
        type: 'join'
      }])
      
    } catch (error) {
      console.error('❌ 집중세션 시작 중 오류:', error)
      alert('집중세션 시작 중 오류가 발생했습니다. 다시 시도해주세요.')
      setIsFocusSessionRunning(false)
    }
  }, [isHost, room?.room_id])

  const pauseFocusSession = useCallback(() => {
    if (!isHost) {
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '호스트만 집중세션을 일시정지할 수 있습니다.',
        type: 'leave'
      }])
      return
    }

    setIsFocusSessionPaused(prev => !prev)
    
    if (focusSessionTimer) {
      if (isFocusSessionPaused) {
        // 재개
        const timer = setInterval(() => {
          setFocusSessionElapsed(prev => prev + 1)
        }, 1000)
        setFocusSessionTimer(timer)
      } else {
        // 일시정지
        clearInterval(focusSessionTimer)
        setFocusSessionTimer(null)
      }
    }
    
    setNotifications(prev => [...prev, {
      id: generateNotificationId(),
      message: isFocusSessionPaused ? '집중세션이 재개되었습니다.' : '집중세션이 일시정지되었습니다.',
      type: 'join'
    }])
  }, [isHost, focusSessionTimer, isFocusSessionPaused])

  const stopFocusSession = useCallback(async () => {
    if (!isHost) {
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '호스트만 집중세션을 종료할 수 있습니다.',
        type: 'leave'
      }])
      return
    }

    if (!confirm('정말로 집중세션을 종료하시겠습니까?')) {
      return
    }

    try {
      console.log('🛑 집중세션 종료')
      
      // 1. 타이머 정리
      if (focusSessionTimer) {
        clearInterval(focusSessionTimer)
        setFocusSessionTimer(null)
      }
      
      // 2. 로컬 상태 정리
      setIsFocusSessionRunning(false)
      setIsFocusSessionPaused(false)
      setFocusSessionElapsed(0)
      
      // 3. 데이터베이스에 세션 종료 기록
      if (currentSessionId) {
        const supabase = supabaseBrowser()
        const { error: updateError } = await supabase
          .from('focus_session')
          .update({
            ended_at: new Date().toISOString(),
            duration_min: Math.floor(focusSessionElapsed / 60)
          })
          .eq('session_id', currentSessionId)
        
        if (updateError) {
          console.error('Session update failed:', updateError)
        } else {
          console.log('✅ 세션 종료 기록 완료')
        }
        
        setCurrentSessionId(null)
      }
      
      // 4. 모든 참가자에게 집중세션 종료 알림 전송 (Realtime)
      try {
        const supabase = supabaseBrowser()
        supabase
          .channel(`social_room:${room?.room_id}`)
          .send({
            type: 'broadcast',
            event: 'focus_session_ended',
            payload: {
              room_id: room?.room_id,
              ended_by: user?.id,
              duration_min: Math.floor(focusSessionElapsed / 60),
              timestamp: new Date().toISOString()
            }
          })
        console.log('집중세션 종료 broadcast 이벤트 전송 완료')
      } catch (error) {
        console.warn('집중세션 종료 알림 전송 실패:', error)
      }
      
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '집중세션이 종료되었습니다.',
        type: 'leave'
      }])
      
    } catch (error) {
      console.error('❌ 집중세션 종료 중 오류:', error)
      alert('집중세션 종료 중 오류가 발생했습니다.')
    }
  }, [isHost, focusSessionTimer, currentSessionId, focusSessionElapsed, room?.room_id, user?.id])

  // 시간 포맷팅 함수
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 대결 초대 응답 처리
  const handleInvitationResponse = useCallback(async (response: 'accepted' | 'rejected') => {
    if (!currentInvitation) return
    
    // 이미 응답했는지 확인 (로컬 상태 + 응답 처리 중 상태)
    const currentUserResponse = currentInvitation.responses[user?.id || '']
    if (currentUserResponse && currentUserResponse !== 'pending') {
      console.log('이미 응답함:', currentUserResponse)
      // 사용자에게 친화적인 알림 표시
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '이미 이 대결 초대에 응답했습니다.',
        type: 'join'
      }])
      return
    }
    
    // 응답 처리 중 상태 설정 (중복 클릭 방지)
    const responseKey = `${currentInvitation.invitation_id}-${user?.id}`
    if (window.sessionStorage.getItem(responseKey)) {
      console.log('응답 처리 중입니다. 잠시만 기다려주세요.')
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '응답 처리 중입니다. 잠시만 기다려주세요.',
        type: 'join'
      }])
      return
    }
    
    // 응답 처리 중 표시
    window.sessionStorage.setItem(responseKey, 'processing')
    
    // 로컬 상태를 즉시 업데이트하여 중복 클릭 방지
    setCurrentInvitation(prev => prev ? {
      ...prev,
      responses: {
        ...prev.responses,
        [user?.id || '']: response
      }
    } : null)
    
    try {
      const responseData = await fetch('/api/social/challenge-invitation/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_id: currentInvitation.invitation_id,
          response
        })
      })

      if (responseData.ok) {
        const result = await responseData.json()
        console.log('대결 초대 응답 완료:', result)
        
                 // 응답 처리 완료 표시
         window.sessionStorage.removeItem(responseKey)
         
         // 초대 상태 업데이트 (서버 응답의 responses를 사용)
         const updatedInvitation = {
           ...currentInvitation,
           responses: result.responses || currentInvitation.responses,
           status: result.status || currentInvitation.status
         }
         setCurrentInvitation(updatedInvitation)
         
         // 응답 완료 알림
         const responseText = response === 'accepted' ? '동의' : '거부'
         setNotifications(prev => [...prev, {
           id: generateNotificationId(),
           message: `대결 초대에 ${responseText}했습니다.`,
           type: 'join'
         }])
        
        // 모든 참가자가 동의했는지 확인 (서버 응답의 responses 사용)
        const allAccepted = Object.values(updatedInvitation.responses).every(response => response === 'accepted')
        const totalParticipants = participants.length
        const respondedCount = Object.keys(updatedInvitation.responses).length
        
        console.log('응답 완료 후 상태:', {
          allAccepted,
          totalParticipants,
          respondedCount,
          responses: updatedInvitation.responses
        })
        
        if (allAccepted && respondedCount === totalParticipants) {
          // 모든 참가자가 동의했으면 호스트가 대결을 시작할 수 있음
          console.log('모든 참가자가 동의함')
          if (isHost) {
            // 호스트인 경우 대결 시작
            console.log('호스트가 대결 시작')
            setShowInvitationPanel(false)  // 호스트인 경우 초대 패널 숨김
            await startActualCompetition(currentInvitation.challenge_id)
          } else {
            // 호스트가 아닌 경우 초대 패널은 유지하고 호스트가 시작할 때까지 대기
            console.log('호스트가 아닌 사용자, 호스트의 대결 시작 대기')
            setNotifications(prev => [...prev, {
              id: generateNotificationId(),
              message: '모든 참가자가 동의했습니다. 호스트가 대결을 시작할 예정입니다.',
              type: 'join'
            }])
          }
        } else {
          // 아직 모든 참가자가 응답하지 않거나 모두 동의하지 않음
          const pendingCount = totalParticipants - respondedCount
          const acceptedCount = Object.values(updatedInvitation.responses).filter(r => r === 'accepted').length
          const rejectedCount = Object.values(updatedInvitation.responses).filter(r => r === 'rejected').length
          
          console.log('응답 현황:', { pendingCount, acceptedCount, rejectedCount, totalParticipants })
          
          if (rejectedCount > 0) {
            setNotifications(prev => [...prev, {
              id: generateNotificationId(),
              message: '누군가 대결 초대를 거부했습니다.',
              type: 'leave'
            }])
          } else if (pendingCount > 0) {
            setNotifications(prev => [...prev, {
              id: generateNotificationId(),
              message: `아직 ${pendingCount}명의 참가자가 응답하지 않았습니다.`,
              type: 'join'
            }])
          }
        }
      } else {
        const errorData = await responseData.json()
        console.error('대결 초대 응답 실패:', responseData.status, errorData)
        
        // 409 에러 (이미 응답함)인 경우 로컬 상태만 업데이트
        if (responseData.status === 409) {
          console.log('이미 응답한 초대, 로컬 상태만 업데이트')
          const updatedInvitation = {
            ...currentInvitation,
            responses: {
              ...currentInvitation.responses,
              [user?.id || '']: response
            }
          }
          setCurrentInvitation(updatedInvitation)
          
          // 사용자에게 친화적인 알림 표시
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: '이미 이 대결 초대에 응답했습니다.',
            type: 'join'
          }])
        } else {
          // 다른 에러의 경우 상세 정보와 함께 표시
          const errorMessage = errorData.error || errorData.details || '알 수 없는 오류'
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: `대결 초대 응답 실패: ${errorMessage}`,
            type: 'leave'
          }])
        }
      }
    } catch (error) {
      console.error('대결 초대 응답 중 오류:', error)
      // 에러 발생 시에도 응답 처리 중 상태 해제
      window.sessionStorage.removeItem(responseKey)
      
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '대결 초대 응답 중 오류가 발생했습니다.',
        type: 'leave'
      }])
    }
  }, [currentInvitation, participants, user?.id, startActualCompetition, isHost])

  // 대결 초대 만료 처리
  const handleInvitationExpire = useCallback(() => {
    console.log('대결 초대 만료')
    setShowInvitationPanel(false)
    setCurrentInvitation(null)
    
    // Realtime으로 만료 알림 전송
    if (currentInvitation) {
      try {
        const supabase = supabaseBrowser()
        supabase
          .channel('challenge_invitations')
          .send({
            type: 'broadcast',
            event: 'challenge_invitation_expired',
            payload: {
              invitation_id: currentInvitation.invitation_id,
              room_id: currentInvitation.room_id,
              timestamp: new Date().toISOString()
            }
          })
      } catch (error) {
        console.warn('만료 알림 전송 실패:', error)
      }
    }
  }, [currentInvitation])

  // 대결 초대 자동 정리 (호스트만 사용 가능)
  const cleanupExpiredInvitations = useCallback(async () => {
    if (!room?.room_id || !isHost) return
    
    try {
      const response = await fetch('/api/social/challenge-invitation/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room.room_id })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('만료된 대결 초대 정리 완료:', result)
        
        // 만료된 초대가 정리되었으면 로컬 상태도 업데이트
        if (result.cleaned_count > 0) {
          setCurrentInvitation(null)
          setShowInvitationPanel(false)
          
          // 알림 추가
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: '만료된 대결 초대가 정리되었습니다.',
            type: 'join'
          }])
        }
      } else {
        console.error('대결 초대 정리 실패:', response.status)
      }
    } catch (error) {
      console.error('대결 초대 정리 중 오류:', error)
    }
  }, [room?.room_id, isHost])

  // 참가자 목록 로드
  const loadParticipants = useCallback(async (isInitialLoad = false) => {
    if (!room?.room_id) return
    
    try {
      if (isInitialLoad) {
        setLoading(true)
        console.log('참가자 목록 초기 로딩 시작')
      } else {
        console.log('참가자 목록 업데이트 시작')
      }
      
      console.log('참가자 목록 로드 시작:', room.room_id, '초기 로딩:', isInitialLoad)
      
      const response = await fetch(`/api/social/study-room/${room.room_id}/participants`)
      console.log('참가자 API 응답 상태:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('참가자 목록 데이터:', data)
        const newParticipants = data.participants || []
        setParticipants(newParticipants)
        
        // 참가자 수 업데이트
        lastParticipantCountRef.current = newParticipants.length
        
        if (isInitialLoad) {
          console.log('참가자 목록 초기 로딩 완료, 참가자 수:', newParticipants.length)
        } else {
          console.log('참가자 목록 업데이트 완료, 참가자 수:', newParticipants.length)
        }
      } else {
        const errorData = await response.json()
        console.error('참가자 API 에러:', errorData)
        // 에러가 발생해도 로딩 상태는 해제하고 빈 배열로 설정
        setParticipants([])
        if (isInitialLoad) {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('참가자 목록 로드 실패:', error)
      // 에러가 발생해도 로딩 상태는 해제
      if (isInitialLoad) {
        setLoading(false)
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false)
        console.log('참가자 목록 로딩 상태 해제')
      }
    }
  }, [room?.room_id])

  const handleLeaveRoom = useCallback(async () => {
    try {
      // 나가기 시에는 로딩 상태를 변경하지 않음 (사용자 경험 개선)
      await leaveRoomMutation.mutateAsync({ roomId: room?.room_id! })

      // 나가기 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 나가기 실패:', error)
      alert('스터디룸 나가기에 실패했습니다.')
    }
  }, [room?.room_id, onClose, leaveRoomMutation])

  const handleEndRoom = useCallback(async () => {
    // 호스트가 아닌 경우 에러 알림 표시
    if (!isHost) {
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '호스트만 스터디룸을 종료할 수 있습니다.',
        type: 'leave'
      }])
      return
    }

    if (!confirm('정말로 스터디룸을 종료하시겠습니까? 모든 참가자가 퇴장됩니다.')) {
      return
    }

    try {
      // 세션 종료 시에는 로딩 상태를 변경하지 않음 (사용자 경험 개선)
      await endRoomMutation.mutateAsync({ roomId: room?.room_id! })
      
      alert('스터디룸이 성공적으로 종료되었습니다.')
      
      // 종료 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 종료 실패:', error)
      alert('스터디룸 종료에 실패했습니다.')
    }
  }, [room?.room_id, onClose, endRoomMutation, isHost])

  // Supabase Realtime 메시지 핸들러들
  const handleRoomJoin = useCallback((data: RoomJoinMessage['data']) => {
    // 새 참가자 입장 로직
    console.log('새 참가자 입장 감지 (Supabase Realtime):', data.user_name)
    
    // Supabase Realtime을 통해 실시간으로 참가자 목록 업데이트
    // API 호출 없이 즉시 참가자 목록에 추가
    setParticipants(prev => {
      const newParticipant: ParticipantWithUser = {
        participant_id: `${data.room_id}-${data.user_id}`,
        user_id: data.user_id,
        room_id: data.room_id,
        joined_at: data.timestamp,
        left_at: undefined,
        current_focus_score: 0,
        is_host: false,
        is_connected: true,
        last_activity: data.timestamp,
        user: {
          name: data.user_name,
          avatar_url: data.avatar_url
        }
      }
      
      // 이미 존재하는 참가자인지 확인
      const exists = prev.some(p => p.user_id === data.user_id)
      if (exists) {
        console.log('이미 존재하는 참가자:', data.user_name)
        return prev
      }
      
      console.log('참가자 목록에 추가:', data.user_name)
      return [...prev, newParticipant]
    })
    
    // 알림 추가
    setNotifications(prev => [...prev, {
      id: generateNotificationId(),
      message: `${data.user_name}님이 입장했습니다!`,
      type: 'join'
    }])
  }, [])

  const handleRoomLeave = useCallback((data: { user_id: string }) => {
    // 참가자 퇴장 로직
    console.log('참가자 퇴장 감지 (Supabase Realtime):', data.user_id)
    
    // Supabase Realtime을 통해 실시간으로 참가자 목록에서 제거
    setParticipants(prev => {
      const leavingParticipant = prev.find(p => p.user_id === data.user_id)
      if (leavingParticipant) {
        console.log('참가자 목록에서 제거:', leavingParticipant.user.name)
        
        // 알림 추가
        setNotifications(notifications => [...notifications, {
          id: generateNotificationId(),
          message: `${leavingParticipant.user.name}님이 퇴장했습니다.`,
          type: 'leave'
        }])
        
        // 참가자 목록에서 제거
        return prev.filter(p => p.user_id !== data.user_id)
      }
      return prev
    })
  }, [])

  const handleEncouragement = useCallback((data: EncouragementMessageWS['data']) => {
    // 격려 메시지 표시 - 기능 제거됨
    console.log('격려 메시지 수신 (기능 비활성화):', data)
  }, [])

  // 대결 초대 Realtime 이벤트 핸들러들
  const handleChallengeInvitationCreated = useCallback((data: ChallengeInvitationCreatedPayload) => {
    console.log('대결 초대 생성 감지:', data)
    
    // 현재 룸의 초대인지 확인
    if (data.room_id === room?.room_id) {
      // 초대 상태 설정
      const invitation: ChallengeInvitation = {
        invitation_id: data.invitation_id,
        room_id: data.room_id,
        challenge_id: data.challenge_id,
        proposed_by: data.proposed_by,
        mode: data.mode,
        config: data.config,
        status: 'pending',
        responses: {},
        created_at: data.created_at,
        expires_at: data.expires_at
      }
      
      setCurrentInvitation(invitation)
      setShowInvitationPanel(true)
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '새로운 집중도 대결 초대가 도착했습니다!',
        type: 'join'
      }])
    }
  }, [room?.room_id])

  const handleChallengeInvitationResponse = useCallback((data: ChallengeInvitationResponsePayload) => {
    console.log('🚀 handleChallengeInvitationResponse 함수 호출됨!')
    console.log('📨 받은 데이터:', data)
    console.log('대결 초대 응답 감지:', data)
    
    // 현재 초대의 응답인지 확인
    if (currentInvitation && data.invitation_id === currentInvitation.invitation_id) {
      console.log('✅ 현재 초대와 일치하는 응답입니다')
      console.log('현재 초대 응답 업데이트:', {
        oldResponses: currentInvitation.responses,
        newResponses: data.responses,
        oldStatus: currentInvitation.status,
        newStatus: data.status
      })
      
             // 초대 상태 업데이트 (서버 응답의 responses를 사용)
       setCurrentInvitation(prev => prev ? {
         ...prev,
         responses: data.responses,
         status: data.status
       } : null)
       
       // 응답 상태 변경 알림 (다른 사용자의 응답인 경우)
       if (data.user_id !== user?.id) {
         const respondingUser = participants.find(p => p.user_id === data.user_id)
         if (respondingUser) {
           const responseText = data.response === 'accepted' ? '동의' : '거부'
           setNotifications(prev => [...prev, {
             id: generateNotificationId(),
             message: `${respondingUser.user.name}님이 대결 초대에 ${responseText}했습니다.`,
             type: 'join'
           }])
         }
       }
      
             // 응답 처리 중 상태 해제 (실시간 이벤트로 응답 완료 확인)
       if (data.user_id === user?.id) {
         const responseKey = `${data.invitation_id}-${data.user_id}`
         window.sessionStorage.removeItem(responseKey)
         console.log('응답 처리 중 상태 해제됨:', responseKey)
       }
      
      // 모든 참가자가 동의했는지 확인 (서버 응답의 responses 사용)
      if (data.status === 'accepted') {
        console.log('대결 초대 응답 상태: accepted')
        console.log('서버 응답의 responses:', data.responses)
        console.log('참가자 수:', participants.length)
        console.log('응답한 사용자 수:', Object.keys(data.responses).length)
        console.log('참가자 ID 목록:', participants.map(p => p.user_id))
        console.log('응답한 사용자 ID 목록:', Object.keys(data.responses))
        
        // 모든 참가자가 동의했는지 확인 (서버 응답의 responses 사용)
        const allAccepted = Object.values(data.responses).every(response => response === 'accepted')
        const totalParticipants = participants.length
        const respondedCount = Object.keys(data.responses).length
        
        console.log('모든 응답이 accepted인지:', allAccepted)
        console.log('모든 참가자가 응답했는지:', respondedCount === totalParticipants)
        console.log('응답 현황 상세:', {
          responses: data.responses,
          allAccepted,
          totalParticipants,
          respondedCount,
          participantIds: participants.map(p => p.user_id),
          responseUserIds: Object.keys(data.responses)
        })
        
        // 모든 참가자가 응답했고 모두 동의한 경우에만 대결 시작
        if (allAccepted && respondedCount === totalParticipants) {
          console.log('🎉 모든 참가자가 동의함 - 대결 자동 시작!')
          console.log('현재 챌린지 상태:', challenge.currentChallenge)
          console.log('현재 초대 상태:', currentInvitation)
          
          // 호스트인 경우에만 대결 시작
          if (isHost) {
            // 현재 활성화된 챌린지가 있는지 확인
            if (challenge.currentChallenge) {
              console.log('🚀 자동으로 대결 시작 - currentChallenge 사용')
              setShowInvitationPanel(false)  // 모든 참가자가 동의했을 때 초대 패널 숨김
              startActualCompetition(challenge.currentChallenge.challenge_id)
            } else if (currentInvitation?.challenge_id) {
              console.log('🚀 초대에서 챌린지 ID 가져와서 대결 시작')
              setShowInvitationPanel(false)  // 모든 참가자가 동의했을 때 초대 패널 숨김
              startActualCompetition(currentInvitation.challenge_id)
            } else {
              console.log('❌ 활성화된 챌린지가 없음')
              console.log('challenge.currentChallenge:', challenge.currentChallenge)
              console.log('currentInvitation:', currentInvitation)
            }
          } else {
            console.log('⏳ 호스트가 아니므로 대결 시작 불가')
            // 호스트가 아닌 경우에도 모든 참가자가 동의했으면 초대 패널 숨김
            setShowInvitationPanel(false)
          }
          
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: '모든 참가자가 동의했습니다. 대결이 시작됩니다!',
            type: 'join'
          }])
        } else {
          // 아직 모든 참가자가 응답하지 않거나 모두 동의하지 않음
          const pendingCount = totalParticipants - respondedCount
          const acceptedCount = Object.values(data.responses).filter(r => r === 'accepted').length
          const rejectedCount = Object.values(data.responses).filter(r => r === 'rejected').length
          
          console.log('📊 응답 현황:', { pendingCount, acceptedCount, rejectedCount, totalParticipants })
          console.log('⏳ 아직 응답하지 않은 참가자:', participants.filter(p => !data.responses[p.user_id]))
          
          if (rejectedCount > 0) {
            // 누군가 거부한 경우
            setNotifications(prev => [...prev, {
              id: Date.now().toString(),
              message: '누군가 대결 초대를 거부했습니다.',
              type: 'leave'
            }])
          } else if (pendingCount > 0) {
            // 아직 응답하지 않은 참가자가 있는 경우
            setNotifications(prev => [...prev, {
              id: generateNotificationId(),
              message: `아직 ${pendingCount}명의 참가자가 응답하지 않았습니다.`,
              type: 'join'
            }])
          } else {
            // 모든 참가자가 응답했지만 모두 동의하지 않은 경우
            setNotifications(prev => [...prev, {
              id: generateNotificationId(),
              message: '모든 참가자가 응답했지만 모두 동의하지 않았습니다.',
              type: 'leave'
            }])
          }
        }
      } else if (data.status === 'rejected') {
        console.log('대결 초대 거부됨')
        setShowInvitationPanel(false)
        setCurrentInvitation(null)
        
        // 알림 추가
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '대결 초대가 거부되었습니다.',
          type: 'leave'
        }])
      } else {
        // 아직 응답 대기 중인 경우
        console.log('대결 초대 응답 업데이트:', data.responses)
        
        // 응답 상태가 변경되었음을 사용자에게 알림
        const respondingUser = participants.find(p => p.user_id === data.user_id)
        if (respondingUser) {
          const responseText = data.response === 'accepted' ? '동의' : '거부'
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: `${respondingUser.user.name}님이 대결 초대에 ${responseText}했습니다.`,
            type: 'join'
          }])
        }
      }
    } else {
      console.log('다른 초대의 응답이거나 초대가 없음:', {
        currentInvitationId: currentInvitation?.invitation_id,
        responseInvitationId: data.invitation_id
      })
    }
  }, [currentInvitation, startActualCompetition, participants, user?.id, isHost, challenge.currentChallenge])

    const handleChallengeInvitationExpired = useCallback((data: ChallengeInvitationExpiredPayload) => {
    console.log('대결 초대 만료 감지:', data)
    
    // 현재 룸의 초대인지 확인
    if (data.room_id === room?.room_id && currentInvitation) {
      setShowInvitationPanel(false)
      setCurrentInvitation(null)
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '대결 초대가 만료되었습니다.',
        type: 'leave'
      }])
    }
  }, [room?.room_id, currentInvitation])

  // 대결 시작 이벤트 핸들러
  const handleChallengeStarted = useCallback((data: ChallengeStartedPayload) => {
    console.log('대결 시작 감지:', data)
    
    // 현재 룸의 대결인지 확인
    if (data.room_id === room?.room_id) {
      // 모든 참가자가 동시에 대결 시작
      console.log('모든 참가자가 대결 시작')
      setShowInvitationPanel(false)
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '대결이 시작되었습니다!',
        type: 'join'
      }])
      
      // 호스트가 아닌 경우에도 대결 시작 (동기화)
      if (!isHost) {
        // 호스트가 아닌 사용자는 대결 상태만 동기화
        console.log('호스트가 아닌 사용자, 대결 상태 동기화')
        // HUD 오버레이 표시
        setShowChallengeHUD(true)
        
        // 뽀모도로 모드일 때는 공부 시간만, 커스텀 모드일 때는 총 시간
        const timeLeft = activeTab === 'pomodoro' 
          ? competitionDuration * 60  // 공부 시간만
          : (customHours * 60 + customMinutes) * 60  // 총 시간
        
        setCompetitionTimeLeft(timeLeft)
        
        // 모든 참가자의 점수를 0으로 초기화
        const initialScores: {[key: string]: number} = {}
        participants.forEach(p => {
          initialScores[p.user_id] = 0
        })
        setCompetitionScores(initialScores)
      }
    }
  }, [room?.room_id, isHost, activeTab, competitionDuration, customHours, customMinutes, participants])

  // 대결 종료 이벤트 핸들러
  const handleChallengeEnded = useCallback((data: ChallengeEndedPayload) => {
    console.log('대결 종료 감지:', data)
    
    // 현재 룸의 대결인지 확인
    if (data.room_id === room?.room_id) {
      // 모든 참가자가 동시에 대결 종료
      console.log('모든 참가자가 대결 종료')
      
      // HUD 오버레이 숨기기
      setShowChallengeHUD(false)
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '대결이 종료되었습니다!',
        type: 'leave'
      }])
      
      // 결과 패널 표시를 위해 직접 결과 계산 및 표시
      if (challenge.currentChallenge) {
        // 최종 점수 계산 및 순위 결정
        const finalScores = Object.entries(competitionScores)
          .map(([userId, score]) => ({ userId, score }))
          .sort((a, b) => b.score - a.score)

        const winner = finalScores[0]?.userId || ''
        const winnerName = participants.find(p => p.user_id === winner)?.user.name || 'Unknown'

        // 결과 패널 표시
        setFinalScores(competitionScores)
        
        // 배지 생성 (간단한 예시)
        const badges: {[key: string]: string[]} = {}
        Object.entries(competitionScores).forEach(([userId, score]) => {
          const userBadges = []
          if (score > 1000) userBadges.push('집중의 달인')
          if (score > 500) userBadges.push('성실한 학습자')
          if (score > 100) userBadges.push('첫걸음')
          badges[userId] = userBadges
        })
        setChallengeBadges(badges)
        
        console.log('결과 패널 표시:', { finalScores, badges })
        setShowResultPanel(true)
        
        // 기존 상태 정리
        setCompetitionTimeLeft(0)
        setCompetitionScores({})
      }
    }
  }, [room?.room_id, challenge.currentChallenge, competitionScores, participants])


    
    const handleChallengeInvitationCleaned = useCallback((data: { room_id: string, cleaned_count: number }) => {
     console.log('대결 초대 정리 감지:', data)
     
     // 현재 룸의 정리인지 확인
     if (data.room_id === room?.room_id && data.cleaned_count > 0) {
       setCurrentInvitation(null)
       setShowInvitationPanel(false)
       
       // 알림 추가
       setNotifications(prev => [...prev, {
         id: generateNotificationId(),
         message: '만료된 대결 초대가 정리되었습니다.',
         type: 'join'
       }])
     }
   }, [room?.room_id])

  // 집중세션 관련 Realtime 이벤트 핸들러들
  const handleFocusSessionStarted = useCallback((data: { session_id: string, room_id: string, started_by: string }) => {
    console.log('집중세션 시작 감지:', data)
    
    // 현재 룸의 세션인지 확인
    if (data.room_id === room?.room_id) {
      // 모든 참가자가 동시에 집중세션 시작
      console.log('모든 참가자가 집중세션 시작')
      
      // 호스트가 아닌 경우에도 집중세션 시작 (동기화)
      if (!isHost) {
        setIsFocusSessionRunning(true)
        setIsFocusSessionPaused(false)
        setFocusSessionElapsed(0)
        
        // 타이머 시작
        const timer = setInterval(() => {
          setFocusSessionElapsed(prev => prev + 1)
        }, 1000)
        setFocusSessionTimer(timer)
      }
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '집중세션이 시작되었습니다!',
        type: 'join'
      }])
    }
  }, [room?.room_id, isHost])

  const handleFocusSessionEnded = useCallback((data: { room_id: string, ended_by: string, duration_min: number }) => {
    console.log('집중세션 종료 감지:', data)
    
    // 현재 룸의 세션인지 확인
    if (data.room_id === room?.room_id) {
      // 모든 참가자가 동시에 집중세션 종료
      console.log('모든 참가자가 집중세션 종료')
      
      // 타이머 정리
      if (focusSessionTimer) {
        clearInterval(focusSessionTimer)
        setFocusSessionTimer(null)
      }
      
      // 로컬 상태 정리
      setIsFocusSessionRunning(false)
      setIsFocusSessionPaused(false)
      setFocusSessionElapsed(0)
      setCurrentSessionId(null)
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '집중세션이 종료되었습니다.',
        type: 'leave'
      }])
    }
  }, [room?.room_id, focusSessionTimer])

  // 그룹 챌린지 Realtime 이벤트 핸들러들
  const handleGroupChallengeCreated = useCallback((data: GroupChallengeCreatedPayload) => {
    console.log('그룹 챌린지 생성 감지:', data)
    
    // 현재 룸의 챌린지인지 확인
    if (data.room_id === room?.room_id) {
      // 그룹 챌린지 정보 로드
      loadGroupChallenge()
      
      // 알림 추가
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '새로운 그룹 챌린지가 생성되었습니다!',
        type: 'join'
      }])
    }
  }, [room?.room_id, loadGroupChallenge])

  const handleGroupChallengeProgressUpdated = useCallback((data: GroupChallengeProgressUpdatedPayload) => {
    console.log('그룹 챌린지 진행률 업데이트 감지:', data)
    
    // 현재 룸의 챌린지인지 확인
    if (data.room_id === room?.room_id) {
      // 진행률 업데이트
      setGroupChallengeProgressMap(prev => {
        const currentProgress = prev[data.challenge_id]
        if (currentProgress) {
          return {
            ...prev,
            [data.challenge_id]: {
              ...currentProgress,
              total_contribution: data.current_value,
              completion_percentage: data.completion_percentage
            }
          }
        }
        return prev
      })
      
      // 챌린지 완료 체크
      if (data.completion_percentage >= 100) {
        setCurrentGroupChallenges(prev => prev.map(challenge => 
          challenge.challenge_id === data.challenge_id 
            ? { ...challenge, is_completed: true }
            : challenge
        ))
        
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '🎉 그룹 챌린지가 완료되었습니다!',
          type: 'join'
        }])
      }
    }
  }, [room?.room_id])

  const handleGroupChallengeCompleted = useCallback((data: GroupChallengeCompletedPayload) => {
    console.log('그룹 챌린지 완료 감지:', data)
    if (data.room_id === room?.room_id) {
      setCurrentGroupChallenges(prev => prev.map(challenge =>
        challenge.challenge_id === data.challenge_id
          ? { ...challenge, is_completed: true }
          : challenge
      ))
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '🎉 그룹 챌린지가 완료되었습니다!',
        type: 'join'
      }])
    }
  }, [room?.room_id])

  const handleGroupChallengeDeleted = useCallback((data: GroupChallengeDeletedPayload) => {
    console.log('그룹 챌린지 삭제 감지:', data)
    if (data.room_id === room?.room_id) {
      setCurrentGroupChallenges(prev => prev.filter(challenge => 
        challenge.challenge_id !== data.challenge_id
      ))
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: `🗑️ "${data.title}" 챌린지가 삭제되었습니다.`,
        type: 'leave'
      }])
    }
  }, [room?.room_id])

  // 로그 제한을 위한 ref (필요한 경우에만 사용)
  const lastLogTimeRef = useRef<number>(0)

  // 집중도 점수 업데이트 (대결 중일 때, 휴식 시간에는 점수 계산 안함)
  const updateCompetitionScore = useCallback((userId: string, focusScore: number) => {
    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    
    if (!isCompetitionActive) {
      return
    }
    
    if (isBreakTime) {
      return
    }

    // 점수 계산: 집중도 × 1 (1:1 비율로 점수 계산)
    const scoreIncrement = Math.round(focusScore)
    
    setCompetitionScores(prev => {
      const newScores = {
        ...prev,
        [userId]: (prev[userId] || 0) + scoreIncrement
      }
      return newScores
    })
  }, [challenge.currentChallenge?.state, isBreakTime, competitionScores])

  // 집중도 업데이트 시 대결 점수도 업데이트 (Realtime 대신 폴링 사용)
  const handleFocusUpdate = useCallback((data: FocusUpdateMessage['data']) => {
    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    
    // 다른 참가자의 집중도 업데이트
    setParticipants(prev => prev.map(p => 
      p.user_id === data.user_id 
        ? { ...p, current_focus_score: data.focus_score }
        : p
    ))

    // 대결 중이면 점수 업데이트
    if (isCompetitionActive) {
      updateCompetitionScore(data.user_id, data.focus_score)
    }
  }, [challenge.currentChallenge?.state, isBreakTime, updateCompetitionScore, competitionScores])

     // 폴링으로 참가자 집중도 업데이트 (Realtime 대체)
   useEffect(() => {
     const isCompetitionActive = challenge.currentChallenge?.state === 'active'
     if (!room?.room_id || !isCompetitionActive) return
 
     const pollInterval = setInterval(async () => {
       try {
         // 모든 참가자의 집중도 조회
         for (const participant of participants) {
           const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score?user_id=${participant.user_id}`)
           if (response.ok) {
             const data = await response.json()
             
             // 집중도 업데이트 처리
             handleFocusUpdate({
               user_id: data.user_id,
               room_id: room.room_id,
               focus_score: data.focus_score,
               timestamp: data.last_activity
             })
           }
         }
       } catch (error) {
         console.error('폴링 중 오류:', error)
       }
     }, 10000) // 10초마다 폴링
 
     return () => clearInterval(pollInterval)
   }, [room?.room_id, challenge.currentChallenge?.state, participants, handleFocusUpdate])

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
       onEncouragement: handleEncouragement,
       onChallengeInvitationCreated: handleChallengeInvitationCreated,
       onChallengeInvitationResponse: handleChallengeInvitationResponse,
       onChallengeInvitationExpired: handleChallengeInvitationExpired,
       onChallengeStarted: handleChallengeStarted,
       onChallengeEnded: handleChallengeEnded,
       onFocusSessionStarted: handleFocusSessionStarted,
       onFocusSessionEnded: handleFocusSessionEnded,
       onGroupChallengeCreated: handleGroupChallengeCreated,
       onGroupChallengeProgressUpdated: handleGroupChallengeProgressUpdated,
       onGroupChallengeCompleted: handleGroupChallengeCompleted,
       onGroupChallengeDeleted: handleGroupChallengeDeleted,
       onError: (error) => {
         console.warn('Realtime 연결 실패, 폴링 방식으로 대체:', error)
         // Realtime 연결 실패 시에도 폴링으로 계속 작동
       }
     })

  // Supabase Realtime 연결 후 룸 입장
  useEffect(() => {
    if (room?.room_id && user && isConnected) {
      console.log('Supabase Realtime 연결됨, 룸 입장 시도')
      joinRoom(user.user_metadata?.name || 'Unknown', user.user_metadata?.avatar_url)
      // 룸 입장 후 참가자 목록은 이미 위의 useEffect에서 로드됨
    }
  }, [room?.room_id, user, isConnected, joinRoom])

  // Supabase Realtime 연결 상태 변경 시 참가자 목록 새로고침
  useEffect(() => {
    if (isConnected && room?.room_id && initialLoadDoneRef.current) {
      console.log('Supabase Realtime 재연결 감지, 참가자 목록 새로고침')
      // 연결이 복구되었을 때 참가자 목록을 새로고침 (로딩 상태 없이)
      loadParticipants(false)
    }
  }, [isConnected, room?.room_id, loadParticipants])

  // 참가자 수 변경 감지 및 자동 새로고침
  useEffect(() => {
    if (initialLoadDoneRef.current && participants.length !== lastParticipantCountRef.current) {
      console.log('참가자 수 변경 감지:', lastParticipantCountRef.current, '->', participants.length)
      lastParticipantCountRef.current = participants.length
    }
  }, [participants.length])

  // 주기적인 참가자 목록 동기화 (Supabase Realtime 이벤트를 놓쳤을 경우 대비)
  useEffect(() => {
    if (!room?.room_id || !initialLoadDoneRef.current || !isConnected) return

    const syncInterval = setInterval(() => {
      console.log('주기적 참가자 목록 동기화 실행')
      loadParticipants(false)
    }, 30000) // 30초마다 동기화

    return () => clearInterval(syncInterval)
  }, [room?.room_id, initialLoadDoneRef.current, isConnected, loadParticipants])

  // 참가자 목록 로드 및 호스트 확인
  useEffect(() => {
    // 룸이 변경되면 초기 로드 플래그 리셋
    if (room?.room_id && room.room_id !== currentRoomIdRef.current) {
      initialLoadDoneRef.current = false
      currentRoomIdRef.current = room.room_id
      lastParticipantCountRef.current = 0
      
      // 대결 상태 초기화
      setCompetitionTimeLeft(0)
      setCompetitionScores({})
      setIsBreakTime(false)
      setShowCompetitionSettings(false)
      
      // 집중세션 상태 초기화
      setIsFocusSessionRunning(false)
      setIsFocusSessionPaused(false)
      setFocusSessionElapsed(0)
      if (focusSessionTimer) {
        clearInterval(focusSessionTimer)
        setFocusSessionTimer(null)
      }
      setCurrentSessionId(null)
      
      console.log('룸 변경 감지, 참가자 추적 상태 및 대결 상태 리셋')
    }
    
         if (room?.room_id && !initialLoadDoneRef.current) {
       // 룸 입장 시 한 번만 참가자 목록 로드 (초기 로딩)
       loadParticipants(true)
       initialLoadDoneRef.current = true
       
       // 챌린지 목록 로드
       challenge.fetchChallenges()
       
               // 대결 기록 로드
        loadCompetitionHistory()
        
                 // 대결 초대 로드
         loadChallengeInvitation()
         
         // 그룹 챌린지 로드
         loadGroupChallenge()
     }
     }, [room?.room_id, loadParticipants, challenge, loadCompetitionHistory, loadChallengeInvitation])

  // 호스트 권한 확인 (별도 useEffect로 분리하여 더 정확한 추적)
  useEffect(() => {
    if (room?.host_id && user?.id) {
      const isUserHost = String(room.host_id) === String(user.id)
      console.log('호스트 권한 확인:', {
        roomHostId: room.host_id,
        userId: user.id,
        isHost: isUserHost,
        roomId: room.room_id,
        roomHostIdType: typeof room.host_id,
        userIdType: typeof user.id
      })
      setIsHost(isUserHost)
      
      // 디버깅 API 호출 (개발 환경에서만)
      if (process.env.NODE_ENV === 'development') {
        const checkDebugInfo = async () => {
          try {
            const debugResponse = await fetch(`/api/social/debug?room_id=${room.room_id}`)
            if (debugResponse.ok) {
              const debugData = await debugResponse.json()
              console.log('디버깅 정보:', debugData)
            }
          } catch (error) {
            console.error('디버깅 API 호출 실패:', error)
          }
        }
        checkDebugInfo()
      }
    } else {
      // 사용자 정보나 룸 정보가 없으면 호스트가 아님
      setIsHost(false)
    }
  }, [room?.host_id, room?.room_id, user?.id])

  // handleLeaveRoom을 useSocialRealtime 훅 호출 후에 다시 정의
  const handleLeaveRoomWithRealtime = useCallback(async () => {
    try {
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

  // 대결 초대 만료 타이머 및 자동 정리
  useEffect(() => {
    if (currentInvitation && currentInvitation.status === 'pending') {
      const expiresAt = new Date(currentInvitation.expires_at).getTime()
      const now = Date.now()
      const timeLeft = expiresAt - now
      
      if (timeLeft > 0) {
        const timer = setTimeout(() => {
          handleInvitationExpire()
        }, timeLeft)
        
        return () => clearTimeout(timer)
      } else {
        // 이미 만료된 경우
        handleInvitationExpire()
      }
    }
  }, [currentInvitation, handleInvitationExpire])

  // 주기적으로 만료된 초대 정리 (호스트만)
  useEffect(() => {
    if (!room?.room_id || !isHost) return

    const cleanupInterval = setInterval(() => {
      cleanupExpiredInvitations()
    }, 60000) // 1분마다 정리

    return () => clearInterval(cleanupInterval)
  }, [room?.room_id, isHost, cleanupExpiredInvitations])

  // 컴포넌트 언마운트 시 응답 처리 중 상태 정리
  useEffect(() => {
    return () => {
      // 현재 사용자의 모든 응답 처리 중 상태 정리
      if (user?.id) {
        const keys = Object.keys(window.sessionStorage)
        keys.forEach(key => {
          if (key.includes(user.id) && key.includes('processing')) {
            window.sessionStorage.removeItem(key)
          }
        })
      }
      
      // 집중세션 타이머 정리
      if (focusSessionTimer) {
        clearInterval(focusSessionTimer)
      }
    }
  }, [user?.id, focusSessionTimer])

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
    if (!room || !user) {
      return
    }
    
    try {
      // API를 통해 집중도 업데이트
      const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_score: focusScore })
      })
      
      if (response.ok) {
        // 로컬 상태도 업데이트
        setCurrentFocusScore(focusScore)
      } else {
        console.error('API 집중도 업데이트 실패:', response.status)
      }
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
    }
  }, [room, user])

  // 격려 메시지 전송 (Realtime) - 기능 제거됨
  const sendEncouragement = useCallback((toUserId: string) => {
    // 기능 비활성화
  }, [])



          // 집중도 대결 시작 (챌린지 생성)
  const startCompetition = useCallback(async () => {
    console.log('대결 시작 시도:', {
      participantsCount: participants.length,
      isHost,
      roomId: room?.room_id,
      userId: user?.id,
      roomHostId: room?.host_id,
      roomHostIdType: typeof room?.host_id,
      userIdType: typeof user?.id
    })
    
    if (participants.length < 2) {
      alert('집중도 대결을 시작하려면 최소 2명 이상의 참가자가 필요합니다.')
      return
    }

    // 커스텀 탭에서 설정한 시간을 사용
    let duration = competitionDuration
    if (activeTab === 'custom') {
      duration = customHours * 60 + customMinutes
      if (duration === 0) {
        alert('시간을 설정해주세요.')
        return
      }
    }

    try {
      // 🚀 집중세션 자동 시작 체크
      if (!isFocusSessionRunning) {
        console.log('집중세션이 활성화되지 않음, 자동으로 시작합니다.')
        
        // 집중세션 자동 시작
        setIsFocusSessionRunning(true)
        setIsFocusSessionPaused(false)
        setFocusSessionElapsed(0)
        
        // 데이터베이스에 세션 생성
        const supabase = supabaseBrowser()
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !currentUser) {
          alert('사용자 인증에 실패했습니다. 다시 로그인해주세요.')
          return
        }
        
        const { data: newSession, error: sessionError } = await supabase
          .from('focus_session')
          .insert({
            user_id: currentUser.id,
            started_at: new Date().toISOString(),
            goal_min: duration,
            context_tag: '집중도 대결 자동 세션',
            session_type: 'competition'
          })
          .select()
          .single()
        
        if (sessionError) {
          console.error('자동 세션 생성 실패:', sessionError)
          alert(`자동 세션 생성에 실패했습니다: ${sessionError.message}`)
          return
        }
        
        console.log('✅ 자동 집중세션 생성 성공:', newSession)
        setCurrentSessionId(newSession.session_id)
        
        // 타이머 시작
        const timer = setInterval(() => {
          setFocusSessionElapsed(prev => prev + 1)
        }, 1000)
        setFocusSessionTimer(timer)
        
        // 모든 참가자에게 집중세션 시작 알림 전송 (Realtime)
        try {
          supabase
            .channel(`social_room:${room?.room_id}`)
            .send({
              type: 'broadcast',
              event: 'focus_session_started',
              payload: {
                session_id: newSession.session_id,
                room_id: room?.room_id,
                started_by: currentUser.id,
                timestamp: new Date().toISOString()
              }
            })
          console.log('자동 집중세션 시작 broadcast 이벤트 전송 완료')
        } catch (error) {
          console.warn('자동 집중세션 시작 알림 전송 실패:', error)
        }
        
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '집중도 대결을 위해 집중세션이 자동으로 시작되었습니다!',
          type: 'join'
        }])
      } else {
        console.log('집중세션이 이미 활성화되어 있음, 기존 세션 활용')
        setNotifications(prev => [...prev, {
          id: generateNotificationId(),
          message: '기존 집중세션의 데이터로 대결을 진행합니다!',
          type: 'join'
        }])
      }

      // 뽀모도로 모드일 때는 공부 시간만 사용, 커스텀 모드일 때는 총 시간 사용
      const config = activeTab === 'pomodoro' 
        ? { work: competitionDuration, break: breakDuration }
        : { durationMin: duration }
      
      // 챌린지 훅을 사용하여 챌린지 생성 (pending 상태로 생성)
      const newChallenge = await challenge.createChallenge({
        mode: activeTab,
        config
      })
      
      // 참가자 정보 설정
      const challengeParticipants = participants.map(p => ({
        participant_id: `${newChallenge.challenge_id}-${p.user_id}`,
        challenge_id: newChallenge.challenge_id,
        user_id: p.user_id,
        joined_at: new Date().toISOString(),
        current_progress: 0
      }))
      challenge.setParticipants(challengeParticipants)
      
      // 새로 생성된 챌린지를 현재 챌린지로 설정
      challenge.setCurrentChallenge(newChallenge)
      
      // 설정 패널 닫기
      setShowCompetitionSettings(false)
      
      // 챌린지 생성 후 대결 초대 생성
      console.log('챌린지 생성 완료, 대결 초대 생성...', newChallenge.challenge_id)
      try {
        // 먼저 만료된 초대 정리
        await cleanupExpiredInvitations()
        
        const invitationData = {
          room_id: room?.room_id,
          challenge_id: newChallenge.challenge_id,
          mode: activeTab,
          config: activeTab === 'pomodoro' 
            ? { work: competitionDuration, break: breakDuration }
            : { durationMin: customHours * 60 + customMinutes }
        }

        const invitationResponse = await fetch('/api/social/challenge-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invitationData)
        })

        if (invitationResponse.ok) {
          const invitationResult = await invitationResponse.json()
          console.log('대결 초대 생성 완료:', invitationResult.invitation)
          
          // 초대 상태 설정
          setCurrentInvitation(invitationResult.invitation)
          setShowInvitationPanel(true)
          
          // API에서 이미 broadcast 이벤트를 전송하므로 여기서는 제거
          console.log('대결 초대 생성 완료 - API에서 broadcast 이벤트 전송됨')
        } else if (invitationResponse.status === 409) {
          // 이미 대기 중인 초대가 있는 경우
          console.log('이미 대기 중인 대결 초대가 있습니다.')
          
          // 기존 초대를 로드하여 표시
          try {
            const existingInvitationResponse = await fetch(`/api/social/challenge-invitation?room_id=${room?.room_id}`)
            if (existingInvitationResponse.ok) {
              const existingData = await existingInvitationResponse.json()
              if (existingData.invitation) {
                setCurrentInvitation(existingData.invitation)
                setShowInvitationPanel(true)
                console.log('기존 대결 초대를 표시합니다:', existingData.invitation)
              }
            }
          } catch (loadError) {
            console.error('기존 초대 로드 실패:', loadError)
          }
          
          // 사용자에게 더 친화적인 메시지 표시
          setNotifications(prev => [...prev, {
            id: generateNotificationId(),
            message: '이미 대기 중인 대결 초대가 있습니다. 기존 초대에 응답해주세요.',
            type: 'join'
          }])
        } else {
          console.error('대결 초대 생성 실패:', invitationResponse.status)
          const errorData = await invitationResponse.json().catch(() => ({}))
          alert(`대결 초대 생성에 실패했습니다: ${errorData.error || '알 수 없는 오류'}`)
        }
      } catch (error) {
        console.error('대결 초대 생성 중 오류:', error)
        alert('대결 초대 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('챌린지 생성 실패:', error)
      alert('챌린지 생성에 실패했습니다.')
    }
  }, [participants, competitionDuration, activeTab, customHours, customMinutes, breakDuration, challenge, cleanupExpiredInvitations, isFocusSessionRunning, room?.room_id])

    // 집중도 대결 종료
  const endCompetition = useCallback(async () => {
    // 호스트가 아닌 경우 에러 알림만 표시
    if (!isHost) {
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '호스트만 대결을 종료할 수 있습니다.',
        type: 'leave'
      }])
      return
    }

    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    if (!isCompetitionActive || !challenge.currentChallenge) return

         // 🚀 대결 종료 시 집중세션은 계속 유지 (사용자가 직접 종료할 때까지)
     if (isFocusSessionRunning) {
       console.log('대결이 종료되었지만 집중세션은 계속 유지됩니다.')
       
       setNotifications(prev => [...prev, {
         id: generateNotificationId(),
         message: '대결이 종료되었습니다. 집중세션은 계속 진행 중입니다.',
         type: 'join'
       }])
     }

    // 최종 점수 계산 및 순위 결정
    const finalScores = Object.entries(competitionScores)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score)

    const winner = finalScores[0]?.userId || ''
    const winnerName = participants.find(p => p.user_id === winner)?.user.name || 'Unknown'

    // 대결 기록을 데이터베이스에 저장
    try {
      const historyData = {
        room_id: room?.room_id,
        challenge_id: challenge.currentChallenge.challenge_id,
        duration: competitionDuration,
        scores: competitionScores,
        winner_id: winner,
        mode: activeTab,
        config: activeTab === 'pomodoro' 
          ? { work: competitionDuration, break: breakDuration }
          : { durationMin: customHours * 60 + customMinutes }
      }

      const response = await fetch('/api/social/challenge-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('대결 기록 저장 완료:', result.history)
        
        // 로컬 상태도 업데이트
        setCompetitionHistory(prev => [...prev, {
          round: prev.length + 1,
          duration: competitionDuration,
          scores: { ...competitionScores },
          winner
        }])
      } else {
        console.error('대결 기록 저장 실패:', response.status)
      }
    } catch (error) {
      console.error('대결 기록 저장 중 오류:', error)
    }

    // 결과 알림 (뽀모도로 모드 구분)
    const durationText = activeTab === 'pomodoro' 
      ? `${competitionDuration}분 공부 + ${breakDuration}분 휴식`
      : `${Math.floor(competitionDuration / 60)}시간 ${competitionDuration % 60}분`
    
    setNotifications(prev => [...prev, {
      id: generateNotificationId(),
      message: `🏆 ${winnerName}님이 ${durationText} 대결에서 우승했습니다!`,
      type: 'join'
    }])

    // HUD 오버레이 숨기고 결과 패널 표시
    setShowChallengeHUD(false)
    setFinalScores(competitionScores)
    
    // 배지 생성 (간단한 예시)
    const badges: {[key: string]: string[]} = {}
    Object.entries(competitionScores).forEach(([userId, score]) => {
      const userBadges = []
      if (score > 1000) userBadges.push('집중의 달인')
      if (score > 500) userBadges.push('성실한 학습자')
      if (score > 100) userBadges.push('첫걸음')
      badges[userId] = userBadges
    })
    setChallengeBadges(badges)
    
    console.log('결과 패널 표시:', { finalScores, badges })
    setShowResultPanel(true)

    // 기존 상태 정리
    setCompetitionTimeLeft(0)
    setCompetitionScores({})
    
    // 챌린지 훅을 사용하여 챌린지 종료
    try {
      await challenge.endChallenge(challenge.currentChallenge.challenge_id)
    } catch (error) {
      console.error('챌린지 종료 실패:', error)
    }
  }, [challenge.currentChallenge, competitionScores, competitionDuration, participants, activeTab, breakDuration, challenge, isHost, isFocusSessionRunning, currentSessionId, focusSessionElapsed, focusSessionTimer, room?.room_id, user?.id])



  // 대결 타이머 (뽀모도로 사이클 포함)
  useEffect(() => {
    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    console.log('타이머 useEffect 실행:', {
      isCompetitionActive,
      competitionTimeLeft,
      activeTab,
      isBreakTime,
      challengeState: challenge.currentChallenge?.state
    })
    
    let timer: NodeJS.Timeout
    if (isCompetitionActive && competitionTimeLeft > 0) {
      timer = setTimeout(() => {
        setCompetitionTimeLeft(prev => {
          console.log('타이머 틱:', { prev, newValue: prev - 1 })
          if (prev <= 1) {
            // 뽀모도로 모드이고 공부 시간이 끝났다면 휴식 시간으로 전환
            if (activeTab === 'pomodoro' && !isBreakTime) {
              console.log('공부 시간 종료, 휴식 시간으로 전환:', breakDuration * 60)
              setIsBreakTime(true)
              setCompetitionTimeLeft(breakDuration * 60) // 휴식 시간 설정
              return breakDuration * 60
            }
            // 휴식 시간이 끝났거나 커스텀 모드라면 대결 종료
            console.log('대결 종료')
            endCompetition()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearTimeout(timer)
  }, [challenge.currentChallenge?.state, competitionTimeLeft, endCompetition, activeTab, isBreakTime, breakDuration])

  const handleLeaveChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/group-challenge/participate?challenge_id=${challengeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '챌린지 탈퇴에 실패했습니다.')
      }

      // 성공 시 챌린지 목록 다시 로드
      await loadGroupChallenge()
      
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '챌린지에서 탈퇴했습니다.',
        type: 'leave'
      }])
    } catch (error) {
      console.error('챌린지 탈퇴 실패:', error)
      alert(error instanceof Error ? error.message : '챌린지 탈퇴에 실패했습니다.')
    }
  }, [loadGroupChallenge])

  const handleDeleteChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/group-challenge/delete?challenge_id=${challengeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '챌린지 삭제에 실패했습니다.')
      }

      // 성공 시 챌린지 목록에서 제거
      setCurrentGroupChallenges(prev => prev.filter(challenge => challenge.challenge_id !== challengeId))
      
      setNotifications(prev => [...prev, {
        id: generateNotificationId(),
        message: '챌린지가 삭제되었습니다.',
        type: 'leave'
      }])
    } catch (error) {
      console.error('챌린지 삭제 실패:', error)
      alert(error instanceof Error ? error.message : '챌린지 삭제에 실패했습니다.')
    }
  }, [])

  // 스터디룸 생성 폼
  if (showCreateRoom) {
    return (
      <StudyRoomCreateForm
        roomForm={roomForm}
        onRoomFormChange={setRoomForm}
        onCreateRoom={handleCreateRoom}
        onCancel={() => setShowCreateRoom(false)}
      />
    )
  }

  // 스터디룸 메인 화면
  if (!room) {
    return (
      <StudyRoomEmpty onCreateRoom={() => setShowCreateRoom(true)} />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 실시간 알림 */}
      <StudyRoomNotifications notifications={notifications} />

                     {/* 챌린지 HUD 오버레이 */}
        {showChallengeHUD && challenge.currentChallenge && (
                     <ChallengeHUD
             challenge={challenge.currentChallenge}
             participants={participants}
             currentUserId={user?.id || ''}
             currentFocusScore={currentFocusScore}
             currentScores={competitionScores}
             timeLeft={competitionTimeLeft}
             isBreakTime={isBreakTime}
                           onClose={() => {
                // 호스트가 아닌 경우 에러 알림만 표시하고 실제 종료는 하지 않음
                if (!isHost) {
                  setNotifications(prev => [...prev, {
                    id: generateNotificationId(),
                    message: '호스트만 대결을 종료할 수 있습니다.',
                    type: 'leave'
                  }])
                  return
                }

                // 모든 참가자에게 경쟁 종료 알림 전송 (Supabase Realtime)
                try {
                  const supabase = supabaseBrowser()
                  supabase
                    .channel(`social_room:${room?.room_id}`)
                    .send({
                      type: 'broadcast',
                      event: 'challenge_ended',
                      payload: {
                        challenge_id: challenge.currentChallenge?.challenge_id,
                        room_id: room?.room_id,
                        ended_by: user?.id,
                        timestamp: new Date().toISOString()
                      }
                    })
                  console.log('경쟁 종료 broadcast 이벤트 전송 완료')
                } catch (error) {
                  console.warn('경쟁 종료 알림 전송 실패:', error)
                }
                
                // 로컬에서도 경쟁 종료 처리
                setShowChallengeHUD(false)
                endCompetition()
              }}
           />
        )}

             {/* 대결 초대 패널 */}
       {showInvitationPanel && currentInvitation && (
         <ChallengeInvitationPanel
           invitation={currentInvitation}
           participants={participants}
           currentUserId={user?.id || ''}
           onAccept={() => handleInvitationResponse('accepted')}
           onReject={() => handleInvitationResponse('rejected')}
           onExpire={handleInvitationExpire}
         />
       )}

       {/* 챌린지 결과 패널 */}
       {showResultPanel && challenge.currentChallenge && (
         <ChallengeResultPanel
           challenge={challenge.currentChallenge}
           participants={participants}
           finalScores={finalScores}
           badges={challengeBadges}
           onClose={() => setShowResultPanel(false)}
           onRestart={() => {
             setShowResultPanel(false)
             setShowCompetitionSettings(true)
           }}
           onShare={() => {
             // 공유 기능 구현
             console.log('결과 공유')
           }}
         />
       )}
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* 룸 헤더 */}
          <StudyRoomHeader
            room={room}
            participants={participants}
            isHost={isHost}
            isConnected={isConnected}
            loading={loading}
            currentUserId={user?.id}
            videoRoom={videoRoom}
            onLeaveRoom={handleLeaveRoomWithRealtime}
            onEndRoom={handleEndRoom}
          />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 메인 화면 */}
            <div className="lg:col-span-4 space-y-6">
              {/* 비디오 화면 */}
              <VideoGrid
                participants={participants}
                currentUserId={user?.id || ''}
                localStream={videoRoom.localStream}
                remoteStreams={videoRoom.remoteStreams}
                onParticipantClick={(participantId) => {
                  console.log('참가자 클릭:', participantId)
                }}
              />
              
              {/* 비디오 에러 표시 */}
              {videoRoom.error && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <VideoOff className="h-5 w-5" />
                      <span className="text-sm font-medium">비디오 연결 오류: {videoRoom.error}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* 연결 상태 표시 */}
              {videoRoom.isConnecting && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-700">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                      <span className="text-sm font-medium">비디오 연결 중...</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 집중세션 컨트롤 패널 */}
              <Card className="rounded-2xl shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">집중세션</h3>
                      {!isFocusSessionRunning ? (
                        <div className="flex items-center gap-3">
                          <Button
                            size="lg"
                            onClick={startFocusSession}
                            disabled={!isHost}
                            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            집중 시작!
                          </Button>
                          {!isHost && (
                            <span className="text-sm text-slate-500">호스트만 집중세션을 시작할 수 있습니다.</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={pauseFocusSession}
                            disabled={!isHost}
                            className="px-6 py-3 rounded-xl bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isFocusSessionPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                            {isFocusSessionPaused ? "재개" : "일시정지"}
                          </Button>
                          
                          <Button
                            size="lg"
                            variant="destructive"
                            onClick={stopFocusSession}
                            disabled={!isHost}
                            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Square className="w-5 h-5 mr-2" />
                            세션 종료
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-900">{formatTime(focusSessionElapsed)}</div>
                        <div className="text-sm text-slate-600">세션 시간</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

                             {/* 집중도 대결 모드 */}
               <CompetitionPanel
                 isHost={isHost}
                 isCompetitionActive={challenge.currentChallenge?.state === 'active' && competitionTimeLeft > 0}
                 isBreakTime={isBreakTime}
                 competitionTimeLeft={competitionTimeLeft}
                 competitionDuration={competitionDuration}
                 breakDuration={breakDuration}
                 competitionScores={competitionScores}
                 competitionHistory={competitionHistory}
                 participants={participants}
                 showCompetitionSettings={showCompetitionSettings}
                 activeTab={activeTab}
                 customHours={customHours}
                 customMinutes={customMinutes}
                 hasPendingInvitation={!!currentInvitation && currentInvitation.status === 'pending'}
                 onShowCompetitionSettings={setShowCompetitionSettings}
                 onActiveTabChange={setActiveTab}
                 onCompetitionDurationChange={setCompetitionDuration}
                 onBreakDurationChange={setBreakDuration}
                 onCustomHoursChange={setCustomHours}
                 onCustomMinutesChange={setCustomMinutes}
                                  onStartCompetition={startCompetition}
                 onEndCompetition={endCompetition}
               />

               {/* 그룹 챌린지 패널 */}
               <GroupChallengePanel
                 roomId={room?.room_id || ''}
                 participants={participants}
                 isHost={isHost}
                 currentChallenges={currentGroupChallenges}
                 challengeProgressMap={groupChallengeProgressMap}
                 currentUserId={user?.id || ''}
                 onCreateChallenge={createGroupChallenge}
                 onJoinChallenge={joinGroupChallenge}
                 onLeaveChallenge={handleLeaveChallenge}
                 onDeleteChallenge={handleDeleteChallenge}
               />
              


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
