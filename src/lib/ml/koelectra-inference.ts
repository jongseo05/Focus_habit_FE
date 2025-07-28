import { koelectraPreprocess, initializeTokenizer } from '@/lib/tokenizer/koelectra'

// ONNX Runtime을 동적으로 import하여 클라이언트 사이드에서만 로드
let ort: any = null

// ONNX Runtime 초기화 함수
async function initializeONNX() {
  console.log('[KoELECTRA] ONNX Runtime 초기화 시작...')
  
  if (typeof window === 'undefined') {
    throw new Error('ONNX Runtime은 클라이언트 사이드에서만 사용할 수 있습니다.')
  }
  
  if (ort) {
    console.log('[KoELECTRA] 기존 ONNX Runtime 인스턴스 재사용')
    return ort
  }
  
  try {
    console.log('[KoELECTRA] onnxruntime-web 모듈 import 시작...')
    ort = await import('onnxruntime-web')
    console.log('[KoELECTRA] onnxruntime-web 모듈 import 완료')
    
    console.log('[KoELECTRA] ONNX Runtime 환경 설정 시작...')
    // ONNX Runtime 설정 - 성능 최적화
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true // SIMD 활성화로 성능 향상
    ort.env.wasm.wasmPaths = '/'
    console.log('[KoELECTRA] ONNX Runtime 환경 설정 완료:', {
      numThreads: ort.env.wasm.numThreads,
      simd: ort.env.wasm.simd,
      wasmPaths: ort.env.wasm.wasmPaths
    })
    
    console.log('[KoELECTRA] ✅ ONNX Runtime 초기화 완료')
    return ort
  } catch (error) {
    console.error('[KoELECTRA] ❌ ONNX Runtime 초기화 실패:', error)
    console.error('[KoELECTRA] 오류 상세 정보:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export interface KoELECTRAConfig {
  modelPath: string
  maxLength: number
  batchSize: number
  enableCache?: boolean
  cacheSize?: number
  enableBatching?: boolean
}

export interface InferenceResult {
  logits: Float32Array
  embeddings?: Float32Array
  confidence: number
  processingTime: number
  cached?: boolean
}

export interface KoELECTRALoader {
  session: any | null
  isLoaded: boolean
  isLoading: boolean
  error: string | null
  loadModel: () => Promise<void>
  unloadModel: () => void
  inference: (text: string) => Promise<InferenceResult>
  batchInference: (texts: string[]) => Promise<InferenceResult[]>
  clearCache: () => void
  getCacheStats: () => { hits: number; misses: number; size: number }
}

// 간단한 LRU 캐시 구현
class LRUCache<K, V> {
  private capacity: number
  private cache = new Map<K, V>()
  private hits = 0
  private misses = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!
      this.cache.delete(key)
      this.cache.set(key, value)
      this.hits++
      return value
    }
    this.misses++
    return undefined
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  getStats() {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size
    }
  }
}

class KoELECTRAInferenceEngine implements KoELECTRALoader {
  private _session: any | null = null
  private _isLoaded = false
  private _isLoading = false
  private _error: string | null = null
  private _config: KoELECTRAConfig
  private _cache: LRUCache<string, InferenceResult> | null = null
  private _batchQueue: string[] = []
  private _batchTimeout: NodeJS.Timeout | null = null
  private _processingBatch = false

  constructor(config: KoELECTRAConfig) {
    console.log('[KoELECTRA] KoELECTRAInferenceEngine 생성자 호출됨:', config);
    
    this._config = {
      enableCache: true,
      cacheSize: 100,
      enableBatching: true,
      ...config
    }
    
    console.log('[KoELECTRA] 최종 설정:', this._config);
    
    if (this._config.enableCache) {
      this._cache = new LRUCache<string, InferenceResult>(this._config.cacheSize || 100)
      console.log('[KoELECTRA] 캐시 초기화 완료 - 크기:', this._config.cacheSize || 100);
    }
    
    console.log('[KoELECTRA] KoELECTRAInferenceEngine 초기화 완료');
  }

  get session(): any | null {
    return this._session
  }

  get isLoaded(): boolean {
    return this._isLoaded
  }

  get isLoading(): boolean {
    return this._isLoading
  }

  get error(): string | null {
    return this._error
  }

