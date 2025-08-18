import { useState, useEffect, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useAuth'
import type { GroupChallenge } from '@/types/social'

interface UsePersonalChallengesReturn {
  challenges: GroupChallenge[]
  loading: boolean
  error: string | null
  createChallenge: (data: CreatePersonalChallengeData) => Promise<GroupChallenge | null>
  updateProgress: (challengeId: string, progressValue: number) => Promise<boolean>
  deleteChallenge: (challengeId: string) => Promise<boolean>
  refreshChallenges: () => Promise<void>
  syncFocusSessionProgress: (sessionDuration: number, focusScore: number) => Promise<void>
}

interface CreatePersonalChallengeData {
  title: string
  description?: string
  type: 'focus_time' | 'study_sessions' | 'streak_days' | 'focus_score' | 'custom'
  target_value: number
  unit: string
  duration_days: number
  min_session_duration?: number
}

export function usePersonalChallenges(): UsePersonalChallengesReturn {
  const { data: user } = useUser()
  const [challenges, setChallenges] = useState<GroupChallenge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // 개인 챌린지 목록 조회
  const fetchPersonalChallenges = useCallback(async (forceRefresh = false) => {
    if (!user) return []

    // 마지막 fetch로부터 30초가 지나지 않았다면 캐시된 데이터 사용
    const now = Date.now()
    if (!forceRefresh && now - lastFetchTime < 30000) {
      return challenges
    }

    try {
      const response = await fetch('/api/challenges/personal')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch personal challenges')
      }

      const result = await response.json()
      setLastFetchTime(now)
      // 표준 API 응답에서 data 필드만 반환
      return result.data || result.challenges || []
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('개인 챌린지 조회 실패:', err)
      return []
    }
  }, [user, challenges, lastFetchTime])

  // 개인 챌린지 데이터 새로고침
  const refreshChallenges = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const challengesData = await fetchPersonalChallenges(forceRefresh)
      setChallenges(challengesData)
      
    } catch (error) {
      console.error('개인 챌린지 새로고침 실패:', error)
      setError('Failed to refresh challenges')
      setChallenges([])
    } finally {
      setLoading(false)
    }
  }, [fetchPersonalChallenges])

  // 페이지 포커스 시 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      // 페이지가 다시 포커스되면 데이터 새로고침
      if (user) {
        refreshChallenges(true)
      }
    }

    const handleVisibilityChange = () => {
      // 탭이 다시 보이게 되면 데이터 새로고침
      if (!document.hidden && user) {
        refreshChallenges(true)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, refreshChallenges])

  // 개인 챌린지 생성
  const createChallenge = useCallback(async (data: CreatePersonalChallengeData): Promise<GroupChallenge | null> => {
    if (!user) return null

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/challenges/personal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create personal challenge')
      }

      // 생성된 챌린지를 즉시 로컬 상태에 추가
      const newChallenge = result.data || result.challenge
      if (newChallenge) {
        setChallenges(prev => [newChallenge, ...prev])
        setLastFetchTime(Date.now())
      }

      return newChallenge
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('개인 챌린지 생성 실패:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [user])

  // 진행 상황 업데이트
  const updateProgress = useCallback(async (challengeId: string, progressValue: number): Promise<boolean> => {
    if (!user) return false

    try {
      const response = await fetch('/api/challenges/personal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challenge_id: challengeId, 
          progress_value: progressValue 
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update progress')
      }

      // 로컬 상태 즉시 업데이트
      setChallenges(prev => prev.map(challenge => 
        challenge.challenge_id === challengeId 
          ? { ...challenge, current_value: progressValue }
          : challenge
      ))
      setLastFetchTime(Date.now())

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('진행 상황 업데이트 실패:', err)
      return false
    }
  }, [user])

  // 개인 챌린지 삭제
  const deleteChallenge = useCallback(async (challengeId: string): Promise<boolean> => {
    if (!user) return false

    try {
      setLoading(true)
      const supabase = supabaseBrowser()
      
      const { error } = await supabase
        .from('group_challenge')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('created_by', user.id)
        .eq('challenge_type', 'personal')

      if (error) {
        throw error
      }

      // 로컬 상태에서 제거
      setChallenges(prev => prev.filter(c => c.challenge_id !== challengeId))
      setLastFetchTime(Date.now())

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('개인 챌린지 삭제 실패:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [user])

  // 집중 세션과 개인 챌린지 진행 상황 연동
  const syncFocusSessionProgress = useCallback(async (sessionDuration: number, focusScore: number) => {
    if (!user) return

    try {
      // 내 활성 개인 챌린지들 가져오기
      const activeChallenges = challenges.filter(challenge => {
        const now = new Date()
        const endDate = new Date(challenge.end_date)
        return now <= endDate && challenge.is_active
      })

      if (activeChallenges.length === 0) return

      console.log('개인 챌린지 진행률 업데이트 시작:', {
        sessionDuration,
        focusScore,
        activeChallengesCount: activeChallenges.length
      })

      // 각 챌린지에 대해 진행 상황 업데이트
      for (const challenge of activeChallenges) {
        let progressValue = 0

                 switch (challenge.type) {
           case 'focus_time':
             // 집중 시간 (분 단위)
             progressValue = sessionDuration
             break
           case 'study_sessions':
             // 학습 세션 수 (최소 시간 기준 확인 후 1회 추가)
             const minDuration = challenge.min_session_duration || 30 // 기본값 30분
             if (sessionDuration >= minDuration) {
               progressValue = 1
               console.log(`공부 세션 챌린지 조건 충족: ${sessionDuration}분 >= ${minDuration}분`)
             } else {
               console.log(`공부 세션 챌린지 조건 미충족: ${sessionDuration}분 < ${minDuration}분`)
               continue // 다음 챌린지로
             }
             break
           case 'focus_score':
             // 집중도 점수 (현재 점수로 업데이트)
             progressValue = focusScore
             break
           case 'streak_days':
             // 연속 학습일 (세션 완료 시 1일 추가)
             progressValue = 1
             break
         }

        if (progressValue > 0) {
          await updateProgress(challenge.challenge_id, progressValue)
          console.log(`챌린지 ${challenge.title} 진행률 업데이트:`, {
            type: challenge.type,
            progressValue,
            currentValue: challenge.current_value,
            targetValue: challenge.target_value
          })
        }
      }

      // 챌린지 목록 새로고침
      await refreshChallenges()
    } catch (error) {
      console.error('집중 세션과 개인 챌린지 연동 실패:', error)
    }
  }, [user, challenges, updateProgress, refreshChallenges])

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      refreshChallenges()
    }
  }, [user, refreshChallenges])

  return {
    challenges,
    loading,
    error,
    refreshChallenges,
    createChallenge,
    deleteChallenge,
    updateProgress,
    syncFocusSessionProgress
  }
}
