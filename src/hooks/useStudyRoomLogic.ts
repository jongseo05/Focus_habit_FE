import { useCallback } from 'react'
import type { 
  StudyRoom,
  CreateGroupChallengeData,
  ChallengeInvitation,
  GroupChallenge
} from '@/types/social'

interface UseStudyRoomLogicProps {
  room?: StudyRoom
  userId?: string
  addNotification: (message: string, type?: 'join' | 'leave') => void
  setCurrentGroupChallenges: (challenges: GroupChallenge[] | ((prev: GroupChallenge[]) => GroupChallenge[])) => void
  setGroupChallengeProgressMap: (progressMap: Record<string, any>) => void
  setCurrentInvitation: (invitation: ChallengeInvitation | null) => void
  setShowInvitationPanel: (show: boolean) => void
  setCompetitionHistory: (history: any[]) => void
}

export function useStudyRoomLogic({
  room,
  userId,
  addNotification,
  setCurrentGroupChallenges,
  setGroupChallengeProgressMap,
  setCurrentInvitation,
  setShowInvitationPanel,
  setCompetitionHistory
}: UseStudyRoomLogicProps) {
  
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
  }, [room?.room_id, setCompetitionHistory])

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
  }, [room?.room_id, setCurrentInvitation, setShowInvitationPanel])

  // 그룹 챌린지 로드
  const loadGroupChallenge = useCallback(async () => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/group-challenge?room_id=${room.room_id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.challenges && Array.isArray(data.challenges) && data.challenges.length > 0) {
          setCurrentGroupChallenges(data.challenges)
          setGroupChallengeProgressMap(data.progressMap || {})
        } else {
          setCurrentGroupChallenges([])
          setGroupChallengeProgressMap({})
        }
      } else {
        setCurrentGroupChallenges([])
        setGroupChallengeProgressMap({})
      }
    } catch (error) {
      console.error('그룹 챌린지 로드 중 오류:', error)
      setCurrentGroupChallenges([])
      setGroupChallengeProgressMap({})
    }
  }, [room?.room_id, setCurrentGroupChallenges, setGroupChallengeProgressMap])

  // 그룹 챌린지 생성
  const createGroupChallenge = useCallback(async (data: CreateGroupChallengeData) => {
    try {
      const response = await fetch('/api/social/group-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        const result = await response.json()
        
        // 새 챌린지를 기존 목록에 추가
        setCurrentGroupChallenges((prev: GroupChallenge[]) => [result.challenge, ...prev])
        
        addNotification('새로운 그룹 챌린지가 생성되었습니다!')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || '그룹 챌린지 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('그룹 챌린지 생성 실패:', error)
      throw error
    }
  }, [room, setCurrentGroupChallenges, addNotification])

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
        
        addNotification('그룹 챌린지에 참여했습니다!')
        
        // 참여 후 챌린지 목록 새로고침
        await loadGroupChallenge()
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || '그룹 챌린지 참여에 실패했습니다.'
        
        // 409 Conflict 에러에 대한 특별 처리
        if (response.status === 409) {
          addNotification('이미 참여 중인 챌린지입니다.', 'leave')
          // 이미 참여 중인 경우에도 목록 새로고침
          await loadGroupChallenge()
        } else {
          addNotification(errorMessage)
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('그룹 챌린지 참여 실패:', error)
      throw error
    }
  }, [addNotification, loadGroupChallenge])

  // 그룹 챌린지 탈퇴
  const leaveGroupChallenge = useCallback(async (challengeId: string) => {
    try {
      const response = await fetch(`/api/social/group-challenge/participate?challenge_id=${challengeId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        
        addNotification('그룹 챌린지에서 탈퇴했습니다.', 'leave')
        
        // 탈퇴 후 챌린지 목록 새로고침
        await loadGroupChallenge()
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.error || '그룹 챌린지 탈퇴에 실패했습니다.'
        
        // 404 에러에 대한 특별 처리 (참여 중이 아닌 경우)
        if (response.status === 404) {
          addNotification('참여 중인 챌린지가 아닙니다.', 'leave')
        } else {
          addNotification(errorMessage)
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('그룹 챌린지 탈퇴 실패:', error)
      throw error
    }
  }, [addNotification, loadGroupChallenge])

  // 스터디룸 생성
  const handleCreateRoom = useCallback(async () => {
    if (!userId) return

    try {
      const response = await fetch('/api/social/study-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_id: userId,
          name: '새로운 스터디룸',
          description: '새로 생성된 스터디룸입니다.',
          max_participants: 4,
          session_type: 'study',
          goal_minutes: 60
        })
      })

      if (response.ok) {
        const newRoom = await response.json()
        
        // API 응답 구조에 맞게 룸 데이터 추출
        // createSimpleSuccessResponse는 { success: true, data: room, message: "..." } 형태
        const room = newRoom.data
        
        if (!room || !room.room_id) {
          console.error('생성된 룸 데이터가 올바르지 않습니다:', room)
          console.error('전체 응답 데이터:', newRoom)
          throw new Error('생성된 룸 정보를 가져올 수 없습니다. 서버 응답을 확인해주세요.')
        }
        
        // room_id가 유효한 UUID 형식인지 확인
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(room.room_id)) {
          console.error('유효하지 않은 room_id 형식:', room.room_id)
          throw new Error('생성된 룸 ID가 올바르지 않습니다. 다시 시도해주세요.')
        }
        
        // 룸 생성 후 해당 룸으로 이동
        window.location.href = `/social/room/${room.room_id}`
      }
    } catch (error) {
      console.error('스터디룸 생성 실패:', error)
    }
  }, [userId])

  // 스터디룸 참가
  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (!userId) return

    try {
      const response = await fetch(`/api/social/study-room/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })

      if (response.ok) {
        addNotification('스터디룸에 입장했습니다!')
      }
    } catch (error) {
      console.error('스터디룸 참가 실패:', error)
    }
  }, [userId, addNotification])

  // 그룹 챌린지 삭제
  const deleteGroupChallenge = useCallback(async (challengeId: string) => {
    if (!room?.room_id) return
    
    try {
      const response = await fetch(`/api/social/group-challenge?challenge_id=${challengeId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        // 로컬 상태에서 챌린지 제거
        setCurrentGroupChallenges((prev: GroupChallenge[]) => prev.filter((c: GroupChallenge) => c.challenge_id !== challengeId))
        addNotification('그룹 챌린지가 삭제되었습니다.')
      } else {
        const errorData = await response.json()
        addNotification(`챌린지 삭제 실패: ${errorData.error}`)
      }
    } catch (error) {
      console.error('그룹 챌린지 삭제 중 오류:', error)
      addNotification('챌린지 삭제 중 오류가 발생했습니다.')
    }
  }, [room?.room_id, setCurrentGroupChallenges, addNotification])

  return {
    loadCompetitionHistory,
    loadChallengeInvitation,
    loadGroupChallenge,
    createGroupChallenge,
    joinGroupChallenge,
    leaveGroupChallenge,
    deleteGroupChallenge,
    handleCreateRoom,
    handleJoinRoom
  }
}
