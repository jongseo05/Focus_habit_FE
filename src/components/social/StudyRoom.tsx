'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Users, 
  Clock, 
  Crown, 
  Video,
  Mic,
  MicOff,
  VideoOff,
  Settings,
  LogOut,
  Plus,
  Hash,
  Activity,
  Trophy,
  Sword,
  Target,
  Timer,
  Play,
  Square,
  Award,
  TrendingUp
} from 'lucide-react'
import { useSocialRealtime } from '@/hooks/useSocialRealtime'
import { useUser } from '@/hooks/useAuth'
import { useEndStudyRoom, useLeaveStudyRoom } from '@/hooks/useSocial'
import { useVideoRoom } from '@/hooks/useVideoRoom'
import { FocusScoreChart } from './FocusScoreChart'
import { VideoGrid } from './VideoGrid'
import { ChallengeHUD } from './ChallengeHUD'
import { ChallengeResultPanel } from './ChallengeResultPanel'
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
  const [loading, setLoading] = useState(true)
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

  // 집중도 대결 관련 상태
  const [isCompetitionActive, setIsCompetitionActive] = useState(false)
  const [competitionRound, setCompetitionRound] = useState<number>(0)
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
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null)
  const [challengeParticipants, setChallengeParticipants] = useState<ChallengeParticipant[]>([])
  const [finalScores, setFinalScores] = useState<{[key: string]: number}>({})
  const [challengeBadges, setChallengeBadges] = useState<{[key: string]: string[]}>({})

  // 비디오룸 훅
  const videoRoom = useVideoRoom({
    roomId: room?.room_id || '',
    userId: user?.id || '',
    participants
  })

  // 참가자 목록 로드
  const loadParticipants = useCallback(async () => {
    try {
      setLoading(true)
      console.log('참가자 목록 로드 시작, room_id:', room?.room_id)
      
      const response = await fetch(`/api/social/study-room/${room?.room_id}/participants`)
      console.log('참가자 API 응답 상태:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('참가자 API 응답 데이터:', data)
        console.log('참가자 목록:', data.participants)
        
        setParticipants(data.participants || [])
      } else {
        const errorData = await response.json()
        console.error('참가자 API 에러:', errorData)
      }
    } catch (error) {
      console.error('참가자 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }, [room?.room_id])

  const handleLeaveRoom = useCallback(async () => {
    try {
      setLoading(true)
      
      // Realtime으로 퇴장 알림 전송은 useSocialRealtime 훅 호출 후에 처리
      await leaveRoomMutation.mutateAsync({ roomId: room?.room_id! })

      // 나가기 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 나가기 실패:', error)
      alert('스터디룸 나가기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, onClose, leaveRoomMutation])

  const handleEndRoom = useCallback(async () => {
    if (!confirm('정말로 스터디룸을 종료하시겠습니까? 모든 참가자가 퇴장됩니다.')) {
      return
    }

    try {
      setLoading(true)
      await endRoomMutation.mutateAsync({ roomId: room?.room_id! })
      
      alert('스터디룸이 성공적으로 종료되었습니다.')
      
      // 종료 성공 시 룸 닫기
      if (onClose) {
        onClose()
      }
    } catch (error) {
      console.error('스터디룸 종료 실패:', error)
      alert('스터디룸 종료에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [room?.room_id, onClose, endRoomMutation])

  // WebSocket 메시지 핸들러들
  const handleRoomJoin = useCallback((data: RoomJoinMessage['data']) => {
    // 새 참가자 입장 로직
    console.log('새 참가자 입장:', data)
    // 참가자 목록 새로고침
    loadParticipants()
    
    // 알림 추가
    setNotifications(prev => [...prev, {
      id: Date.now().toString(),
      message: `${data.user_name}님이 입장했습니다!`,
      type: 'join'
    }])
  }, [loadParticipants])

  const handleRoomLeave = useCallback((data: { user_id: string }) => {
    // 참가자 퇴장 로직
    console.log('참가자 퇴장:', data)
    // 참가자 목록 새로고침
    loadParticipants()
    
    // 알림 추가
    const leavingParticipant = participants.find(p => p.user_id === data.user_id)
    if (leavingParticipant) {
      setNotifications(prev => [...prev, {
        id: Date.now().toString(),
        message: `${leavingParticipant.user.name}님이 퇴장했습니다.`,
        type: 'leave'
      }])
    }
  }, [loadParticipants, participants])



  const handleEncouragement = useCallback((data: EncouragementMessageWS['data']) => {
    // 격려 메시지 표시 - 기능 제거됨
    console.log('격려 메시지 수신 (기능 비활성화):', data)
  }, [])

  // 로그 제한을 위한 ref들
  const lastLogTimeRef = useRef<number>(0)
  const lastInactiveLogTimeRef = useRef<number>(0)
  const lastBreakLogTimeRef = useRef<number>(0)
  const lastScoreLogTimeRef = useRef<number>(0)

  // 집중도 점수 업데이트 (대결 중일 때, 휴식 시간에는 점수 계산 안함)
  const updateCompetitionScore = useCallback((userId: string, focusScore: number) => {
    // 로그 제한: 10초에 한번만 출력
    const now = Date.now()
    if (now - lastLogTimeRef.current > 10000) {
      console.log('updateCompetitionScore 호출:', { 
        userId, 
        focusScore, 
        isCompetitionActive, 
        isBreakTime,
        currentCompetitionScores: competitionScores
      })
      lastLogTimeRef.current = now
    }
    
    if (!isCompetitionActive) {
      if (now - lastInactiveLogTimeRef.current > 10000) {
        console.log('대결이 비활성 상태 - 점수 업데이트 건너뜀')
        lastInactiveLogTimeRef.current = now
      }
      return
    }
    
    if (isBreakTime) {
      if (now - lastBreakLogTimeRef.current > 10000) {
        console.log('휴식 시간 - 점수 업데이트 건너뜀')
        lastBreakLogTimeRef.current = now
      }
      return
    }

    // 점수 계산: 집중도 × 0.1 (더 현실적인 점수)
    const scoreIncrement = Math.round(focusScore * 0.1)
    
    setCompetitionScores(prev => {
      const newScores = {
        ...prev,
        [userId]: (prev[userId] || 0) + scoreIncrement
      }
      if (now - lastScoreLogTimeRef.current > 10000) {
        console.log('점수 업데이트 완료:', { 
          userId, 
          scoreIncrement, 
          focusScore, 
          prevScores: prev,
          newScores 
        })
        lastScoreLogTimeRef.current = now
      }
      return newScores
    })
  }, [isCompetitionActive, isBreakTime, competitionScores])

  // 집중도 업데이트 시 대결 점수도 업데이트 (Realtime 대신 폴링 사용)
  const handleFocusUpdate = useCallback((data: FocusUpdateMessage['data']) => {
    const now = Date.now()
    if (now - lastLogTimeRef.current > 10000) {
      console.log('집중도 업데이트 수신:', data)
      console.log('현재 대결 상태:', { 
        isCompetitionActive, 
        isBreakTime,
        currentCompetitionScores: competitionScores
      })
      lastLogTimeRef.current = now
    }
    
    // 다른 참가자의 집중도 업데이트
    setParticipants(prev => prev.map(p => 
      p.user_id === data.user_id 
        ? { ...p, current_focus_score: data.focus_score }
        : p
    ))

    // 대결 중이면 점수 업데이트
    if (isCompetitionActive) {
      if (now - lastLogTimeRef.current > 10000) {
        console.log('대결 중 - 점수 업데이트 호출')
      }
      updateCompetitionScore(data.user_id, data.focus_score)
    } else {
      if (now - lastInactiveLogTimeRef.current > 10000) {
        console.log('대결 비활성 상태 - 점수 업데이트 건너뜀')
        lastInactiveLogTimeRef.current = now
      }
    }
  }, [isCompetitionActive, isBreakTime, updateCompetitionScore, competitionScores])

     // 폴링으로 참가자 집중도 업데이트 (Realtime 대체)
   useEffect(() => {
     if (!room?.room_id || !isCompetitionActive) return
 
     const pollInterval = setInterval(async () => {
       try {
         // 모든 참가자의 집중도 조회
         for (const participant of participants) {
           const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score?user_id=${participant.user_id}`)
           if (response.ok) {
             const data = await response.json()
             console.log('폴링으로 집중도 조회:', data)
             
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
     }, 5000) // 5초마다 폴링
 
     return () => clearInterval(pollInterval)
   }, [room?.room_id, isCompetitionActive, participants, handleFocusUpdate])

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

  // Realtime 연결 후 룸 입장
  useEffect(() => {
    if (room?.room_id && user && isConnected) {
      joinRoom(user.user_metadata?.name || 'Unknown', user.user_metadata?.avatar_url)
      // 룸 입장 후 참가자 목록은 이미 위의 useEffect에서 로드됨
    }
  }, [room?.room_id, user, isConnected, joinRoom])

  // 참가자 목록 로드 및 호스트 확인
  useEffect(() => {
    if (room?.room_id) {
      // 룸 입장 시 한 번만 참가자 목록 로드
      loadParticipants()
      
      // 호스트 여부 확인 (room.host_id와 user.id 비교)
      if (room.host_id && user?.id) {
        setIsHost(room.host_id === user.id)
        console.log('호스트 확인:', { roomHostId: room.host_id, userId: user.id, isHost: room.host_id === user.id })
      }
    }
  }, [room?.room_id, room?.host_id, user?.id, loadParticipants])

  // handleLeaveRoom을 useSocialRealtime 훅 호출 후에 다시 정의
  const handleLeaveRoomWithRealtime = useCallback(async () => {
    try {
      setLoading(true)
      
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
    } finally {
      setLoading(false)
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
    const now = Date.now()
    
    console.log('sendFocusUpdate 함수 호출됨:', { focusScore, room: !!room, user: !!user })
    
    if (!room || !user) {
      console.log('sendFocusUpdate - room 또는 user가 없음:', { room: !!room, user: !!user })
      return
    }
    
    console.log('sendFocusUpdate API 호출 시작:', { focusScore, roomId: room.room_id, userId: user.id })
    
    try {
      // API를 통해 집중도 업데이트
      const response = await fetch(`/api/social/study-room/${room.room_id}/focus-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_score: focusScore })
      })
      
      console.log('API 응답 상태:', response.status)
      
             if (response.ok) {
        console.log('API 집중도 업데이트 성공')
        console.log('Realtime 이벤트 대기 중...')
        
        // 로컬 상태도 업데이트
        setCurrentFocusScore(focusScore)
      } else {
        console.error('API 집중도 업데이트 실패:', response.status)
        const errorText = await response.text()
        console.error('API 에러 내용:', errorText)
      }
    } catch (error) {
      console.error('집중도 업데이트 실패:', error)
    }
  }, [room, user])

  // 격려 메시지 전송 (Realtime) - 기능 제거됨
  const sendEncouragement = useCallback((toUserId: string) => {
    console.log('격려 메시지 전송 (기능 비활성화):', toUserId)
  }, [])

  // 집중도 시뮬레이션 (실제로는 ML 모델에서 받아올 값)
  useEffect(() => {
    const now = Date.now()
    if (now - lastLogTimeRef.current > 10000) {
      console.log('집중도 시뮬레이션 useEffect 실행:', { room: !!room, isConnected })
      lastLogTimeRef.current = now
    }
    
    if (room && isConnected) {
      const startNow = Date.now()
      if (startNow - lastLogTimeRef.current > 10000) {
        console.log('집중도 시뮬레이션 시작:', { roomId: room.room_id, isConnected })
        lastLogTimeRef.current = startNow
      }
      
      const interval = setInterval(() => {
        const newFocusScore = Math.floor(Math.random() * 100)
        const intervalNow = Date.now()
        if (intervalNow - lastLogTimeRef.current > 10000) {
          console.log('집중도 시뮬레이션 - 새로운 점수 생성:', newFocusScore)
          console.log('sendFocusUpdate 함수 호출 예정...')
          lastLogTimeRef.current = intervalNow
        }
        sendFocusUpdate(newFocusScore)
      }, 2000) // 2초마다 업데이트 (실제 시뮬레이션은 빠르게)

      setFocusUpdateInterval(interval)
      const setupNow = Date.now()
      if (setupNow - lastLogTimeRef.current > 10000) {
        console.log('집중도 시뮬레이션 인터벌 설정 완료')
        lastLogTimeRef.current = setupNow
      }
    }

    return () => {
      if (focusUpdateInterval) {
        const cleanupNow = Date.now()
        if (cleanupNow - lastLogTimeRef.current > 10000) {
          console.log('집중도 시뮬레이션 정리')
          lastLogTimeRef.current = cleanupNow
        }
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
      
      
      
             // API를 통해 챌린지 생성
       const response = await fetch('/api/social/challenge', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           room_id: room?.room_id,
           mode: activeTab,
           config,
           start_at: new Date().toISOString() // 현재 시간으로 시작 시간 설정
         })
       })

             if (response.ok) {
                   const responseData = await response.json()
          
          // API 응답에서 challenge 객체 추출
          const challenge = responseData.challenge
          setCurrentChallenge(challenge)
        
                 // 참가자 정보 설정
         const challengeParticipants = participants.map(p => ({
           participant_id: `${challenge.challenge_id}-${p.user_id}`,
           challenge_id: challenge.challenge_id,
           user_id: p.user_id,
           joined_at: new Date().toISOString(),
           current_progress: 0
         }))
         setChallengeParticipants(challengeParticipants)
        
        // HUD 오버레이 표시
        setShowChallengeHUD(true)
        setShowCompetitionSettings(false)
        
        // 기존 대결 상태도 업데이트 (하위 호환성)
        setIsCompetitionActive(true)
        setIsBreakTime(false)
        setCompetitionRound(prev => prev + 1)
        
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
         
         console.log('대결 시작 - 초기 점수:', initialScores)
         console.log('대결 시작 - 상태 설정:', {
           isCompetitionActive: true,
           isBreakTime: false,
           participants: participants.map(p => p.user_id)
         })
      }
    } catch (error) {
      console.error('챌린지 생성 실패:', error)
      alert('챌린지 생성에 실패했습니다.')
    }
  }, [participants, competitionDuration, activeTab, customHours, customMinutes, breakDuration, room?.room_id])

  // 집중도 대결 종료
  const endCompetition = useCallback(async () => {
    if (!isCompetitionActive) return

    // 최종 점수 계산 및 순위 결정
    const finalScores = Object.entries(competitionScores)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score)

    const winner = finalScores[0]?.userId || ''
    const winnerName = participants.find(p => p.user_id === winner)?.user.name || 'Unknown'

    // 대결 기록에 추가
    setCompetitionHistory(prev => [...prev, {
      round: competitionRound,
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
    setIsCompetitionActive(false)
    setIsBreakTime(false)
    setCompetitionTimeLeft(0)
    setCompetitionScores({})
    
    // API를 통해 챌린지 종료
    if (currentChallenge) {
      try {
        await fetch(`/api/social/challenge/${currentChallenge.challenge_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            state: 'ended',
            end_at: new Date().toISOString()
          })
        })
      } catch (error) {
        console.error('챌린지 종료 API 호출 실패:', error)
      }
    }
  }, [isCompetitionActive, competitionScores, competitionRound, competitionDuration, participants, activeTab, breakDuration, currentChallenge])

  // 대결 타이머 (뽀모도로 사이클 포함)
  useEffect(() => {
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
  }, [isCompetitionActive, competitionTimeLeft, endCompetition, activeTab, isBreakTime, breakDuration])



  // 스터디룸 생성 폼
  if (showCreateRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              새로운 스터디룸 만들기
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">룸 이름</label>
              <input
                type="text"
                value={roomForm.name}
                onChange={(e) => setRoomForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 오늘 밤 공부방"
                className="w-full p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">설명</label>
              <textarea
                value={roomForm.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRoomForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="룸에 대한 설명을 입력하세요"
                rows={3}
                className="w-full p-2 border rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">최대 참가자 수</label>
                <input
                  type="number"
                  min="2"
                  max="4"
                  value={roomForm.max_participants}
                  onChange={(e) => setRoomForm(prev => ({ ...prev, max_participants: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">목표 시간 (분)</label>
                <input
                  type="number"
                  min="15"
                  value={roomForm.goal_minutes}
                  onChange={(e) => setRoomForm(prev => ({ ...prev, goal_minutes: parseInt(e.target.value) }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">세션 타입</label>
              <select
                value={roomForm.session_type}
                onChange={(e) => setRoomForm(prev => ({ ...prev, session_type: e.target.value as any }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="study">공부</option>
                <option value="work">업무</option>
                <option value="reading">독서</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateRoom} className="flex-1">
                스터디룸 생성
              </Button>
              <Button variant="outline" onClick={() => setShowCreateRoom(false)}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 스터디룸 메인 화면
  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>스터디룸</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateRoom(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              새 스터디룸 만들기
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 실시간 알림 */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.slice(-3).map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg text-sm text-white max-w-xs ${
                notification.type === 'join' ? 'bg-green-500' : 'bg-gray-500'
              }`}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}

             {/* 챌린지 HUD 오버레이 */}
       {showChallengeHUD && currentChallenge && (
         <ChallengeHUD
           challenge={currentChallenge}
           participants={challengeParticipants}
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
      {showResultPanel && currentChallenge && (
        <ChallengeResultPanel
          challenge={currentChallenge}
          participants={challengeParticipants}
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
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <Hash className="h-6 w-6 text-blue-500" />
                      {room.name}
                    </CardTitle>
                    <p className="text-gray-600 mt-1">{room.description}</p>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {room.current_participants}/{room.max_participants}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {room.goal_minutes}분
                    </div>
                    <Badge variant="secondary">{room.session_type}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Realtime 연결 상태 */}
                  <div className={`flex items-center gap-1 text-xs ${
                    isConnected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {isConnected ? '실시간 연결됨' : '연결 중...'}
                  </div>
                 
                  {isHost && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleEndRoom}
                      disabled={loading}
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      스터디룸 종료
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLeaveRoomWithRealtime}
                    disabled={loading}
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    나가기
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {/* 헤더 하단에 참가자 목록과 컨트롤을 한 줄로 통합 */}
            <CardContent className="pt-0">
              <div className="flex items-center justify-between pt-4 border-t">
                {/* 참가자 목록 */}
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                    <Users className="h-4 w-4 text-blue-500" />
                    참가자 목록
                  </h3>
                  <div className="flex items-center gap-4">
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                        <span className="text-sm text-gray-500">로딩 중...</span>
                      </div>
                    ) : participants.length === 0 ? (
                      <span className="text-sm text-gray-500">아직 참가자가 없습니다</span>
                    ) : (
                      participants.slice(0, 5).map((participant) => {
                        // 현재 사용자의 실제 비디오/마이크 상태 확인
                        const isCurrentUser = participant.user_id === user?.id
                        const actualVideoState = isCurrentUser ? videoRoom.isVideoEnabled : participant.is_video_on
                        const actualMicState = isCurrentUser ? videoRoom.isAudioEnabled : participant.is_mic_on
                        
                        return (
                          <div key={participant.participant_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={participant.user.avatar_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                                {participant.user.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">{participant.user.name}</span>
                              {participant.is_host && <Crown className="h-4 w-4 text-yellow-500" />}
                            </div>
                            
                            {/* 비디오/오디오 상태 표시 */}
                            <div className="flex items-center gap-1 ml-auto">
                              <Badge 
                                variant={actualVideoState ? "default" : "secondary"}
                                className="h-5 px-1"
                              >
                                {actualVideoState ? (
                                  <Video className="h-3 w-3" />
                                ) : (
                                  <VideoOff className="h-3 w-3" />
                                )}
                              </Badge>
                              
                              <Badge 
                                variant={actualMicState ? "default" : "secondary"}
                                className="h-5 px-1"
                              >
                                {actualMicState ? (
                                  <Mic className="h-3 w-3" />
                                ) : (
                                  <MicOff className="h-3 w-3" />
                                )}
                              </Badge>
                            </div>
                          </div>
                        )
                      })
                    )}
                    {participants.length > 5 && (
                      <div className="flex items-center justify-center w-20 h-20 rounded-lg bg-gray-100 border border-gray-200">
                        <span className="text-sm font-medium text-gray-600">+{participants.length - 5}명</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 컨트롤 */}
                <div className="flex items-center gap-3 ml-8">
                  <Button
                    variant={videoRoom.isVideoEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={videoRoom.toggleVideo}
                    className="h-10 px-4"
                    disabled={videoRoom.isConnecting}
                  >
                    {videoRoom.isVideoEnabled ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  </Button>
                  
                  <Button
                    variant={videoRoom.isAudioEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={videoRoom.toggleAudio}
                    className="h-10 px-4"
                    disabled={!videoRoom.isVideoEnabled}
                  >
                    {videoRoom.isAudioEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  
                  <Button variant="outline" size="sm" className="h-10 px-4">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

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
                <Card className="bg-white border-blue-200">
                 <CardHeader>
                   <div className="flex items-center justify-between">
                     <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
                       <Sword className="h-5 w-5 text-blue-600" />
                       ⚔️ 집중도 대결
                     </CardTitle>
                     <div className="flex items-center gap-2">
                                               {isCompetitionActive ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={isBreakTime ? "secondary" : "destructive"} className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {Math.floor(competitionTimeLeft / 60)}:{(competitionTimeLeft % 60).toString().padStart(2, '0')}
                            </Badge>
                            {isBreakTime && (
                              <Badge variant="outline" className="text-xs">
                                ☕ 휴식
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            대기 중
                          </Badge>
                        )}
                       {isHost && (
                         <Button
                           variant={isCompetitionActive ? "destructive" : "default"}
                           size="sm"
                           onClick={isCompetitionActive ? endCompetition : () => setShowCompetitionSettings(true)}
                           className="bg-blue-600 hover:bg-blue-700"
                         >
                           {isCompetitionActive ? (
                             <>
                               <Square className="h-4 w-4 mr-1" />
                               대결 종료
                             </>
                           ) : (
                             <>
                               <Play className="h-4 w-4 mr-1" />
                               대결 시작
                             </>
                           )}
                         </Button>
                       )}
                     </div>
                   </div>
                 </CardHeader>

                <CardContent className="space-y-4">
                                                                                                 {/* 대결 설정 모달 */}
                      {showCompetitionSettings && (
                        <Card className="bg-white border border-gray-200 shadow-lg">
                          <CardContent className="p-6">
                            <div className="space-y-6">
                              <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">⚔️ 집중도 대결 설정</h3>
                                <p className="text-sm text-gray-600">라운드 시간을 설정하고 대결을 시작하세요</p>
                              </div>
                              
                              {/* 탭 네비게이션 */}
                              <div className="flex border-b border-gray-200">
                                <button
                                  onClick={() => setActiveTab('pomodoro')}
                                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                                    activeTab === 'pomodoro'
                                      ? 'text-blue-600 border-b-2 border-blue-600'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  🍅 뽀모도로
                                </button>
                                <button
                                  onClick={() => setActiveTab('custom')}
                                  className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                                    activeTab === 'custom'
                                      ? 'text-blue-600 border-b-2 border-blue-600'
                                      : 'text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  ⚙️ 커스텀
                                </button>
                              </div>
                              
                                                             {/* 뽀모도로 탭 */}
                               {activeTab === 'pomodoro' && (
                                 <div className="space-y-4">
                                   <div className="text-center">
                                     <p className="text-sm text-gray-600 mb-4">뽀모도로 기법에 맞춘 집중 세션을 시작하세요</p>
                                   </div>
                                   <div className="grid grid-cols-2 gap-4">
                                     {[
                                       { 
                                         label: '25분 공부', 
                                         value: 25, 
                                         breakValue: 5,
                                         color: 'bg-orange-50 border-orange-200 text-orange-700', 
                                         desc: '25분 공부 + 5분 휴식',
                                         subDesc: '표준 뽀모도로'
                                       },
                                       { 
                                         label: '50분 공부', 
                                         value: 50, 
                                         breakValue: 10,
                                         color: 'bg-blue-50 border-blue-200 text-blue-700', 
                                         desc: '50분 공부 + 10분 휴식',
                                         subDesc: '긴 뽀모도로'
                                       }
                                     ].map((option) => (
                                       <button
                                         key={option.value}
                                         onClick={() => {
                                           setCompetitionDuration(option.value)
                                           setBreakDuration(option.breakValue)
                                         }}
                                         className={`p-6 rounded-lg border-2 transition-all hover:scale-105 ${
                                           competitionDuration === option.value 
                                             ? `${option.color} ring-2 ring-offset-2 ring-blue-500` 
                                             : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                         }`}
                                       >
                                         <div className="text-xl font-semibold mb-2">{option.label}</div>
                                         <div className="text-sm opacity-75 mb-1">{option.desc}</div>
                                         <div className="text-xs opacity-60">{option.subDesc}</div>
                                       </button>
                                     ))}
                                   </div>
                                   <div className="text-center text-xs text-gray-500">
                                     * 휴식 시간에는 점수 계산이 일시 중단됩니다
                                   </div>
                                 </div>
                               )}
                              
                              {/* 커스텀 탭 */}
                              {activeTab === 'custom' && (
                                <div className="space-y-4">
                                  <div className="text-center">
                                    <p className="text-sm text-gray-600 mb-4">원하는 시간을 직접 설정하여 대결을 시작하세요</p>
                                  </div>
                                  <div className="flex items-center justify-center gap-4">
                                    <div className="text-center">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="23"
                                        value={customHours}
                                        onChange={(e) => setCustomHours(parseInt(e.target.value) || 0)}
                                        className="w-20 p-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                      <div className="text-xs text-gray-500 mt-1">시간</div>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-400">:</div>
                                    <div className="text-center">
                                      <label className="block text-sm font-medium text-gray-700 mb-2">분</label>
                                      <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={customMinutes}
                                        onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 0)}
                                        className="w-20 p-3 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                      <div className="text-xs text-gray-500 mt-1">분</div>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-lg font-semibold text-blue-600">
                                      총 {customHours}시간 {customMinutes}분
                                    </div>
                                    <div className="text-xs text-gray-500">설정된 시간</div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex gap-3 pt-4">
                                <Button 
                                  onClick={startCompetition}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base font-medium"
                                  disabled={activeTab === 'custom' && customHours === 0 && customMinutes === 0}
                                >
                                  <Play className="h-5 w-5 mr-2" />
                                  대결 시작
                                </Button>
                                <Button 
                                  variant="outline" 
                                  onClick={() => setShowCompetitionSettings(false)}
                                  className="flex-1 h-12 text-base font-medium"
                                >
                                  취소
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                                     {/* 실시간 순위 */}
                   {isCompetitionActive && (
                     <div className="space-y-3">
                       <h4 className="font-medium text-blue-700 flex items-center gap-2">
                         <TrendingUp className="h-4 w-4" />
                         실시간 순위
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                         {participants
                           .map(participant => {
                             const score = competitionScores[participant.user_id] || 0
                             return { participant, score, userId: participant.user_id }
                           })
                           .sort((a, b) => b.score - a.score)
                           .map(({ participant, score, userId }, index) => {
                             
                             return (
                               <div 
                                 key={userId} 
                                 className={`p-3 rounded-lg border-2 transition-all ${
                                   index === 0 ? 'border-yellow-400 bg-yellow-50' :
                                   index === 1 ? 'border-gray-300 bg-gray-50' :
                                   index === 2 ? 'border-amber-600 bg-amber-50' :
                                   'border-gray-200 bg-white'
                                 }`}
                               >
                                 <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2">
                                     <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                       index === 0 ? 'bg-yellow-400 text-white' :
                                       index === 1 ? 'bg-gray-400 text-white' :
                                       index === 2 ? 'bg-amber-600 text-white' :
                                       'bg-gray-300 text-gray-700'
                                     }`}>
                                       {index + 1}
                                     </div>
                                     <Avatar className="h-6 w-6">
                                       <AvatarImage src={participant.user.avatar_url} />
                                       <AvatarFallback className="text-xs">
                                         {participant.user.name?.charAt(0) || 'U'}
                                       </AvatarFallback>
                                     </Avatar>
                                     <span className="text-sm font-medium">{participant.user.name}</span>
                                   </div>
                                   <div className="text-right">
                                     <div className="text-lg font-bold text-blue-700">
                                       {Math.round(score)}
                                     </div>
                                     <div className="text-xs text-gray-500">점수</div>
                                   </div>
                                 </div>
                               </div>
                             )
                           })}
                       </div>
                     </div>
                   )}

                                     {/* 대결 기록 */}
                   {competitionHistory.length > 0 && (
                     <div className="space-y-3">
                       <h4 className="font-medium text-blue-700 flex items-center gap-2">
                         <Award className="h-4 w-4" />
                         대결 기록
                       </h4>
                       <div className="space-y-2">
                         {competitionHistory.slice(-3).reverse().map((record, index) => {
                           const winner = participants.find(p => p.user_id === record.winner)
                           return (
                             <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                               <div className="flex items-center gap-2">
                                 <Trophy className="h-4 w-4 text-yellow-500" />
                                                                     <span className="text-sm">
                                      {Math.floor(record.duration / 60)}시간 {record.duration % 60}분 라운드 - {winner?.user.name || 'Unknown'} 우승
                                    </span>
                               </div>
                               <Badge variant="outline" className="text-xs">
                                 {record.round}라운드
                               </Badge>
                             </div>
                           )
                         })}
                       </div>
                     </div>
                   )}

                                       {/* 대결 안내 */}
                    {!isCompetitionActive && competitionHistory.length === 0 && (
                      <div className="text-center py-6 text-gray-600">
                        <Sword className="h-12 w-12 mx-auto text-blue-500 mb-3" />
                        <p className="text-sm">
                          {isHost ? '대결 시작 버튼을 눌러 집중도 대결을 시작하세요!' : '방장이 대결을 시작할 때까지 기다려주세요.'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          각 라운드 동안의 집중도 × 지속시간으로 점수가 계산됩니다
                        </p>
                      </div>
                    )}
                </CardContent>
              </Card>

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
