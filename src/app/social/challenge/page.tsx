'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { usePersonalChallenges } from '@/hooks/usePersonalChallenges'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Plus, Trophy, Target, Brain, Bell, Settings, LogOut, BarChart3, Users, User, Watch, Menu, Database, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function PersonalChallengePage() {
  const { 
    challenges, 
    loading, 
    error,
    refreshChallenges,
    createChallenge,
    deleteChallenge
  } = usePersonalChallenges()
  
  const { user } = useAuth()
  const [selectedChallengeType, setSelectedChallengeType] = useState<string | null>(null)

  // 챌린지 생성 폼이 나타날 때 자동으로 스크롤 올리기
  useEffect(() => {
    if (selectedChallengeType) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }, [selectedChallengeType])

  const handleSignOut = async () => {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleCreateSuccess = () => {
    setSelectedChallengeType(null)
    // 새로고침 없이 즉시 반영
    refreshChallenges()
  }

  const handleDeleteChallenge = async (challengeId: string) => {
    if (confirm('정말로 이 챌린지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      const success = await deleteChallenge(challengeId)
    }
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
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="p-3 text-sm text-slate-500">
                    알림이 없습니다
                  </div>
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
                     onClick={handleSignOut}
                     className="text-red-600 focus:text-red-600 focus:bg-red-50"
                   >
                     <LogOut className="w-4 h-4 mr-2" />
                     로그아웃
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>

              {/* Weekly Report */}
              <Link href="/report/weekly">
                <Button variant="ghost" size="sm" title="주간 리포트 보기">
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
                <Button variant="ghost" size="sm" title="개인 챌린지" className="bg-blue-50 text-blue-700">
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
                  <div className="mt-6 text-center py-6 text-slate-500">
                    <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                      <Database className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-sm font-medium mb-1">개인 챌린지 페이지</div>
                    <div className="text-xs mb-3">이 페이지에서는 데이터 로그를 확인할 수 없습니다</div>
                    <div className="text-xs text-slate-400 bg-slate-50 p-2 rounded">
                      💡 대시보드에서 데이터 로그를 확인하세요
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
                     {/* 헤더 */}
           <div className="mb-8">
             <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-3 mb-2">
               <Trophy className="h-7 w-7 text-amber-500" />
               개인 챌린지
             </h1>
             <p className="text-gray-600">
               나만의 목표를 설정하고 달성해보세요
             </p>
           </div>

                     {/* 에러 메시지 */}
           {error && (
             <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
               {error}
             </div>
           )}

           

                                   {/* 챌린지 생성 폼 */}
            {selectedChallengeType && (
              <div className="mb-8">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <CreatePersonalChallengeForm
                    challengeType={selectedChallengeType}
                    onSuccess={handleCreateSuccess}
                    onCancel={() => {
                      setSelectedChallengeType(null)
                    }}
                    setSelectedChallengeType={setSelectedChallengeType}
                  />
                </div>
              </div>
            )}

            {/* 챌린지 섹션 */}
             <div className="space-y-6">
               <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                 <Trophy className="h-6 w-6 text-amber-500" />
                 내 챌린지
               </h2>
               
               {loading ? (
                 <div className="text-center py-12">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                   <p className="text-gray-600 mb-2">챌린지를 불러오는 중...</p>
                   <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
                 </div>
               ) : (

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* 집중 시간 챌린지 */}
                  <ChallengeSection
                    type="focus_time"
                    title="집중 시간"
                    icon="⏰"
                    color="blue"
                    challenges={challenges.filter(c => c.type === 'focus_time')}
                    onDelete={handleDeleteChallenge}
                                         onCreate={() => {
                       setSelectedChallengeType('focus_time')
                     }}
                  />
                  
                  {/* 공부 세션 챌린지 */}
                  <ChallengeSection
                    type="study_sessions"
                    title="공부 세션"
                    icon="📚"
                    color="green"
                    challenges={challenges.filter(c => c.type === 'study_sessions')}
                    onDelete={handleDeleteChallenge}
                                         onCreate={() => {
                       setSelectedChallengeType('study_sessions')
                     }}
                  />
                  
                  {/* 연속 달성 챌린지 */}
                  <ChallengeSection
                    type="streak_days"
                    title="연속 달성"
                    icon="🔥"
                    color="orange"
                    challenges={challenges.filter(c => c.type === 'streak_days')}
                    onDelete={handleDeleteChallenge}
                                         onCreate={() => {
                       setSelectedChallengeType('streak_days')
                     }}
                  />
                  
                  {/* 집중도 점수 챌린지 */}
                  <ChallengeSection
                    type="focus_score"
                    title="집중도 점수"
                    icon="🎯"
                    color="purple"
                    challenges={challenges.filter(c => c.type === 'focus_score')}
                    onDelete={handleDeleteChallenge}
                                         onCreate={() => {
                       setSelectedChallengeType('focus_score')
                     }}
                  />
                </div>
                             )}
             </div>
        </div>
      </div>
    </div>
  )
}

