import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  createKoELECTRA, 
  getKoELECTRA, 
  cleanupKoELECTRA,
  InferenceResult,
  KoELECTRAConfig
} from '@/lib/ml/koelectra-inference'

// KoELECTRAInferenceEngine 타입 정의
type KoELECTRAInferenceEngine = ReturnType<typeof createKoELECTRA>

interface UseKoELECTRAOptions {
  autoLoad?: boolean
  config?: Partial<KoELECTRAConfig>
  enablePerformanceMonitoring?: boolean
}

interface UseKoELECTRAReturn {
  // 모델 상태
  isLoaded: boolean
  isLoading: boolean
  error: string | null
  
  // 모델 제어
  loadModel: () => Promise<void>
  unloadModel: () => void
  
  // 추론 기능
  inference: (text: string) => Promise<InferenceResult | null>
  batchInference: (texts: string[]) => Promise<InferenceResult[]>
  
  // 성능 정보
  lastInferenceTime: number | null
  totalInferences: number
  averageInferenceTime: number
  
  // 캐시 관리
  clearCache: () => void
  cacheStats: { hits: number; misses: number; size: number }
  
  // 모델 정보
  modelInfo: {
    inputNames: readonly string[]
    outputNames: readonly string[]
  } | null
  
  // 성능 모니터링
  performanceStats: {
    totalProcessingTime: number
    cacheHitRate: number
    throughput: number // inferences per second
  }
}

