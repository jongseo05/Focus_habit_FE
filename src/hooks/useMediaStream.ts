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
    console.log('🎥 [requestMediaStream] Starting...', { constraints })
    
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))
      console.log('🎥 [requestMediaStream] State set to loading')

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      console.log('🎥 [requestMediaStream] Stream obtained successfully', { streamId: stream.id, tracks: stream.getTracks().length })

      setState(prev => ({
        ...prev,
        stream,
        isLoading: false,
        isPermissionGranted: true,
        isPermissionDenied: false,
        error: null,
      }))
      console.log('🎥 [requestMediaStream] State updated: permission granted, stream set')

      return stream
    } catch (error: any) {
      console.error('🎥 [requestMediaStream] FAILED:', error)
      
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
      console.log('🎥 [requestMediaStream] Error state set:', { errorMessage, isPermissionDenied })

      return null
    }
  }, [])

  // 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('🔐 [requestPermission] Starting permission check...')
    
    try {
      const permissionStatus = await checkPermissionStatus()
      console.log('🔐 [requestPermission] Permission status:', permissionStatus)
      
      if (permissionStatus === 'granted') {
        setState(prev => ({ ...prev, isPermissionGranted: true, isPermissionDenied: false, error: null }))
        console.log('🔐 [requestPermission] Permission already granted')
        return true
      }

      if (permissionStatus === 'denied') {
        setState(prev => ({
          ...prev,
          isPermissionGranted: false,
          isPermissionDenied: true,
          error: '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.',
        }))
        console.log('🔐 [requestPermission] Permission denied')
        return false
      }

      console.log('🔐 [requestPermission] Requesting stream to get permission...')
      // 'prompt' 또는 'unknown' 상태에서는 실제 미디어 요청을 통해 권한 확인
      const stream = await requestMediaStream()
      const success = stream !== null
      console.log('🔐 [requestPermission] Stream request result:', success)
      return success
    } catch (error) {
      console.error('🔐 [requestPermission] Permission request failed:', error)
      setState(prev => ({
        ...prev,
        isPermissionGranted: false,
        isPermissionDenied: true,
        error: '권한 요청 중 오류가 발생했습니다.',
      }))
      return false
    }
  }, [checkPermissionStatus, requestMediaStream])

  // 스트림 시작
  const startStream = useCallback(async (): Promise<boolean> => {
    console.log('▶️ [startStream] Starting stream...', { 
      hasExistingStream: !!streamRef.current,
      currentState: { 
        isPermissionGranted: state.isPermissionGranted,
        hasStream: !!state.stream,
        isLoading: state.isLoading 
      }
    })
    
    try {
      // 기존 스트림이 있고 유효한지 확인
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        console.log('▶️ [startStream] Checking existing stream:', { 
          trackCount: tracks.length, 
          readyState: tracks[0]?.readyState 
        })
        
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => ({ ...prev, stream: streamRef.current, error: null }))
          console.log('▶️ [startStream] Using existing valid stream')
          return true
        } else {
          // 기존 스트림이 무효하면 정리
          console.log('▶️ [startStream] Cleaning up invalid existing stream')
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      console.log('▶️ [startStream] Requesting new stream...')
      // 새 스트림 요청
      const stream = await requestMediaStream()
      if (stream) {
        setState(prev => ({ ...prev, stream, error: null }))
        console.log('▶️ [startStream] New stream obtained successfully')
        return true
      }
      console.log('▶️ [startStream] Failed to get new stream')
      return false
    } catch (error) {
      console.error('▶️ [startStream] Failed to start stream:', error)
      setState(prev => ({ 
        ...prev, 
        stream: null, 
        error: '스트림 시작에 실패했습니다.' 
      }))
      return false
    }
  }, [requestMediaStream, state.isPermissionGranted, state.stream, state.isLoading])

  // 스트림 중지
  const stopStream = useCallback(() => {
    console.log('⏹️ [stopStream] Stopping stream...', { 
      hasStream: !!streamRef.current,
      currentState: { hasStream: !!state.stream }
    })
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('⏹️ [stopStream] Stopping track:', track.kind, track.readyState)
        track.stop()
      })
      streamRef.current = null
    }

    setState(prev => ({
      ...prev,
      stream: null,
    }))
    console.log('⏹️ [stopStream] Stream stopped and state cleared')
  }, [state.stream])

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
      isLoading: true, // 재시도 중임을 표시
    }))
    
    try {
      const result = await requestPermission()
      return result
    } catch (error) {
      console.error('Permission retry failed:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: '권한 재요청에 실패했습니다.',
      }))
      return false
    }
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
        console.warn('Camera track ended unexpectedly')
        setState(prev => ({
          ...prev,
          stream: null,
          // 트랙 종료는 에러가 아닌 정상적인 상황일 수 있으므로 에러 메시지를 부드럽게 변경
          error: null, // 에러로 처리하지 않음
        }))
        // 스트림 레퍼런스도 정리
        streamRef.current = null
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
