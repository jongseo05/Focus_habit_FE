import { useState, useEffect, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useAuth'
import type { PersonalChallenge } from '@/types/social'

interface UsePersonalChallengesReturn {
  challenges: PersonalChallenge[]
  loading: boolean
  error: string | null
  createChallenge: (data: CreatePersonalChallengeData) => Promise<PersonalChallenge | null>
  updateProgress: (challengeId: number, progressValue: number) => Promise<boolean>
  deleteChallenge: (challengeId: number) => Promise<boolean>
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
  const [challenges, setChallenges] = useState<PersonalChallenge[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // 개인 챌린지 목록 조회
  const fetchPersonalChallenges = useCallback(async (forceRefresh = false) => {
    if (!user) {
      console.log('❌ 사용자 정보 없음')
      return []
    }

    try {
      console.log('🌐 API 호출 시작: /api/challenges/personal')
      const response = await fetch('/api/challenges/personal')
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API 응답 오류:', response.status, errorData)
        throw new Error(errorData.error || 'Failed to fetch personal challenges')
      }

      const result = await response.json()
      console.log('✅ API 응답 성공:', result)
      // 표준 API 응답에서 data 필드만 반환
      const challengesData = result.data || result.challenges || []
      console.log('📋 추출된 챌린지 데이터:', challengesData)
      return challengesData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('개인 챌린지 조회 실패:', err)
      return []
    }
  }, [user])

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

  // 페이지 포커스 시 데이터 새로고침 - 제거 (세션 진행 중 불필요한 새로고침 방지)
  // useEffect(() => {
  //   const handleFocus = () => {
  //     if (user) {
  //       refreshChallenges(true)
  //     }
  //   }

  //   const handleVisibilityChange = () => {
  //     if (!document.hidden && user) {
  //       refreshChallenges(true)
  //     }
  //   }

  //   window.addEventListener('focus', handleFocus)
  //   document.addEventListener('visibilitychange', handleVisibilityChange)

  //   return () => {
  //     window.removeEventListener('focus', handleFocus)
  //     document.removeEventListener('visibilitychange', handleVisibilityChange)
  //   }
  // }, [user, refreshChallenges])

  // 개인 챌린지 생성
  const createChallenge = useCallback(async (data: CreatePersonalChallengeData): Promise<PersonalChallenge | null> => {
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

  // 개인 챌린지 진행 상황 업데이트
  const updateProgress = useCallback(async (challengeId: number, progressValue: number): Promise<boolean> => {
    if (!user) return false

    try {
      // 현재 챌린지 정보 가져오기
      const currentChallenge = challenges.find(c => c.id === challengeId)
      if (!currentChallenge) {
        console.error('챌린지를 찾을 수 없음:', challengeId)
        return false
      }

      // 누적 진행률 계산
      const newProgressValue = currentChallenge.current_value + progressValue
      const completionPercentage = Math.min((newProgressValue / currentChallenge.target_value) * 100, 100)
      const isCompleted = newProgressValue >= currentChallenge.target_value

      const response = await fetch('/api/challenges/personal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          challenge_id: challengeId, 
          progress_value: newProgressValue,
          completion_percentage: completionPercentage,
          is_completed: isCompleted
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update progress')
      }

      // 로컬 상태 즉시 업데이트
      setChallenges(prev => prev.map(challenge => 
        challenge.id === challengeId 
          ? { 
              ...challenge, 
              current_value: newProgressValue
            }
          : challenge
      ))
      setLastFetchTime(Date.now())

      console.log(`✅ 챌린지 진행률 업데이트 완료: ${currentChallenge.title}`, {
        previousValue: currentChallenge.current_value,
        addedValue: progressValue,
        newValue: newProgressValue,
        targetValue: currentChallenge.target_value,
        completionPercentage: Math.round(completionPercentage),
        isCompleted
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('진행 상황 업데이트 실패:', err)
      return false
    }
  }, [user, challenges])

  // 개인 챌린지 삭제
  const deleteChallenge = useCallback(async (challengeId: number): Promise<boolean> => {
    if (!user) return false

    try {
      setLoading(true)
      const supabase = supabaseBrowser()
      
      const { error } = await supabase
        .from('personal_challenge')
        .delete()
        .eq('id', challengeId)
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      // 로컬 상태에서 제거
      setChallenges(prev => prev.filter(c => c.id !== challengeId))
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
  // 세션 끝나고나서만 실행되어야 함 (세션 진행 중에는 호출하지 않음)
  const syncFocusSessionProgress = useCallback(async (sessionDuration: number, focusScore: number) => {
    if (!user) return

    try {
      console.log('개인 챌린지 진행률 전체 집계 시작:', {
        sessionDuration,
        focusScore
      })

      // API를 통해 전체 진행사항을 다시 계산
      const response = await fetch('/api/challenges/personal/sync-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_duration: sessionDuration,
          focus_score: focusScore
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ 개인 챌린지 진행률 전체 집계 완료:', result)
        
        // 챌린지 목록 새로고침
        await refreshChallenges()
      } else {
        const errorData = await response.json()
        console.error('❌ 개인 챌린지 진행률 집계 실패:', errorData)
      }
    } catch (error) {
      console.error('집중 세션과 개인 챌린지 연동 실패:', error)
    }
  }, [user, refreshChallenges])

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      console.log('🚀 초기 챌린지 데이터 로드 시작')
      refreshChallenges(true) // 사용자가 로그인되면 항상 데이터 로드
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
