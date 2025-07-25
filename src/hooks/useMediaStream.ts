"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useFocusSessionErrorHandler } from "@/hooks/useFocusSessionErrorHandler"
import { FocusSessionErrorType } from "@/types/focusSession"

export interface MediaStreamState {
  stream: MediaStream | null
  isLoading: boolean
  error: string | null
  isPermissionGranted: boolean
  isPermissionDenied: boolean
  isRecovering: boolean
  lastDisconnection: number | null
}

export interface MediaStreamActions {
  requestPermission: () => Promise<boolean>
  startStream: () => Promise<boolean>
  stopStream: () => void
  resetError: () => void
  retryPermission: () => Promise<boolean>
  recoverCameraStream: () => Promise<boolean>
}

export const useMediaStream = () => {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    isLoading: false,
    error: null,
    isPermissionGranted: false,
    isPermissionDenied: false,
    isRecovering: false,
    lastDisconnection: null,
  })

  const streamRef = useRef<MediaStream | null>(null)

  // 집중 세션 에러 핸들러
  const { handleError, classifyError, state: errorState } = useFocusSessionErrorHandler({
    onError: (error) => {
      setState(prev => ({
        ...prev,
        error: error.message,
        isRecovering: false
      }))
    },
    onRecoveryStart: (errorType) => {
      console.log('[MEDIA_STREAM] 미디어 스트림 복구 시작:', errorType)
      setState(prev => ({
        ...prev,
        isRecovering: true,
        error: null
      }))
    },
    onRecoverySuccess: (errorType) => {
      console.log('[MEDIA_STREAM] 미디어 스트림 복구 성공:', errorType)
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: null
      }))
    },
    onRecoveryFailed: (error) => {
      console.log('[MEDIA_STREAM] 미디어 스트림 복구 실패:', error)
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: error.message
      }))
    }
  })

  // 권한 상태 확인
  const checkPermissionStatus = useCallback(async () => {
    try {
      // 브라우저 환경에서만 실행
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.permissions) {
        return 'unsupported'
      }

      const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return result.state // 'granted', 'denied', 'prompt'
    } catch (error) {
      console.warn('[PERMISSION] Permission API not supported:', error)
      return 'unknown'
    }
  }, [])

  // 미디어 스트림 요청
  const requestMediaStream = useCallback(async (constraints: MediaStreamConstraints = { video: true }) => {
    try {
      // 브라우저 환경에서만 실행
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('브라우저 환경이 아니거나 미디어 디바이스를 지원하지 않습니다.')
      }

      // 이미 유효한 스트림이 있다면 재사용
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => ({
            ...prev,
            stream: streamRef.current,
            isLoading: false,
            isPermissionGranted: true,
            isPermissionDenied: false,
            error: null,
          }))
          return streamRef.current
        }
      }

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

      // 집중 세션 에러 핸들러로 에러 전달
      const sessionError = classifyError(error, 'camera')
      handleError(sessionError)

      return null
    }
  }, [])

  // 권한 요청
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // 이미 권한이 부여되어 있고 스트림이 활성화된 경우 추가 요청 불필요
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => ({ 
            ...prev, 
            isPermissionGranted: true, 
            isPermissionDenied: false, 
            error: null,
            stream: streamRef.current 
          }))
          return true
        }
      }

      const permissionStatus = await checkPermissionStatus()
      
      if (permissionStatus === 'granted') {
        setState(prev => ({ ...prev, isPermissionGranted: true, isPermissionDenied: false, error: null }))
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

      // 'prompt' 또는 'unknown' 상태에서만 실제 미디어 요청을 통해 권한 확인
      const stream = await requestMediaStream({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        }
      })
      const success = stream !== null
      return success
    } catch (error) {
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
    try {
      // 기존 스트림이 있고 유효한지 확인
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          // 이미 유효한 스트림이 있고 상태가 동일하면 불필요한 업데이트 방지
          setState(prev => {
            if (prev.stream === streamRef.current && !prev.error) {
              return prev // 상태 변경하지 않음
            }
            return { ...prev, stream: streamRef.current, error: null }
          })
          return true
        } else {
          // 기존 스트림이 무효하면 정리
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      // 새 스트림 요청 (고해상도로)
      const stream = await requestMediaStream({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        }
      })
      if (stream) {
        setState(prev => ({ ...prev, stream, error: null }))
        return true
      }
      return false
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        stream: null, 
        error: '스트림 시작에 실패했습니다.' 
      }))
      return false
    }
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
      isLoading: true, // 재시도 중임을 표시
    }))
    
    try {
      const result = await requestPermission()
      return result
    } catch (error) {
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

  // 스트림 상태 변화 감지 및 연결 끊김 모니터링
  useEffect(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks()
      
      const handleTrackEnded = () => {
        const disconnectionTime = Date.now()
        
        setState(prev => ({
          ...prev,
          stream: null,
          lastDisconnection: disconnectionTime,
          error: null, // 에러로 처리하지 않음
        }))
        
        // 스트림 레퍼런스도 정리
        streamRef.current = null
        
        // 예기치 않은 연결 끊김으로 판단하여 에러 핸들러 호출
        const cameraError = classifyError(
          new Error('Camera stream ended unexpectedly'), 
          'camera'
        )
        handleError(cameraError)
      }

      const handleTrackMute = () => {
        console.warn('[CAMERA] 카메라 트랙이 음소거되었습니다')
        const cameraError = classifyError(
          new Error('Camera track muted'), 
          'camera'
        )
        handleError(cameraError)
      }

      tracks.forEach(track => {
        track.addEventListener('ended', handleTrackEnded)
        track.addEventListener('mute', handleTrackMute)
      })

      return () => {
        tracks.forEach(track => {
          track.removeEventListener('ended', handleTrackEnded)
          track.removeEventListener('mute', handleTrackMute)
        })
      }
    }
  }, [state.stream, classifyError, handleError])

  // 카메라 연결 끊김 자동 복구
  const recoverCameraStream = useCallback(async (): Promise<boolean> => {
    if (state.isRecovering) return false
    
    setState(prev => ({ ...prev, isRecovering: true, error: null }))
    
    try {
      // 점진적으로 낮은 해상도로 재시도
      const constraints = [
        { video: { width: 1280, height: 720 } },
        { video: { width: 640, height: 480 } },
        { video: { width: 320, height: 240 } },
        { video: true }
      ]
      
      for (const constraint of constraints) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraint)
          streamRef.current = stream
          
          setState(prev => ({
            ...prev,
            stream,
            isLoading: false,
            isRecovering: false,
            isPermissionGranted: true,
            isPermissionDenied: false,
            error: null,
          }))
          
          console.log('[CAMERA] 카메라 스트림 복구 성공:', constraint)
          return true
        } catch (retryError: any) {
          console.warn('[CAMERA] 카메라 복구 재시도:', constraint, retryError.message)
          continue
        }
      }
      
      throw new Error('모든 해상도에서 카메라 복구 실패')
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: '카메라 복구에 실패했습니다.',
        isPermissionGranted: false
      }))
      
      return false
    }
  }, [state.isRecovering])

  const actions: MediaStreamActions = {
    requestPermission,
    startStream,
    stopStream,
    resetError,
    retryPermission,
    recoverCameraStream, // 새로운 복구 액션 추가
  }

  return {
    ...state,
    ...actions,
  }
}

