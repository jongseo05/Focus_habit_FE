import * as ort from 'onnxruntime-web'
import { koelectraPreprocess } from '@/lib/tokenizer/koelectra'

// ONNX Runtime 설정
ort.env.wasm.numThreads = 1
ort.env.wasm.simd = false
// WASM 파일 경로 설정
ort.env.wasm.wasmPaths = '/'

export interface KoELECTRAConfig {
  modelPath: string
  maxLength: number
  batchSize: number
}

export interface InferenceResult {
  logits: Float32Array
  embeddings?: Float32Array
  confidence: number
  processingTime: number
}

export interface KoELECTRALoader {
  session: ort.InferenceSession | null
  isLoaded: boolean
  isLoading: boolean
  error: string | null
  loadModel: () => Promise<void>
  unloadModel: () => void
  inference: (text: string) => Promise<InferenceResult>
  batchInference: (texts: string[]) => Promise<InferenceResult[]>
}

class KoELECTRAInferenceEngine implements KoELECTRALoader {
  private _session: ort.InferenceSession | null = null
  private _isLoaded = false
  private _isLoading = false
  private _error: string | null = null
  private _config: KoELECTRAConfig

  constructor(config: KoELECTRAConfig) {
    this._config = config
  }

  get session(): ort.InferenceSession | null {
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
    if (this._isLoaded || this._isLoading) {
      return
    }

    this._isLoading = true
    this._error = null

    try {
      console.log('[KoELECTRA] 모델 로딩 시작...')
      
      // ONNX 모델 로드
      this._session = await ort.InferenceSession.create(
        this._config.modelPath,
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          executionMode: 'sequential'
        }
      )

      console.log('[KoELECTRA] 모델 로딩 완료')
      console.log('[KoELECTRA] 입력 정보:', this._session.inputNames)
      console.log('[KoELECTRA] 출력 정보:', this._session.outputNames)

      this._isLoaded = true
      this._isLoading = false
    } catch (error) {
      console.error('[KoELECTRA] 모델 로딩 실패:', error)
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
    console.log('[KoELECTRA] 모델 언로드 완료')
  }

  async inference(text: string): Promise<InferenceResult> {
    if (!this._session || !this._isLoaded) {
      throw new Error('모델이 로드되지 않았습니다. loadModel()을 먼저 호출하세요.')
    }

    const startTime = performance.now()

    try {
      // 1. 텍스트 전처리 및 토크나이징
      const inputIds = await koelectraPreprocess(text)
      
      // 2. 입력 텐서 생성
      const inputTensor = new ort.Tensor('int64', new BigInt64Array(inputIds.map(id => BigInt(id))), [1, inputIds.length])
      
      // 3. 어텐션 마스크 생성 (패딩 토큰 제외)
      const attentionMask = new Array(inputIds.length).fill(1)
      const padIndex = 0 // [PAD] 토큰 인덱스
      for (let i = 0; i < inputIds.length; i++) {
        if (inputIds[i] === padIndex) {
          attentionMask[i] = 0
        }
      }
      const attentionMaskTensor = new ort.Tensor('int64', new BigInt64Array(attentionMask.map(mask => BigInt(mask))), [1, attentionMask.length])

      // 4. 추론 실행
      const feeds = {
        input_ids: inputTensor,
        attention_mask: attentionMaskTensor
      }

      const results = await this._session.run(feeds)
      
      // 5. 결과 처리
      const logits = results.logits?.data as Float32Array
      const embeddings = results.hidden_states?.data as Float32Array
      
      const processingTime = performance.now() - startTime
      
      // 6. 신뢰도 계산 (소프트맥스 적용)
      const confidence = this.calculateConfidence(logits)

      return {
        logits,
        embeddings,
        confidence,
        processingTime
      }
    } catch (error) {
      console.error('[KoELECTRA] 추론 실패:', error)
      throw error
    }
  }

  async batchInference(texts: string[]): Promise<InferenceResult[]> {
    const results: InferenceResult[] = []
    
    for (const text of texts) {
      try {
        const result = await this.inference(text)
        results.push(result)
      } catch (error) {
        console.error(`[KoELECTRA] 배치 추론 실패 (텍스트: "${text}"):`, error)
        // 에러가 발생한 경우 기본값 반환
        results.push({
          logits: new Float32Array(),
          confidence: 0,
          processingTime: 0
        })
      }
    }
    
    return results
  }

  private calculateConfidence(logits: Float32Array): number {
    if (!logits || logits.length === 0) {
      return 0
    }

    // 소프트맥스 적용
    const maxLogit = Math.max(...Array.from(logits))
    const expLogits = Array.from(logits).map(logit => Math.exp(logit - maxLogit))
    const sumExpLogits = expLogits.reduce((sum, exp) => sum + exp, 0)
    const softmax = expLogits.map(exp => exp / sumExpLogits)
    
    // 최대 확률을 신뢰도로 사용
    return Math.max(...softmax)
  }

  // 모델 정보 조회
  getModelInfo() {
    if (!this._session) {
      return null
    }

    return {
      inputNames: this._session.inputNames,
      outputNames: this._session.outputNames
    }
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
  if (!globalKoELECTRA) {
    globalKoELECTRA = new KoELECTRAInferenceEngine(config)
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