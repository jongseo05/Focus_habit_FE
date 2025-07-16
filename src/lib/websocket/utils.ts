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

  getAverageLatency(): number {
    if (this.latencyHistory.length === 0) return 0
    return this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
  }

  getAverageThroughput(): number {
    if (this.throughputHistory.length === 0) return 0
    return this.throughputHistory.reduce((a, b) => a + b, 0) / this.throughputHistory.length
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

  cleanup(): void {
    this.latencyHistory = []
    this.throughputHistory = []
  }
}

// 프레임 스트리밍 상태 관리 (최적화 버전)
export class FrameStreamer {
  private intervalId: NodeJS.Timeout | null = null
  private isStreaming = false
  private frameRate = 10 // 초당 10프레임 (기본값)
  private quality = 0.9 // JPEG 품질
  
  // 동적 프레임레이트 관리
  private networkMonitor = new NetworkPerformanceMonitor()
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
  
  // 스트리밍 시작 (최적화 버전)
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
        const result = captureFrameAsJpegBase64(this.video, this.quality)
        this.captureCount++
        this.consecutiveFailures = 0 // 성공 시 실패 카운터 리셋
        
        // 메모리 관리: 배열 크기 제한
        this.addToLimitedArray(this.frameSizes, result.stats.sizeKB)
        this.addToLimitedArray(this.nonZeroPixelCounts, result.stats.nonZeroPixels)
        
        // 네트워크 성능 기록
        const frameProcessTime = Date.now() - frameStartTime
        this.networkMonitor.recordThroughput(result.stats.sizeKB * 1024, frameProcessTime)
        
        // 100번째 프레임마다 서버로 전송 (기존 로직 유지)
        if (this.captureCount % 100 === 0) {
          this.onFrame(result.base64)
        }
        
        // 동적 프레임레이트 조정 (5초마다)
        const now = Date.now()
        if (now - this.lastFrameRateAdjustment >= this.frameRateAdjustmentInterval) {
          this.adjustFrameRateBasedOnPerformance()
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
    
    console.log(`Frame streaming started at ${this.frameRate} FPS`)
  }
  
  // 메모리 관리를 위한 제한된 배열 추가 메서드
  private addToLimitedArray(array: number[], value: number): void {
    array.push(value)
    if (array.length > this.maxArraySize) {
      array.shift() // 가장 오래된 값 제거
    }
  }

  // 동적 프레임레이트 조정
  private adjustFrameRateBasedOnPerformance(): void {
    const recommendedFrameRate = this.networkMonitor.getRecommendedFrameRate()
    const currentFrameRate = this.frameRate
    
    // 프레임레이트 변경이 필요한 경우에만 조정
    if (Math.abs(recommendedFrameRate - currentFrameRate) >= 2) {
      console.log(`[동적 프레임레이트] ${currentFrameRate}fps -> ${recommendedFrameRate}fps로 조정`)
      this.setFrameRate(recommendedFrameRate)
    }
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
  
  // 스트리밍 중지 (메모리 정리 포함)
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isStreaming = false
    this.consecutiveFailures = 0
    
    // 메모리 정리
    this.networkMonitor.cleanup()
    this.frameSizes = []
    this.nonZeroPixelCounts = []
    
    // Canvas 풀 정리 (전역 정리는 조심스럽게)
    // CanvasPool.getInstance().cleanup() // 다른 인스턴스에서 사용 중일 수 있음
    
    console.log('Frame streaming stopped and memory cleaned')
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

  // 네트워크 성능 정보 반환
  getNetworkPerformance(): { latency: number; throughput: number; recommendedFPS: number } {
    return {
      latency: this.networkMonitor.getAverageLatency(),
      throughput: this.networkMonitor.getAverageThroughput(),
      recommendedFPS: this.networkMonitor.getRecommendedFrameRate()
    }
  }
  
  // 평균 통계 로그 출력 (최적화 버전)
  private logAverageStats(): void {
    if (this.frameSizes.length === 0) return
    
    const totalSamples = this.frameSizes.length
    const avgSize = this.frameSizes.reduce((a, b) => a + b, 0) / totalSamples
    const avgNonZeroPixels = this.nonZeroPixelCounts.reduce((a, b) => a + b, 0) / totalSamples
    const networkPerf = this.getNetworkPerformance()
    
    console.log(`[프레임 스트리밍 통계 - 10초]`)
    console.log(`  현재 프레임레이트: ${this.frameRate} FPS`)
    console.log(`  권장 프레임레이트: ${networkPerf.recommendedFPS} FPS`)
    console.log(`  캡처된 프레임: ${totalSamples}개`)
    console.log(`  평균 이미지 크기: ${avgSize.toFixed(2)} KB`)
    console.log(`  평균 비-제로 픽셀: ${Math.round(avgNonZeroPixels)}개`)
    console.log(`  총 전송된 프레임: ${Math.floor(this.captureCount / 100)}개`)
    console.log(`  평균 지연시간: ${networkPerf.latency.toFixed(1)} ms`)
    console.log(`  처리량: ${networkPerf.throughput.toFixed(2)} bytes/ms`)
    
    // 통계 데이터는 제한된 크기로 유지 (메모리 누수 방지)
    // 배열을 완전히 초기화하지 않고 크기만 제한
  }
}
