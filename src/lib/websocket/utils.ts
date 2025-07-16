// Base64 인코딩을 위한 유틸리티 함수
export function captureFrameAsJpegBase64(
  video: HTMLVideoElement, 
  quality: number = 0.8
): { base64: string; stats: { sizeKB: number; nonZeroPixels: number } } {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context를 생성할 수 없습니다.')
  }
  
  // 캔버스 크기 설정 (비디오 크기와 동일)
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  
  // 비디오 프레임을 캔버스에 그리기
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  
  // JPEG로 변환하여 Base64 인코딩
  const dataURL = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataURL.split(',')[1] // data:image/jpeg;base64, 부분 제거
  
  // 통계 정보 계산
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  
  let nonZeroPixels = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    
    // RGB 값이 모두 0이 아닌 픽셀 개수
    if (r !== 0 || g !== 0 || b !== 0) {
      nonZeroPixels++
    }
  }
  
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

// 프레임 스트리밍 상태 관리
export class FrameStreamer {
  private intervalId: NodeJS.Timeout | null = null
  private isStreaming = false
  private frameRate = 10 // 초당 10프레임
  private quality = 0.9 // JPEG 품질
  
  // 평균값 계산을 위한 데이터 수집
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
  
  // 스트리밍 시작
  start(): void {
    if (this.isStreaming) {
      console.warn('Frame streaming is already running')
      return
    }
    
    this.isStreaming = true
    this.consecutiveFailures = 0
    const interval = 1000 / this.frameRate // 100ms 간격
    
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
        
        const result = captureFrameAsJpegBase64(this.video, this.quality)
        this.captureCount++
        this.consecutiveFailures = 0 // 성공 시 실패 카운터 리셋
        
        // 통계 데이터 수집
        this.frameSizes.push(result.stats.sizeKB)
        this.nonZeroPixelCounts.push(result.stats.nonZeroPixels)
        
        // 10초마다 서버로 전송 (100번째 프레임마다)
        if (this.captureCount % 100 === 0) {
          this.onFrame(result.base64)
        }
        
        // 10초마다 평균값 로그 출력
        const now = Date.now()
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
  
  // 연속 실패 처리
  private handleContinuousFailure(reason: string): void {
    this.consecutiveFailures++
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.error(`연속 ${this.consecutiveFailures}회 실패. 스트리밍 중단: ${reason}`)
      this.stop()
      this.onError?.(new Error(`Frame streaming failed: ${reason}`))
    }
  }
  
  // 스트리밍 중지
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isStreaming = false
    this.consecutiveFailures = 0
    console.log('Frame streaming stopped')
  }
  
  // 프레임 레이트 변경
  setFrameRate(fps: number): void {
    this.frameRate = fps
    
    if (this.isStreaming) {
      this.stop()
      this.start()
    }
  }
  
  // 스트리밍 상태 확인
  getIsStreaming(): boolean {
    return this.isStreaming
  }
  
  // 평균 통계 로그 출력
  private logAverageStats(): void {
    if (this.frameSizes.length === 0) return
    
    const totalSamples = this.frameSizes.length
    const avgSize = this.frameSizes.reduce((a, b) => a + b, 0) / totalSamples
    const avgNonZeroPixels = this.nonZeroPixelCounts.reduce((a, b) => a + b, 0) / totalSamples
    
    console.log(`[10초 평균 통계]`)
    console.log(`  캡처된 프레임: ${totalSamples}개`)
    console.log(`  평균 이미지 크기: ${avgSize.toFixed(2)} KB`)
    console.log(`  평균 비-제로 픽셀: ${Math.round(avgNonZeroPixels)}개`)
    console.log(`  총 전송된 프레임: ${Math.floor(this.captureCount / 100)}개`)
    
    // 통계 데이터 초기화
    this.frameSizes = []
    this.nonZeroPixelCounts = []
  }
}
