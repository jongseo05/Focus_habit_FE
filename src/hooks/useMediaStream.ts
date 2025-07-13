"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export interface MediaStreamState {
  stream: MediaStream | null
  isLoading: boolean
  error: string | null
  isPermissionGranted: boolean
  isPermissionDenied: boolean
}

export interface MediaStreamActions {
  requestPermission: () => Promise<boolean>
  startStream: () => Promise<boolean>
  stopStream: () => void
  resetError: () => void
  retryPermission: () => Promise<boolean>
}

export const useMediaStream = () => {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    isLoading: false,
    error: null,
    isPermissionGranted: false,
    isPermissionDenied: false,
  })

  const streamRef = useRef<MediaStream | null>(null)

  // 권한 상태 확인
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.permissions) {
        return 'unsupported'
      }

      const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return result.state // 'granted', 'denied', 'prompt'
    } catch (error) {
      console.warn('Permission API not supported:', error)
      return 'unknown'
    }
  }, [])

  // 미디어 스트림 요청
  const requestMediaStream = useCallback(async (constraints: MediaStreamConstraints = { video: true }) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      setState(prev => ({
        ...prev,
        stream,
        isLoading: false,
        isPermissionGranted: true,
        isPermissionDenied: false,
        error: null,
      }))

      return stream
    } catch (error: any) {
      console.error('Media stream request failed:', error)
      
      let errorMessage = '카메라 접근에 실패했습니다.'
      let isPermissionDenied = false

      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.'
          isPermissionDenied = true
          break
        case 'NotFoundError':
          errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.'
          break
        case 'NotReadableError':
          errorMessage = '카메라가 다른 애플리케이션에서 사용 중입니다. 다른 앱이나 브라우저 탭에서 카메라를 사용하고 있지 않은지 확인해주세요.'
          break
        case 'OverconstrainedError':
          errorMessage = '요청한 카메라 설정이 지원되지 않습니다.'
          break
        case 'SecurityError':
          errorMessage = '보안상의 이유로 카메라에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.'
          break
        case 'AbortError':
          errorMessage = '카메라 접근이 중단되었습니다.'
          break
        case 'NotSupportedError':
          errorMessage = '이 브라우저에서는 카메라를 지원하지 않습니다.'
          break
        case 'TrackStartError':
          errorMessage = '카메라 트랙을 시작할 수 없습니다.'
          break
        default:
          // "Device in use" 같은 일반적인 오류 메시지도 확인
          if (error.message?.toLowerCase().includes('device in use')) {
            errorMessage = '카메라가 다른 애플리케이션에서 사용 중입니다. 다른 앱이나 브라우저 탭을 닫고 다시 시도해주세요.'
          } else if (error.message?.toLowerCase().includes('permission')) {
            errorMessage = '카메라 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.'
            isPermissionDenied = true
          } else {
            errorMessage = `카메라 접근 오류: ${error.message || '알 수 없는 오류가 발생했습니다.'}`
          }
      }

      setState(prev => ({
        ...prev,
        stream: null,
        isLoading: false,
        error: errorMessage,
        isPermissionGranted: false,
        isPermissionDenied,
      }))

      return null
    }
  }, [])

  // 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const permissionStatus = await checkPermissionStatus()
    
    if (permissionStatus === 'granted') {
      setState(prev => ({ ...prev, isPermissionGranted: true, isPermissionDenied: false }))
      return true
    }

    if (permissionStatus === 'denied') {
      setState(prev => ({
        ...prev,
        isPermissionGranted: false,
        isPermissionDenied: true,
        error: '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.',
      }))
      return false
    }

    // 'prompt' 또는 'unknown' 상태에서는 실제 미디어 요청을 통해 권한 확인
    const stream = await requestMediaStream()
    return stream !== null
  }, [checkPermissionStatus, requestMediaStream])

  // 스트림 시작
  const startStream = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) {
      setState(prev => ({ ...prev, stream: streamRef.current }))
      return true
    }

    const stream = await requestMediaStream()
    return stream !== null
  }, [requestMediaStream])

  // 스트림 중지
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop()
      })
      streamRef.current = null
    }

    setState(prev => ({
      ...prev,
      stream: null,
    }))
  }, [])

  // 에러 리셋
  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // 권한 재요청
  const retryPermission = useCallback(async (): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      error: null,
      isPermissionDenied: false,
    }))
    return await requestPermission()
  }, [requestPermission])

  // 컴포넌트 언마운트 시 스트림 정리
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 스트림 상태 변화 감지
  useEffect(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks()
      
      const handleTrackEnded = () => {
        setState(prev => ({
          ...prev,
          stream: null,
          error: '카메라 연결이 끊어졌습니다.',
        }))
      }

      tracks.forEach(track => {
        track.addEventListener('ended', handleTrackEnded)
      })

      return () => {
        tracks.forEach(track => {
          track.removeEventListener('ended', handleTrackEnded)
        })
      }
    }
  }, [state.stream])

  const actions: MediaStreamActions = {
    requestPermission,
    startStream,
    stopStream,
    resetError,
    retryPermission,
  }

  return {
    ...state,
    ...actions,
  }
}

export default useMediaStream
