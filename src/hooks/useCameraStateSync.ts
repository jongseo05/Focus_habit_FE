// =====================================================
// 카메라 상태 실시간 동기화 훅 (Supabase Realtime 기반)
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CameraStateUpdateRequest, ParticipantsCameraStateResponse } from '@/types/base'
import type { APIResponse } from '@/types/base'

interface CameraStateMap {
  [userId: string]: {
    is_video_enabled: boolean
    is_audio_enabled: boolean
    updated_at: string
  }
}

interface UseCameraStateSyncProps {
  roomId: string
  userId: string
}

interface UseCameraStateSyncReturn {
  participantsCameraState: CameraStateMap
  updateCameraState: (isVideoEnabled: boolean, isAudioEnabled: boolean) => Promise<boolean>
  syncCameraStates: () => Promise<void>
  isLoading: boolean
  error: string | null
  // 외부에서 실시간 업데이트를 받을 수 있도록 콜백 제공
  handleCameraStateUpdate: (userId: string, isVideoEnabled: boolean, isAudioEnabled: boolean) => void
}

export function useCameraStateSync({
  roomId,
  userId
}: UseCameraStateSyncProps): UseCameraStateSyncReturn {
  const [participantsCameraState, setParticipantsCameraState] = useState<CameraStateMap>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 타임아웃 참조
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // API를 통해 카메라 상태 업데이트
  const updateCameraState = useCallback(async (
    isVideoEnabled: boolean, 
    isAudioEnabled: boolean
  ): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      const requestData: CameraStateUpdateRequest = {
        is_video_enabled: isVideoEnabled,
        is_audio_enabled: isAudioEnabled
      }

      const response = await fetch(`/api/social/study-room/${roomId}/camera-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      const result: APIResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || '카메라 상태 업데이트에 실패했습니다.')
      }

      // 로컬 상태 즉시 업데이트
      setParticipantsCameraState(prev => ({
        ...prev,
        [userId]: {
          is_video_enabled: isVideoEnabled,
          is_audio_enabled: isAudioEnabled,
          updated_at: new Date().toISOString()
        }
      }))

      // 실시간 알림은 useVideoRoom에서 별도로 처리
      
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)
      console.error('카메라 상태 업데이트 오류:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [roomId, userId])

  // 전체 카메라 상태 동기화
  const syncCameraStates = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/social/study-room/${roomId}/camera-state`)
      const result: APIResponse<ParticipantsCameraStateResponse> = await response.json()

      if (!result.success || !result.data) {
        throw new Error(result.error || '카메라 상태 조회에 실패했습니다.')
      }

      // 상태 맵 업데이트
      const newStateMap: CameraStateMap = {}
      result.data.participants.forEach(p => {
        newStateMap[p.user_id] = {
          is_video_enabled: p.is_video_enabled,
          is_audio_enabled: p.is_audio_enabled,
          updated_at: p.camera_updated_at
        }
      })

      setParticipantsCameraState(newStateMap)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      setError(errorMessage)
      console.error('카메라 상태 동기화 오류:', err)
    } finally {
      setIsLoading(false)
    }
  }, [roomId])

  // 다른 참가자의 카메라 상태 변경을 실시간으로 받기 위한 콜백 함수
  // (useVideoRoom에서 useSignaling의 onCameraStateUpdate와 연결)
  const handleCameraStateUpdate = useCallback((
    updatedUserId: string,
    isVideoEnabled: boolean,
    isAudioEnabled: boolean
  ) => {
    if (updatedUserId === userId) return // 자신의 업데이트는 무시

    setParticipantsCameraState(prev => ({
      ...prev,
      [updatedUserId]: {
        is_video_enabled: isVideoEnabled,
        is_audio_enabled: isAudioEnabled,
        updated_at: new Date().toISOString()
      }
    }))
  }, [userId])

  // 초기 동기화
  useEffect(() => {
    if (roomId) {
      syncCameraStates()
    }
  }, [roomId, syncCameraStates])

  // 디바운스된 업데이트 함수
  const debouncedUpdateCameraState = useCallback((
    isVideoEnabled: boolean,
    isAudioEnabled: boolean
  ) => {
    // 기존 타임아웃 클리어
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // 새 타임아웃 설정 (300ms 디바운스)
    updateTimeoutRef.current = setTimeout(() => {
      updateCameraState(isVideoEnabled, isAudioEnabled)
    }, 300)
  }, [updateCameraState])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  return {
    participantsCameraState,
    updateCameraState,
    syncCameraStates,
    isLoading,
    error,
    // 외부에서 실시간 업데이트를 받을 수 있도록 콜백 제공
    handleCameraStateUpdate
  }
}
