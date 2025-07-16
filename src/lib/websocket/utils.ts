// Canvas 메모리 풀링을 위한 캐시
class CanvasPool {
  private static instance: CanvasPool
  private canvasCache = new Map<string, HTMLCanvasElement>()
  private maxCacheSize = 3

  static getInstance(): CanvasPool {
    if (!CanvasPool.instance) {
      CanvasPool.instance = new CanvasPool()
    }
    return CanvasPool.instance
  }

  getCanvas(width: number, height: number): HTMLCanvasElement {
    const key = `${width}x${height}`
    let canvas = this.canvasCache.get(key)
    
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      // 캐시 크기 제한
      if (this.canvasCache.size >= this.maxCacheSize) {
        const firstKey = this.canvasCache.keys().next().value
        if (firstKey) {
          this.canvasCache.delete(firstKey)
        }
      }
      
      this.canvasCache.set(key, canvas)
    }
    
    return canvas
  }

  cleanup(): void {
    this.canvasCache.clear()
  }
}

// Base64 인코딩을 위한 유틸리티 함수 (메모리 최적화 버전)
export function captureFrameAsJpegBase64(
  video: HTMLVideoElement, 
  quality: number = 0.8
): { base64: string; stats: { sizeKB: number; nonZeroPixels: number } } {
  const canvasPool = CanvasPool.getInstance()
  const canvas = canvasPool.getCanvas(video.videoWidth, video.videoHeight)
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context를 생성할 수 없습니다.')
  }
  
  // 캔버스 클리어 (이전 프레임 데이터 제거)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 비디오 프레임을 캔버스에 그리기
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  // JPEG로 변환하여 Base64 인코딩
  const dataURL = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataURL.split(',')[1] // data:image/jpeg;base64, 부분 제거
  
  // 통계 정보 계산 (메모리 효율적으로 개선)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  
  let nonZeroPixels = 0
  // 4픽셀씩 건너뛰며 샘플링하여 성능 개선
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    
    // RGB 값이 모두 0이 아닌 픽셀 개수
    if (r !== 0 || g !== 0 || b !== 0) {
      nonZeroPixels++
    }
  }
  // 샘플링 비율에 따른 보정
  nonZeroPixels *= 4
  
  // Base64 문자열의 크기 (KB)
  const sizeKB = Math.round((base64.length * 3) / 4 / 1024 * 100) / 100
  
  return {
    base64,
    stats: {
      sizeKB,
      nonZeroPixels
    }
  }
}

// 동적 프레임레이트 관리를 위한 네트워크 모니터
class NetworkPerformanceMonitor {
  private latencyHistory: number[] = []
  private throughputHistory: number[] = []
  private connectionQualityHistory: number[] = []
  private lastSendTime = 0
  private lastReceiveTime = 0
  private readonly maxHistorySize = 20

  recordLatency(latency: number): void {
    this.latencyHistory.push(latency)
    if (this.latencyHistory.length > this.maxHistorySize) {
      this.latencyHistory.shift()
    }
  }

  recordThroughput(bytes: number, duration: number): void {
    if (duration > 0) {
      const throughput = bytes / duration // bytes per ms
      this.throughputHistory.push(throughput)
      if (this.throughputHistory.length > this.maxHistorySize) {
        this.throughputHistory.shift()
      }
    }
  }

  recordConnectionQuality(score: number): void {
    // 연결 품질 점수 (0-100)
    this.connectionQualityHistory.push(Math.max(0, Math.min(100, score)))
    if (this.connectionQualityHistory.length > this.maxHistorySize) {
      this.connectionQualityHistory.shift()
    }
  }

  getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0
    return this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
  }

  getAverageThroughput(): number {
    if (this.throughputHistory.length === 0) return 0
    return this.throughputHistory.reduce((a, b) => a + b, 0) / this.throughputHistory.length
  }

  getConnectionQualityScore(): number {
    if (this.connectionQualityHistory.length === 0) return 50 // 기본값
    return this.connectionQualityHistory.reduce((a, b) => a + b, 0) / this.connectionQualityHistory.length
  }

  getRecommendedFrameRate(): number {
    const avgLatency = this.getAverageLatency()
    const avgThroughput = this.getAverageThroughput()

    // 네트워크 상태에 따른 동적 프레임레이트 결정
    if (avgLatency < 100 && avgThroughput > 1000) {
      return 15 // 높은 품질
    } else if (avgLatency < 300 && avgThroughput > 500) {
      return 10 // 보통 품질
    } else if (avgLatency < 500) {
      return 5  // 낮은 품질
    } else {
      return 2  // 최소 품질
    }
  }

  getRecommendedReconnectInterval(): number {
    const quality = this.getConnectionQualityScore()
    const latency = this.getAverageLatency()
    
    // 연결 품질에 따른 적응형 재연결 간격
    if (quality > 80 && latency < 200) {
      return 1000 // 좋은 연결: 1초
    } else if (quality > 60 && latency < 500) {
      return 3000 // 보통 연결: 3초
    } else if (quality > 40) {
      return 5000 // 나쁜 연결: 5초
    } else {
      return 10000 // 매우 나쁜 연결: 10초
    }
  }

  cleanup(): void {
    this.latencyHistory = []
    this.throughputHistory = []
    this.connectionQualityHistory = []
  }
}

// 적응형 이미지 압축 관리자
class AdaptiveCompressionManager {
  private qualityHistory: number[] = []
  private sizeHistory: number[] = []
  private readonly maxHistorySize = 10
  private currentQuality = 0.8
  private readonly minQuality = 0.3
  private readonly maxQuality = 0.95
  private readonly targetSizeKB = 30 // 목표 파일 크기 (KB)

  recordFrame(quality: number, sizeKB: number): void {
    this.qualityHistory.push(quality)
    this.sizeHistory.push(sizeKB)
    
    if (this.qualityHistory.length > this.maxHistorySize) {
      this.qualityHistory.shift()
      this.sizeHistory.shift()
    }
  }

  getOptimalQuality(networkCondition: 'good' | 'medium' | 'poor'): number {
    const avgSize = this.sizeHistory.length > 0 
      ? this.sizeHistory.reduce((a, b) => a + b, 0) / this.sizeHistory.length 
      : this.targetSizeKB

    // 네트워크 상태와 파일 크기에 따른 품질 조정
    let targetQuality = this.currentQuality

    if (avgSize > this.targetSizeKB * 1.5) {
      // 파일이 너무 큰 경우 품질 낮춤
      targetQuality = Math.max(this.minQuality, this.currentQuality - 0.1)
    } else if (avgSize < this.targetSizeKB * 0.7) {
      // 파일이 작은 경우 품질 높임
      targetQuality = Math.min(this.maxQuality, this.currentQuality + 0.05)
    }

    // 네트워크 상태에 따른 추가 조정
    switch (networkCondition) {
      case 'poor':
        targetQuality = Math.max(this.minQuality, targetQuality - 0.1)
        break
      case 'good':
        targetQuality = Math.min(this.maxQuality, targetQuality + 0.05)
        break
      // medium은 그대로 유지
    }

    this.currentQuality = targetQuality
    return this.currentQuality
  }

  getCurrentQuality(): number {
    return this.currentQuality
  }

  getCompressionStats(): { avgQuality: number; avgSize: number; currentQuality: number } {
    const avgQuality = this.qualityHistory.length > 0
      ? this.qualityHistory.reduce((a, b) => a + b, 0) / this.qualityHistory.length
      : this.currentQuality
    
    const avgSize = this.sizeHistory.length > 0
      ? this.sizeHistory.reduce((a, b) => a + b, 0) / this.sizeHistory.length
      : 0

    return {
      avgQuality,
      avgSize,
      currentQuality: this.currentQuality
    }
  }

  cleanup(): void {
    this.qualityHistory = []
    this.sizeHistory = []
  }
}

// 배치 전송 관리자
class BatchTransmissionManager {
  private frameBatch: string[] = []
  private batchSize = 5 // 기본 배치 크기
  private lastTransmissionTime = Date.now()
  private readonly maxBatchSize = 10
  private readonly minBatchSize = 1
  private readonly maxWaitTime = 2000 // 최대 대기 시간 (2초)

  addFrame(base64Frame: string): boolean {
    this.frameBatch.push(base64Frame)
    
    // 배치가 가득 찼거나 최대 대기 시간 초과 시 전송 필요
    const timeElapsed = Date.now() - this.lastTransmissionTime
    const shouldTransmit = this.frameBatch.length >= this.batchSize || timeElapsed >= this.maxWaitTime
    
    return shouldTransmit
  }

  getBatchAndClear(): string[] {
    const batch = [...this.frameBatch]
    this.frameBatch = []
    this.lastTransmissionTime = Date.now()
    return batch
  }

