'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { 
  Users, 
  Target, 
  Clock, 
  Crown, 
  Plus,
  Search,
  Filter,
  TrendingUp,
  MessageCircle,
  Heart,
  Star,
  Brain,
  Bell,
  Settings,
  BarChart3,
  User,
  Watch,
  Menu,
  LogOut,
  Database,
  Download,
  Hash,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MoreVertical,
  Sparkles,
  Zap,
  Activity,
  Trophy
} from 'lucide-react'
import CreateStudyRoomForm from '@/components/social/CreateStudyRoomForm'
import type { StudyRoom as StudyRoomType } from '@/types/social'
import Link from 'next/link'
import { useSignOut, useAuth } from '@/hooks/useAuth'
import { FriendsList } from '@/components/social/FriendsList'
import { FriendRequests } from '@/components/social/FriendRequests'
import { FriendRanking } from '@/components/social/FriendRanking'

function SocialPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState('rooms')
  
  const [activeRooms, setActiveRooms] = useState<StudyRoomType[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'study' | 'work' | 'reading'>('all')
  
  // Auth hooks
  const { user } = useAuth()
  const signOut = useSignOut()
  
  // Mock notifications for header
  const notifications = [
    { id: 1, type: 'info', message: '새로운 스터디룸이 생성되었습니다.' },
    { id: 2, type: 'success', message: '친구 요청이 수락되었습니다.' }
  ]

  // URL 파라미터 변경 시 탭 업데이트
  useEffect(() => {
    const tab = searchParams.get('tab')
    console.log('URL 파라미터에서 tab 값:', tab)
    if (tab && (tab === 'rooms' || tab === 'friends')) {
      console.log('탭을 변경합니다:', tab)
      setCurrentTab(tab)
    }
  }, [searchParams])

  // 초기 로딩 시 URL 파라미터 확인 (클라이언트 사이드에서만)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tab = urlParams.get('tab')
      console.log('초기 로딩 시 URL 파라미터에서 tab 값:', tab)
      if (tab && (tab === 'rooms' || tab === 'friends')) {
        console.log('초기 로딩 시 탭을 변경합니다:', tab)
        setCurrentTab(tab)
      }
    }
  }, [])

  // url 파라미터 확인
  useEffect(() => {
    const checkUrlParams = () => {
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.href
        console.log('현재 URL:', currentUrl)
        
        if (currentUrl.includes('?tab=')) {
          const tabMatch = currentUrl.match(/[?&]tab=([^&]+)/)
          if (tabMatch) {
            const tab = tabMatch[1]
            console.log('정규식으로 찾은 tab 값:', tab)
            if (tab === 'rooms' || tab === 'friends') {
              console.log('정규식으로 찾은 tab으로 탭을 변경합니다:', tab)
              setCurrentTab(tab)
            }
          }
        }
      }
    }

    // 즉시 확인
    checkUrlParams()
    
    // 약간의 지연 후 다시 확인 (useSearchParams가 늦게 업데이트될 수 있음)
    const timer = setTimeout(checkUrlParams, 100)
    return () => clearTimeout(timer)
  }, [])

  // 탭 변경 시 URL 업데이트
  const handleTabChange = (value: string) => {
    setCurrentTab(value)
    router.push(`/social?tab=${value}`)
  }

  // 활성 스터디룸 목록 조회
  useEffect(() => {
    fetchActiveRooms()
  }, [])

  const fetchActiveRooms = async () => {
    try {
      setLoading(true)
      console.log('활성 룸 목록 조회 시작...')
      const response = await fetch('/api/social/study-room')
      console.log('API 응답 상태:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('받은 API 응답:', result)
        
        // API 응답 구조에 따른 데이터 추출
        if (result.success && result.data) {
          // 페이지네이션 응답인 경우
          if (result.data.items) {
            setActiveRooms(Array.isArray(result.data.items) ? result.data.items : [])
          } else if (Array.isArray(result.data)) {
            // 직접 배열 응답인 경우
            setActiveRooms(result.data)
          } else {
            // 기타 경우 빈 배열로 초기화
            setActiveRooms([])
          }
        } else {
          console.warn('API 응답에 data가 없음:', result)
          setActiveRooms([])
        }
      } else {
        const errorData = await response.json()
        console.error('API 에러 상세:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          errorMessage: errorData.error,
          errorDetails: errorData.details
        })
        setActiveRooms([])
      }
    } catch (error) {
      console.error('스터디룸 목록 조회 실패:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack'
      })
      setActiveRooms([])
    } finally {
      setLoading(false)
    }
  }

  // 필터링된 룸 목록 (활성 세션만)
  const filteredRooms = Array.isArray(activeRooms) ? activeRooms.filter(room => {
    // 활성 세션이 아니면 제외
    if (!room.is_active) return false
    
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || room.session_type === filterType
    return matchesSearch && matchesFilter
  }) : []

  const handleRoomSelect = async (room: StudyRoomType) => {
    try {
      // 먼저 룸에 참가
      const response = await fetch(`/api/social/study-room/${room.room_id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user?.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        // 중복 참가 에러인 경우 특별 처리
        if (response.status === 409 || result.error?.includes('이미')) {
          console.log('이미 참가한 스터디룸입니다. 바로 이동합니다.')
        } else {
          console.error('룸 참가 실패:', result.error)
          alert(result.error || '룸 참가에 실패했습니다.')
          return
        }
      }

      // 참가 성공 시 룸 페이지로 이동 (이미 참가 중인 경우도 포함)
      window.location.href = `/social/room/${room.room_id}`
    } catch (error) {
      console.error('룸 참가 실패:', error)
      alert('룸 참가에 실패했습니다.')
    }
  }

  const handleCreateRoom = (room: StudyRoomType) => {
    // 룸 생성 후 목록 새로고침
    fetchActiveRooms()
    setShowCreateForm(false)
  }

  if (showCreateForm) {
    return (
      <CreateStudyRoomForm
        onClose={() => setShowCreateForm(false)}
        onSuccess={handleCreateRoom}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
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
                <Button variant="ghost" size="sm" title="대시보드로 이동">
                  <Target className="w-5 h-5" />
                </Button>
              </Link>

              {/* Personal Challenges */}
              <Link href="/social/challenge">
                <Button variant="ghost" size="sm" title="개인 챌린지로 이동">
                  <Trophy className="w-5 h-5" />
                </Button>
              </Link>

              {/* Weekly Report */}
              <Link href="/report/weekly">
                <Button variant="ghost" size="sm" title="주간 리포트 보기">
                  <BarChart3 className="w-5 h-5" />
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
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              소셜 스터디
            </h1>
            <p className="text-gray-600">
              친구들과 함께 실시간으로 집중도를 공유하고 대결해보세요!
            </p>
          </div>

          <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rooms" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                스터디룸
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                친구
              </TabsTrigger>
            </TabsList>

            {/* 스터디룸 탭 */}
            <TabsContent value="rooms" className="space-y-6">
              {/* 검색 및 필터 */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="스터디룸 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">전체</option>
                  <option value="study">공부</option>
                  <option value="work">업무</option>
                  <option value="reading">독서</option>
                </select>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  새 룸 만들기
                </Button>
              </div>

              {/* 룸 목록 */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded mb-4"></div>
                        <div className="h-3 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      활성 스터디룸이 없습니다
                    </h3>
                    <p className="text-gray-600 mb-4">
                      첫 번째 스터디룸을 만들어보세요!
                    </p>
                    <Button onClick={() => setShowCreateForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      새 스터디룸 만들기
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRooms.map((room) => (
                    <Card 
                      key={room.room_id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => handleRoomSelect(room)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                              <Hash className="h-5 w-5 text-blue-500" />
                              {room.name}
                            </CardTitle>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {room.description || '설명이 없습니다.'}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {room.session_type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {/* 호스트 정보 */}
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                                <Crown className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-gray-600">방장</span>
                          </div>

                          {/* 룸 정보 */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {room.current_participants}/{room.max_participants}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {room.goal_minutes}분
                            </div>
                          </div>

                          {/* 참가 버튼 */}
                          <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRoomSelect(room)
                            }}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            참가하기
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 친구 탭 */}
            <TabsContent value="friends" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 친구 목록 */}
                <FriendsList 
                  onAddFriend={() => {
                    // 친구 목록 컴포넌트 내부에서 처리됨
                  }}
                  onFriendAdded={() => {
                    // 친구 목록 새로고침 (React Query가 자동으로 처리)
                  }}
                />
                
                {/* 친구 요청 */}
                <FriendRequests />
              </div>
             
              {/* 친구 랭킹 */}
              <FriendRanking />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default function SocialPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">소셜 페이지를 불러오는 중...</p>
        </div>
      </div>
    }>
      <SocialPageContent />
    </Suspense>
  )
}
