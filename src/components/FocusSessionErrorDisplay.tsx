"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Wifi, Camera, Server, RefreshCw, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { FocusSessionError, FocusSessionErrorType, FocusSessionStatus } from "@/types/focusSession"

interface FocusSessionErrorDisplayProps {
  sessionStatus: FocusSessionStatus
  sessionErrors: FocusSessionError[]
  lastSessionError: FocusSessionError | null
  canRecoverFromError: boolean
  onRetryRecovery: () => Promise<boolean>
  onDismissError: () => void
  isVisible?: boolean
}

const FocusSessionErrorDisplay = ({
  sessionStatus,
  sessionErrors,
  lastSessionError,
  canRecoverFromError,
  onRetryRecovery,
  onDismissError,
  isVisible = true
}: FocusSessionErrorDisplayProps) => {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryProgress, setRetryProgress] = useState(0)
  const [showDetails, setShowDetails] = useState(false)

  // 에러 타입별 아이콘 및 색상
  const getErrorDisplay = (errorType: FocusSessionErrorType) => {
    switch (errorType) {
      case FocusSessionErrorType.CAMERA_DISCONNECTED:
        return {
          icon: Camera,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          title: "카메라 연결 문제"
        }
      case FocusSessionErrorType.WEBSOCKET_FAILED:
        return {
          icon: Wifi,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          title: "서버 연결 문제"
        }
      case FocusSessionErrorType.GESTURE_SERVER_ERROR:
        return {
          icon: Server,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-200",
          title: "제스처 인식 서버 오류"
        }
      case FocusSessionErrorType.NETWORK_ERROR:
        return {
          icon: Wifi,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          title: "네트워크 연결 문제"
        }
      default:
        return {
          icon: AlertTriangle,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          title: "알 수 없는 오류"
        }
    }
  }

  // 상태별 표시
  const getStatusDisplay = (status: FocusSessionStatus) => {
    switch (status) {
      case FocusSessionStatus.ERROR:
        return {
          badge: "error",
          color: "destructive",
          text: "오류"
        }
      case FocusSessionStatus.RECOVERING:
        return {
          badge: "recovering",
          color: "default",
          text: "복구 중"
        }
      case FocusSessionStatus.ACTIVE:
        return {
          badge: "active",
          color: "default",
          text: "활성"
        }
      default:
        return {
          badge: "unknown",
          color: "secondary",
          text: "알 수 없음"
        }
    }
  }

  // 복구 시도
  const handleRetryRecovery = async () => {
    setIsRetrying(true)
    setRetryProgress(0)

    // 진행률 시뮬레이션
    const progressInterval = setInterval(() => {
      setRetryProgress(prev => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 200)

    try {
      const success = await onRetryRecovery()
      setRetryProgress(100)

      setTimeout(() => {
        setIsRetrying(false)
        setRetryProgress(0)
        if (success) {
          onDismissError()
        }
      }, 500)
    } catch (error) {
      console.error('복구 재시도 실패:', error)
      setIsRetrying(false)
      setRetryProgress(0)
    } finally {
      clearInterval(progressInterval)
    }
  }

  // 자동 해제 (복구 성공 시)
  useEffect(() => {
    if (sessionStatus === FocusSessionStatus.ACTIVE && lastSessionError) {
      const timer = setTimeout(() => {
        onDismissError()
      }, 3000) // 3초 후 자동 해제

      return () => clearTimeout(timer)
    }
  }, [sessionStatus, lastSessionError, onDismissError])

  if (!isVisible || !lastSessionError) return null

  const errorDisplay = getErrorDisplay(lastSessionError.type)
  const statusDisplay = getStatusDisplay(sessionStatus)
  const IconComponent = errorDisplay.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-50 w-96"
      >
        <Card className={`${errorDisplay.borderColor} border-2`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${errorDisplay.bgColor}`}>
                  <IconComponent className={`w-5 h-5 ${errorDisplay.color}`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">
                    {errorDisplay.title}
                  </CardTitle>
                  <Badge 
                    variant={statusDisplay.color as any} 
                    className="mt-1 text-xs"
                  >
                    {statusDisplay.text}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismissError}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 에러 메시지 */}
            <Alert className={`${errorDisplay.borderColor} ${errorDisplay.bgColor}`}>
              <AlertDescription className="text-sm">
                {lastSessionError.message}
              </AlertDescription>
            </Alert>

            {/* 복구 진행률 */}
            {sessionStatus === FocusSessionStatus.RECOVERING && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>복구 진행 중...</span>
                  <span>{retryProgress}%</span>
                </div>
                <Progress value={retryProgress} className="h-2" />
              </div>
            )}

            {/* 성공 메시지 */}
            {sessionStatus === FocusSessionStatus.ACTIVE && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-green-700 text-sm">
                  문제가 해결되었습니다. 집중 세션이 계속됩니다.
                </AlertDescription>
              </Alert>
            )}

            {/* 액션 버튼들 */}
            <div className="flex gap-2">
              {canRecoverFromError && sessionStatus === FocusSessionStatus.ERROR && (
                <Button
                  size="sm"
                  onClick={handleRetryRecovery}
                  disabled={isRetrying}
                  className="flex-1"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      복구 중...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      다시 시도
                    </>
                  )}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? '간단히' : '자세히'}
              </Button>
            </div>

            {/* 상세 정보 */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-2">
                    <div>
                      <strong>에러 타입:</strong> {lastSessionError.type}
                    </div>
                    <div>
                      <strong>발생 시간:</strong>{" "}
                      {new Date(lastSessionError.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <strong>재시도 횟수:</strong>{" "}
                      {lastSessionError.retryCount || 0} / {lastSessionError.maxRetries || 0}
                    </div>
                    {lastSessionError.details?.networkStatus && (
                      <div>
                        <strong>네트워크 상태:</strong>{" "}
                        {lastSessionError.details.networkStatus}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}

export default FocusSessionErrorDisplay
