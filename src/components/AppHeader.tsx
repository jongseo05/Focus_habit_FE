"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Brain,
  Bell,
  Settings,
  Menu,
  BarChart3,
  Users,
  Trophy,
  User,
  Watch,
  LogOut,
  Database,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useSignOut, useAuth } from "@/hooks/useAuth"
import { useQuery } from "@tanstack/react-query"
import { supabaseBrowser } from "@/lib/supabase/client"

interface AppHeaderProps {
  showSessionControls?: boolean
  sessionState?: {
    isRunning: boolean
    focusScore: number
  }
  mediaStream?: {
    isPermissionGranted: boolean
    isGestureRecognitionActive: boolean
    gestureFramesSent: number
    webcamAnalysisResult: any
  }
}

export default function AppHeader({ 
  showSessionControls = false, 
  sessionState,
  mediaStream 
}: AppHeaderProps) {
  const signOut = useSignOut()
  const router = useRouter()
  const { user } = useAuth()
  const [notifications] = useState([
    { id: 1, message: "웹캠 연결이 성공적으로 완료되었습니다", type: "success" },
    { id: 2, message: "새로운 업데이트가 있습니다", type: "info" },
  ])

  // 최근 완료된 세션들 조회 (데이터 로그용)
  const { data: recentSessions } = useQuery({
    queryKey: ['recent-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .not('ended_at', 'is', null) // 완료된 세션만
        .order('ended_at', { ascending: false })
        .limit(5) // 최근 5개
      
      if (error) {
        return []
      }
      
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // 세션 전체 데이터 다운로드
  const handleSessionDownload = async (format: 'json' | 'csv' = 'json', sessionId?: string, includeAllUsers: boolean = false) => {
    if (!sessionId) {
      alert('세션 ID가 없습니다.')
      return
    }

    try {
      const queryParams = new URLSearchParams({
        format: format,
        uid: user?.id || '',
        includeAllUsers: includeAllUsers.toString()
      })
      
      const response = await fetch(`/api/focus-session/${sessionId}/download?${queryParams}`)
      if (!response.ok) throw new Error('세션 데이터 조회 실패')
      
      if (format === 'csv') {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = includeAllUsers 
          ? `focus-session-all-users-${sessionId}-${new Date().toISOString().split('T')[0]}.csv`
          : `focus-session-${sessionId}-${new Date().toISOString().split('T')[0]}.csv`
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const filename = includeAllUsers 
          ? `focus-session-all-users-${sessionId}-${new Date().toISOString().split('T')[0]}.json`
          : `focus-session-${sessionId}-${new Date().toISOString().split('T')[0]}.json`
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      alert('세션 다운로드 실패')
    }
  }

  return (
    <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">FocusAI</span>
          </Link>

          <div className="flex items-center gap-4">
            {/* 세션 상태 표시 (showSessionControls가 true일 때만) */}
            {showSessionControls && sessionState?.isRunning && mediaStream?.isPermissionGranted && (
              <>
                {/* 웹캠 상태 표시 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-slate-600 hidden sm:inline">카메라 활성</span>
                </div>

                {/* 제스처 인식 상태 표시 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    mediaStream.isGestureRecognitionActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    {mediaStream.isGestureRecognitionActive ? '제스처 분석' : '제스처 대기'}
                  </span>
                  {mediaStream.gestureFramesSent > 0 && (
                    <span className="text-xs text-slate-400">
                      ({mediaStream.gestureFramesSent}프레임)
                    </span>
                  )}
                </div>

                {/* AI 집중도 점수 표시 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    sessionState.focusScore >= 80 ? 'bg-green-500' :
                    sessionState.focusScore >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  } animate-pulse`}></div>
                  <span className="text-slate-600 hidden sm:inline">
                    AI 집중도: {sessionState.focusScore}점
                  </span>
                  <span className="text-xs text-slate-400">(실시간)</span>
                  {mediaStream.webcamAnalysisResult && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>분석 중</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {notifications.map((notif) => (
                  <DropdownMenuItem key={notif.id} className="p-3">
                    <div className={`text-sm ${
                      notif.type === 'error' ? 'text-red-600' : 
                      notif.type === 'success' ? 'text-green-600' : 
                      'text-slate-700'
                    }`}>
                      {notif.message}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => signOut.mutate()}
                  disabled={signOut.isPending}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {signOut.isPending ? '로그아웃 중...' : '로그아웃'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dashboard */}
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" title="대시보드">
                <Brain className="w-5 h-5" />
              </Button>
            </Link>

            {/* Weekly Report */}
            <Link href="/report">
              <Button variant="ghost" size="sm" title="리포트">
                <BarChart3 className="w-5 h-5" />
              </Button>
            </Link>

            {/* Social Features */}
            <Link href="/social">
              <Button variant="ghost" size="sm" title="소셜 스터디">
                <Users className="w-5 h-5" />
              </Button>
            </Link>

            {/* Personal Challenges */}
            <Link href="/social/challenge">
              <Button variant="ghost" size="sm" title="개인 챌린지로 이동">
                <Trophy className="w-5 h-5" />
              </Button>
            </Link>

            {/* Profile */}
            <Link href="/profile">
              <Button variant="ghost" size="sm" title="프로필 보기">
                <User className="w-5 h-5" />
              </Button>
            </Link>

            {/* Watch Connection */}
            <Link href="/connect">
              <Button variant="ghost" size="sm" title="스마트워치 연동">
                <Watch className="w-5 h-5" />
              </Button>
            </Link>

            {/* Data Log Drawer */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open data log">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>데이터 로그</SheetTitle>
                  <SheetDescription>ML 분석 결과 및 집중도 데이터</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {recentSessions && recentSessions.length > 0 ? (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                          <Database className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="text-md font-semibold text-slate-800 mb-2">최근 완료된 세션</div>
                        <div className="text-sm text-slate-600 mb-4">
                          완료된 세션의 데이터를 다운로드할 수 있습니다
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {recentSessions.map((session) => (
                          <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-900">
                                {session.context_tag || `세션 ${new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                {new Date(session.started_at).toLocaleDateString('ko-KR')} {new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.ended_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleSessionDownload('json', session.session_id)}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                JSON
                              </Button>
                              <Button
                                onClick={() => handleSessionDownload('csv', session.session_id)}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                CSV
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500">
                      <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                        <Database className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="text-sm font-medium mb-1">활성 세션이 없습니다</div>
                      <div className="text-xs mb-3">집중 세션을 시작하면 데이터 다운로드가 가능합니다</div>
                      <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded">
                        집중 세션을 시작해보세요
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
