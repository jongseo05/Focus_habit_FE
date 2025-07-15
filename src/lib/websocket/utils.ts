// 카메라 프레임을 JPEG Base64로 변환 (제스처 인식용)
export const captureFrameAsJpegBase64 = (
  video: HTMLVideoElement,
  quality: number = 0.8,
  maxWidth: number = 640,
  maxHeight: number = 480
): string => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Canvas context not available')
  }
  
  // 비디오 크기 가져오기
  const { videoWidth, videoHeight } = video
  
  // 종횡비 유지하며 최대 크기 제한
  let { width, height } = calculateResizeSize(videoWidth, videoHeight, maxWidth, maxHeight)
  
  canvas.width = width
  canvas.height = height
  
  // 좌우반전을 위한 변환 적용
  ctx.scale(-1, 1)
  ctx.translate(-width, 0)
  
  // 비디오 프레임을 캔버스에 그리기 (반전된 상태로)
  ctx.drawImage(video, 0, 0, width, height)
  
  // JPEG로 변환하고 Base64 추출
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  
  return base64
}

// 이미지 크기 계산 (종횡비 유지)
const calculateResizeSize = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight)
  
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  }
}

// 프레임 스트리밍 상태 관리
export class FrameStreamer {
  private intervalId: NodeJS.Timeout | null = null
  private isStreaming = false
  private frameRate = 10 // 초당 10프레임
  
  constructor(
    private video: HTMLVideoElement,
    private onFrame: (base64: string) => void,
    private onError?: (error: Error) => void
  ) {}
  
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
          const base64 = captureFrameAsJpegBase64(this.video)
          this.onFrame(base64)
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
}