  async loadModel(): Promise<void> {
    console.log('[KoELECTRA] loadModel 호출됨 - 현재 상태:', {
      isLoaded: this._isLoaded,
      isLoading: this._isLoading,
      hasSession: !!this._session,
      error: this._error
    });
    
    if (this._isLoaded || this._isLoading) {
      console.log('[KoELECTRA] 이미 로드 중이거나 로드됨 - 로딩 중단');
      return
    }

    console.log('[KoELECTRA] 모델 로딩 시작...');
    this._isLoading = true
    this._error = null

    try {
      console.log('[KoELECTRA] 1단계: 브라우저 환경 확인');
      if (typeof window === 'undefined') {
        throw new Error('브라우저 환경에서만 모델을 로드할 수 있습니다.');
      }
      
      console.log('[KoELECTRA] 2단계: 모델 파일 존재 확인 - 경로:', this._config.modelPath);
      
      // 모델 파일 존재 여부 확인 (브라우저에서는 fetch로 확인)
      try {
        const response = await fetch(this._config.modelPath, { method: 'HEAD' });
        console.log('[KoELECTRA] 모델 파일 응답:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
          throw new Error(`모델 파일을 찾을 수 없습니다: ${this._config.modelPath} (상태: ${response.status})`);
        }
        console.log('[KoELECTRA] ✅ 모델 파일 존재 확인됨');
      } catch (fetchError) {
        console.error('[KoELECTRA] ❌ 모델 파일 존재 확인 실패:', fetchError);
        throw new Error(`모델 파일 접근 실패: ${fetchError}`);
      }
      
      console.log('[KoELECTRA] 3단계: 토크나이저 초기화');
      await initializeTokenizer()
      console.log('[KoELECTRA] ✅ 토크나이저 초기화 완료');
      
      console.log('[KoELECTRA] 4단계: ONNX Runtime 초기화');
      const onnxRuntime = await initializeONNX()
      console.log('[KoELECTRA] ✅ ONNX Runtime 초기화 완료');
      
      console.log('[KoELECTRA] 5단계: ONNX 모델 로드 시작');
      
      // ONNX 모델 로드 - 성능 최적화 옵션 적용
      this._session = await onnxRuntime.InferenceSession.create(
        this._config.modelPath,
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          executionMode: 'parallel', // 병렬 실행으로 성능 향상
          enableCpuMemArena: true, // CPU 메모리 아레나 활성화
          enableMemPattern: true, // 메모리 패턴 최적화
          extra: {
            session: {
              use_ort_model_bytes_directly: true, // 모델 바이트 직접 사용
              log_severity_level: 0 // 로그 레벨 최소화
            }
          }
        }
      )

      console.log('[KoELECTRA] ✅ ONNX 모델 로딩 완료');
      console.log('[KoELECTRA] 입력 정보:', this._session.inputNames)
      console.log('[KoELECTRA] 출력 정보:', this._session.outputNames)

      // 상태 업데이트 전 최종 확인
      console.log('[KoELECTRA] 상태 업데이트 전 확인:', {
        hasSession: !!this._session,
        sessionInputNames: this._session?.inputNames,
        sessionOutputNames: this._session?.outputNames
      });

      this._isLoaded = true
      this._isLoading = false
      console.log('[KoELECTRA] ✅ 모델 상태 업데이트 완료 - isLoaded: true');
      
      // 상태 업데이트 후 확인
      console.log('[KoELECTRA] 상태 업데이트 후 확인:', {
        isLoaded: this._isLoaded,
        isLoading: this._isLoading,
        error: this._error
      });
    } catch (error) {
      console.error('[KoELECTRA] ❌ 모델 로딩 실패:', error)
      console.error('[KoELECTRA] 오류 상세 정보:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this._error = error instanceof Error ? error.message : 'Unknown error'
      this._isLoading = false
      throw error
    }
  }

  unloadModel(): void {
    if (this._session) {
      this._session.release()
      this._session = null
    }
    this._isLoaded = false
    this._error = null
    this.clearCache()
    
    // 배치 큐 정리
    if (this._batchTimeout) {
      clearTimeout(this._batchTimeout)
      this._batchTimeout = null
    }
    this._batchQueue = []
    this._processingBatch = false
  }