  adjustBatchSize(networkCondition: 'good' | 'medium' | 'poor'): void {
    switch (networkCondition) {
      case 'good':
        this.batchSize = Math.min(this.maxBatchSize, this.batchSize + 1)
        break
      case 'poor':
        this.batchSize = Math.max(this.minBatchSize, this.batchSize - 1)
        break
      // medium은 그대로 유지
    }
  }

  getCurrentBatchSize(): number {
    return this.batchSize
  }

  getPendingFramesCount(): number {
    return this.frameBatch.length
  }

  cleanup(): void {
    this.frameBatch = []
  }
}

// 프레임 스트리밍 상태 관리 (고급 최적화 버전)
export class FrameStreamer {
  private intervalId: NodeJS.Timeout | null = null
  private isStreaming = false
  private frameRate = 10 // 초당 10프레임 (기본값)
  private quality = 0.9 // JPEG 품질
  
  // 고급 최적화 관리자들
  private networkMonitor = new NetworkPerformanceMonitor()
  private compressionManager = new AdaptiveCompressionManager()
  private batchManager = new BatchTransmissionManager()
  
  // 동적 프레임레이트 관리
  private lastFrameRateAdjustment = Date.now()
  private frameRateAdjustmentInterval = 5000 // 5초마다 조정
  
  // 메모리 관리 (크기 제한)
  private readonly maxArraySize = 50 // 배열 크기 제한
  private frameSizes: number[] = []
  private nonZeroPixelCounts: number[] = []
  private captureCount = 0
  private lastLogTime = Date.now()
  private logInterval = 10000 // 10초마다 로그
  
  // 에러 처리를 위한 상태
  private consecutiveFailures = 0
  private maxConsecutiveFailures = 5
  
  constructor(
    private video: HTMLVideoElement,
    private onFrame: (base64: string) => void,
    private onError?: (error: Error) => void,
    quality?: number
  ) {
    if (quality !== undefined) {
      this.quality = quality
    }
  }
  
  // 스트리밍 시작 (고급 최적화 버전)
  start(): void {
    if (this.isStreaming) {
      console.warn('Frame streaming is already running')
      return
    }
    
    this.isStreaming = true
    this.consecutiveFailures = 0
    const interval = 1000 / this.frameRate
    
    this.intervalId = setInterval(() => {
      try {
        // 비디오 상태 확인
        if (!this.video || this.video.readyState < 2) {
          console.warn('비디오가 준비되지 않았습니다. readyState:', this.video?.readyState)
          this.handleContinuousFailure('Video not ready')
          return
        }

        // 비디오 크기 확인
        if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
          console.warn('비디오 크기가 0입니다. 스트림에 문제가 있을 수 있습니다.')
          this.handleContinuousFailure('Video dimensions are zero')
          return
        }
        
        // 비디오 재생 상태 확인
        if (this.video.paused || this.video.ended) {
          console.warn('비디오가 일시정지되었거나 종료되었습니다.')
          this.handleContinuousFailure('Video is paused or ended')
          return
        }
        
        const frameStartTime = Date.now()
        
        // 네트워크 상태 평가
        const networkCondition = this.evaluateNetworkCondition()
        
        // 적응형 압축 품질 결정
        const optimalQuality = this.compressionManager.getOptimalQuality(networkCondition)
        
        const result = captureFrameAsJpegBase64(this.video, optimalQuality)
        this.captureCount++
        this.consecutiveFailures = 0 // 성공 시 실패 카운터 리셋
        
        // 압축 통계 기록
        this.compressionManager.recordFrame(optimalQuality, result.stats.sizeKB)
        
        // 메모리 관리: 배열 크기 제한
        this.addToLimitedArray(this.frameSizes, result.stats.sizeKB)
        this.addToLimitedArray(this.nonZeroPixelCounts, result.stats.nonZeroPixels)
        
        // 네트워크 성능 기록
        const frameProcessTime = Date.now() - frameStartTime
        this.networkMonitor.recordThroughput(result.stats.sizeKB * 1024, frameProcessTime)
        
        // 배치 전송 관리
        const shouldTransmit = this.batchManager.addFrame(result.base64)
        
        if (shouldTransmit) {
          const frameBatch = this.batchManager.getBatchAndClear()
          // 배치로 전송 (기존 단일 프레임 전송 대신)
          this.onFrame(frameBatch.join('|')) // 구분자로 연결
        }
        
        // 동적 프레임레이트 조정 (5초마다)
        const now = Date.now()
        if (now - this.lastFrameRateAdjustment >= this.frameRateAdjustmentInterval) {
          this.adjustPerformanceSettings()
          this.lastFrameRateAdjustment = now
        }
        
        // 10초마다 평균값 로그 출력
        if (now - this.lastLogTime >= this.logInterval) {
          this.logAverageStats()
          this.lastLogTime = now
        }
        
      } catch (error) {
        console.error('Frame capture error:', error)
        this.handleContinuousFailure(`Capture error: ${(error as Error).message}`)
      }
    }, interval)
    
