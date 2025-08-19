// =====================================================
// 스터디룸 전용 집중세션 훅
// =====================================================

import { useState, useCallback, useRef, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

interface UseStudyRoomFocusSessionOptions {
  sessionId?: string
  userId: string
  roomId?: string
  onScoreUpdate?: (score: number) => void
  onError?: (error: string) => void
}

interface UseStudyRoomFocusSessionReturn {
  // 분석 상태
  isAnalyzing: boolean
  currentScore: number
  averageScore: number
  gestureData: any
  audioData: any
  
  // 제어 함수
  startAnalysis: () => void
  stopAnalysis: () => void
  pauseAnalysis: () => void
  resumeAnalysis: () => void
}

export function useStudyRoomFocusSession({
  sessionId,
  userId,
  roomId,
  onScoreUpdate,
  onError
}: UseStudyRoomFocusSessionOptions): UseStudyRoomFocusSessionReturn {
  
  // 상태 관리
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentScore, setCurrentScore] = useState(0)
  const [averageScore, setAverageScore] = useState(0)
  const [gestureData, setGestureData] = useState<any>(null)
  const [audioData, setAudioData] = useState<any>(null)
  
  // 점수 업데이트 관리
  const scoreHistory = useRef<number[]>([])
  const analysisInterval = useRef<NodeJS.Timeout | null>(null)
  const scoreUpdateThrottle = useRef<NodeJS.Timeout | null>(null)
  const sampleBatch = useRef<Array<{
    timestamp: string
    score: number
    gesture_features: any
    audio_features: any
  }>>([])
  const batchSaveInterval = useRef<NodeJS.Timeout | null>(null)

  // 모의 집중도 분석 (실제 구현시 WebSocket이나 ML 모델 연동)
  const simulateAnalysis = useCallback(() => {
    if (!isAnalyzing || isPaused) return

    // 모의 집중도 점수 생성 (실제로는 웹캠, 마이크 데이터 분석)
    const baseScore = 70 + Math.random() * 25 // 70-95 범위
    const noise = (Math.random() - 0.5) * 10 // -5 ~ +5 노이즈
    const newScore = Math.max(0, Math.min(100, baseScore + noise))
    
    setCurrentScore(newScore)
    
    // 점수 히스토리 업데이트
    scoreHistory.current.push(newScore)
    if (scoreHistory.current.length > 100) { // 최근 100개만 유지
      scoreHistory.current.shift()
    }
    
    // 평균 점수 계산
    const avg = scoreHistory.current.reduce((sum, score) => sum + score, 0) / scoreHistory.current.length
    setAverageScore(avg)
    
    // 모의 제스처/오디오 데이터
    setGestureData({
      headPose: { pitch: Math.random() * 20 - 10, yaw: Math.random() * 20 - 10 },
      eyeGaze: { x: Math.random(), y: Math.random() },
      confidence: Math.random() * 0.3 + 0.7
    })
    
    setAudioData({
      volume: Math.random() * 0.5,
      frequency: Math.random() * 1000 + 100,
      speechDetected: Math.random() > 0.8
    })
    
    // 점수 업데이트 콜백 (스로틀링)
    if (onScoreUpdate && !scoreUpdateThrottle.current) {
      scoreUpdateThrottle.current = setTimeout(() => {
        onScoreUpdate(newScore)
        scoreUpdateThrottle.current = null
      }, 1000) // 1초마다 한 번
    }
    
    // 배치에 샘플 추가
    if (sessionId) {
      sampleBatch.current.push({
        timestamp: new Date().toISOString(),
        score: newScore,
        gesture_features: gestureData,
        audio_features: audioData
      })
    }
  }, [isAnalyzing, isPaused, sessionId, onScoreUpdate])

  // 배치 샘플 저장
  const saveBatchSamples = useCallback(async () => {
    if (!sessionId || sampleBatch.current.length === 0) return
    
    const samples = [...sampleBatch.current]
    sampleBatch.current = [] // 배치 초기화
    
    try {
      // 병렬로 여러 샘플 저장 (최대 5개씩)
      const chunks = []
      for (let i = 0; i < samples.length; i += 5) {
        chunks.push(samples.slice(i, i + 5))
      }
      
      const supabase = supabaseBrowser()
      
      await Promise.all(
        chunks.map(chunk => 
          Promise.all(
            chunk.map(sample => 
              supabase
                .from('focus_sample')
                .insert({
                  session_id: sessionId,
                  timestamp: sample.timestamp,
                  score: sample.score,
                  gesture_features: sample.gesture_features,
                  audio_features: sample.audio_features
                })
            )
          )
        )
      )
      
      console.log(`${samples.length}개의 집중도 샘플이 저장되었습니다.`)
    } catch (error) {
      console.error('배치 샘플 저장 실패:', error)
      // 실패한 샘플들을 다시 배치에 추가
      sampleBatch.current.unshift(...samples)
      
      if (onError) {
        onError('집중도 데이터 저장에 실패했습니다.')
      }
    }
  }, [sessionId, onError])

  // 분석 시작
  const startAnalysis = useCallback(() => {
    if (isAnalyzing) return
    
    setIsAnalyzing(true)
    setIsPaused(false)
    scoreHistory.current = []
    sampleBatch.current = []
    
    // 분석 인터벌 시작 (2초마다)
    analysisInterval.current = setInterval(simulateAnalysis, 2000)
    
    // 배치 저장 인터벌 시작 (10초마다)
    batchSaveInterval.current = setInterval(saveBatchSamples, 10000)
    
    console.log('집중도 분석 시작')
  }, [isAnalyzing, simulateAnalysis, saveBatchSamples])

  // 분석 중지
  const stopAnalysis = useCallback(async () => {
    setIsAnalyzing(false)
    setIsPaused(false)
    
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current)
      analysisInterval.current = null
    }
    
    if (batchSaveInterval.current) {
      clearInterval(batchSaveInterval.current)
      batchSaveInterval.current = null
    }
    
    if (scoreUpdateThrottle.current) {
      clearTimeout(scoreUpdateThrottle.current)
      scoreUpdateThrottle.current = null
    }
    
    // 남은 배치 샘플 저장
    if (sampleBatch.current.length > 0) {
      await saveBatchSamples()
    }
    
    // 최종 평균 점수로 세션 업데이트
    if (sessionId && scoreHistory.current.length > 0) {
      const finalAverage = scoreHistory.current.reduce((sum, score) => sum + score, 0) / scoreHistory.current.length
      const supabase = supabaseBrowser()
      
      supabase
        .from('focus_session')
        .update({
          focus_score: finalAverage,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .then(({ error }) => {
          if (error) {
            console.error('세션 업데이트 실패:', error)
          }
        })
    }
    
    console.log('집중도 분석 중지')
  }, [sessionId, saveBatchSamples])

  // 분석 일시정지
  const pauseAnalysis = useCallback(() => {
    if (!isAnalyzing) return
    
    setIsPaused(true)
    
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current)
      analysisInterval.current = null
    }
    
    if (batchSaveInterval.current) {
      clearInterval(batchSaveInterval.current)
      batchSaveInterval.current = null
    }
    
    console.log('집중도 분석 일시정지')
  }, [isAnalyzing])

  // 분석 재개
  const resumeAnalysis = useCallback(() => {
    if (!isAnalyzing || !isPaused) return
    
    setIsPaused(false)
    
    // 분석 인터벌 재시작
    analysisInterval.current = setInterval(simulateAnalysis, 2000)
    
    // 배치 저장 인터벌 재시작
    batchSaveInterval.current = setInterval(saveBatchSamples, 10000)
    
    console.log('집중도 분석 재개')
  }, [isAnalyzing, isPaused, simulateAnalysis, saveBatchSamples])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (analysisInterval.current) {
        clearInterval(analysisInterval.current)
      }
      if (batchSaveInterval.current) {
        clearInterval(batchSaveInterval.current)
      }
      if (scoreUpdateThrottle.current) {
        clearTimeout(scoreUpdateThrottle.current)
      }
      
      // 남은 배치 샘플 저장 (비동기이지만 최선의 노력)
      if (sampleBatch.current.length > 0) {
        saveBatchSamples().catch(error => {
          console.error('언마운트 시 배치 저장 실패:', error)
        })
      }
    }
  }, [saveBatchSamples])

  return {
    // 분석 상태
    isAnalyzing,
    currentScore,
    averageScore,
    gestureData,
    audioData,
    
    // 제어 함수
    startAnalysis,
    stopAnalysis,
    pauseAnalysis,
    resumeAnalysis
  }
}
