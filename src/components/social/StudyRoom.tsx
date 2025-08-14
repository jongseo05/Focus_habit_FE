'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { VideoOff } from 'lucide-react'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { useVideoRoom } from '@/hooks/useVideoRoom'
import { useChallenge } from '@/hooks/useChallenge'
import { FocusScoreChart } from './FocusScoreChart'
import { VideoGrid } from './VideoGrid'
import { ChallengeHUD } from './ChallengeHUD'
import { ChallengeResultPanel } from './ChallengeResultPanel'
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
  CreateStudyRoomData,
  FocusUpdateMessage,
  RoomJoinMessage,
  EncouragementMessageWS,
  Challenge,
  ChallengeParticipant
} from '@/types/social'

interface StudyRoomProps {
  room?: StudyRoom
  onClose?: () => void
}

interface ParticipantWithUser extends RoomParticipant {
  user: {
    name: string
    avatar_url?: string
  }
}

export function StudyRoom({ room, onClose }: StudyRoomProps) {
  const { data: user } = useUser()
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
  const [focusUpdateInterval, setFocusUpdateInterval] = useState<NodeJS.Timeout | null>(null)
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: 'join' | 'leave'}>>([])

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
  }, [room?.room_id, onClose, endRoomMutation])

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
      id: Date.now().toString(),
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
          id: Date.now().toString(),
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

    // 점수 계산: 집중도 × 0.1 (더 현실적인 점수)
    const scoreIncrement = Math.round(focusScore * 0.1)
    
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
    onEncouragement: handleEncouragement
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
    console.log('참가자 목록 로드 useEffect 실행:', { roomId: room?.room_id, userId: user?.id })
    
    // 룸이 변경되면 초기 로드 플래그 리셋
    if (room?.room_id && room.room_id !== currentRoomIdRef.current) {
      initialLoadDoneRef.current = false
      currentRoomIdRef.current = room.room_id
      lastParticipantCountRef.current = 0
      console.log('룸 변경 감지, 참가자 추적 상태 리셋')
    }
    
    if (room?.room_id && !initialLoadDoneRef.current) {
      // 룸 입장 시 한 번만 참가자 목록 로드 (초기 로딩)
      loadParticipants(true)
      initialLoadDoneRef.current = true
      
      // 호스트 여부 확인 (room.host_id와 user.id 비교)
      if (room.host_id && user?.id) {
        setIsHost(room.host_id === user.id)
      }
      
      // 챌린지 목록 로드
      challenge.fetchChallenges()
    }
  }, [room?.room_id, room?.host_id, user?.id, loadParticipants])

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

  // 집중도 시뮬레이션 (실제로는 ML 모델에서 받아올 값)
  useEffect(() => {
    if (room && isConnected) {
      const interval = setInterval(() => {
        const newFocusScore = Math.floor(Math.random() * 100)
        sendFocusUpdate(newFocusScore)
      }, 10000) // 10초마다 업데이트

      setFocusUpdateInterval(interval)
    }

    return () => {
      if (focusUpdateInterval) {
        clearInterval(focusUpdateInterval)
      }
    }
  }, [room?.room_id, isConnected, sendFocusUpdate])

  // 집중도 대결 시작
  const startCompetition = useCallback(async () => {
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
      // 뽀모도로 모드일 때는 공부 시간만 사용, 커스텀 모드일 때는 총 시간 사용
      const config = activeTab === 'pomodoro' 
        ? { work: competitionDuration, break: breakDuration }
        : { durationMin: duration }
      
      // 챌린지 훅을 사용하여 챌린지 생성
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
      
      // HUD 오버레이 표시
      setShowChallengeHUD(true)
      setShowCompetitionSettings(false)
      
      // 뽀모도로 모드일 때는 공부 시간만, 커스텀 모드일 때는 총 시간
      const timeLeft = activeTab === 'pomodoro' 
        ? competitionDuration * 60  // 공부 시간만
        : duration * 60  // 총 시간
      setCompetitionTimeLeft(timeLeft)
      
      // 모든 참가자의 점수를 0으로 초기화
      const initialScores: {[key: string]: number} = {}
      participants.forEach(p => {
        initialScores[p.user_id] = 0
      })
      setCompetitionScores(initialScores)
      
      // 대결 시작 완료
    } catch (error) {
      console.error('챌린지 생성 실패:', error)
      alert('챌린지 생성에 실패했습니다.')
    }
  }, [participants, competitionDuration, activeTab, customHours, customMinutes, breakDuration, challenge])

  // 집중도 대결 종료
  const endCompetition = useCallback(async () => {
    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    if (!isCompetitionActive || !challenge.currentChallenge) return

    // 최종 점수 계산 및 순위 결정
    const finalScores = Object.entries(competitionScores)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score)

    const winner = finalScores[0]?.userId || ''
    const winnerName = participants.find(p => p.user_id === winner)?.user.name || 'Unknown'

    // 대결 기록에 추가
    setCompetitionHistory(prev => [...prev, {
      round: prev.length + 1,
      duration: competitionDuration,
      scores: { ...competitionScores },
      winner
    }])

    // 결과 알림 (뽀모도로 모드 구분)
    const durationText = activeTab === 'pomodoro' 
      ? `${competitionDuration}분 공부 + ${breakDuration}분 휴식`
      : `${Math.floor(competitionDuration / 60)}시간 ${competitionDuration % 60}분`
    
    setNotifications(prev => [...prev, {
      id: Date.now().toString(),
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
  }, [challenge.currentChallenge, competitionScores, competitionDuration, participants, activeTab, breakDuration, challenge])

  // 대결 타이머 (뽀모도로 사이클 포함)
  useEffect(() => {
    const isCompetitionActive = challenge.currentChallenge?.state === 'active'
    let timer: NodeJS.Timeout
    if (isCompetitionActive && competitionTimeLeft > 0) {
      timer = setTimeout(() => {
        setCompetitionTimeLeft(prev => {
          if (prev <= 1) {
            // 뽀모도로 모드이고 공부 시간이 끝났다면 휴식 시간으로 전환
            if (activeTab === 'pomodoro' && !isBreakTime) {
              setIsBreakTime(true)
              setCompetitionTimeLeft(breakDuration * 60) // 휴식 시간 설정
              return breakDuration * 60
            }
            // 휴식 시간이 끝났거나 커스텀 모드라면 대결 종료
            endCompetition()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearTimeout(timer)
  }, [challenge.currentChallenge?.state, competitionTimeLeft, endCompetition, activeTab, isBreakTime, breakDuration])



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
          participants={challenge.participants}
          currentUserId={user?.id || ''}
          currentFocusScore={currentFocusScore}
          currentScores={competitionScores}
          onClose={() => {
            setShowChallengeHUD(false)
            endCompetition()
          }}
        />
      )}

      {/* 챌린지 결과 패널 */}
      {showResultPanel && challenge.currentChallenge && (
        <ChallengeResultPanel
          challenge={challenge.currentChallenge}
          participants={challenge.participants}
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

              {/* 집중도 대결 모드 */}
              <CompetitionPanel
                isHost={isHost}
                isCompetitionActive={challenge.currentChallenge?.state === 'active'}
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
                onShowCompetitionSettings={setShowCompetitionSettings}
                onActiveTabChange={setActiveTab}
                onCompetitionDurationChange={setCompetitionDuration}
                onBreakDurationChange={setBreakDuration}
                onCustomHoursChange={setCustomHours}
                onCustomMinutesChange={setCustomMinutes}
                onStartCompetition={startCompetition}
                onEndCompetition={endCompetition}
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
