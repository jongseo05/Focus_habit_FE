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
}

interface CreatePersonalChallengeData {
  title: string
  description?: string
  type: 'focus_time' | 'study_sessions' | 'streak_days' | 'focus_score' | 'custom'
  target_value: number
  unit: string
  duration_days: number
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

    // 강제 새로고침이 아니고, 마지막 fetch로부터 30초가 지나지 않았다면 캐시된 데이터 사용
    const now = Date.now()
    if (!forceRefresh && now - lastFetchTime < 30000) {
      return challenges
    }

    try {
      const response = await fetch('/api/challenges/personal')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch personal challenges')
      }

      setLastFetchTime(now)
      return data.challenges || []
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
      if (result.challenge) {
        setChallenges(prev => [result.challenge, ...prev])
        setLastFetchTime(Date.now())
      }

      return result.challenge
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
      setError(null)

      const response = await fetch(`/api/challenges/personal?id=${challengeId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete personal challenge')
      }

      // 로컬 상태에서 즉시 제거
      setChallenges(prev => prev.filter(challenge => challenge.challenge_id !== challengeId))
      setLastFetchTime(Date.now())

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('개인 챌린지 삭제 실패:', err)
      return false
    } finally {
      setLoading(false)
    }
  }, [user])

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
    createChallenge,
    updateProgress,
    deleteChallenge,
    refreshChallenges
  }
}
