"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, AlertTriangle, RefreshCw, Settings, X, CheckCircle, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface MicrophonePermissionLayerProps {
  isVisible: boolean
  isLoading: boolean
  error: string | null
  isPermissionDenied: boolean
  isPermissionGranted: boolean
  onRequestPermission: () => Promise<boolean>
  onRetry: () => Promise<boolean>
  onClose: () => void
  onDismissError: () => void
}

const MicrophonePermissionLayer = ({
  isVisible,
  isLoading,
  error,
  isPermissionDenied,
  isPermissionGranted,
  onRequestPermission,
  onRetry,
  onClose,
  onDismissError,
}: MicrophonePermissionLayerProps) => {
  const [showHelp, setShowHelp] = useState(false)

  // AudioContext, AudioWorkletNode 관리용 ref
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  // 16kHz mono 스트림 획득 및 AudioWorkletNode 연결
  const handlePermissionRequest = async () => {
    const success = await onRequestPermission()
    if (success && navigator.mediaDevices?.getUserMedia) {
      try {
        // 16kHz mono 스트림 요청
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1 }
        })
        // AudioContext 생성
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
        audioContextRef.current = audioContext
        // AudioWorkletProcessor 등록
        await audioContext.audioWorklet.addModule('/audio/stft-mel-processor.js')
        const workletNode = new AudioWorkletNode(audioContext, 'stft-mel-processor')
        workletNodeRef.current = workletNode
        // 마이크 스트림을 AudioContext에 연결
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(workletNode)
        // workletNode.connect(audioContext.destination) // 필요시 모니터링용

        // Web Worker 예시 (ML 추론용, 실제 worker 구현 필요)
        // const worker = new Worker('/audio/ml-inference-worker.js')
        // workletNode.port.onmessage = (e) => {
        //   if (e.data && e.data.mel) {
        //     worker.postMessage({ mel: e.data.mel })
        //   }
        // }
        // worker.onmessage = (e) => {
        //   // 추론 결과 수신 및 후처리
        //   // e.data: { result, ... }
        // }
        

      } catch (err) {
        // 에러 처리만 유지
      }
    }
    // 자동으로 닫지 않음 - Dashboard의 useEffect에서 상태 변화를 감지하여 처리
  }

  const renderBrowserInstructions = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { browserName: 'browser', instructions: [] }
    }
    const userAgent = navigator.userAgent.toLowerCase()
    let browserName = 'browser'
    let instructions: string[] = []
    if (userAgent.includes('chrome')) {
      browserName = 'Chrome'
      instructions = [
        '주소창 왼쪽의 마이크 아이콘을 클릭하세요',
        '"허용"을 선택하고 "완료"를 클릭하세요',
        '페이지를 새로고침하고 다시 시도하세요',
      ]
    } else if (userAgent.includes('firefox')) {
      browserName = 'Firefox'
      instructions = [
        '주소창 왼쪽의 마이크 아이콘을 클릭하세요',
        '"권한 허용"을 선택하세요',
        '페이지를 새로고침하고 다시 시도하세요',
      ]
    } else if (userAgent.includes('safari')) {
      browserName = 'Safari'
      instructions = [
        'Safari 메뉴 > 환경설정 > 웹사이트로 이동하세요',
        '"마이크" 섹션에서 이 사이트를 "허용"으로 설정하세요',
        '페이지를 새로고침하고 다시 시도하세요',
      ]
    } else if (userAgent.includes('edge')) {
      browserName = 'Edge'
      instructions = [
        '주소창 오른쪽의 자물쇠 아이콘을 클릭하세요',
        '"마이크" 권한을 "허용"으로 변경하세요',
        '페이지를 새로고침하고 다시 시도하세요',
      ]
    }
    return { browserName, instructions }
  }

  const { browserName, instructions } = renderBrowserInstructions();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-md"
          >
            <Card className="border-0 shadow-2xl bg-white">
              <CardHeader className="relative text-center pb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 w-8 h-8 p-0 text-slate-400 hover:text-slate-600"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </Button>
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900">
                  마이크 권한이 필요합니다
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  집중도 모니터링을 위해 마이크 접근 권한을 허용해주세요
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isPermissionGranted && !error && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-4"
                  >
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-green-700 font-medium">권한이 성공적으로 부여되었습니다!</p>
                    <p className="text-sm text-slate-600 mt-1">잠시 후 자동으로 닫힙니다.</p>
                  </motion.div>
                )}
                {error && (
                  <div className="space-y-3">
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <AlertDescription className="text-red-700 text-sm">
                        {error}
                      </AlertDescription>
                    </Alert>
                    {(error.toLowerCase().includes('다른 애플리케이션') || 
                      error.toLowerCase().includes('device in use')) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-sm text-blue-800 font-medium mb-2">
                          해결 방법:
                        </div>
                        <ul className="text-sm text-blue-700 space-y-1 pl-4">
                          <li>• 다른 화상통화 앱 (Zoom, Teams, Skype 등)을 종료하세요</li>
                          <li>• 다른 브라우저 탭에서 마이크를 사용하는 사이트를 닫으세요</li>
                          <li>• 마이크를 사용하는 다른 프로그램을 종료하세요</li>
                          <li>• 브라우저를 완전히 종료하고 다시 시작해보세요</li>
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {isPermissionDenied && (
                  <div className="space-y-3">
                    <Alert className="border-orange-200 bg-orange-50">
                      <Settings className="w-4 h-4 text-orange-600" />
                      <AlertDescription className="text-orange-700 text-sm">
                        브라우저 설정에서 마이크 권한을 수동으로 허용해야 합니다.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHelp(!showHelp)}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      설정 방법 보기
                    </Button>
                    <AnimatePresence>
                      {showHelp && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <Card className="bg-slate-50 border-slate-200">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {browserName}
                                  </Badge>
                                  <span className="text-sm font-medium text-slate-700">설정 방법</span>
                                </div>
                                <ol className="space-y-2 text-sm text-slate-600">
                                  {instructions.map((instruction, index) => (
                                    <li key={index} className="flex gap-2">
                                      <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center font-medium">
                                        {index + 1}
                                      </span>
                                      <span>{instruction}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <div className="space-y-3 pt-4">
                  {!isPermissionGranted && (
                    <Button
                      onClick={isPermissionDenied ? onRetry : handlePermissionRequest}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                      size="lg"
                    >
                      {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                      {isLoading ? "권한 확인 중..." : isPermissionDenied ? "다시 시도" : "마이크 권한 허용"}
                    </Button>
                  )}
                  {error && !isPermissionDenied && (
                    <Button
                      variant="outline"
                      onClick={onDismissError}
                      className="w-full"
                      size="sm"
                    >
                      닫기
                    </Button>
                  )}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-slate-400 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        마이크는 집중도 분석에만 사용되며, 음성은 저장되지 않습니다. 
                        언제든지 권한을 취소하거나 마이크를 끌 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default MicrophonePermissionLayer 