    console.log(`Frame streaming started at ${this.frameRate} FPS with adaptive optimization`)
  }
  
  // 메모리 관리를 위한 제한된 배열 추가 메서드
  private addToLimitedArray(array: number[], value: number): void {
    array.push(value)
    if (array.length > this.maxArraySize) {
      array.shift() // 가장 오래된 값 제거
    }
  }

  // 네트워크 상태 평가
  private evaluateNetworkCondition(): 'good' | 'medium' | 'poor' {
    const latency = this.networkMonitor.getAverageLatency()
    const throughput = this.networkMonitor.getAverageThroughput()
    const quality = this.networkMonitor.getConnectionQualityScore()
    
    if (latency < 200 && throughput > 500 && quality > 70) {
      return 'good'
    } else if (latency < 500 && throughput > 200 && quality > 40) {
      return 'medium'
    } else {
      return 'poor'
    }
  }

  // 종합적인 성능 설정 조정
  private adjustPerformanceSettings(): void {
    const networkCondition = this.evaluateNetworkCondition()
    
    // 프레임레이트 조정
    const recommendedFrameRate = this.networkMonitor.getRecommendedFrameRate()
    const currentFrameRate = this.frameRate
    
    if (Math.abs(recommendedFrameRate - currentFrameRate) >= 2) {
      console.log(`[동적 프레임레이트] ${currentFrameRate}fps -> ${recommendedFrameRate}fps로 조정`)
      this.setFrameRate(recommendedFrameRate)
    }
    
    // 배치 크기 조정
    this.batchManager.adjustBatchSize(networkCondition)
    
    // 연결 품질 점수 계산 및 기록
    const qualityScore = this.calculateConnectionQuality(networkCondition)
    this.networkMonitor.recordConnectionQuality(qualityScore)
  }

  // 연결 품질 점수 계산
  private calculateConnectionQuality(networkCondition: 'good' | 'medium' | 'poor'): number {
    const latency = this.networkMonitor.getAverageLatency()
    const throughput = this.networkMonitor.getAverageThroughput()
    
    let score = 50 // 기본 점수
    
    // 지연시간 기반 점수 (0-40점)
    if (latency < 100) score += 40
    else if (latency < 200) score += 30
    else if (latency < 300) score += 20
    else if (latency < 500) score += 10
    
    // 처리량 기반 점수 (0-40점)
    if (throughput > 1000) score += 40
    else if (throughput > 500) score += 30
    else if (throughput > 200) score += 20
    else if (throughput > 100) score += 10
    
    // 실패율 기반 감점 (0-20점)
    const failureRate = this.consecutiveFailures / this.maxConsecutiveFailures
    score -= failureRate * 20
    
    return Math.max(0, Math.min(100, score))
  }

  // 동적 프레임레이트 조정 (기존 메서드명 유지)
  private adjustFrameRateBasedOnPerformance(): void {
    this.adjustPerformanceSettings()
  }

  // 연속 실패 처리
  private handleContinuousFailure(reason: string): void {
    this.consecutiveFailures++
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.error(`연속 ${this.consecutiveFailures}회 실패. 스트리밍 중단: ${reason}`)
      this.stop()
      this.onError?.(new Error(`Frame streaming failed: ${reason}`))
    }
  }
  
  // 스트리밍 중지 (고급 메모리 정리 포함)
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isStreaming = false
    this.consecutiveFailures = 0
    
    // 모든 관리자 메모리 정리
    this.networkMonitor.cleanup()
    this.compressionManager.cleanup()
    this.batchManager.cleanup()
    
    // 기본 통계 데이터 정리
    this.frameSizes = []
    this.nonZeroPixelCounts = []
    
    // Canvas 풀 정리 (전역 정리는 조심스럽게)
    // CanvasPool.getInstance().cleanup() // 다른 인스턴스에서 사용 중일 수 있음
    
    console.log('Frame streaming stopped and all memory cleaned')
  }
  
  // 프레임 레이트 변경 (최적화 버전)
  setFrameRate(fps: number): void {
    // 유효한 범위로 제한 (1~30 FPS)
    this.frameRate = Math.max(1, Math.min(30, fps))
    
    if (this.isStreaming) {
      // 스트리밍 중인 경우 재시작 (더 부드러운 전환)
      this.stop()
      setTimeout(() => this.start(), 100) // 100ms 지연 후 재시작
    }
  }
  
  // 스트리밍 상태 확인
  getIsStreaming(): boolean {
    return this.isStreaming
  }

  // 현재 프레임레이트 반환
  getCurrentFrameRate(): number {
    return this.frameRate
  }

  // 네트워크 성능 정보 반환 (확장 버전)
  getNetworkPerformance(): { 
    latency: number; 
    throughput: number; 
    recommendedFPS: number;
    connectionQuality: number;
    reconnectInterval: number;
  } {
    return {
      latency: this.networkMonitor.getAverageLatency(),
      throughput: this.networkMonitor.getAverageThroughput(),
      recommendedFPS: this.networkMonitor.getRecommendedFrameRate(),
      connectionQuality: this.networkMonitor.getConnectionQualityScore(),
      reconnectInterval: this.networkMonitor.getRecommendedReconnectInterval()
    }
  }

  // 압축 성능 정보 반환
  getCompressionPerformance(): {
    avgQuality: number;
    avgSize: number;
    currentQuality: number;
  } {
    return this.compressionManager.getCompressionStats()
  }

  // 배치 전송 정보 반환
  getBatchInfo(): {
    currentBatchSize: number;
    pendingFrames: number;
  } {
    return {
      currentBatchSize: this.batchManager.getCurrentBatchSize(),
      pendingFrames: this.batchManager.getPendingFramesCount()
    }
  }
  
  // 평균 통계 로그 출력 (고급 최적화 버전)
  private logAverageStats(): void {
    if (this.frameSizes.length === 0) return
    
    const totalSamples = this.frameSizes.length
    const avgSize = this.frameSizes.reduce((a, b) => a + b, 0) / totalSamples
    const avgNonZeroPixels = this.nonZeroPixelCounts.reduce((a, b) => a + b, 0) / totalSamples
    const networkPerf = this.getNetworkPerformance()
    const compressionPerf = this.getCompressionPerformance()
    const batchInfo = this.getBatchInfo()
    
    console.log(`[🚀 프레임 스트리밍 고급 통계 - 10초]`)
    console.log(`  📊 기본 정보:`)
    console.log(`    현재 프레임레이트: ${this.frameRate} FPS`)
    console.log(`    권장 프레임레이트: ${networkPerf.recommendedFPS} FPS`)
    console.log(`    캡처된 프레임: ${totalSamples}개`)
    console.log(`    평균 이미지 크기: ${avgSize.toFixed(2)} KB`)
    console.log(`    평균 비-제로 픽셀: ${Math.round(avgNonZeroPixels)}개`)
    
    console.log(`  🌐 네트워크 성능:`)
    console.log(`    평균 지연시간: ${networkPerf.latency.toFixed(1)} ms`)
    console.log(`    처리량: ${networkPerf.throughput.toFixed(2)} bytes/ms`)
    console.log(`    연결 품질: ${networkPerf.connectionQuality.toFixed(1)}/100`)
    console.log(`    권장 재연결 간격: ${networkPerf.reconnectInterval} ms`)
    
    console.log(`  🗜️ 압축 최적화:`)
    console.log(`    현재 압축 품질: ${(compressionPerf.currentQuality * 100).toFixed(1)}%`)
    console.log(`    평균 압축 품질: ${(compressionPerf.avgQuality * 100).toFixed(1)}%`)
    console.log(`    평균 압축 크기: ${compressionPerf.avgSize.toFixed(2)} KB`)
    
    console.log(`  📦 배치 전송:`)
    console.log(`    현재 배치 크기: ${batchInfo.currentBatchSize}개`)
    console.log(`    대기 중인 프레임: ${batchInfo.pendingFrames}개`)
    
    // 통계 데이터는 제한된 크기로 유지 (메모리 누수 방지)
    // 배열을 완전히 초기화하지 않고 크기만 제한
  }
}
