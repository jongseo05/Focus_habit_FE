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
      
      // 각 쿼리를 개별적으로 실행하여 하나가 실패해도 다른 것들은 성공하도록 함
      const allChallenges = await fetchChallenges('all')
      const myChallengesData = await fetchChallenges('my')
      const availableChallengesData = await fetchChallenges('available')

      setChallenges(allChallenges || [])
      setMyChallenges(myChallengesData || [])
      setAvailableChallenges(availableChallengesData || [])
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
    refreshChallenges
  }
}
