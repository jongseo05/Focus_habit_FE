// 카메라 프레임을 JPEG Base64로 변환 (제스처 인식용)
export const captureFrameAsJpegBase64 = (
  video: HTMLVideoElement,
  quality: number = 0.9
): { base64: string; stats: { sizeKB: number; nonZeroPixels: number; totalPixels: number } } => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context not available')
  }
  
  // 비디오의 원본 해상도 사용
  const { videoWidth, videoHeight } = video
  
  canvas.width = videoWidth
  canvas.height = videoHeight
  
  // 좌우반전을 위한 변환 적용
  ctx.scale(-1, 1)
  ctx.translate(-videoWidth, 0)
  
  // 비디오 프레임을 캔버스에 그리기 (원본 해상도로)
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
  
  // 디버깅: 캔버스 데이터 확인 (샘플링)
  const sampleSize = Math.min(100, videoWidth) * Math.min(100, videoHeight)
  const imageData = ctx.getImageData(0, 0, Math.min(100, videoWidth), Math.min(100, videoHeight))
  const pixels = imageData.data
  let nonZeroPixels = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0) {
      nonZeroPixels++
    }
  }
  
  // JPEG로 변환하고 Base64 추출
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  const sizeKB = Math.round(base64.length / 1024)
  
  return {
    base64,
    stats: {
      sizeKB,
      nonZeroPixels,
      totalPixels: sampleSize
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
    const interval = 1000 / this.frameRate // 100ms 간격
    
    this.intervalId = setInterval(() => {
      try {
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA
          // 비디오 상태 추가 확인
          if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
            console.warn('⚠️ 비디오 크기가 0입니다. 스트림에 문제가 있을 수 있습니다.')
            return
          }
          
          if (this.video.paused || this.video.ended) {
            console.warn('⚠️ 비디오가 일시정지되었거나 종료되었습니다.')
            return
          }
          
          const result = captureFrameAsJpegBase64(this.video, this.quality)
          this.captureCount++
          
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
          
        } else {
          console.warn(`⚠️ 비디오 readyState가 낮습니다: ${this.video.readyState}`)
        }
      } catch (error) {
        console.error('Frame capture error:', error)
        this.onError?.(error as Error)
      }
    }, interval)
    
    console.log(`Frame streaming started at ${this.frameRate} FPS`)
  }
  
  // 스트리밍 중지
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.isStreaming = false
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
    
    const avgSize = Math.round(this.frameSizes.reduce((a, b) => a + b, 0) / this.frameSizes.length)
    const avgPixels = Math.round(this.nonZeroPixelCounts.reduce((a, b) => a + b, 0) / this.nonZeroPixelCounts.length)
    const totalSamples = this.frameSizes.length
    const pixelActivity = Math.round((avgPixels / 10000) * 100) // 100x100 샘플에서 활성 픽셀 비율
    
    console.log(`📊 [10초 평균 통계]`)
    console.log(`  📸 캡처된 프레임: ${totalSamples}개`)
    console.log(`  💾 평균 이미지 크기: ${avgSize}KB`)
    console.log(`  🎨 평균 활성 픽셀: ${avgPixels}/10000 (${pixelActivity}%)`)
    console.log(`  🎥 해상도: ${this.video.videoWidth}×${this.video.videoHeight}`)
    console.log(`  🎯 품질 설정: ${Math.round(this.quality * 100)}%`)
    console.log(`  ⏱️  전송 빈도: 10초마다 1회 (${this.frameRate}fps로 수집)`)
    
    // 경고 메시지
    if (avgSize < 10) {
      console.warn(`⚠️ 평균 이미지 크기가 매우 작습니다 (${avgSize}KB). 얼굴 인식에 어려움이 있을 수 있습니다.`)
    }
    
    if (pixelActivity < 20) {
      console.warn(`⚠️ 활성 픽셀이 적습니다 (${pixelActivity}%). 카메라가 가려져 있거나 조명이 어둡습니다.`)
    }
    
    // 데이터 초기화
    this.frameSizes = []
    this.nonZeroPixelCounts = []
  }
}