  async inference(text: string): Promise<InferenceResult> {
    if (!this._session || !this._isLoaded) {
      throw new Error('모델이 로드되지 않았습니다.')
    }

    const startTime = performance.now()

    // 캐시 확인
    if (this._cache) {
      const cached = this._cache.get(text)
      if (cached) {
        return { ...cached, cached: true, processingTime: 0 }
      }
    }

    // 배치 처리 활성화된 경우 큐에 추가
    if (this._config.enableBatching && this._batchQueue.length < 5) {
      return this.addToBatch(text)
    }

    // 즉시 처리
    const result = await this.processInference(text)
    
    // 캐시에 저장
    if (this._cache) {
      this._cache.set(text, result)
    }

    return result
  }

  private async addToBatch(text: string): Promise<InferenceResult> {
    return new Promise((resolve, reject) => {
      this._batchQueue.push(text)
      
      // 배치 처리 시작
      if (!this._processingBatch) {
        this.processBatch()
      }
      
      // 타임아웃 설정 (최대 100ms 대기)
      setTimeout(() => {
        const index = this._batchQueue.indexOf(text)
        if (index > -1) {
          this._batchQueue.splice(index, 1)
          reject(new Error('배치 처리 타임아웃'))
        }
      }, 100)
    })
  }

  private async processBatch(): Promise<void> {
    if (this._processingBatch || this._batchQueue.length === 0) {
      return
    }

    this._processingBatch = true
    const texts = [...this._batchQueue]
    this._batchQueue = []

    try {
      const results = await this.batchInference(texts)
      // 결과 처리
      console.log(`[KoELECTRA] 배치 처리 완료: ${texts.length}개 텍스트`)
    } catch (error) {
      console.error('[KoELECTRA] 배치 처리 실패:', error)
    } finally {
      this._processingBatch = false
      
      // 큐에 남은 항목이 있으면 다시 처리
      if (this._batchQueue.length > 0) {
        setTimeout(() => this.processBatch(), 10)
      }
    }
  }

  private async processInference(text: string): Promise<InferenceResult> {
    if (!this._session) {
      throw new Error('모델이 로드되지 않았습니다.')
    }

    const startTime = performance.now()

    try {
      console.log('[KoELECTRA] 추론 시작 - 입력 텍스트:', text);
      
      // 텍스트 전처리
      const preprocessed = koelectraPreprocess(text, this._config.maxLength)
      console.log('[KoELECTRA] 전처리 결과:', {
        inputIdsLength: preprocessed.input_ids.length,
        attentionMaskLength: preprocessed.attention_mask.length,
        tokenTypeIdsLength: preprocessed.token_type_ids.length,
        inputIdsSample: preprocessed.input_ids.slice(0, 10), // 처음 10개만
        attentionMaskSample: preprocessed.attention_mask.slice(0, 10),
        tokenTypeIdsSample: preprocessed.token_type_ids.slice(0, 10)
      });
      
      // ONNX Runtime 가져오기
      const onnxRuntime = await initializeONNX()
      
      // 입력 텐서 생성
      const inputTensor = new onnxRuntime.Tensor('int64', preprocessed.input_ids, [1, preprocessed.input_ids.length])
      const attentionMask = new onnxRuntime.Tensor('int64', preprocessed.attention_mask, [1, preprocessed.attention_mask.length])
      const tokenTypeIds = new onnxRuntime.Tensor('int64', preprocessed.token_type_ids, [1, preprocessed.token_type_ids.length])

      console.log('[KoELECTRA] 텐서 생성 완료:', {
        inputTensorShape: inputTensor.dims,
        attentionMaskShape: attentionMask.dims,
        tokenTypeIdsShape: tokenTypeIds.dims
      });

      // 추론 실행
      const feeds = {
        input_ids: inputTensor,
        attention_mask: attentionMask,
        token_type_ids: tokenTypeIds
      }

      console.log('[KoELECTRA] 모델 추론 실행 중...');
      const results = await this._session.run(feeds)
      console.log('[KoELECTRA] 모델 추론 완료:', {
        outputKeys: Object.keys(results),
        logitsShape: results.logits?.dims,
        logitsType: results.logits?.type
      });
      
      const logits = results.logits.data as Float32Array
      console.log('[KoELECTRA] 로짓 값:', {
        logitsLength: logits.length,
        logitsValues: Array.from(logits),
        logitsMin: Math.min(...logits),
        logitsMax: Math.max(...logits),
        logitsMean: logits.reduce((sum, val) => sum + val, 0) / logits.length
      });

      const processingTime = performance.now() - startTime
      const confidence = this.calculateConfidence(logits)
      
      console.log('[KoELECTRA] 신뢰도 계산 완료:', {
        confidence: confidence,
        processingTime: processingTime
      });

      return {
        logits,
        confidence,
        processingTime
      }
    } catch (error) {
      console.error('[KoELECTRA] 추론 실패:', error)
      throw error
    }
  }

