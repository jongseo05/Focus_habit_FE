"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Smartphone, 
  Watch, 
  Copy, 
  Check, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Play,
  AlertCircle,
  CheckCircle,
  QrCode
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import ProtectedRoute from "@/components/ProtectedRoute"

interface ConnectionStatus {
  code: string | null
  isConnected: boolean
  sessionId: string | null
  error: string | null
}

export default function ConnectPage() {
  const router = useRouter()
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    code: null,
    isConnected: false,
    sessionId: null,
    error: null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // 코드 생성
  const generateCode = async () => {
    setIsLoading(true)
    setConnectionStatus(prev => ({ ...prev, error: null }))

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate_code`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${(await supabaseBrowser().auth.getSession()).data.session!.access_token}` 
        }
      })

      if (!response.ok) {
        throw new Error('코드 생성에 실패했습니다')
      }

      const { code } = await response.json()
      setConnectionStatus(prev => ({ ...prev, code }))

      // 코드 생성 후 폴링 시작
      startPolling()

    } catch (error) {
      console.error('Code generation error:', error)
      setConnectionStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' 
      }))
    } finally {
      setIsLoading(false)
    }
  }

  // 연결 상태 폴링
  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const { data: connections } = await supabaseBrowser()
          .from('watch_connections')
          .select('*')
          .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
          .eq('is_active', true)
          .limit(1)

        if (connections && connections.length > 0) {
          setConnectionStatus(prev => ({ 
            ...prev, 
            isConnected: true,
            error: null 
          }))
          stopPolling()
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000) // 2초마다 체크

    setPollingInterval(interval)
  }

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
  }

  // 세션 시작
  const startSession = async () => {
    setIsLoading(true)
    setConnectionStatus(prev => ({ ...prev, error: null }))

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/start_session`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${(await supabaseBrowser().auth.getSession()).data.session!.access_token}` 
        }
      })

      if (!response.ok) {
        throw new Error('세션 시작에 실패했습니다')
      }

      const { session_id } = await response.json()
      setConnectionStatus(prev => ({ ...prev, sessionId: session_id }))

      // 대시보드로 이동
      router.push('/dashboard')

    } catch (error) {
      console.error('Session start error:', error)
      setConnectionStatus(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다' 
      }))
    } finally {
      setIsLoading(false)
    }
  }

  // 코드 복사
  const copyCode = async () => {
    if (connectionStatus.code) {
      await navigator.clipboard.writeText(connectionStatus.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => stopPolling()
  }, [])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto pt-20">
          <Card className="shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Smartphone className="w-8 h-8 text-blue-600" />
                <div className="text-2xl font-bold text-gray-800">스마트워치 연동</div>
                <Watch className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-lg text-gray-600">
                스마트워치 앱에서 연결 코드를 입력하세요
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* 연결 상태 표시 */}
              <div className="flex items-center justify-center">
                <div className="flex items-center justify-center space-x-2">
                  <Badge 
                    variant={connectionStatus.isConnected ? "default" : "secondary"}
                    className="text-sm"
                  >
                    {connectionStatus.isConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        연결됨
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-4 h-4 mr-1" />
                        연결 대기 중
                      </>
                    )}
                  </Badge>
                </div>
              </div>

              {/* 에러 메시지 */}
              <AnimatePresence>
                {connectionStatus.error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{connectionStatus.error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 연결 코드 표시 */}
              <AnimatePresence>
                {connectionStatus.code && !connectionStatus.isConnected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center"
                  >
                    <div className="bg-white rounded-lg p-6 border-2 border-dashed border-blue-300">
                      <div className="text-sm text-gray-600 mb-3">
                        스마트워치 앱에서 이 코드를 입력하세요
                      </div>
                      <div className="flex items-center justify-center space-x-3">
                        <div className="text-4xl font-mono font-bold text-blue-600 tracking-wider">
                          {connectionStatus.code}
                        </div>
                        <Button
                          onClick={copyCode}
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {copied ? '복사됨!' : '클릭하여 복사'}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 연결 완료 메시지 */}
              <AnimatePresence>
                {connectionStatus.isConnected && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center"
                  >
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <div className="text-green-800 font-medium">스마트워치 연결 완료!</div>
                      <div className="text-green-600 text-sm mt-1">
                        이제 집중 세션을 시작할 수 있습니다
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 액션 버튼들 */}
              <div className="space-y-3">
                {!connectionStatus.code && !connectionStatus.isConnected && (
                  <Button
                    onClick={generateCode}
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        코드 생성 중...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4 mr-2" />
                        연결 코드 생성
                      </>
                    )}
                  </Button>
                )}

                {connectionStatus.isConnected && (
                  <Button
                    onClick={startSession}
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        세션 시작 중...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        집중 세션 시작
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="outline"
                  className="w-full"
                >
                  대시보드로 돌아가기
                </Button>
              </div>

              {/* 사용법 안내 */}
              <div className="text-xs text-gray-500 text-center space-y-1">
                <div>1. 연결 코드를 생성하세요</div>
                <div>2. 스마트워치 앱에서 코드를 입력하세요</div>
                <div>3. 연결이 완료되면 집중 세션을 시작하세요</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  )
}
