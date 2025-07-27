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
  
  // 모델 정보
  modelInfo: {
    inputNames: readonly string[]
    outputNames: readonly string[]
  } | null
}

export function useKoELECTRA(options: UseKoELECTRAOptions = {}): UseKoELECTRAReturn {
  const { autoLoad = false, config = {} } = options
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInferenceTime, setLastInferenceTime] = useState<number | null>(null)
  const [totalInferences, setTotalInferences] = useState(0)
  const [modelInfo, setModelInfo] = useState<{
    inputNames: readonly string[]
    outputNames: readonly string[]
  } | null>(null)
  
  const modelRef = useRef<KoELECTRAInferenceEngine | null>(null)
  const isInitializedRef = useRef(false)

  // 모델 초기화
  const initializeModel = useCallback(() => {
    if (isInitializedRef.current) return
    
    try {
      const defaultConfig: KoELECTRAConfig = {
        modelPath: '/models/koelectra/koelectra.onnx',
        maxLength: 512,
        batchSize: 1,
        ...config
      }
      
      modelRef.current = createKoELECTRA(defaultConfig)
      isInitializedRef.current = true
      
      console.log('[useKoELECTRA] 모델 초기화 완료')
    } catch (err) {
      console.error('[useKoELECTRA] 모델 초기화 실패:', err)
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
      setIsLoaded(true)
      setModelInfo(modelRef.current.getModelInfo())
      console.log('[useKoELECTRA] 모델 로드 완료')
    } catch (err) {
      console.error('[useKoELECTRA] 모델 로드 실패:', err)
      setError(err instanceof Error ? err.message : '모델 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }, [initializeModel])

  // 모델 언로드
  const unloadModel = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.unloadModel()
    }
    setIsLoaded(false)
    setModelInfo(null)
    setError(null)
    console.log('[useKoELECTRA] 모델 언로드 완료')
  }, [])

  // 단일 추론
  const inference = useCallback(async (text: string): Promise<InferenceResult | null> => {
    if (!modelRef.current || !modelRef.current.isLoaded) {
      setError('모델이 로드되지 않았습니다.')
      return null
    }
    
    try {
      const startTime = performance.now()
      const result = await modelRef.current.inference(text)
      const endTime = performance.now()
      
      setLastInferenceTime(endTime - startTime)
      setTotalInferences(prev => prev + 1)
      setError(null)
      
      return result
    } catch (err) {
      console.error('[useKoELECTRA] 추론 실패:', err)
      setError(err instanceof Error ? err.message : '추론 실패')
      return null
    }
  }, [])

  // 배치 추론
  const batchInference = useCallback(async (texts: string[]): Promise<InferenceResult[]> => {
    if (!modelRef.current || !modelRef.current.isLoaded) {
      setError('모델이 로드되지 않았습니다.')
      return []
    }
    
    try {
      const startTime = performance.now()
      const results = await modelRef.current.batchInference(texts)
      const endTime = performance.now()
      
      setLastInferenceTime(endTime - startTime)
      setTotalInferences(prev => prev + texts.length)
      setError(null)
      
      return results
    } catch (err) {
      console.error('[useKoELECTRA] 배치 추론 실패:', err)
      setError(err instanceof Error ? err.message : '배치 추론 실패')
      return []
    }
  }, [])

  // 자동 로드
  useEffect(() => {
    if (autoLoad && !isInitializedRef.current) {
      initializeModel()
      loadModel()
    }
  }, [autoLoad, initializeModel, loadModel])

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        modelRef.current.unloadModel()
      }
    }
  }, [])

  // 전역 정리 함수 등록
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupKoELECTRA()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
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
    modelInfo
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
      console.warn('[useKoELECTRASimple] 모델이 로드되지 않았습니다.')
      return
    }
    
    setIsProcessing(true)
    try {
      const inferenceResult = await inference(text)
      setResult(inferenceResult)
    } catch (err) {
      console.error('[useKoELECTRASimple] 텍스트 처리 실패:', err)
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