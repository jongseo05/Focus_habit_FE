import { useCallback } from 'react'

interface UseGroupChallengeAutoUpdateProps {
  roomId?: string
}

export function useGroupChallengeAutoUpdate({ roomId }: UseGroupChallengeAutoUpdateProps) {
  // 스터디룸 세션 완료 시 자동으로 챌린지 진행사항 업데이트
  const updateChallengeProgress = useCallback(async (
    sessionDurationMinutes: number,
    focusScore?: number,
    sessionType: string = 'focus'
  ) => {
    if (!roomId) {
      console.log('룸 ID가 없어 챌린지 업데이트를 건너뜁니다.')
      return
    }

    try {
      console.log('자동 챌린지 업데이트 시작:', {
        roomId,
        sessionDurationMinutes,
        focusScore,
        sessionType
      })

      const response = await fetch('/api/social/group-challenge/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          session_duration_minutes: sessionDurationMinutes,
          focus_score: focusScore,
          session_type: sessionType
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('자동 챌린지 업데이트 완료:', result)
        
        if (result.updated_challenges && result.updated_challenges.length > 0) {
          console.log('업데이트된 챌린지:', result.updated_challenges)
        }
      } else {
        const errorData = await response.json()
        console.error('자동 챌린지 업데이트 실패:', errorData)
      }
    } catch (error) {
      console.error('자동 챌린지 업데이트 중 오류:', error)
    }
  }, [roomId])

  // 집중 세션 완료 시 호출
  const onFocusSessionComplete = useCallback(async (
    sessionDurationMinutes: number,
    averageFocusScore?: number
  ) => {
    await updateChallengeProgress(sessionDurationMinutes, averageFocusScore, 'focus')
  }, [updateChallengeProgress])

  // 학습 세션 완료 시 호출
  const onStudySessionComplete = useCallback(async (
    sessionDurationMinutes: number
  ) => {
    await updateChallengeProgress(sessionDurationMinutes, undefined, 'study')
  }, [updateChallengeProgress])

  // 일반 세션 완료 시 호출
  const onSessionComplete = useCallback(async (
    sessionDurationMinutes: number,
    focusScore?: number
  ) => {
    await updateChallengeProgress(sessionDurationMinutes, focusScore, 'general')
  }, [updateChallengeProgress])

  return {
    updateChallengeProgress,
    onFocusSessionComplete,
    onStudySessionComplete,
    onSessionComplete
  }
}