// 마이크 권한 요청 및 상태 관리 훅
export const useMicrophoneStream = () => {
  const [state, setState] = useState<MediaStreamState>({
    stream: null,
    isLoading: false,
    error: null,
    isPermissionGranted: false,
    isPermissionDenied: false,
    isRecovering: false,
    lastDisconnection: null,
  })

  const streamRef = useRef<MediaStream | null>(null)

  const { handleError, classifyError, state: errorState } = useFocusSessionErrorHandler({
    onError: (error) => {
      setState(prev => ({
        ...prev,
        error: error.message,
        isRecovering: false
      }))
    },
    onRecoveryStart: (errorType) => {
      setState(prev => ({
        ...prev,
        isRecovering: true,
        error: null
      }))
    },
    onRecoverySuccess: (errorType) => {
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: null
      }))
    },
    onRecoveryFailed: (error) => {
      setState(prev => ({
        ...prev,
        isRecovering: false,
        error: error.message
      }))
    }
  })

  const checkPermissionStatus = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.permissions) {
        return 'unsupported'
      }
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      return result.state
    } catch (error) {
      return 'unknown'
    }
  }, [])

  const requestMediaStream = useCallback(async (constraints: MediaStreamConstraints = { audio: true }) => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices) {
        throw new Error('브라우저 환경이 아니거나 미디어 디바이스를 지원하지 않습니다.')
      }
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => ({
            ...prev,
            stream: streamRef.current,
            isLoading: false,
            isPermissionGranted: true,
            isPermissionDenied: false,
            error: null,
          }))
          return streamRef.current
        }
      }
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
      let errorMessage = '마이크 접근에 실패했습니다.'
      let isPermissionDenied = false
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.'
          isPermissionDenied = true
          break
        case 'NotFoundError':
          errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.'
          break
        case 'NotReadableError':
          errorMessage = '마이크가 다른 애플리케이션에서 사용 중입니다. 다른 앱이나 브라우저 탭에서 마이크를 사용하고 있지 않은지 확인해주세요.'
          break
        case 'OverconstrainedError':
          errorMessage = '요청한 마이크 설정이 지원되지 않습니다.'
          break
        case 'SecurityError':
          errorMessage = '보안상의 이유로 마이크에 접근할 수 없습니다. HTTPS 연결을 확인해주세요.'
          break
        case 'AbortError':
          errorMessage = '마이크 접근이 중단되었습니다.'
          break
        case 'NotSupportedError':
          errorMessage = '이 브라우저에서는 마이크를 지원하지 않습니다.'
          break
        case 'TrackStartError':
          errorMessage = '마이크 트랙을 시작할 수 없습니다.'
          break
        default:
          if (error.message?.toLowerCase().includes('device in use')) {
            errorMessage = '마이크가 다른 애플리케이션에서 사용 중입니다. 다른 앱이나 브라우저 탭을 닫고 다시 시도해주세요.'
          } else if (error.message?.toLowerCase().includes('permission')) {
            errorMessage = '마이크 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.'
            isPermissionDenied = true
          } else {
            errorMessage = `마이크 접근 오류: ${error.message || '알 수 없는 오류가 발생했습니다.'}`
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
      const sessionError = classifyError(error, 'microphone')
      handleError(sessionError)
      return null
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => ({ 
            ...prev, 
            isPermissionGranted: true, 
            isPermissionDenied: false, 
            error: null,
            stream: streamRef.current 
          }))
          return true
        }
      }
      const permissionStatus = await checkPermissionStatus()
      if (permissionStatus === 'granted') {
        setState(prev => ({ ...prev, isPermissionGranted: true, isPermissionDenied: false, error: null }))
        return true
      }
      if (permissionStatus === 'denied') {
        setState(prev => ({
          ...prev,
          isPermissionGranted: false,
          isPermissionDenied: true,
          error: '마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.',
        }))
        return false
      }
      const stream = await requestMediaStream({ audio: true })
      const success = stream !== null
      return success
    } catch (error) {
      setState(prev => ({
        ...prev,
        isPermissionGranted: false,
        isPermissionDenied: true,
        error: '권한 요청 중 오류가 발생했습니다.',
      }))
      return false
    }
  }, [checkPermissionStatus, requestMediaStream])

  const startStream = useCallback(async (): Promise<boolean> => {
    try {
      if (streamRef.current) {
        const tracks = streamRef.current.getTracks()
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          setState(prev => {
            if (prev.stream === streamRef.current && !prev.error) {
              return prev
            }
            return { ...prev, stream: streamRef.current, error: null }
          })
          return true
        } else {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }
      const stream = await requestMediaStream({ audio: true })
      if (stream) {
        setState(prev => ({ ...prev, stream, error: null }))
        return true
      }
      return false
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        stream: null, 
        error: '스트림 시작에 실패했습니다.' 
      }))
      return false
    }
  }, [requestMediaStream])

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

  const resetError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const retryPermission = useCallback(async (): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      error: null,
      isPermissionDenied: false,
      isLoading: true,
    }))
    try {
      const result = await requestPermission()
      return result
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: '권한 재요청에 실패했습니다.',
      }))
      return false
    }
  }, [requestPermission])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks()
      const handleTrackEnded = () => {
        const disconnectionTime = Date.now()
        setState(prev => ({
          ...prev,
          stream: null,
          lastDisconnection: disconnectionTime,
          error: null,
        }))
        streamRef.current = null
        const micError = classifyError(
          new Error('Microphone stream ended unexpectedly'),
          'microphone'
        )
        handleError(micError)
      }
      const handleTrackMute = () => {
        const micError = classifyError(
          new Error('Microphone track muted'),
          'microphone'
        )
        handleError(micError)
      }
      tracks.forEach(track => {
        track.addEventListener('ended', handleTrackEnded)
        track.addEventListener('mute', handleTrackMute)
      })
      return () => {
        tracks.forEach(track => {
          track.removeEventListener('ended', handleTrackEnded)
          track.removeEventListener('mute', handleTrackMute)
        })
      }
    }
  }, [state.stream, classifyError, handleError])

  const actions: MediaStreamActions = {
    requestPermission,
    startStream,
    stopStream,
    resetError,
    retryPermission,
    recoverCameraStream: async () => false, // 마이크 복구는 별도 구현 필요시 추가
  }

  return {
    ...state,
    ...actions,
  }
}

export default useMediaStream