  async batchInference(texts: string[]): Promise<InferenceResult[]> {
    if (!this._session || !this._isLoaded) {
      throw new Error('모델이 로드되지 않았습니다.')
    }

    const startTime = performance.now()
    const results: InferenceResult[] = []

    try {
      // 배치 크기로 나누어 처리
      const batchSize = this._config.batchSize || 4
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize)
        const batchResults = await this.processBatchInference(batch)
        results.push(...batchResults)
      }

      const totalTime = performance.now() - startTime
      console.log(`[KoELECTRA] 배치 추론 완료: ${texts.length}개, ${totalTime.toFixed(2)}ms`)

      return results
    } catch (error) {
      console.error('[KoELECTRA] 배치 추론 실패:', error)
      throw error
    }
  }

  private async processBatchInference(texts: string[]): Promise<InferenceResult[]> {
    if (!this._session) {
      throw new Error('모델이 로드되지 않았습니다.')
    }

    const batchSize = texts.length
    const maxLength = Math.max(...texts.map(text => text.length))
    const paddedLength = Math.min(maxLength, this._config.maxLength)

    // 배치 입력 준비
    const inputIds: number[][] = []
    const attentionMasks: number[][] = []
    const batchTokenTypeIds: number[][] = []

    for (const text of texts) {
      const preprocessed = koelectraPreprocess(text, paddedLength)
      inputIds.push(preprocessed.input_ids)
      attentionMasks.push(preprocessed.attention_mask)
      batchTokenTypeIds.push(preprocessed.token_type_ids)
    }

    // ONNX Runtime 가져오기
    const onnxRuntime = await initializeONNX()
    
    // 배치 텐서 생성
    const inputTensor = new onnxRuntime.Tensor('int64', inputIds.flat(), [batchSize, paddedLength])
    const attentionMask = new onnxRuntime.Tensor('int64', attentionMasks.flat(), [batchSize, paddedLength])
    const tokenTypeIds = new onnxRuntime.Tensor('int64', batchTokenTypeIds.flat(), [batchSize, paddedLength])

    // 배치 추론 실행
    const feeds = {
      input_ids: inputTensor,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds
    }

    const results = await this._session.run(feeds)
    const logits = results.logits.data as Float32Array

    // 결과 분리
    const logitsPerText = logits.length / batchSize
    const inferenceResults: InferenceResult[] = []

    for (let i = 0; i < batchSize; i++) {
      const startIdx = i * logitsPerText
      const endIdx = startIdx + logitsPerText
      const textLogits = logits.slice(startIdx, endIdx)
      
      inferenceResults.push({
        logits: textLogits,
        confidence: this.calculateConfidence(textLogits),
        processingTime: 0 // 배치 처리에서는 개별 시간 측정 어려움
      })
    }

    return inferenceResults
  }

  private calculateConfidence(logits: Float32Array): number {
    console.log('[KoELECTRA] 신뢰도 계산 시작:', {
      logitsLength: logits.length,
      logitsValues: Array.from(logits).map(v => Number(v.toFixed(4)))
    });
    
    // 로짓 값 검증
    if (logits.length === 0) {
      console.error('[KoELECTRA] 로짓 배열이 비어있음');
      return 0;
    }
    
    if (logits.some(isNaN)) {
      console.error('[KoELECTRA] 로짓에 NaN 값이 포함됨');
      return 0;
    }
    
    // Softmax 계산
    const maxLogit = Math.max(...logits)
    console.log('[KoELECTRA] 최대 로짓:', maxLogit.toFixed(4));
    
    // 수치 안정성을 위한 검증
    if (!isFinite(maxLogit)) {
      console.error('[KoELECTRA] 최대 로짓이 유효하지 않음:', maxLogit);
      return 0;
    }
    
    const expLogits = logits.map(logit => {
      const expValue = Math.exp(logit - maxLogit);
      if (!isFinite(expValue)) {
        console.warn('[KoELECTRA] exp 값이 유효하지 않음:', { logit, maxLogit, expValue });
        return 0;
      }
      return expValue;
    });
    
    console.log('[KoELECTRA] exp(logit - maxLogit) 값들:', expLogits.map(v => Number(v.toFixed(6))));
    
    const sumExpLogits = expLogits.reduce((sum, exp) => sum + exp, 0)
    console.log('[KoELECTRA] exp 합계:', Number(sumExpLogits.toFixed(6)));
    
    if (sumExpLogits === 0) {
      console.error('[KoELECTRA] exp 합계가 0임 - 모든 exp 값이 0');
      return 0;
    }
    
    const probabilities = expLogits.map(exp => exp / sumExpLogits)
    console.log('[KoELECTRA] 확률 값들:', probabilities.map(v => Number(v.toFixed(6))));
    
    // 최대 확률을 신뢰도로 사용
    const maxProbability = Math.max(...probabilities)
    console.log('[KoELECTRA] 최대 확률 (신뢰도):', maxProbability.toFixed(6));
    
    // 신뢰도 검증
    if (!isFinite(maxProbability) || maxProbability < 0 || maxProbability > 1) {
      console.error('[KoELECTRA] 신뢰도가 유효하지 않음:', maxProbability);
      return 0;
    }
    
    return maxProbability
  }

  getModelInfo() {
    if (!this._session) {
      return { inputNames: [], outputNames: [] }
    }
    
    return {
      inputNames: this._session.inputNames,
      outputNames: this._session.outputNames
    }
  }

  clearCache(): void {
    if (this._cache) {
      this._cache.clear()
    }
  }

  getCacheStats(): { hits: number; misses: number; size: number } {
    if (!this._cache) {
      return { hits: 0, misses: 0, size: 0 }
    }
    return this._cache.getStats()
  }
}