export function useKoELECTRA(options: UseKoELECTRAOptions = {}): UseKoELECTRAReturn {
  const { autoLoad = false, config = {}, enablePerformanceMonitoring = true } = options
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInferenceTime, setLastInferenceTime] = useState<number | null>(null)
  const [totalInferences, setTotalInferences] = useState(0)
  const [averageInferenceTime, setAverageInferenceTime] = useState(0)
  const [cacheStats, setCacheStats] = useState({ hits: 0, misses: 0, size: 0 })
  const [modelInfo, setModelInfo] = useState<{
    inputNames: readonly string[]
    outputNames: readonly string[]
  } | null>(null)
  
  const modelRef = useRef<KoELECTRAInferenceEngine | null>(null)
  const isInitializedRef = useRef(false)
  const performanceRef = useRef({
    totalProcessingTime: 0,
    startTime: Date.now(),
    inferenceTimes: [] as number[]
  })

  // 모델 초기화
  const initializeModel = useCallback(() => {
    if (isInitializedRef.current) {
      return
    }
    
    try {
      const defaultConfig: KoELECTRAConfig = {
        modelPath: '/models/koelectra/koelectra.onnx',
        maxLength: 512,
        batchSize: 4, // 배치 크기 증가
        enableCache: true,
        cacheSize: 200, // 캐시 크기 증가
        enableBatching: true,
        ...config
      }
      
      modelRef.current = createKoELECTRA(defaultConfig)
      isInitializedRef.current = true
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 초기화 실패')
    }
  }, [config])

  // 모델 로드
  const loadModel = useCallback(async () => {
    
    if (!modelRef.current) {
      initializeModel()
    }
    
    if (!modelRef.current) {
      setError('모델을 초기화할 수 없습니다.')
      return
    }
    
    if (modelRef.current.isLoaded || modelRef.current.isLoading) {
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      await modelRef.current.loadModel()
      
      // 모델 상태 재확인
      
      setIsLoaded(true)
      setModelInfo(modelRef.current.getModelInfo())
      
      // 성능 모니터링 시작
      if (enablePerformanceMonitoring) {
        performanceRef.current.startTime = Date.now()
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '모델 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }, [initializeModel, enablePerformanceMonitoring])

  // 모델 언로드
  const unloadModel = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.unloadModel()
      setIsLoaded(false)
      setModelInfo(null)
      setError(null)
      
      // 성능 통계 초기화
      performanceRef.current = {
        totalProcessingTime: 0,
        startTime: Date.now(),
        inferenceTimes: []
      }
      
    }
  }, [])

  // 추론 실행
  const inference = useCallback(async (text: string): Promise<InferenceResult | null> => {
    if (!modelRef.current || !modelRef.current.isLoaded) {
      return null
    }
    
    const startTime = performance.now()
    
    try {
      const result = await modelRef.current.inference(text)
      const processingTime = performance.now() - startTime
      
      // 성능 통계 업데이트
      setLastInferenceTime(processingTime)
      setTotalInferences(prev => prev + 1)
      
      if (enablePerformanceMonitoring) {
        performanceRef.current.totalProcessingTime += processingTime
        performanceRef.current.inferenceTimes.push(processingTime)
        
        // 최근 100개 추론의 평균 시간 계산
        const recentTimes = performanceRef.current.inferenceTimes.slice(-100)
        const avgTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
        setAverageInferenceTime(avgTime)
      }
      
      // 캐시 통계 업데이트
      setCacheStats(modelRef.current.getCacheStats())
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : '추론 실패')
      return null
    }
  }, [enablePerformanceMonitoring])

  // 배치 추론
  const batchInference = useCallback(async (texts: string[]): Promise<InferenceResult[]> => {
    if (!modelRef.current || !modelRef.current.isLoaded) {
      return []
    }
    
    const startTime = performance.now()
    
    try {
      const results = await modelRef.current.batchInference(texts)
      const processingTime = performance.now() - startTime
      
      // 성능 통계 업데이트
      setLastInferenceTime(processingTime)
      setTotalInferences(prev => prev + texts.length)
      
      if (enablePerformanceMonitoring) {
        performanceRef.current.totalProcessingTime += processingTime
        performanceRef.current.inferenceTimes.push(processingTime)
        
        // 최근 100개 추론의 평균 시간 계산
        const recentTimes = performanceRef.current.inferenceTimes.slice(-100)
        const avgTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
        setAverageInferenceTime(avgTime)
      }
      
      // 캐시 통계 업데이트
      setCacheStats(modelRef.current.getCacheStats())
      
      return results
    } catch (err) {
      setError(err instanceof Error ? err.message : '배치 추론 실패')
      return []
    }
  }, [enablePerformanceMonitoring])

  // 캐시 클리어
  const clearCache = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.clearCache()
      setCacheStats({ hits: 0, misses: 0, size: 0 })
    }
  }, [])

  // 성능 통계 계산
  const performanceStats = {
    totalProcessingTime: performanceRef.current.totalProcessingTime,
    cacheHitRate: cacheStats.hits + cacheStats.misses > 0 
      ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100 
      : 0,
    throughput: performanceRef.current.totalProcessingTime > 0 
      ? (totalInferences / (performanceRef.current.totalProcessingTime / 1000))
      : 0
  }

  // 자동 로드 (10초마다 한 번씩만 로그 출력)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (autoLoad && !isLoaded && !isLoading) {
        loadModel()
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [autoLoad, isLoaded, isLoading, loadModel])

  // 상태 변화 추적 (10초마다 한 번씩만 로그 출력)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // console.log('[useKoELECTRA] 상태 변화 감지:', {
      //   isLoaded,
      //   isLoading,
      //   error,
      //   hasModelRef: !!modelRef.current,
      //   modelRefLoaded: modelRef.current?.isLoaded,
      //   modelRefLoading: modelRef.current?.isLoading,
      //   timestamp: new Date().toLocaleTimeString()
      // });
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [isLoaded, isLoading, error]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (modelRef.current) {
        cleanupKoELECTRA()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (modelRef.current) {
        cleanupKoELECTRA()
      }
    }
  }, [])

  return {
    isLoaded,
    isLoading,
    error,
    loadModel,
    unloadModel,
    inference,
    batchInference,
    lastInferenceTime,
    totalInferences,
    averageInferenceTime,
    clearCache,
    cacheStats,
    modelInfo,
    performanceStats
  }
}

// 간단한 사용 예시를 위한 유틸리티 훅
export function useKoELECTRASimple() {
  const { 
    isLoaded, 
    isLoading, 
    error, 
    loadModel, 
    inference 
  } = useKoELECTRA({ autoLoad: true })
  
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const processText = useCallback(async (text: string) => {
    if (!isLoaded) {
      return
    }
    
    setIsProcessing(true)
    try {
      const inferenceResult = await inference(text)
      setResult(inferenceResult)
    } catch (err) {
      // console.error('[useKoELECTRASimple] 텍스트 처리 실패:', err)
    } finally {
      setIsProcessing(false)
    }
  }, [isLoaded, inference])
  
  return {
    isLoaded,
    isLoading,
    error,
    loadModel,
    processText,
    result,
    isProcessing
  }
} 