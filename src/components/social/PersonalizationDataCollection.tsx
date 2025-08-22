"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Camera, Play, Square, AlertTriangle, CheckCircle, Clock, Eye, Download, Upload, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useWebSocket } from '@/hooks/useWebSocket'

interface CollectionSession {
  sessionId: string
  phase: 'idle' | 'focus_instruction' | 'focus_collecting' | 'nonfocus_instruction' | 'nonfocus_collecting' | 'processing' | 'completed' | 'error'
  startTime: Date | null
  duration: number
  targetDuration: number
  samplesCollected: number
  focusSamplesCount: number
  nonFocusSamplesCount: number
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor'
  focusData: any[]
  nonFocusData: any[]
}

interface PersonalizationDataCollectionProps {
  onComplete?: (data: { focusDataCount: number; nonFocusDataCount: number }) => void
  onCancel: () => void
  isVisible: boolean
  onProgressUpdate?: (progress: {
    focusSamplesCollected: number
    nonFocusSamplesCollected: number
    focusProgress: number
    nonFocusProgress: number
    currentPhase: 'focus' | 'nonfocus' | 'idle'
  }) => void
}

export const PersonalizationDataCollection = ({
  onComplete,
  onCancel,
  isVisible,
  onProgressUpdate
}: PersonalizationDataCollectionProps) => {
  const { user } = useAuth()
  const [session, setSession] = useState<CollectionSession>({
    sessionId: '',
    phase: 'idle',
    startTime: null,
    duration: 0,
          targetDuration: 60, // 테스트용 1분 (60초)
    samplesCollected: 0,
    focusSamplesCount: 0,
    nonFocusSamplesCount: 0,
    dataQuality: 'good',
    focusData: [],
    nonFocusData: []
  })
  
  const [errorMessage, setErrorMessage] = useState('')
  const [currentDataType, setCurrentDataType] = useState<'focus' | 'nonfocus'>('focus')
  const [isDeleting, setIsDeleting] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameCountRef = useRef(0)
  
  // 직접 WebSocket 연결 및 카메라 관리
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [isCameraError, setIsCameraError] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const isStreamingRef = useRef(false) // ref로 스트리밍 상태 관리
  const [lastFrameAnalysis, setLastFrameAnalysis] = useState<any | null>(null)

  // WebSocket 연결
  const { sendFrame, isConnected, connect } = useWebSocket({
    url: 'wss://focushabit.site/ws/analysis'
  }, {
    onMessage: (message: any) => {
      try {
        console.log('📨 WebSocket 메시지 수신:', message)
        console.log('📨 메시지 타입:', typeof message)
        console.log('📨 메시지 키:', message && typeof message === 'object' ? Object.keys(message) : 'N/A')
        
        // 서버에서 보내는 집중도 분석 응답 형식 처리
        if (message && typeof message === 'object' && 'timestamp' in message && 'eye_status' in message && 'head_pose' in message) {
          console.log('✅ 집중도 분석 결과 감지:', message)
          
          // 분석 결과를 개인화 데이터 형식으로 변환
          const frameData = {
            timestamp: message.timestamp,
            eye_status: {
              status: message.eye_status.status,
              ear_value: message.eye_status.ear_value
            },
            head_pose: {
              pitch: message.head_pose.pitch,
              yaw: message.head_pose.yaw,
              roll: message.head_pose.roll
            }
          }
          
          console.log('🔄 변환된 프레임 데이터:', frameData)
          console.log('🔄 현재 데이터 타입:', currentDataType)
          
          // 현재 데이터 타입에 따라 저장
          saveFrameAnalysisData(frameData, currentDataType)
          setLastFrameAnalysis(message)
        }
        // 기존 형식 처리 (하위 호환성)
        else if (message.type === 'frame_analysis_result') {
          console.log('📨 기존 형식 프레임 분석 결과:', message)
          const analysisData = message.data
          setLastFrameAnalysis(analysisData)
        }
        // 다른 형식의 메시지들도 로깅
        else {
          console.log('📨 처리되지 않은 메시지 형식:', message)
        }
      } catch (error) {
        console.error('프레임 분석 메시지 처리 오류:', error)
        console.error('오류 발생 시점 메시지:', message)
      }
    }
  })

  // WebSocket 연결 상태 확인을 위한 로깅
  useEffect(() => {
    console.log('🔍 WebSocket 연결 상태 확인:', {
      isStreaming,
      lastFrameAnalysis: !!lastFrameAnalysis,
      url: 'wss://focushabit.site/ws/analysis'
    })
  }, [isStreaming, lastFrameAnalysis])

  // 카메라 시작 함수
  const startCamera = useCallback(async () => {
    try {
      setIsCameraError(false)
      setCameraError(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          frameRate: 5
        },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true)
        }
      }
    } catch (error) {
      console.error('[CAMERA] 카메라 접근 실패:', error)
      setIsCameraError(true)
      setCameraError(error instanceof Error ? error.message : '카메라 접근 실패')
    }
  }, [])

  // 카메라 중지 함수
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    
    setIsVideoReady(false)
    setIsStreaming(false)
    isStreamingRef.current = false // ref도 함께 업데이트
  }, [])

  // 프레임 전송 함수
  const sendFrameToServer = useCallback((base64: string) => {
    if (!isConnected) {
      console.warn('[WEBSOCKET] WebSocket not connected')
      return
    }

    if (!sendFrame) {
      console.error('[WEBSOCKET] sendFrame function is not available')
      return
    }

    try {
      console.log('📤 프레임 전송 시작 - 데이터 크기:', Math.round(base64.length / 1024), 'KB')
      sendFrame(base64)
      console.log('📤 프레임 전송 완료')
    } catch (error) {
      console.error('[WEBSOCKET] sendFrame 호출 중 오류:', error)
    }
  }, [isConnected, sendFrame])

  // 스트리밍 시작 함수
  const startStreaming = useCallback(() => {
    if (!isConnected) {
      console.log('[STREAMING] WebSocket not connected, attempting to connect...')
      connect()
      setTimeout(() => {
        if (videoRef.current && isVideoReady) {
          console.log('[STREAMING] WebSocket connection attempt completed, starting streaming...')
          startStreamingInternal()
        }
      }, 1000)
      return
    }

    if (!videoRef.current || !isVideoReady) {
      console.warn('[STREAMING] Cannot start streaming: video not ready')
      return
    }

    startStreamingInternal()
  }, [isConnected, isVideoReady, connect])

  // 내부 스트리밍 시작 함수
  const startStreamingInternal = useCallback(() => {
    if (!videoRef.current || !isVideoReady || !isConnected) {
      console.warn('[STREAMING] Cannot start streaming: video not ready or WebSocket not connected')
      return
    }

    setIsStreaming(true)
    isStreamingRef.current = true // ref 업데이트
    
    // 프프레임 전송 (5fps)
    const interval = setInterval(() => {
      if (!isStreamingRef.current || !videoRef.current || !isConnected) { // ref 값 사용
        clearInterval(interval)
        return
      }

      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx && videoRef.current) {
          canvas.width = videoRef.current.videoWidth
          canvas.height = videoRef.current.videoHeight
          ctx.drawImage(videoRef.current, 0, 0)
          const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
          sendFrameToServer(base64)
        }
      } catch (error) {
        console.error('[STREAMING] Frame capture error:', error)
      }
    }, 200) // 5fps

    // 정리 함수 저장
    return () => clearInterval(interval)
  }, [isVideoReady, isConnected, sendFrameToServer, isStreaming])

  // WebSocket 연결 강제 시작 (개인화 데이터 수집 시)
  useEffect(() => {
    if (session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') {
      // WebSocket 연결이 안 되어 있으면 강제로 연결 시도
      if (!isStreaming && !lastFrameAnalysis) {
        console.log('🔌 WebSocket 연결 강제 시작 시도...')
        startStreaming()
      }
    }
  }, [session.phase, isStreaming, lastFrameAnalysis, startStreaming])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // 웹캠 상태 모니터링
  useEffect(() => {
    if (isCameraError) {
      setErrorMessage(cameraError || '카메라 오류가 발생했습니다.')
      setSession(prev => ({ ...prev, phase: 'error' }))
    }
  }, [isCameraError, cameraError])

  // 페이지 언로드 시 중단된 세션 정리
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (session.sessionId && session.phase !== 'completed' && session.phase !== 'idle') {
        try {
          // navigator.sendBeacon을 사용하여 페이지 언로드 시에도 요청 전송
          const cleanupData = JSON.stringify({
            userId: user?.id,
            sessionId: session.sessionId,
            action: 'delete'
          })
          
          navigator.sendBeacon('/api/personalization/cleanup-incomplete-sessions', cleanupData)
        } catch (error) {
          console.error('페이지 언로드 시 세션 정리 실패:', error)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session.sessionId, session.phase, user?.id])

  // 실제 프레임 분석 데이터 수집
  useEffect(() => {
    if (session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') {
      if (lastFrameAnalysis && lastFrameAnalysis.features) {
        console.log('실제 프레임 분석 데이터 수신:', lastFrameAnalysis)
        console.log('현재 데이터 타입:', currentDataType, '세션 페이즈:', session.phase)
        console.log('프레임 카운터:', frameCountRef.current)
        
        // 실제 분석 데이터를 DB에 저장 (원본 데이터 그대로)
        const frameData = {
          timestamp: lastFrameAnalysis.timestamp || Date.now(),
          eye_status: {
            status: lastFrameAnalysis.features.eyeStatus?.isFocused, // 원본 boolean 값 그대로
            ear_value: lastFrameAnalysis.features.eyeStatus?.confidence || 0.5
          },
          head_pose: {
            pitch: lastFrameAnalysis.features.headPose?.pitch || 0,
            yaw: lastFrameAnalysis.features.headPose?.yaw || 0,
            roll: lastFrameAnalysis.features.headPose?.roll || 0
          }
        }
        
        console.log(`데이터 저장 호출 - 타입: ${currentDataType}, 세션: ${session.sessionId}`)
        saveFrameAnalysisData(frameData, currentDataType)
      }
    }
  }, [lastFrameAnalysis, session.phase, currentDataType])

  // 시뮬레이션 데이터 생성 (폴백용)
  const generateSimulationData = useCallback(() => {
    const focusData = currentDataType === 'focus'
    
    return {
      timestamp: Date.now(),
      eye_status: {
        status: focusData ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.3, // 원본 수치값 (0.0~1.0)
        ear_value: focusData ? 0.25 + Math.random() * 0.1 : 0.15 + Math.random() * 0.15
      },
      head_pose: {
        pitch: focusData ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 60,
        yaw: focusData ? (Math.random() - 0.5) * 20 : (Math.random() - 0.5) * 80,
        roll: focusData ? (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 30
      }
    }
  }, [currentDataType])

  // 데이터 품질 평가 함수 (1000개 샘플 기준)
  const evaluateDataQuality = useCallback((focusCount: number, nonFocusCount: number, totalDuration: number): 'excellent' | 'good' | 'fair' | 'poor' => {
    const totalSamples = focusCount + nonFocusCount
    const durationMinutes = totalDuration / 60
    const samplesPerMinute = totalSamples / durationMinutes
    
    // 1000개 샘플 기준 품질 평가
    if (totalSamples >= 800 && samplesPerMinute >= 15 && Math.abs(focusCount - nonFocusCount) <= 100) {
      return 'excellent'
    } else if (totalSamples >= 600 && samplesPerMinute >= 10) {
      return 'good'
    } else if (totalSamples >= 400 && samplesPerMinute >= 8) {
      return 'fair'
    } else {
      return 'poor'
    }
  }, [])

  // 시뮬레이션 데이터 수집 (실제 데이터가 없을 때만)
  useEffect(() => {
    let simulationInterval: NodeJS.Timeout | null = null
    
    // 실제 프레임 분석이 없을 때만 시뮬레이션 사용
    if ((session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') && !lastFrameAnalysis) {
      console.log('실제 프레임 분석 데이터가 없어 시뮬레이션 모드로 전환')
      simulationInterval = setInterval(() => {
        const frameData = generateSimulationData()
        saveFrameAnalysisData(frameData, currentDataType)
      }, 2000) // 2초마다 데이터 생성
    }
    
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval)
      }
    }
  }, [session.phase, currentDataType, generateSimulationData, lastFrameAnalysis])

  // 타이머 업데이트 및 단계 전환 (5분 제한 적용)
  useEffect(() => {
    if (session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') {
      intervalRef.current = setInterval(() => {
        setSession(prev => {
          const newDuration = prev.duration + 1
          
                     // 30분(1800초) 제한 적용
                        if (newDuration >= prev.targetDuration) {
               // 자동 전환 대신 수동 전환으로 변경
               if (prev.phase === 'focus_collecting') {
                 // 집중 데이터 수집 완료, 비집중 데이터 수집 안내 단계로 전환
                 console.log('집중 데이터 수집 완료 (30분 제한), 비집중 데이터 수집 안내 단계로 전환')
                 setCurrentDataType('nonfocus')
                 setSession(prevState => ({
                   ...prevState,
                   focusSamplesCount: prev.samplesCollected,
                   samplesCollected: 0,
                   duration: 0,
                   phase: 'nonfocus_instruction'
                 }))
                 // 카메라 중지 (비집중 단계에서 새로 시작할 예정)
                 stopCamera()
                 console.log('집중 데이터 수집 완료, 카메라 중지')
                 return { ...prev, duration: 0, phase: 'nonfocus_instruction' }
               } else if (prev.phase === 'nonfocus_collecting') {
                 // 비집중 데이터 수집 완료, 처리 단계로 전환
                                 console.log('비집중 데이터 수집 완료 (30분 제한), 처리 단계로 전환')
                const totalSamples = prev.focusSamplesCount + prev.samplesCollected
                const dataQuality = evaluateDataQuality(
                  prev.focusSamplesCount, 
                  prev.samplesCollected, 
                  prev.targetDuration * 2 // 총 60분
                )
                 setSession(prevState => ({
                   ...prevState,
                   nonFocusSamplesCount: prev.samplesCollected,
                   samplesCollected: totalSamples,
                   dataQuality,
                   phase: 'processing'
                 }))
                 // 카메라 중지
                 stopCamera()
                 console.log('비집중 데이터 수집 완료, 카메라 중지')
                 return { ...prev, duration: 0, phase: 'processing' }
               }
             }
          
          return { ...prev, duration: newDuration }
        })
        
        // 타이머 업데이트 시 진행상황 전달
        setTimeout(() => {
          updateProgressToParent()
        }, 0)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [session.phase])

  // 일시 중지/재개 기능
  const [isPaused, setIsPaused] = useState(false)
  const [pausedDuration, setPausedDuration] = useState(0)
  const pauseStartTimeRef = useRef<number | null>(null)

  const handlePause = () => {
    if (!isPaused) {
      setIsPaused(true)
      pauseStartTimeRef.current = Date.now()
      // 타이머 일시 중지
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  const handleResume = () => {
    if (isPaused) {
      setIsPaused(false)
      if (pauseStartTimeRef.current) {
        const pauseDuration = Math.floor((Date.now() - pauseStartTimeRef.current) / 1000)
        setPausedDuration(prev => prev + pauseDuration)
        pauseStartTimeRef.current = null
      }
      // 타이머 재시작
      if (session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') {
        intervalRef.current = setInterval(() => {
          setSession(prev => {
            const newDuration = prev.duration + 1
            
                         if (newDuration >= prev.targetDuration) {
               // 자동 전환 대신 수동 전환으로 변경
               if (prev.phase === 'focus_collecting') {
                 // 집중 데이터 수집 완료, 비집중 데이터 수집 안내 단계로 전환
                 console.log('집중 데이터 수집 완료, 비집중 데이터 수집 안내 단계로 전환')
                 setCurrentDataType('nonfocus')
                 setSession(prevState => ({
                   ...prevState,
                   focusSamplesCount: prev.samplesCollected,
                   samplesCollected: 0,
                   duration: 0,
                   phase: 'nonfocus_instruction'
                 }))
                 // 카메라 중지 (비집중 단계에서 새로 시작할 예정)
                 stopCamera()
                 console.log('집중 데이터 수집 완료, 카메라 중지')
                 return { ...prev, duration: 0, phase: 'nonfocus_instruction' }
               } else if (prev.phase === 'nonfocus_collecting') {
                 // 비집중 데이터 수집 완료, 처리 단계로 전환
                 console.log('비집중 데이터 수집 완료, 처리 단계로 전환')
                 const totalSamples = prev.focusSamplesCount + prev.samplesCollected
                 const dataQuality = evaluateDataQuality(
                   prev.focusSamplesCount, 
                   prev.samplesCollected, 
                   prev.targetDuration * 2 // 총 10분
                 )
                 setSession(prevState => ({
                   ...prevState,
                   nonFocusSamplesCount: prev.samplesCollected,
                   samplesCollected: totalSamples,
                   dataQuality,
                   phase: 'processing'
                 }))
                 // 카메라 중지
                 stopCamera()
                 console.log('비집중 데이터 수집 완료, 카메라 중지')
                 return { ...prev, duration: 0, phase: 'processing' }
               }
             }
            
            return { ...prev, duration: newDuration }
          })
        }, 1000)
      }
    }
  }

  const handleNextPhase = () => {
    if (session.phase === 'focus_collecting') {
      // 집중 데이터 수집을 수동으로 완료하고 다음 단계로
      console.log('집중 데이터 수집 완료 - 수집된 데이터:', {
        focusSamples: session.samplesCollected,
        focusDataLength: session.focusData.length,
        frameCount: frameCountRef.current
      })
      
      setSession(prev => ({
        ...prev,
        focusSamplesCount: prev.samplesCollected,
        samplesCollected: 0,
        duration: 0,
        phase: 'nonfocus_instruction'
      }))
      setCurrentDataType('nonfocus')
      frameCountRef.current = 0 // 프레임 카운터 초기화
      stopCamera()
      console.log('집중 데이터 수집 완료, 카메라 중지, currentDataType을 nonfocus로 설정')
    } else if (session.phase === 'nonfocus_collecting') {
      // 비집중 데이터 수집을 수동으로 완료하고 처리 단계로
      console.log('비집중 데이터 수집 완료 - 수집된 데이터:', {
        nonFocusSamples: session.samplesCollected,
        nonFocusDataLength: session.nonFocusData.length,
        frameCount: frameCountRef.current
      })
      
      const totalSamples = session.focusSamplesCount + session.samplesCollected
      const dataQuality = evaluateDataQuality(
        session.focusSamplesCount, 
        session.samplesCollected, 
        session.targetDuration * 2 // 총 60분
      )
      setSession(prev => ({
        ...prev,
        nonFocusSamplesCount: prev.samplesCollected,
        samplesCollected: totalSamples,
        dataQuality,
        phase: 'processing'
      }))
      // 카메라 중지
      stopCamera()
      console.log('비집중 데이터 수집 완료, 카메라 중지')
    }
  }

  // 비집중 데이터 수집 시작 시 남은 시간 설정
  const startNonFocusCollection = async () => {
    // 기존 수집된 비집중 시간 확인
    let existingNonFocusTime = 0
    
    try {
      // API에서 기존 데이터 확인
      const response = await fetch(`/api/profile/personalization-model?userId=${user?.id}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        existingNonFocusTime = data.data.actual_non_focus_time || 0
        const maxTotalTime = 3600 // 60분 (1000개씩 수집 가능)
        const remainingNonFocusTime = Math.max(0, maxTotalTime - existingNonFocusTime)
        
        console.log('비집중 데이터 수집 시작 - 남은 시간:', remainingNonFocusTime)
        
        setSession(prev => ({ 
          ...prev, 
          phase: 'nonfocus_collecting',
          targetDuration: remainingNonFocusTime > 0 ? remainingNonFocusTime : 0,
          duration: 0,
          samplesCollected: 0
        }))
        setCurrentDataType('nonfocus')
        frameCountRef.current = 0 // 프레임 카운터 초기화
        setIsPaused(false)
        setPausedDuration(0)
        
        // 카메라 재시작
        try {
          console.log('비집중 데이터 수집을 위한 카메라 재시작...')
          
          // 카메라 권한 확인
          const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName })
          console.log('카메라 권한 상태:', permissions.state)
          
          if (permissions.state === 'denied') {
            throw new Error('카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
          }
          
          // video 요소가 DOM에 렌더링될 때까지 대기
          await new Promise(resolve => setTimeout(resolve, 100))
          
          let videoRenderAttempts = 0
          const maxVideoRenderAttempts = 50
          
          const waitForVideoElement = () => {
            return new Promise<void>((resolve, reject) => {
              const checkVideoRender = () => {
                videoRenderAttempts++
                console.log(`비집중 수집 - video 요소 렌더링 확인 시도 ${videoRenderAttempts}/${maxVideoRenderAttempts}`)
                
                if (videoRef.current) {
                  console.log('비집중 수집 - video 요소가 DOM에 렌더링됨!')
                  resolve()
                } else if (videoRenderAttempts >= maxVideoRenderAttempts) {
                  reject(new Error(`비집중 수집 - video 요소가 DOM에 렌더링되지 않았습니다. (${videoRenderAttempts}회 시도)`))
                } else {
                  setTimeout(checkVideoRender, 100)
                }
              }
              
              checkVideoRender()
            })
          }
          
          await waitForVideoElement()
          console.log('비집중 수집 - video 요소 렌더링 완료, 카메라 재시작')
          
                     // 카메라 재시작
           await startCamera()
           console.log('비집중 수집 - 카메라 재시작 완료')
           
           // WebSocket 스트리밍 재시작
           await new Promise(resolve => setTimeout(resolve, 500)) // 카메라 준비 대기
           startStreaming()
           console.log('비집중 수집 - WebSocket 스트리밍 재시작 완료')
          
        } catch (error) {
          console.error('비집중 데이터 수집을 위한 카메라 재시작 실패:', error)
          setErrorMessage(error instanceof Error ? error.message : '카메라를 재시작할 수 없습니다.')
          setSession(prev => ({ ...prev, phase: 'error' }))
        }
      }
    } catch (error) {
      console.error('기존 비집중 데이터 확인 실패:', error)
      // 기본값으로 설정
      setSession(prev => ({ 
        ...prev, 
        phase: 'nonfocus_collecting',
        targetDuration: 3599, // 기본 59분 59초 (1000개 수집)
        duration: 0,
        samplesCollected: 0
      }))
      setCurrentDataType('nonfocus')
      frameCountRef.current = 0 // 프레임 카운터 초기화
      setIsPaused(false)
      setPausedDuration(0)
      
      // 기본값으로 설정했을 때도 카메라 재시작 시도
      try {
        console.log('기본값 설정 후 카메라 재시작 시도...')
        await startCamera()
        console.log('기본값 설정 후 카메라 재시작 완료')
      } catch (cameraError) {
        console.error('기본값 설정 후 카메라 재시작 실패:', cameraError)
        setErrorMessage(cameraError instanceof Error ? cameraError.message : '카메라를 재시작할 수 없습니다.')
        setSession(prev => ({ ...prev, phase: 'error' }))
      }
    }
  }

  // 프레임 데이터 저장 (메모리에만 저장, DB 저장 안함)
  const saveFrameAnalysisData = async (frameData: any, dataType: 'focus' | 'nonfocus') => {
    try {
      console.log(`프레임 데이터 메모리 저장 - 타입: ${dataType}, 세션: ${session.sessionId}`)
      console.log('저장할 프레임 데이터:', frameData)
      
      // 데이터를 세션 상태에만 저장 (DB 저장 안함)
      if (dataType === 'focus') {
        setSession(prev => {
          const newFocusData = [...prev.focusData, frameData]
          console.log(`Focus 데이터 업데이트: ${prev.focusData.length}개 → ${newFocusData.length}개`)
          return {
            ...prev,
            focusData: newFocusData,
            samplesCollected: prev.samplesCollected + 1
          }
        })
      } else {
        setSession(prev => {
          const newNonFocusData = [...prev.nonFocusData, frameData]
          console.log(`NonFocus 데이터 업데이트: ${prev.nonFocusData.length}개 → ${newNonFocusData.length}개`)
          return {
            ...prev,
            nonFocusData: newNonFocusData,
            samplesCollected: prev.samplesCollected + 1
          }
        })
      }

      frameCountRef.current += 1
      
      // 실시간 진행상황 업데이트
      updateProgressToParent()
      
      // 데이터 개수 로깅
      console.log(`${dataType} 데이터 메모리 저장 완료: ${frameCountRef.current}개`)
      
    } catch (error) {
      console.error('프레임 데이터 메모리 저장 오류:', error)
      console.error('오류 발생 시점 데이터:', { dataType, frameData, sessionId: session.sessionId })
    }
  }

  // 부모 컴포넌트에 진행상황 전달 (시간 기반)
  const updateProgressToParent = () => {
    if (onProgressUpdate) {
      // 시간 기반 진행률 계산 (5분 기준)
      const focusProgress = session.phase === 'focus_collecting' 
        ? Math.round(getProgressPercentage(session.duration, session.targetDuration))
        : session.phase === 'nonfocus_collecting' || session.phase === 'nonfocus_instruction'
        ? 100
        : 0
        
      const nonFocusProgress = session.phase === 'nonfocus_collecting'
        ? Math.round(getProgressPercentage(session.duration, session.targetDuration))
        : session.phase === 'focus_collecting' || session.phase === 'focus_instruction'
        ? 0
        : 0

      // 샘플 수를 시간으로 변환 (2초마다 1개 샘플 가정)
      const focusSamplesCollected = session.focusSamplesCount + (session.phase === 'focus_collecting' ? session.samplesCollected : 0)
      const nonFocusSamplesCollected = session.nonFocusSamplesCount + (session.phase === 'nonfocus_collecting' ? session.samplesCollected : 0)

      onProgressUpdate({
        focusSamplesCollected,
        nonFocusSamplesCollected,
        focusProgress,
        nonFocusProgress,
        currentPhase: session.phase === 'focus_collecting' ? 'focus' : 
                     session.phase === 'nonfocus_collecting' ? 'nonfocus' : 'idle'
      })
    }
  }

  // 메모리 데이터를 DB에 한 번에 저장
  const saveAllDataToDatabase = async () => {
    try {
      console.log('메모리 데이터를 DB에 한 번에 저장 시작...')
      
      const allData = [
        ...session.focusData.map(data => ({
          dataType: 'focus' as const,
          timestamp: new Date(data.timestamp).toISOString(),
          eyeStatus: data.eye_status.status,
          earValue: data.eye_status.ear_value,
          headPosePitch: data.head_pose.pitch,
          headPoseYaw: data.head_pose.yaw,
          headPoseRoll: data.head_pose.roll,
        })),
        ...session.nonFocusData.map(data => ({
          dataType: 'nonfocus' as const,
          timestamp: new Date(data.timestamp).toISOString(),
          eyeStatus: data.eye_status.status,
          earValue: data.eye_status.ear_value,
          headPosePitch: data.head_pose.pitch,
          headPoseYaw: data.head_pose.yaw,
          headPoseRoll: data.head_pose.roll,
        }))
      ]

      console.log(`총 ${allData.length}개의 데이터를 DB에 저장 중...`)
      console.log('저장할 데이터 샘플:', allData.slice(0, 2))
      console.log('eyeStatus 값들:', allData.map(item => item.eyeStatus))

      // 배치로 DB에 저장
      const requestBody = {
        userId: user?.id,
        sessionId: session.sessionId,
        data: allData
      }
      
      console.log('API 요청 데이터:', requestBody)
      
      const response = await fetch('/api/personalization/save-frame-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      console.log('API 응답 상태:', response.status, response.statusText)
      
      if (response.ok) {
        const result = await response.json()
        console.log('API 응답 성공:', result)
        console.log('모든 데이터가 DB에 저장되었습니다.')
        return true
      } else {
        const errorText = await response.text()
        console.error('데이터 저장 실패:', errorText)
        console.error('응답 상태:', response.status, response.statusText)
        throw new Error(`데이터 저장에 실패했습니다. (${response.status})`)
      }
    } catch (error) {
      console.error('메모리 데이터 DB 저장 오류:', error)
      throw error
    }
  }

  // JSON 파일 생성 및 ZIP 압축
  const createDataFiles = useCallback(async () => {
    try {
      // JSON 파일 생성
      const focusJson = JSON.stringify(session.focusData, null, 2)
      const nonFocusJson = JSON.stringify(session.nonFocusData, null, 2)

      // JSZip 라이브러리 동적 import
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // JSON 파일들을 ZIP에 추가
      zip.file('focus.json', focusJson)
      zip.file('nonfocus.json', nonFocusJson)

      // ZIP 파일 생성
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      
      return zipBlob
    } catch (error) {
      console.error('데이터 파일 생성 오류:', error)
      throw error
    }
  }, [session.focusData, session.nonFocusData])

  // Presigned URL 요청
  const getPresignedUrl = async (fileName: string) => {
    try {
      const response = await fetch('/api/v1/storage/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          file_name: fileName
        })
      })

      if (!response.ok) {
        throw new Error('Presigned URL 요청 실패')
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Presigned URL 요청 오류:', error)
      throw error
    }
  }

  // Supabase Storage에 파일 업로드
  const uploadToStorage = async (presignedUrl: string, file: Blob) => {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/zip',
        }
      })

      if (!response.ok) {
        throw new Error('파일 업로드 실패')
      }

      return response
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      throw error
    }
  }

  const startDataCollection = async () => {
    // 기존 수집된 데이터 확인
    let existingFocusTime = 0
    let existingNonFocusTime = 0
    
    try {
      const response = await fetch(`/api/profile/personalization-model?userId=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          existingFocusTime = data.data.actual_focus_time || 0
          existingNonFocusTime = data.data.actual_non_focus_time || 0
          console.log('기존 수집 시간 확인:', { existingFocusTime, existingNonFocusTime })
        }
      }
    } catch (error) {
      console.error('기존 데이터 확인 실패:', error)
    }

    // 남은 수집 가능 시간 계산 (최대 1000개씩 = 약 60분 = 3600초)
const maxTotalTime = 3600 // 약 60분 (1000개씩 수집)
    const remainingFocusTime = Math.max(0, maxTotalTime - existingFocusTime)
    const remainingNonFocusTime = Math.max(0, maxTotalTime - existingNonFocusTime)
    
    console.log('남은 수집 가능 시간:', { remainingFocusTime, remainingNonFocusTime })

    const sessionId = `personalization_${user?.id}_${Date.now()}`
    setSession(prev => ({
      ...prev,
      sessionId,
      phase: 'focus_collecting',
      startTime: new Date(),
      duration: 0,
      targetDuration: remainingFocusTime > 0 ? remainingFocusTime : 0, // 남은 시간만큼만 설정
      samplesCollected: 0,
      focusSamplesCount: 0,
      nonFocusSamplesCount: 0,
      focusData: [],
      nonFocusData: []
    }))
         setErrorMessage('')
     frameCountRef.current = 0
     setCurrentDataType('focus')
     console.log('집중 데이터 수집 시작 - currentDataType을 focus로 설정')
     // 일시 중지 상태 초기화
     setIsPaused(false)
     setPausedDuration(0)
     console.log('데이터 수집 시작 - 남은 시간만큼만 수집:', remainingFocusTime)

    // 바로 카메라 시작
    try {
      console.log('자동 카메라 시작 시도...')

      // 카메라 권한 확인
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName })
      console.log('카메라 권한 상태:', permissions.state)

      if (permissions.state === 'denied') {
        throw new Error('카메라 접근이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.')
      }

      // video 요소가 DOM에 렌더링될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 100))

      let videoRenderAttempts = 0
      const maxVideoRenderAttempts = 50

      const waitForVideoElement = () => {
        return new Promise<void>((resolve, reject) => {
          const checkVideoRender = () => {
            videoRenderAttempts++
            console.log(`video 요소 렌더링 확인 시도 ${videoRenderAttempts}/${maxVideoRenderAttempts}`)

            if (videoRef.current) {
              console.log('video 요소가 DOM에 렌더링됨!')
              resolve()
            } else if (videoRenderAttempts >= maxVideoRenderAttempts) {
              reject(new Error(`video 요소가 DOM에 렌더링되지 않았습니다. (${videoRenderAttempts}회 시도)`))
            } else {
              setTimeout(checkVideoRender, 100)
            }
          }

          checkVideoRender()
        })
      }

      await waitForVideoElement()
      console.log('video 요소 렌더링 완료, 카메라 시작')

             // 카메라 시작
       await startCamera()
       console.log('카메라 시작 완료')
       
       // WebSocket 스트리밍 시작
       await new Promise(resolve => setTimeout(resolve, 500)) // 카메라 준비 대기
       startStreaming()
       console.log('WebSocket 스트리밍 시작 완료, 데이터 수집 시작')

    } catch (error) {
      console.error('자동 카메라 시작 실패:', error)
      setErrorMessage(error instanceof Error ? error.message : '카메라를 시작할 수 없습니다.')
      setSession(prev => ({ ...prev, phase: 'error' }))
    }
  }

  useEffect(() => {
    if (session.phase === 'processing') {
      processCollectedData()
    }
  }, [session.phase])

  const processCollectedData = async () => {
    try {
      stopCamera()
      
      // 1. 메모리 데이터를 DB에 한 번에 저장
      console.log('메모리 데이터를 DB에 저장 중...')
      await saveAllDataToDatabase()
      
      // 2. JSON 파일 생성 및 ZIP 압축
      console.log('데이터 파일 생성 중...')
      const zipBlob = await createDataFiles()
      
             // 2. Presigned URL 요청
       console.log('Presigned URL 요청 중...')
       const fileName = `${user?.id}_data.zip`
       const presignedResult = await getPresignedUrl(fileName)
      
      // 3. Supabase Storage에 업로드
      console.log('파일 업로드 중...')
      await uploadToStorage(presignedResult.presigned_url, zipBlob)
      
      console.log('파일 업로드 완료:', presignedResult.storage_path)
      
      // 4. 개인화 모델 학습 시작 요청
      console.log('개인화 모델 학습 시작 요청 중...')
      const trainResponse = await fetch('/api/v1/models/train-personal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          storage_path: presignedResult.storage_path
        })
      })

      const trainResult = await trainResponse.json()

      if (trainResponse.ok) {
        setSession(prev => ({ ...prev, phase: 'completed' }))
        
        if (onComplete) {
          onComplete({
            focusDataCount: session.focusData.length,
            nonFocusDataCount: session.nonFocusData.length
          })
        }
        
        console.log('개인화 모델 학습 요청 완료:', trainResult.message)
      } else {
        throw new Error(trainResult.error || '개인화 모델 학습 요청 실패')
      }
    } catch (error) {
      console.error('데이터 처리 오류:', error)
      setErrorMessage(error instanceof Error ? error.message : '데이터 처리 중 오류가 발생했습니다')
      setSession(prev => ({ ...prev, phase: 'error' }))
    }
  }

  // 모든 개인화 데이터 삭제
  const handleDeleteAllData = async () => {
    if (!confirm('정말로 모든 개인화 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/personalization/delete-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert('모든 개인화 데이터가 삭제되었습니다.')
        // 세션 상태 초기화
        setSession(prev => ({
          ...prev,
          phase: 'idle',
          sessionId: '',
          startTime: null,
          duration: 0,
          targetDuration: 3600,
          samplesCollected: 0,
          focusSamplesCount: 0,
          nonFocusSamplesCount: 0,
          focusData: [],
          nonFocusData: []
        }))
        setCurrentDataType('focus')
        frameCountRef.current = 0
        setErrorMessage('')
      } else {
        throw new Error(result.error || '데이터 삭제 실패')
      }
    } catch (error) {
      console.error('데이터 삭제 오류:', error)
      alert(error instanceof Error ? error.message : '데이터 삭제 중 오류가 발생했습니다.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    stopCamera()
    
    // 중단된 세션 데이터 정리
    if (session.sessionId && session.phase !== 'completed' && session.phase !== 'idle') {
      try {
        console.log('중단된 세션 데이터 정리 중...')
        
        const response = await fetch('/api/personalization/cleanup-incomplete-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user?.id,
            sessionId: session.sessionId,
            action: 'delete' // 또는 'mark_incomplete'로 변경 가능
          })
        })

        if (response.ok) {
          console.log('중단된 세션 데이터 정리 완료')
        } else {
          console.error('세션 데이터 정리 실패:', await response.text())
        }
      } catch (error) {
        console.error('세션 데이터 정리 중 오류:', error)
      }
    }
    
    onCancel()
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 시간 기반 진행률 계산 (00:00 ~ 05:00) - 이제 getProgressPercentage로 대체됨
  const getTimeProgress = (currentSeconds: number, targetSeconds: number) => {
    return Math.min((currentSeconds / targetSeconds) * 100, 100)
  }

  // 시간 표시 형식 (00:00 ~ 05:00)
  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 남은 시간 계산
  const getRemainingTime = (currentSeconds: number, targetSeconds: number) => {
    const remaining = Math.max(0, targetSeconds - currentSeconds)
    return remaining
  }

  // 진행률 퍼센트 계산 (0~100%)
  const getProgressPercentage = (currentSeconds: number, targetSeconds: number) => {
    return Math.min((currentSeconds / targetSeconds) * 100, 100)
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <Card className="w-full max-w-lg bg-white shadow-xl max-h-[90vh] overflow-hidden">
        <CardHeader className="pb-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Camera className="h-4 w-4 text-blue-600" />
              개인화 모델 데이터 수집
            </CardTitle>
                             {(session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') && (
               <div className="text-sm font-medium text-gray-600">
                   {formatTimeDisplay(session.duration)} / {formatTimeDisplay(session.targetDuration)}
                   <span className="ml-2 text-blue-600">
                     (남은 시간: {formatTimeDisplay(getRemainingTime(session.duration, session.targetDuration))})
                   </span>
                 {pausedDuration > 0 && (
                   <span className="ml-2 text-orange-600">
                     (일시 중지: {formatTimeDisplay(pausedDuration)})
                   </span>
                 )}
                 {isPaused && (
                   <span className="ml-2 text-orange-600 font-bold">
                     ⏸️ 일시 중지됨
                   </span>
                 )}
                 </div>
               )}
            </div>
        </CardHeader>

        <CardContent className="space-y-4 px-4 pb-4 max-h-[calc(90vh-120px)] overflow-y-auto">

          {/* 전체 진행상황 표시 */}
          {(session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-medium text-gray-700">전체 진행상황</h4>
                <span className="text-xs text-gray-500">
                  {session.phase === 'focus_collecting' ? '1/2 단계' : '2/2 단계'}
                </span>
              </div>
              
          {/* 전체 단계 진행률 */}
               <div className="space-y-2">
                 <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-600">전체 단계 진행률</span>
                   <span className="font-medium text-blue-600">
                     {session.phase === 'focus_collecting' ? '50%' : '100%'}
                   </span>
                 </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                     <div 
                       className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                       style={{ 
                         width: `${session.phase === 'focus_collecting' ? '50' : '100'}%` 
                       }}
                     />
                   </div>
                                     <div className="flex justify-between text-xs text-gray-500">
                    <span>00:00</span>
                    <span>15:00</span>
                    <span>29:59</span>
                  </div>
               </div>
              
              {/* 현재 단계별 진행률 */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-green-600">집중 데이터</span>
                    <span className="text-green-600 font-medium">
                      {session.phase === 'focus_collecting'
                        ? Math.round((session.duration / session.targetDuration) * 100)
                        : 100
                      }%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-green-500 h-1 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${session.phase === 'focus_collecting'
                          ? Math.min((session.duration / session.targetDuration) * 100, 100)
                          : 100
                        }%`
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-orange-600">비집중 데이터</span>
                    <span className="text-orange-600 font-medium">
                      {session.phase === 'nonfocus_collecting'
                        ? Math.round((session.duration / session.targetDuration) * 100)
                        : session.phase === 'focus_collecting' ? 0 : 100
                      }%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-orange-500 h-1 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${session.phase === 'nonfocus_collecting'
                          ? Math.min((session.duration / session.targetDuration) * 100, 100)
                          : session.phase === 'focus_collecting' ? 0 : 100
                        }%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 집중 데이터 수집 단계 */}
          {session.phase === 'focus_collecting' && (
            <div className="space-y-2">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video bg-black rounded-lg"
                />
                
                {/* 간단한 상태 표시 */}
                <div className="absolute top-3 left-3">
                  <div className={`w-3 h-3 rounded-full ${
                    isVideoReady ? 'bg-green-500' : isCameraError ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                </div>
                
                {/* 웹캠 권한 안내 */}
                {!isVideoReady && !isCameraError && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white p-6">
                      <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h4 className="font-medium text-lg mb-2">카메라 준비 중</h4>
                      <p className="text-gray-300 text-sm">
                        웹캠 접근 권한을 확인하고 있습니다
                      </p>
                    </div>
                  </div>
                )}

                {/* 일시 중지 오버레이 */}
                {isPaused && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white p-6">
                      <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                      <h4 className="font-medium text-lg mb-2">일시 중지됨</h4>
                      <p className="text-gray-300 text-sm">
                        재개 버튼을 눌러 계속 진행하세요
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 진행상황 프로그레스 바 */}
              <div className="space-y-1">
                                 <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-600">집중 데이터 수집 진행률</span>
                   <span className="font-medium text-green-600">
                     {formatTimeDisplay(session.duration)} / {formatTimeDisplay(session.targetDuration)}
                     <span className="ml-1 text-gray-500">
                       ({Math.round(getProgressPercentage(session.duration, session.targetDuration))}%)
                     </span>
                   </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2">
                   <div
                     className="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out"
                     style={{
                       width: `${getProgressPercentage(session.duration, session.targetDuration)}%`
                     }}
                   />
                 </div>
                 <div className="flex justify-between text-xs text-gray-500">
                   <span>00:00</span>
                   <span>15:00</span>
                   <span>29:59</span>
                 </div>
              </div>
              
             {/* 집중 단계 안내 */}
               <div className="text-center space-y-1">
                 <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 text-green-700">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                   <span className="text-xs font-medium">
                     {isPaused ? '집중 데이터 수집 일시 중지' : '집중 데이터 수집 중'}
                   </span>
                 </div>
                                   <p className="text-xs text-gray-600">
                    책상에 앉아서 집중하는 모습을 보여주세요<br />
                    <span className="text-blue-600 font-medium">
                      {session.targetDuration > 0 
                        ? `최대 ${formatTimeDisplay(session.targetDuration)}(00:00~${formatTimeDisplay(session.targetDuration)}) 동안 데이터를 수집합니다`
                        : '이미 충분한 집중 데이터가 수집되었습니다'
                      }
                    </span>
                  </p>
                 <div className="bg-blue-50 rounded-lg p-2 mt-2">
                   <p className="text-xs text-blue-700">
                     <strong>진행률:</strong> {Math.round(getProgressPercentage(session.duration, session.targetDuration))}% 
                     ({formatTimeDisplay(session.duration)} / {formatTimeDisplay(session.targetDuration)})<br />
                     <strong>남은 시간:</strong> {formatTimeDisplay(getRemainingTime(session.duration, session.targetDuration))}
                   </p>
                 </div>
                 {isPaused && (
                   <p className="text-xs text-orange-600 font-medium">
                     ⏸️ 일시 중지됨 - 재개 버튼으로 계속 진행
                   </p>
                 )}
               </div>
            </div>
          )}

          {/* 비집중 데이터 수집 단계 */}
          {session.phase === 'nonfocus_collecting' && (
            <div className="space-y-2">
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full aspect-video bg-black rounded-lg"
                />

                {/* 간단한 상태 표시 */}
                <div className="absolute top-2 left-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isVideoReady ? 'bg-green-500' : isCameraError ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                </div>

                {/* 일시 중지 오버레이 */}
                {isPaused && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg">
                    <div className="text-center text-white p-4">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <h4 className="font-medium text-base mb-2">일시 중지됨</h4>
                      <p className="text-gray-300 text-xs">
                        재개 버튼을 눌러 계속 진행하세요
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 진행상황 프로그레스 바 */}
              <div className="space-y-1">
                                 <div className="flex justify-between items-center text-xs">
                   <span className="text-gray-600">비집중 데이터 수집 진행률</span>
                   <span className="font-medium text-orange-600">
                     {formatTimeDisplay(session.duration)} / {formatTimeDisplay(session.targetDuration)}
                     <span className="ml-1 text-gray-500">
                       ({Math.round(getProgressPercentage(session.duration, session.targetDuration))}%)
                     </span>
                   </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2">
                   <div
                     className="bg-orange-500 h-2 rounded-full transition-all duration-300 ease-out"
                     style={{
                       width: `${getProgressPercentage(session.duration, session.targetDuration)}%`
                     }}
                   />
                 </div>
                 <div className="flex justify-between text-xs text-gray-500">
                   <span>00:00</span>
                   <span>15:00</span>
                   <span>29:59</span>
                 </div>
              </div>

                             {/* 비집중 단계 안내 */}
               <div className="text-center space-y-1">
                 <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                   <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                   <span className="text-xs font-medium">
                     {isPaused ? '비집중 데이터 수집 일시 중지' : '비집중 데이터 수집 중'}
                       </span>
                 </div>
                                   <p className="text-xs text-gray-600">
                    잠시 쉬거나 다른 활동을 하는 모습을 보여주세요<br />
                    <span className="text-blue-600 font-medium">
                      {session.targetDuration > 0 
                        ? `최대 ${formatTimeDisplay(session.targetDuration)}(00:00~${formatTimeDisplay(session.targetDuration)}) 동안 데이터를 수집합니다`
                        : '이미 충분한 비집중 데이터가 수집되었습니다'
                      }
                    </span>
                  </p>
                 <div className="bg-orange-50 rounded-lg p-2 mt-2">
                   <p className="text-xs text-orange-700">
                     <strong>진행률:</strong> {Math.round(getProgressPercentage(session.duration, session.targetDuration))}% 
                     ({formatTimeDisplay(session.duration)} / {formatTimeDisplay(session.targetDuration)})<br />
                     <strong>남은 시간:</strong> {formatTimeDisplay(getRemainingTime(session.duration, session.targetDuration))}
                   </p>
                 </div>
                 {isPaused && (
                   <p className="text-xs text-orange-600 font-medium">
                     ⏸️ 일시 중지됨 - 재개 버튼으로 계속 진행
                   </p>
                 )}
               </div>
            </div>
          )}

          {/* 비집중 데이터 수집 안내 단계 */}
          {session.phase === 'nonfocus_instruction' && (
            <div className="space-y-3 py-4">
              {/* 전체 진행상황 표시 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-medium text-gray-700">전체 진행상황</h4>
                  <span className="text-xs text-gray-500">1/2 단계 완료</span>
                </div>
                
                {/* 전체 단계 진행률 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">전체 단계 진행률</span>
                    <span className="font-medium text-blue-600">50%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1">
                    <div className="bg-blue-500 h-1 rounded-full" style={{ width: '50%' }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>시작</span>
                    <span className="text-green-600 font-medium">집중 수집 ✓</span>
                    <span>비집중 수집</span>
                    <span>완료</span>
                  </div>
                </div>

                {/* 단계별 진행률 */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-green-600">집중 데이터</span>
                      <span className="text-green-600 font-medium">100%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-green-500 h-1 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-orange-600">비집중 데이터</span>
                      <span className="text-orange-600 font-medium">0%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-orange-500 h-1 rounded-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-3">
                <div className="w-12 h-12 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-orange-600">집중 데이터 수집 완료!</h3>
                  <p className="text-gray-600 text-xs">
                    이제 비집중 상태의 데이터를 수집합니다
                  </p>
                  <div className="bg-orange-50 rounded-lg p-2 mt-2">
                    <p className="text-xs text-orange-700">
                      잠시 쉬거나 다른 활동을 하는 모습을 보여주세요.<br />
                      이는 개인화 모델의 정확도를 높이는 데 중요합니다.
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 mt-2">
                    <p className="text-xs text-blue-700">
                      💡 <strong>수동 전환:</strong> 원하는 시점에 "비집중 데이터 수집 시작" 버튼을 눌러 진행하세요.<br />
                      충분한 데이터가 수집되었다고 판단되면 언제든지 다음 단계로 넘어갈 수 있습니다.
                    </p>
                  </div>
                </div>

                                 <Button
                   onClick={startNonFocusCollection}
                   disabled={session.targetDuration === 0}
                   className={`px-4 py-2 text-sm ${
                     session.targetDuration === 0 
                       ? 'bg-gray-400 cursor-not-allowed' 
                       : 'bg-orange-600 hover:bg-orange-700 text-white'
                   }`}
                 >
                   {session.targetDuration === 0 ? '비집중 데이터 수집 완료' : '비집중 데이터 수집 시작'}
                 </Button>
              </div>
            </div>
          )}

                     {session.phase === 'idle' && (
             <div className="text-center space-y-3 py-4">
               <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                 <Camera className="h-6 w-6 text-blue-600" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-lg font-semibold text-gray-900">개인화 모델 데이터 수집</h3>
                 <p className="text-gray-600 text-sm">
                   집중 상태와 비집중 상태의 데이터를 수집하여<br />
                   더 정확한 분석을 제공합니다
               </p>
               </div>
               
               {/* 데이터 삭제 버튼 */}
               <div className="pt-4 border-t border-gray-200">
                 <Button
                   onClick={handleDeleteAllData}
                   disabled={isDeleting}
                   variant="outline"
                   size="sm"
                   className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                 >
                   {isDeleting ? (
                     <>
                       <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                       삭제 중...
                     </>
                   ) : (
                     <>
                       <Trash2 className="h-4 w-4 mr-1" />
                       모든 데이터 삭제
                     </>
                   )}
                 </Button>
                 <p className="text-xs text-gray-500 mt-2">
                   저장된 모든 개인화 데이터를 영구적으로 삭제합니다
                 </p>
               </div>
             </div>
           )}

          {session.phase === 'processing' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-gray-900">처리 중...</h3>
                <p className="text-gray-600 text-xs">
                  데이터를 저장하고 있습니다
                </p>
                <div className="bg-blue-50 rounded-lg p-2 mt-2">
                  <p className="text-xs text-blue-700">
                    • JSON 파일 생성 중...<br />
                    • ZIP 파일 압축 중...<br />
                    • Supabase Storage 업로드 중...
                  </p>
                </div>
              </div>
            </div>
          )}

          {session.phase === 'completed' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-green-600 mb-2">데이터 수집 완료!</h3>
                <p className="text-gray-600 text-xs">
                    집중 상태와 비집중 상태의 데이터를 모두 수집하여<br />
                    개인화 모델 학습을 위한 준비가 완료되었습니다
                  </p>
                </div>
                
                {/* 수집된 데이터 요약 */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-medium text-gray-700">수집된 데이터 요약</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="text-base font-semibold text-green-600">
                        {session.samplesCollected}
                      </div>
                      <div className="text-gray-500">총 프레임 수</div>
                    </div>
                                         <div className="text-center">
                       <div className="text-base font-semibold text-blue-600">
                         {formatTimeDisplay(session.targetDuration * 2)}
                       </div>
                       <div className="text-gray-500">총 수집 시간</div>
                     </div>
                    <div className="text-center">
                      <div className={`text-base font-semibold ${
                        session.dataQuality === 'excellent' ? 'text-purple-600' :
                        session.dataQuality === 'good' ? 'text-green-600' :
                        session.dataQuality === 'fair' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {session.dataQuality === 'excellent' ? '우수' :
                         session.dataQuality === 'good' ? '양호' :
                         session.dataQuality === 'fair' ? '보통' : '부족'}
                      </div>
                      <div className="text-gray-500">데이터 품질</div>
                    </div>
                  </div>

                                   {/* 상세 통계 */}
                 <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200">
                   <div className="text-center">
                     <div className="text-sm font-medium text-green-600">
                       {session.focusSamplesCount}
                     </div>
                     <div className="text-gray-500 text-xs">집중 데이터</div>
                     <div className="text-xs text-gray-400">
                       ({formatTimeDisplay(session.targetDuration)} 수집)
                     </div>
                   </div>
                   <div className="text-center">
                     <div className="text-sm font-medium text-orange-600">
                       {session.nonFocusSamplesCount}
                     </div>
                     <div className="text-gray-500 text-xs">비집중 데이터</div>
                     <div className="text-xs text-gray-400">
                       ({formatTimeDisplay(session.targetDuration)} 수집)
                     </div>
                   </div>
                 </div>
                </div>
                
                {/* 파일 생성 완료 안내 */}
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-start space-x-2">
                    <Download className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <h5 className="text-xs font-medium text-green-800 mb-1">파일 생성 완료</h5>
                      <p className="text-xs text-green-700">
                        • focus.json: {session.focusSamplesCount}개 프레임<br />
                        • nonfocus.json: {session.nonFocusSamplesCount}개 프레임<br />
                        • {user?.id}_data.zip: Supabase Storage에 업로드 완료
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 다음 단계 안내 */}
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-start space-x-2">
                    <Eye className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-left">
                      <h5 className="text-xs font-medium text-blue-800 mb-1">다음 단계</h5>
                                             <p className="text-xs text-blue-700">
                         수집된 데이터를 기반으로 개인화된 집중도 분석 모델이 생성됩니다.<br />
                         • 집중 데이터: {session.focusSamplesCount}개 프레임 ({formatTimeDisplay(session.targetDuration)} 수집)<br />
                         • 비집중 데이터: {session.nonFocusSamplesCount}개 프레임 ({formatTimeDisplay(session.targetDuration)} 수집)<br />
                         • 총 수집 시간: {formatTimeDisplay(session.targetDuration * 2)}<br />
                         향후 더 정확한 집중도 측정이 가능합니다.
                       </p>
                    </div>
                  </div>
                </div>
                
                {/* 현재 날짜 표시 */}
                <div className="text-xs text-gray-400 pt-2">
                  {new Date().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric'
                  }).replace(/\. /g, '. ')}
                </div>
              </div>
            </div>
          )}

          {session.phase === 'error' && (
            <div className="text-center space-y-3 py-4">
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-red-600">오류</h3>
                <p className="text-gray-600 text-xs">
                  {errorMessage || '오류가 발생했습니다'}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3">
                         {session.phase === 'idle' && (
               <>
                 <Button variant="outline" onClick={handleCancel} className="px-4 py-2 text-sm">
                   취소
                 </Button>
                 <Button 
                   onClick={startDataCollection} 
                   disabled={session.targetDuration === 0}
                   className={`px-4 py-2 text-sm ${
                     session.targetDuration === 0 
                       ? 'bg-gray-400 cursor-not-allowed' 
                       : 'bg-blue-600 hover:bg-blue-700 text-white'
                   }`}
                 >
                   <Play className="h-4 w-4 mr-1" />
                   {session.targetDuration === 0 ? '수집 완료' : '수집 시작'}
                 </Button>
               </>
             )}

            {(session.phase === 'focus_collecting' || session.phase === 'nonfocus_collecting') && (
              <>
                {!isPaused ? (
                  <Button variant="outline" onClick={handlePause} className="px-4 py-2 text-sm">
                    <Square className="h-4 w-4 mr-1" />
                    일시 중지
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleResume} className="px-4 py-2 text-sm bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                    <Play className="h-4 w-4 mr-1" />
                    재개
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleNextPhase}
                  className="px-4 py-2 text-sm bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  disabled={isPaused}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  다음 단계
                </Button>
                <Button variant="outline" onClick={handleCancel} className="px-4 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  중단
                </Button>
              </>
            )}

            {(session.phase === 'completed' || session.phase === 'error') && (
              <Button onClick={handleCancel} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm">
                확인
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