// 전역 인스턴스
let globalKoELECTRA: KoELECTRAInferenceEngine | null = null

// KoELECTRA 인스턴스 생성 및 관리
export function createKoELECTRA(config: KoELECTRAConfig = {
  modelPath: '/models/koelectra/koelectra.onnx',
  maxLength: 512,
  batchSize: 1
}): KoELECTRAInferenceEngine {
  console.log('[KoELECTRA] createKoELECTRA 호출됨:', {
    config,
    globalKoELECTRA: !!globalKoELECTRA
  });
  
  if (!globalKoELECTRA) {
    console.log('[KoELECTRA] 새로운 인스턴스 생성');
    globalKoELECTRA = new KoELECTRAInferenceEngine(config)
  } else {
    console.log('[KoELECTRA] 기존 인스턴스 재사용');
  }
  return globalKoELECTRA
}

// 전역 인스턴스 반환
export function getKoELECTRA(): KoELECTRAInferenceEngine | null {
  return globalKoELECTRA
}

// 모델 정리
export function cleanupKoELECTRA(): void {
  if (globalKoELECTRA) {
    globalKoELECTRA.unloadModel()
    globalKoELECTRA = null
  }
}

// 유틸리티 함수들
export async function loadKoELECTRAModel(): Promise<KoELECTRAInferenceEngine> {
  const model = createKoELECTRA()
  await model.loadModel()
  return model
}

export async function runKoELECTRAInference(text: string): Promise<InferenceResult> {
  const model = getKoELECTRA()
  if (!model) {
    throw new Error('KoELECTRA 모델이 초기화되지 않았습니다.')
  }
  return await model.inference(text)
}

// 성능 테스트 함수
export async function benchmarkKoELECTRA(texts: string[]): Promise<{
  totalTime: number
  averageTime: number
  results: InferenceResult[]
}> {
  const model = getKoELECTRA()
  if (!model) {
    throw new Error('KoELECTRA 모델이 초기화되지 않았습니다.')
  }

  const startTime = performance.now()
  const results = await model.batchInference(texts)
  const totalTime = performance.now() - startTime

  const averageTime = totalTime / texts.length

  return {
    totalTime,
    averageTime,
    results
  }
} 