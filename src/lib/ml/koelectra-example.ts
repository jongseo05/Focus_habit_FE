// KoELECTRA 모델 사용 예시
import { useKoELECTRA } from '@/hooks/useKoELECTRA'

// 1. 기본 사용법
export function ExampleBasicUsage() {
  const { 
    isLoaded, 
    isLoading, 
    error, 
    loadModel, 
    inference 
  } = useKoELECTRA({ autoLoad: true })

  const handleTextAnalysis = async (text: string) => {
    if (!isLoaded) {
      console.warn('모델이 로드되지 않았습니다.')
      return
    }

    try {
      const result = await inference(text)
      console.log('추론 결과:', result)
      
      // 결과 활용
      if (result) {
        console.log('신뢰도:', result.confidence)
        console.log('처리 시간:', result.processingTime)
        console.log('로그its 크기:', result.logits.length)
      }
    } catch (err) {
      console.error('추론 실패:', err)
    }
  }

  return {
    isLoaded,
    isLoading,
    error,
    loadModel,
    handleTextAnalysis
  }
}

// 2. 집중 세션에서 사용하는 예시
export function ExampleFocusSessionUsage() {
  const { 
    isLoaded, 
    inference 
  } = useKoELECTRA({ autoLoad: true })

  const analyzeUserBehavior = async (userInput: string) => {
    if (!isLoaded) return null

    try {
      const result = await inference(userInput)
      
      // 집중도 분석 (예시)
      const focusScore = result?.confidence || 0
      const isFocused = focusScore > 0.7
      
      return {
        focusScore,
        isFocused,
        processingTime: result?.processingTime || 0
      }
    } catch (err) {
      console.error('사용자 행동 분석 실패:', err)
      return null
    }
  }

  return {
    isLoaded,
    analyzeUserBehavior
  }
}

// 3. 배치 처리 예시
export function ExampleBatchProcessing() {
  const { 
    isLoaded, 
    batchInference 
  } = useKoELECTRA({ autoLoad: true })

  const analyzeMultipleTexts = async (texts: string[]) => {
    if (!isLoaded) return []

    try {
      const results = await batchInference(texts)
      
      return results.map((result, index) => ({
        text: texts[index],
        confidence: result.confidence,
        processingTime: result.processingTime,
        isHighConfidence: result.confidence > 0.8
      }))
    } catch (err) {
      console.error('배치 처리 실패:', err)
      return []
    }
  }

  return {
    isLoaded,
    analyzeMultipleTexts
  }
}

// 4. 성능 모니터링 예시
export function ExamplePerformanceMonitoring() {
  const { 
    isLoaded, 
    inference, 
    lastInferenceTime, 
    totalInferences 
  } = useKoELECTRA({ autoLoad: true })

  const analyzeWithMonitoring = async (text: string) => {
    if (!isLoaded) return null

    const startTime = performance.now()
    
    try {
      const result = await inference(text)
      const endTime = performance.now()
      
      // 성능 메트릭 수집
      const metrics = {
        inferenceTime: result?.processingTime || 0,
        totalTime: endTime - startTime,
        totalInferences,
        averageTime: lastInferenceTime || 0
      }
      
      console.log('성능 메트릭:', metrics)
      
      return {
        result,
        metrics
      }
    } catch (err) {
      console.error('분석 실패:', err)
      return null
    }
  }

  return {
    isLoaded,
    analyzeWithMonitoring,
    performanceStats: {
      lastInferenceTime,
      totalInferences
    }
  }
}

// 5. 에러 처리 및 복구 예시
export function ExampleErrorHandling() {
  const { 
    isLoaded, 
    isLoading, 
    error, 
    loadModel, 
    inference 
  } = useKoELECTRA({ autoLoad: false })

  const robustInference = async (text: string) => {
    // 모델이 로드되지 않은 경우 자동 로드 시도
    if (!isLoaded && !isLoading) {
      try {
        await loadModel()
      } catch (err) {
        console.error('모델 로드 실패:', err)
        return { error: '모델을 로드할 수 없습니다.' }
      }
    }

    // 에러가 있는 경우 처리
    if (error) {
      console.error('모델 에러:', error)
      return { error: '모델에 문제가 있습니다.' }
    }

    // 추론 실행
    try {
      const result = await inference(text)
      return { success: true, result }
    } catch (err) {
      console.error('추론 에러:', err)
      return { error: '추론 중 오류가 발생했습니다.' }
    }
  }

  return {
    isLoaded,
    isLoading,
    error,
    robustInference
  }
} 