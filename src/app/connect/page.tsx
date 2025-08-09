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
  connectedWatch?: {
    deviceId: string
    connectedAt: string
    lastSeen: string | null
  } | null
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

  // 페이지 진입 시 초기화
  useEffect(() => {
    // 기존 연결 상태 초기화
    setConnectionStatus({
      code: null,
      isConnected: false,
      sessionId: null,
      error: null,
      connectedWatch: null
    })
    
    // 기존 폴링 중단
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    
    // 복사 상태 초기화
    setCopied(false)
    
    // 로딩 상태 초기화
    setIsLoading(false)
    
    // 기존 연결 확인
    checkExistingConnection()
  }, []) // 페이지 진입 시 한 번만 실행

  // 기존 연결 확인
  const checkExistingConnection = async () => {
    try {
      console.log('🔍 Checking for existing connections...')
      
      const { data: connections, error } = await supabaseBrowser()
        .from('watch_connections')
        .select('*')
        .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
        .eq('device_type', 'watch')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('❌ Error checking existing connections:', error)
        return
      }

      if (connections && connections.length > 0) {
        const latestConnection = connections[0]
        console.log('✅ Found existing connection:', latestConnection)
        
        setConnectionStatus(prev => ({
          ...prev,
          isConnected: true,
          sessionId: latestConnection.id || null,
          connectedWatch: {
            deviceId: latestConnection.device_id,
            connectedAt: latestConnection.created_at,
            lastSeen: latestConnection.last_seen_at
          }
        }))
        
        // 연결된 워치 정보 표시
        console.log('📱 Connected watch info:', {
          deviceId: latestConnection.device_id,
          connectedAt: latestConnection.created_at,
          lastSeen: latestConnection.last_seen_at
        })
      } else {
        console.log('📱 No existing connections found')
      }
    } catch (error) {
      console.error('💥 Error in checkExistingConnection:', error)
    }
  }

  // 코드 생성
  const generateCode = async () => {
    // 기존 상태 완전 초기화
    setConnectionStatus({
      code: null,
      isConnected: false,
      sessionId: null,
      error: null,
      connectedWatch: null
    })
    
    // 기존 폴링 중단
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    
    // 복사 상태 초기화
    setCopied(false)
    
    // 기존 연결 삭제 (새 페어링을 위한 클린 슬레이트)
    try {
      const { error: deleteError } = await supabaseBrowser()
        .from('watch_connections')
        .delete()
        .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
        .eq('device_type', 'watch')
      
      if (deleteError) {
        console.warn('⚠️ 기존 연결 삭제 중 오류:', deleteError)
      } else {
        console.log('🧹 기존 연결 기록 삭제 완료')
      }
    } catch (deleteError) {
      console.warn('⚠️ 기존 연결 삭제 중 예외:', deleteError)
    }
    
    setIsLoading(true)

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
      startPolling(code)

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
  const startPolling = (code: string) => {
    console.log('🚀 Starting polling for code:', code)
    
    if (!code) {
      console.log('❌ No code provided, cannot start polling')
      return
    }
    
    const interval = setInterval(async () => {
      try {
        console.log('🔄 Polling check for code:', code)

        // 1. 현재 코드가 사용되었는지 확인
        const { data: codeStatus, error: codeError } = await supabaseBrowser()
          .from('watch_codes')
          .select('is_used, used_at')
          .eq('code', code)
          .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
          .single()

        console.log('📊 Code status check result:', { codeStatus, codeError })

        // 2. 코드가 존재하면 연결 확인 (사용 여부와 관계없이)
        if (codeStatus) {
          console.log('✅ Code exists, checking for connections...')
          
          // 모든 워치 연결을 확인
          console.log('🔍 Looking for all watch connections...')
          
          const { data: connections, error: connError } = await supabaseBrowser()
            .from('watch_connections')
            .select('*')
            .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
            .eq('device_type', 'watch')
            .order('created_at', { ascending: false }) // 최신 연결부터
            .limit(1)

          console.log('🔗 Connections check result:', { connections, connError })

          if (connections && connections.length > 0) {
            console.log('🎉 Connection found:', { code: code, connection: connections[0] })
            console.log('🔄 Updating connection status to connected...')
            
            setConnectionStatus(prev => {
              console.log('📝 Previous state:', prev)
              const newState = { 
                ...prev, 
                isConnected: true,
                error: null 
              }
              console.log('📝 New state:', newState)
              return newState
            })
            
            console.log('⏹️ Stopping polling...')
            stopPolling()
          } else {
            console.log('⏳ No connections found yet, continuing to poll...')
          }
        } else {
          console.log('❌ Code not found, stopping polling')
          stopPolling()
        }
      } catch (error) {
        console.error('💥 Polling error:', error)
      }
    }, 1000) // 1초마다 체크 (더 빠르게)

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

  // 연결 해제
  const disconnectWatch = async () => {
    try {
      console.log('🔌 Disconnecting watch...')
      
      if (!connectionStatus.sessionId) {
        console.log('❌ No session ID to disconnect')
        return
      }

      // 연결 상태를 비활성화로 업데이트 (선택사항)
      const { error } = await supabaseBrowser()
        .from('watch_connections')
        .update({ 
          last_seen_at: new Date().toISOString(),
          // is_active: false // 이 컬럼이 있다면
        })
        .eq('id', connectionStatus.sessionId)

      if (error) {
        console.error('❌ Error updating connection:', error)
      }

      // 로컬 상태 초기화
      setConnectionStatus({
        code: null,
        isConnected: false,
        sessionId: null,
        error: null,
        connectedWatch: null
      })

      console.log('✅ Watch disconnected successfully')
    } catch (error) {
      console.error('💥 Error disconnecting watch:', error)
    }
  }

  // 연결 상태 변경 감지
  useEffect(() => {
    console.log('🔄 Connection status changed:', connectionStatus)
  }, [connectionStatus])

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

              {/* 연결된 워치 정보 */}
              {connectionStatus.isConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Watch className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">연결된 워치</span>
                    </div>
                    <Button
                      onClick={disconnectWatch}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      연결 해제
                    </Button>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <div>• 워치가 성공적으로 연결되었습니다</div>
                    <div>• 포커스 세션을 시작할 수 있습니다</div>
                    {connectionStatus.connectedWatch && (
                      <div className="mt-2 pt-2 border-t border-green-200">
                        <div className="text-xs text-green-600">
                          <div>디바이스 ID: {connectionStatus.connectedWatch.deviceId}</div>
                          <div>연결 시간: {new Date(connectionStatus.connectedWatch.connectedAt).toLocaleString('ko-KR')}</div>
                          {connectionStatus.connectedWatch.lastSeen && (
                            <div>마지막 활동: {new Date(connectionStatus.connectedWatch.lastSeen).toLocaleString('ko-KR')}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

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



              {/* 액션 버튼들 */}
              <div className="space-y-3">
                {connectionStatus.isConnected && (
                  <div className="space-y-3">
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
                    
                    <Button
                      onClick={generateCode}
                      disabled={isLoading}
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      {isLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          코드 생성 중...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 mr-2" />
                          새 연결 코드 생성
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {!connectionStatus.isConnected && (
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

                 {/* 디버깅용 수동 연결 확인 버튼 */}
                 {connectionStatus.code && !connectionStatus.isConnected && (
                   <Button
                     onClick={async () => {
                       try {
                         console.log('🔍 Manual check started...')
                         
                         const { data: codeStatus } = await supabaseBrowser()
                           .from('watch_codes')
                           .select('is_used, used_at')
                           .eq('code', connectionStatus.code)
                           .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
                           .single()
                         
                         const { data: connections } = await supabaseBrowser()
                           .from('watch_connections')
                           .select('*')
                           .eq('user_id', (await supabaseBrowser().auth.getUser()).data.user?.id)
                           .eq('device_type', 'watch')
                           .limit(1)
                         
                         console.log('🔍 Manual check result:', { codeStatus, connections })
                         
                         // 연결이 있으면 강제로 연결 상태로 변경
                         if (connections && connections.length > 0) {
                           console.log('🔧 Force updating connection status...')
                           setConnectionStatus(prev => ({
                             ...prev,
                             isConnected: true,
                             error: null
                           }))
                           alert('연결 상태를 강제로 업데이트했습니다!')
                         } else {
                           alert(`코드 상태: ${JSON.stringify(codeStatus)}\n연결 상태: ${JSON.stringify(connections)}`)
                         }
                       } catch (error) {
                         console.error('Manual check error:', error)
                         alert('수동 확인 중 오류 발생')
                       }
                     }}
                     variant="outline"
                     className="w-full"
                     size="sm"
                   >
                     🔍 수동 연결 상태 확인 + 강제 업데이트
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
