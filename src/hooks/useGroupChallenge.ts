import { useState, useEffect, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useAuth'
import type { GroupChallenge, ChallengeParticipant } from '@/types/social'

interface GroupProgress {
  total: number
  average: number
  participants_count: number
  goal_value: number
  progress_percentage: number
}

interface UseGroupChallengeReturn {
  // 상태
  challenges: GroupChallenge[]
  myChallenges: GroupChallenge[]
  availableChallenges: GroupChallenge[]
  loading: boolean
  error: string | null
  
  // 액션
  createChallenge: (data: CreateChallengeData) => Promise<GroupChallenge | null>
  joinChallenge: (challengeId: string) => Promise<boolean>
  updateProgress: (challengeId: string, progressValue: number) => Promise<GroupProgress | null>
  refreshChallenges: () => Promise<void>
  
  // 집중 세션 연동
  syncFocusSessionProgress: (sessionDuration: number, focusScore: number) => Promise<void>
  getActiveChallenges: () => GroupChallenge[]
}

interface CreateChallengeData {
  name: string
  description?: string
  goal_type: 'total_hours' | 'total_sessions' | 'average_focus_score'
  goal_value: number
  duration_days: number
}

export function useGroupChallenge(): UseGroupChallengeReturn {
  const { data: user } = useUser()
  const [challenges, setChallenges] = useState<GroupChallenge[]>([])
  const [myChallenges, setMyChallenges] = useState<GroupChallenge[]>([])
  const [availableChallenges, setAvailableChallenges] = useState<GroupChallenge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 챌린지 목록 조회
  const fetchChallenges = useCallback(async (type: 'all' | 'my' | 'available' = 'all') => {
    if (!user) return []

    try {
      const response = await fetch(`/api/social/group-challenge?type=${type}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch challenges')
      }

      return data.challenges || []
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('챌린지 조회 실패:', err)
      return []
    }
  }, [user])

  // 모든 챌린지 데이터 새로고침
  const refreshChallenges = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 대시보드에서는 my 챌린지만 필요하므로 available 쿼리는 제거
      const [myChallengesData, allChallenges] = await Promise.allSettled([
        fetchChallenges('my'),
        fetchChallenges('all')
      ])

      setMyChallenges(myChallengesData.status === 'fulfilled' ? (myChallengesData.value || []) : [])
      setChallenges(allChallenges.status === 'fulfilled' ? (allChallenges.value || []) : [])
      setAvailableChallenges([]) // available 챌린지는 빈 배열로 설정
      
    } catch (error) {
      console.error('챌린지 새로고침 실패:', error)
      setError('Failed to refresh challenges')
      // 개별 쿼리 실패 시에도 가능한 데이터는 설정
      setChallenges([])
      setMyChallenges([])
      setAvailableChallenges([])
    } finally {
      setLoading(false)
    }
  }, [fetchChallenges])

  // 챌린지 생성
  const createChallenge = useCallback(async (data: CreateChallengeData): Promise<GroupChallenge | null> => {
    if (!user) return null

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/social/group-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create challenge')
      }

      // 챌린지 목록 새로고침
      await refreshChallenges()

      return result.challenge
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('챌린지 생성 실패:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [user, refreshChallenges])

  // 챌린지 참가
  const joinChallenge = useCallback(async (challengeId: string): Promise<boolean> => {
    if (!user) return false

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/social/group-challenge/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challenge_id: challengeId })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join challenge')
      }

      // 챌린지 목록 새로고침
      await refreshChallenges()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('챌린지 참가 실패:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [user, refreshChallenges])

  // 진행 상황 업데이트
  const updateProgress = useCallback(async (challengeId: string, progressValue: number): Promise<GroupProgress | null> => {
    if (!user) return null

    try {
      const response = await fetch('/api/social/group-challenge/progress', {
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

      return result.group_progress || null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('진행 상황 업데이트 실패:', err)
      return null
    }
  }, [user])

  // 집중 세션과 챌린지 진행 상황 연동
  const syncFocusSessionProgress = useCallback(async (sessionDuration: number, focusScore: number) => {
    if (!user) return

    try {
      // 내가 참가한 활성 챌린지들 가져오기
      const activeChallenges = myChallenges.filter(challenge => {
        const now = new Date()
        const endDate = new Date(challenge.end_date)
        return now <= endDate && challenge.is_active
      })

      if (activeChallenges.length === 0) return

      // 각 챌린지에 대해 진행 상황 업데이트
      for (const challenge of activeChallenges) {
        let progressValue = 0

        switch (challenge.type) {
          case 'focus_time':
            // 집중 시간 (분 단위)
            progressValue = sessionDuration
            break
          case 'study_sessions':
            // 학습 세션 수 (1회 추가)
            progressValue = 1
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
        }
      }

      // 챌린지 목록 새로고침
      await refreshChallenges()
    } catch (error) {
      console.error('집중 세션과 챌린지 연동 실패:', error)
    }
  }, [user, myChallenges, updateProgress, refreshChallenges])

  // 활성 챌린지 가져오기
  const getActiveChallenges = useCallback(() => {
    const now = new Date()
    return challenges.filter(challenge => {
      const endDate = new Date(challenge.end_date)
      return now <= endDate && challenge.is_active
    })
  }, [challenges])

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      refreshChallenges()
    }
  }, [user, refreshChallenges])

  return {
    challenges,
    myChallenges,
    availableChallenges,
    loading,
    error,
    createChallenge,
    joinChallenge,
    updateProgress,
    refreshChallenges,
    syncFocusSessionProgress,
    getActiveChallenges
  }
}