// 챌린지 섹션 컴포넌트
function ChallengeSection({ 
  type, 
  title, 
  icon, 
  color, 
  challenges, 
  onDelete, 
  onCreate 
}: { 
  type: string
  title: string
  icon: string
  color: string
  challenges: any[]
  onDelete: (id: string) => void
  onCreate: () => void 
}) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50'
  }

  const textColorClasses = {
    blue: 'text-blue-800',
    green: 'text-green-800',
    orange: 'text-orange-800',
    purple: 'text-purple-800'
  }

  return (
    <Card className={`border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <CardHeader className="pb-4">
        <CardTitle className={`flex items-center gap-3 text-xl ${textColorClasses[color as keyof typeof textColorClasses]}`}>
          <span className="text-3xl">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
                 {challenges.length === 0 ? (
           <div className="text-center py-8">
             <div className="text-4xl mb-4 opacity-50">{icon}</div>
             <p className="text-base text-gray-600 mb-6">챌린지 생성 가능</p>
            <Button
              onClick={onCreate}
              size="sm"
              className={`w-full ${
                color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                color === 'green' ? 'bg-green-600 hover:bg-green-700' :
                color === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                'bg-purple-600 hover:bg-purple-700'
              } text-white`}
            >
              <Plus className="h-4 w-4 mr-1" />
              생성하기
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((challenge) => (
              <div
                key={challenge.challenge_id}
                className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  console.log('챌린지 상세 정보:', challenge)
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm mb-1">
                      {challenge.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {challenge.description || '설명이 없습니다.'}
                    </p>
                    {challenge.type === 'study_sessions' && challenge.min_session_duration && (
                      <p className="text-xs text-blue-600 mt-1">
                        최소 {challenge.min_session_duration}분 세션
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(challenge.challenge_id)
                    }}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="챌린지 삭제"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* 진행률 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>진행률</span>
                    <span>{Math.round((challenge.current_value / challenge.target_value) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        (challenge.current_value / challenge.target_value) >= 1 
                          ? 'bg-green-500' 
                          : (challenge.current_value / challenge.target_value) >= 0.7 
                          ? 'bg-blue-500' 
                          : (challenge.current_value / challenge.target_value) >= 0.3 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}
                      style={{ 
                        width: `${Math.min((challenge.current_value / challenge.target_value) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
                
                {/* 현재 값 */}
                <div className="text-xs text-gray-600 text-center mt-2">
                  {challenge.current_value} / {challenge.target_value} {challenge.unit}
                </div>
                
                {/* 상태 */}
                <div className="text-center mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    challenge.is_active 
                      ? (challenge.current_value >= challenge.target_value 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800')
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {challenge.is_active 
                      ? (challenge.current_value >= challenge.target_value ? '달성' : '진행중')
                      : '완료'
                    }
                  </span>
                </div>
              </div>
            ))}
            
            {/* 추가 생성 버튼 */}
            <Button
              onClick={onCreate}
              variant="outline"
              size="sm"
              className="w-full mt-3"
            >
              <Plus className="h-4 w-4 mr-1" />
              추가 생성
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}



// 개인 챌린지 생성 폼 컴포넌트
function CreatePersonalChallengeForm({ 
  challengeType, 
  onSuccess, 
  onCancel,
  setSelectedChallengeType
}: { 
  challengeType: string
  onSuccess: () => void
  onCancel: () => void
  setSelectedChallengeType: (type: string | null) => void
}) {
  const { createChallenge, loading } = usePersonalChallenges()
  // 챌린지 타입에 따라 단위 자동 조정
  const getUnitForType = (type: string) => {
    switch (type) {
      case 'focus_time':
        return '시간'
      case 'study_sessions':
        return '회'
      case 'streak_days':
        return '일'
      case 'focus_score':
        return '점'
      case 'custom':
        return '개'
      default:
        return '시간'
    }
  }

  const getDefaultValues = (type: string) => {
    switch (type) {
      case 'focus_time':
        return { target_value: '2', duration_days: '7' }
      case 'study_sessions':
        return { target_value: '3', duration_days: '7' }
      case 'streak_days':
        return { target_value: '7', duration_days: '14' }
      case 'focus_score':
        return { target_value: '80', duration_days: '7' }
      default:
        return { target_value: '2', duration_days: '7' }
    }
  }

  const defaultValues = getDefaultValues(challengeType)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: challengeType as 'focus_time' | 'study_sessions' | 'streak_days' | 'focus_score' | 'custom',
    target_value: defaultValues.target_value,
    unit: getUnitForType(challengeType),
    duration_days: defaultValues.duration_days,
    min_session_duration: challengeType === 'study_sessions' ? '30' : undefined
  })

  // 타입 변경 시 단위 자동 업데이트
  const handleTypeChange = (newType: string) => {
    setFormData(prev => ({
      ...prev,
      type: newType as any,
      unit: getUnitForType(newType)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 유효성 검사 개선
    if (!formData.title.trim()) {
      alert('챌린지 제목을 입력해주세요.')
      return
    }
    
    if (!formData.target_value || Number(formData.target_value) <= 0) {
      alert('올바른 목표값을 입력해주세요.')
      return
    }
    
    if (!formData.duration_days || Number(formData.duration_days) <= 0) {
      alert('올바른 지속 기간을 입력해주세요.')
      return
    }

    try {
      const result = await createChallenge({
        title: formData.title.trim(),
        description: formData.description.trim(),
        type: formData.type,
        target_value: Number(formData.target_value),
        unit: formData.unit,
        duration_days: Number(formData.duration_days),
        min_session_duration: formData.type === 'study_sessions' ? Number(formData.min_session_duration) : undefined
      })

      if (result) {
        onSuccess()
      }
    } catch (error) {
      console.error('개인 챌린지 생성 실패:', error)
      alert('챌린지 생성에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedChallengeType(null)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {challengeType === 'focus_time' && '집중 시간 챌린지'}
              {challengeType === 'study_sessions' && '공부 세션 챌린지'}
              {challengeType === 'streak_days' && '연속 달성 챌린지'}
              {challengeType === 'focus_score' && '집중도 점수 챌린지'}
            </h3>
            <p className="text-sm text-gray-600">
              {challengeType === 'focus_time' && '하루 집중한 총 시간을 목표로 설정하세요. 예: 하루 2시간 집중 공부하기'}
              {challengeType === 'study_sessions' && '완료한 공부 세션 수를 목표로 설정하세요. 최소 세션 시간을 설정하면 해당 시간 이상의 세션만 카운트됩니다.'}
              {challengeType === 'streak_days' && '연속으로 목표 달성한 일수를 목표로 설정하세요. 예: 7일 연속 목표 달성하기'}
              {challengeType === 'focus_score' && '평균 집중도 점수를 목표로 설정하세요. 예: 평균 집중도 80점 달성하기'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 챌린지 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            챌린지 제목 *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={
              challengeType === 'focus_time' ? '예: 하루 2시간 집중 공부하기' :
              challengeType === 'study_sessions' ? '예: 하루 3회 공부 세션 완료하기' :
              challengeType === 'streak_days' ? '예: 7일 연속 목표 달성하기' :
              challengeType === 'focus_score' ? '예: 평균 집중도 80점 달성하기' :
              '챌린지 제목을 입력하세요'
            }
            required
          />
        </div>

      {/* 목표값과 단위 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          목표값 *
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={formData.target_value}
            onChange={(e) => setFormData(prev => ({ ...prev, target_value: e.target.value }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="예: 2"
            min="1"
            step={formData.type === 'focus_time' ? '0.5' : '1'}
            required
          />
          <div className="flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium min-w-[70px] justify-center">
            {formData.unit}
          </div>
        </div>
      </div>

      {/* 공부 세션 최소 시간 설정 */}
      {formData.type === 'study_sessions' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            최소 세션 시간 (분) *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={formData.min_session_duration || '30'}
              onChange={(e) => setFormData(prev => ({ ...prev, min_session_duration: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: 30"
              min="1"
              required
            />
            <div className="flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-medium min-w-[80px] justify-center">
              분
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            이 시간 이상의 세션만 챌린지 진행률에 포함됩니다
          </p>
        </div>
      )}

      {/* 지속 기간 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          지속 기간 (일) *
        </label>
        <input
          type="number"
          value={formData.duration_days}
          onChange={(e) => setFormData(prev => ({ ...prev, duration_days: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="예: 7"
          min="1"
          required
        />
      </div>

      {/* 설명 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          설명
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="챌린지에 대한 자세한 설명을 입력하세요"
        />
      </div>

      {/* 버튼 */}
      <div className="flex justify-end space-x-3 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
          className="px-6"
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              생성 중...
            </>
          ) : (
            '챌린지 생성'
          )}
        </Button>
      </div>
    </form>
    </div>
  )
}
