import { useState, useRef, useCallback } from 'react'
import type { 
  StudyRoom, 
  ParticipantWithUser,
  CreateStudyRoomData,
  ChallengeInvitation,
  GroupChallenge,
  GroupChallengeProgress,
  CreateGroupChallengeData
} from '@/types/social'

interface UseStudyRoomStateProps {
  room?: StudyRoom
  userId?: string
}

export function useStudyRoomState({ room, userId }: UseStudyRoomStateProps) {
  // 기본 상태
  const [participants, setParticipants] = useState<ParticipantWithUser[]>([])
  const [currentFocusScore, setCurrentFocusScore] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(!room)
  const [loading, setLoading] = useState(false)
  
  // 룸 폼 상태
  const [roomForm, setRoomForm] = useState<CreateStudyRoomData>({
    host_id: userId || '',
    name: '',
    description: '',
    max_participants: 10,
    session_type: 'study',
    goal_minutes: 60
  })

  // 알림 상태
  const [notifications, setNotifications] = useState<Array<{id: string, message: string, type: 'join' | 'leave'}>>([])
  const notificationIdCounter = useRef(0)
  
  // 집중도 대결 관련 상태
  const [competitionDuration, setCompetitionDuration] = useState<number>(25)
  const [competitionTimeLeft, setCompetitionTimeLeft] = useState<number>(0)
  const [competitionScores, setCompetitionScores] = useState<{[key: string]: number}>({})
  const [competitionHistory, setCompetitionHistory] = useState<Array<{
    round: number,
    duration: number,
    scores: {[key: string]: number},
    winner: string
  }>>([])
  const [showCompetitionSettings, setShowCompetitionSettings] = useState(false)
  
  // 타이머 관련 상태
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'custom'>('pomodoro')
  const [customHours, setCustomHours] = useState<number>(0)
  const [customMinutes, setCustomMinutes] = useState<number>(30)
  const [isBreakTime, setIsBreakTime] = useState(false)
  const [breakDuration, setBreakDuration] = useState<number>(5)
  
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
  const [focusSessionStartTime, setFocusSessionStartTime] = useState<number | null>(null)

  // 집중도 히스토리 관리 (참가자별)
  const [focusHistoryMap, setFocusHistoryMap] = useState<Record<string, Array<{
    timestamp: number
    score: number
    confidence: number
  }>>>({})

  // 집중도 히스토리 업데이트 함수
  const updateFocusHistory = useCallback((userId: string, score: number, confidence: number = 0.8) => {
    const timestamp = Date.now()
    setFocusHistoryMap(prev => ({
      ...prev,
      [userId]: [
        ...(prev[userId] || []),
        { timestamp, score, confidence }
      ] // 전체 세션 데이터 유지 (누적 추세 표시)
    }))
  }, [])

  // 참조 변수들
  const initialLoadDoneRef = useRef<boolean>(false)
  const currentRoomIdRef = useRef<string | undefined>(undefined)
  const lastParticipantCountRef = useRef<number>(0)

  // 고유한 알림 ID 생성 함수
  const generateNotificationId = useCallback(() => {
    return `notification-${++notificationIdCounter.current}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 알림 추가 함수 (중복 방지)
  const addNotification = useCallback((message: string, type: 'join' | 'leave' = 'join') => {
    setNotifications(prev => {
      // 동일한 메시지가 이미 있는지 확인
      const isDuplicate = prev.some(notification => 
        notification.message === message && 
        notification.type === type &&
        Date.now() - parseInt(notification.id.split('-')[1]) < 5000 // 5초 내 중복 방지
      )
      
      if (isDuplicate) {
        return prev
      }
      
      return [...prev, {
        id: generateNotificationId(),
        message,
        type
      }]
    })
  }, [generateNotificationId])

  // 알림 제거 함수
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  return {
    // 기본 상태
    participants,
    setParticipants,
    currentFocusScore,
    setCurrentFocusScore,
    isHost,
    setIsHost,
    showCreateRoom,
    setShowCreateRoom,
    loading,
    setLoading,
    
    // 룸 폼 상태
    roomForm,
    setRoomForm,
    
    // 알림 상태
    notifications,
    addNotification,
    removeNotification,
    
    // 집중도 대결 상태
    competitionDuration,
    setCompetitionDuration,
    competitionTimeLeft,
    setCompetitionTimeLeft,
    competitionScores,
    setCompetitionScores,
    competitionHistory,
    setCompetitionHistory,
    showCompetitionSettings,
    setShowCompetitionSettings,
    
    // 타이머 상태
    activeTab,
    setActiveTab,
    customHours,
    setCustomHours,
    customMinutes,
    setCustomMinutes,
    isBreakTime,
    setIsBreakTime,
    breakDuration,
    setBreakDuration,
    
    // HUD 상태
    showChallengeHUD,
    setShowChallengeHUD,
    showResultPanel,
    setShowResultPanel,
    finalScores,
    setFinalScores,
    challengeBadges,
    setChallengeBadges,
    
    // 대결 초대 상태
    currentInvitation,
    setCurrentInvitation,
    showInvitationPanel,
    setShowInvitationPanel,
    
    // 그룹 챌린지 상태
    currentGroupChallenges,
    setCurrentGroupChallenges,
    groupChallengeProgressMap,
    setGroupChallengeProgressMap,
    
    // 집중세션 상태
    isFocusSessionRunning,
    setIsFocusSessionRunning,
    isFocusSessionPaused,
    setIsFocusSessionPaused,
    focusSessionElapsed,
    setFocusSessionElapsed,
    currentSessionId,
    setCurrentSessionId,
    focusSessionTimer,
    setFocusSessionTimer,
    focusSessionStartTime,
    setFocusSessionStartTime,
    
    // 집중도 히스토리 상태
    focusHistoryMap,
    setFocusHistoryMap,
    updateFocusHistory,
    
    // 참조 변수들
    initialLoadDoneRef,
    currentRoomIdRef,
    lastParticipantCountRef
  }
}
