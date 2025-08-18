'use client'

import { useState, useCallback } from 'react'
import type { Challenge, ChallengeParticipant, ChallengeConfig } from '@/types/social'

interface UseChallengeProps {
  roomId: string
  userId: string
}

interface CreateChallengeData {
  mode: 'pomodoro' | 'custom'
  config: ChallengeConfig
}

export function useChallenge({ roomId, userId }: UseChallengeProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null)
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 챌린지 생성
  const createChallenge = useCallback(async (data: CreateChallengeData) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/social/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          ...data
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create challenge')
      }

      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      const newChallenge = result.data || result.challenge
      
      // challenge_id가 UUID 객체인 경우를 대비하여 문자열로 변환
      if (newChallenge && newChallenge.challenge_id) {
        newChallenge.challenge_id = String(newChallenge.challenge_id)
      }
      
      setCurrentChallenge(newChallenge)
      setChallenges(prev => [newChallenge, ...prev])
      
      return newChallenge
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create challenge'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  // 챌린지 참가
  const joinChallenge = useCallback(async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/social/challenge/${challengeId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to join challenge')
      }

      const result = await response.json()
      const newParticipant = result.participant
      
      setParticipants(prev => [...prev, newParticipant])
      
      return newParticipant
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join challenge'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userId])

  // 챌린지 종료
  const endChallenge = useCallback(async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/social/challenge/${challengeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          state: 'ended',
          end_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to end challenge')
      }

      const result = await response.json()
      const updatedChallenge = result.challenge
      
      // challenge_id가 UUID 객체인 경우를 대비하여 문자열로 변환
      if (updatedChallenge && updatedChallenge.challenge_id) {
        updatedChallenge.challenge_id = String(updatedChallenge.challenge_id)
      }
      
      setCurrentChallenge(prev => 
        prev?.challenge_id === challengeId ? updatedChallenge : prev
      )
      setChallenges(prev => 
        prev.map(c => c.challenge_id === challengeId ? updatedChallenge : c)
      )
      
      return updatedChallenge
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end challenge'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 챌린지 시작
  const startChallenge = useCallback(async (challengeId: string) => {
    console.log('startChallenge 호출됨:', { challengeId, type: typeof challengeId })
    console.log('challengeId 값:', challengeId)
    console.log('challengeId가 문자열인지 확인:', typeof challengeId === 'string')
    
    // challengeId가 문자열이 아니면 문자열로 변환
    const sanitizedChallengeId = typeof challengeId === 'string' ? challengeId : String(challengeId)
    console.log('sanitizedChallengeId:', sanitizedChallengeId)
    console.log('sanitizedChallengeId 타입:', typeof sanitizedChallengeId)
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/social/challenge/${sanitizedChallengeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          state: 'active',
          start_at: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start challenge')
      }

      const result = await response.json()
      const updatedChallenge = result.challenge
      
      // challenge_id가 UUID 객체인 경우를 대비하여 문자열로 변환
      if (updatedChallenge && updatedChallenge.challenge_id) {
        updatedChallenge.challenge_id = String(updatedChallenge.challenge_id)
      }
      
      setCurrentChallenge(prev => {
        console.log('setCurrentChallenge 호출:', {
          prevChallengeId: prev?.challenge_id,
          prevChallengeIdType: typeof prev?.challenge_id,
          targetChallengeId: sanitizedChallengeId,
          targetChallengeIdType: typeof sanitizedChallengeId,
          shouldUpdate: prev?.challenge_id && String(prev.challenge_id) === sanitizedChallengeId
        })
        return prev?.challenge_id && String(prev.challenge_id) === sanitizedChallengeId ? updatedChallenge : prev
      })
      setChallenges(prev => 
        prev.map(c => c.challenge_id && String(c.challenge_id) === sanitizedChallengeId ? updatedChallenge : c)
      )
      
      console.log('챌린지 상태 업데이트 완료:', {
        updatedChallenge,
        updatedChallengeState: updatedChallenge?.state,
        updatedChallengeId: updatedChallenge?.challenge_id
      })
      
      return updatedChallenge
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start challenge'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 챌린지 목록 조회
  const fetchChallenges = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/social/challenge?room_id=${roomId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch challenges')
      }

      const result = await response.json()
      // 표준 API 응답에서 data 필드만 반환
      const challenges = result.data || result.challenges || []
      
      // challenge_id가 UUID 객체인 경우를 대비하여 문자열로 변환
      challenges.forEach((challenge: Challenge) => {
        if (challenge && challenge.challenge_id) {
          challenge.challenge_id = String(challenge.challenge_id)
        }
      })
      
      setChallenges(challenges)
      
      // 가장 최근 활성 챌린지 찾기
      const activeChallenge = challenges.find((c: Challenge) => c.state === 'active')
      if (activeChallenge) {
        setCurrentChallenge(activeChallenge)
      }
      
      return challenges
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch challenges'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [roomId])

  // 챌린지 참가자 조회
  const fetchParticipants = useCallback(async (challengeId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/social/challenge/${challengeId}/participants`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch participants')
      }

      const result = await response.json()
      setParticipants(result.participants || [])
      
      return result.participants
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch participants'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 점수 업데이트
  const updateScore = useCallback(async (challengeId: string, scores: { [key: string]: number }) => {
    try {
      const response = await fetch(`/api/social/challenge/${challengeId}/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update scores')
      }

      const result = await response.json()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update scores'
      setError(errorMessage)
      throw err
    }
  }, [])

  return {
    challenges,
    currentChallenge,
    participants,
    loading,
    error,
    createChallenge,
    joinChallenge,
    endChallenge,
    startChallenge,
    fetchChallenges,
    fetchParticipants,
    updateScore,
    setCurrentChallenge,
    setParticipants
  }
}
