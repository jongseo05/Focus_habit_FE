"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { X, Move, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebcamPreviewProps {
  stream: MediaStream | null
  onClose: () => void
}

// 사이즈 제한
const MIN_SIZE = { width: 100, height: 75 }
const MAX_SIZE = { width: 400, height: 300 }
const DEFAULT_SIZE = { width: 150, height: 112 }

type DragMode = 'move' | 'resize' | null

const WebcamPreview = ({ stream, onClose }: WebcamPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVideoReady, setIsVideoReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [position, setPosition] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - DEFAULT_SIZE.width - 24 : 100, 
    y: 80 
  })
  const [showControls, setShowControls] = useState(false)
  const [dragMode, setDragMode] = useState<DragMode>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0, startWidth: 0, startHeight: 0 })

  // 위치 초기화 (화면 크기 변경 시)
  const resetPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - size.width - 24, y: 80 })
    }
  }, [size.width])

  // 마우스 다운 핸들러 (이동)
  const handleMoveStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setDragMode('move')
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
      startX: position.x,
      startY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    })
  }

  // 마우스 다운 핸들러 (리사이즈)
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragMode('resize')
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    })
  }

  // 마우스 이동 핸들러
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragMode || typeof window === 'undefined') return

    if (dragMode === 'move') {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y
      
      // 화면 경계 체크
      const maxX = window.innerWidth - size.width
      const maxY = window.innerHeight - size.height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    } else if (dragMode === 'resize') {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      // 대각선 드래그로 비율 유지하면서 크기 조절
      const aspectRatio = 4 / 3 // 4:3 비율 유지
      const scale = Math.max(deltaX, deltaY) / 100 // 감도 조절
      
      let newWidth = dragStart.startWidth + deltaX
      let newHeight = dragStart.startHeight + deltaY
      
      // 비율 유지
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newHeight = newWidth / aspectRatio
      } else {
        newWidth = newHeight * aspectRatio
      }
      
      // 최소/최대 크기 제한
      newWidth = Math.max(MIN_SIZE.width, Math.min(MAX_SIZE.width, newWidth))
      newHeight = Math.max(MIN_SIZE.height, Math.min(MAX_SIZE.height, newHeight))
      
      // 비율 재조정
      newHeight = newWidth / aspectRatio
      
      setSize({ width: newWidth, height: newHeight })
      
      // 위치 조정 (화면 밖으로 나가지 않도록)
      const maxX = window.innerWidth - newWidth
      const maxY = window.innerHeight - newHeight
      
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY)),
      }))
    }
  }, [dragMode, dragStart, size.width, size.height])

  // 마우스 업 핸들러
  const handleMouseUp = useCallback(() => {
    setDragMode(null)
  }, [])

  // 이벤트 리스너 등록/해제
  useEffect(() => {
    if (dragMode && typeof window !== 'undefined') {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragMode, handleMouseMove, handleMouseUp])

  // 화면 크기 변경 시 위치 조정
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleResize = () => {
      const maxX = window.innerWidth - size.width
      const maxY = window.innerHeight - size.height
      
      setPosition(prev => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY)),
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [size])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) {
      setIsVideoReady(false)
      return
    }

    const setupVideo = async () => {
      try {
        // 이전 스트림이 있다면 정리
        if (video.srcObject) {
          video.srcObject = null
        }

        // 새 스트림 설정
        video.srcObject = stream
        
        // 비디오 메타데이터 로드 대기
        await new Promise((resolve, reject) => {
          const handleLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('error', handleError)
            resolve(void 0)
          }
          
          const handleError = (e: Event) => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata)
            video.removeEventListener('error', handleError)
            reject(new Error('비디오 로드 실패'))
          }

          video.addEventListener('loadedmetadata', handleLoadedMetadata)
          video.addEventListener('error', handleError)
        })

        // 안전하게 재생 시작
        try {
          await video.play()
          setIsVideoReady(true)
          setError(null)
        } catch (playError: any) {
          // play() 오류는 대부분 무시해도 됨 (autoplay로 처리됨)
          if (playError.name !== 'AbortError') {
            console.warn('Video play warning:', playError.message)
          }
          setIsVideoReady(true) // autoplay가 처리할 것으로 예상
        }

      } catch (setupError: any) {
        console.error('Video setup failed:', setupError)
        setError('비디오 설정에 실패했습니다.')
        setIsVideoReady(false)
      }
    }

    setupVideo()

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (video) {
        video.pause()
        video.srcObject = null
      }
    }
  }, [stream])

  // 스트림이 없으면 렌더링하지 않음
  if (!stream) {
    return null
  }

  // 스트림이 없으면 렌더링하지 않음
  if (!stream) {
    return null
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed z-40 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden shadow-xl border-2 border-white relative group">
        {/* 드래그 핸들 (상단 바) */}
        <div 
          className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/50 to-transparent z-10 cursor-move flex items-center justify-center"
          onMouseDown={handleMoveStart}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showControls ? 1 : 0.3 }}
            className="flex items-center gap-1"
          >
            <Move className="w-3 h-3 text-white/80" />
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-white/60 rounded-full"></div>
              <div className="w-1 h-1 bg-white/60 rounded-full"></div>
              <div className="w-1 h-1 bg-white/60 rounded-full"></div>
            </div>
          </motion.div>
        </div>

        {/* 컨트롤 버튼들 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          className="absolute top-1 right-1 z-20 flex gap-1"
        >
          {/* 위치 리셋 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            className="w-5 h-5 p-0 text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => {
              e.stopPropagation()
              resetPosition()
            }}
            title="위치 리셋"
          >
            <RotateCcw className="w-2.5 h-2.5" />
          </Button>

          {/* 닫기 버튼 */}
          <Button
            variant="ghost"
            size="sm"
            className="w-5 h-5 p-0 text-white hover:bg-white/20 bg-black/30"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            title="미리보기 숨기기 (카메라는 계속 작동)"
          >
            <X className="w-2.5 h-2.5" />
          </Button>
        </motion.div>

        {/* 크기 조절 핸들 (우하단) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          className="absolute bottom-1 right-1 z-20 w-4 h-4 cursor-nw-resize"
          onMouseDown={handleResizeStart}
          title="드래그하여 크기 조절"
        >
          <div className="w-full h-full bg-black/50 rounded-tl-lg flex items-end justify-end p-0.5">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-0.5 h-0.5 bg-white/80 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-white/80 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-white/80 rounded-full"></div>
              <div className="w-0.5 h-0.5 bg-white/80 rounded-full"></div>
            </div>
          </div>
        </motion.div>

        {/* 크기 표시 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showControls ? 1 : 0 }}
          className="absolute bottom-1 left-1 z-20"
        >
          <div className="text-white text-xs bg-black/50 px-1.5 py-0.5 rounded text-center">
            {Math.round(size.width)}×{Math.round(size.height)}
          </div>
        </motion.div>

        {/* 비디오 콘텐츠 */}
        <div className="w-full h-full relative">
          {error ? (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
              <span className="text-white text-xs text-center px-2">
                카메라 오류
              </span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isVideoReady ? 'opacity-100' : 'opacity-0'
                }`}
              />
              
              {/* 로딩 상태 */}
              {!isVideoReady && (
                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                  <div className="text-white text-xs">
                    <div className="animate-pulse">카메라 준비 중...</div>
                  </div>
                </div>
              )}
              
              {/* LIVE 표시 */}
              {isVideoReady && (
                <>
                  <div className="absolute top-2 left-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="absolute top-7 left-2 text-white text-xs bg-black/50 px-1.5 py-0.5 rounded">
                    LIVE
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* 사용법 안내 (처음에만 표시) */}
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-10 left-0 right-0 text-center pointer-events-none"
          >
            <div className="text-xs text-white bg-black/70 px-2 py-1 rounded whitespace-nowrap mx-auto inline-block">
              상단 바: 이동 • 우하단: 크기 조절
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

export default WebcamPreview
