'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { usePersonalChallenges } from '@/hooks/usePersonalChallenges'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Plus, Trophy, ArrowLeft, Target, Clock, Calendar, Star, Zap, X, Brain, Bell, Settings, LogOut, BarChart3, Users, User, Watch, Menu, Database, Download, Trash2 } from 'lucide-react'
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
  const [showCreateModal, setShowCreateModal] = useState(false)

  const handleSignOut = async () => {
    const supabase = supabaseBrowser()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
    refreshChallenges()
  }

  const handleDeleteChallenge = async (challengeId: string) => {
    if (confirm('정말로 이 챌린지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      const success = await deleteChallenge(challengeId)
      if (success) {
        // 삭제 성공 시 별도 처리 불필요 (refreshChallenges가 자동으로 호출됨)
      }
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
                <Button variant="ghost" size="sm" title="개인 챌린지로 이동" className="bg-blue-50 text-blue-700">
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
          <div className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-3 mb-2">
                <Trophy className="h-7 w-7 text-amber-500" />
                개인 챌린지
              </h1>
              <p className="text-gray-600">
                나만의 목표를 설정하고 달성해보세요
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/social">
                <Button variant="outline" className="h-10 px-4">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  소셜으로 돌아가기
                </Button>
              </Link>
              <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogTrigger asChild>
                  <Button className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    챌린지 생성
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      새로운 개인 챌린지
                    </DialogTitle>
                  </DialogHeader>
                  <CreatePersonalChallengeForm
                    onSuccess={handleCreateSuccess}
                    onCancel={() => setShowCreateModal(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* 챌린지 목록 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">챌린지를 불러오는 중...</p>
            </div>
          ) : challenges.length === 0 ? (
            <Card className="border-0 bg-gray-50">
              <CardContent className="p-12 text-center">
                <Target className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  아직 챌린지가 없습니다
                </h3>
                <p className="text-gray-600 mb-6">
                  새로운 목표를 설정하고 달성해보세요!
                </p>
                <Button 
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  첫 번째 챌린지 만들기
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map((challenge) => (
                <Card 
                  key={challenge.challenge_id}
                  className="group border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer"
                >
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                          {challenge.title}
                        </CardTitle>
                        <p className="text-gray-600 text-sm line-clamp-2">
                          {challenge.description || '설명이 없습니다.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          challenge.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {challenge.is_active ? '진행중' : '완료'}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteChallenge(challenge.challenge_id)
                          }}
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="챌린지 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="space-y-3">
                      {/* 챌린지 정보 */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-gray-700">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span>{challenge.target_value} {challenge.unit}</span>
                        </div>
                        <div className="text-gray-600">
                          {challenge.type === 'focus_time' ? '집중 시간' : 
                           challenge.type === 'study_sessions' ? '공부 세션' :
                           challenge.type === 'streak_days' ? '연속 달성' :
                           challenge.type === 'focus_score' ? '집중도 점수' : '커스텀'}
                        </div>
                      </div>
                      
                      {/* 진행률 */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>진행률</span>
                          <span>{Math.round((challenge.current_value / challenge.target_value) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min((challenge.current_value / challenge.target_value) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      {/* 현재 값 */}
                      <div className="text-sm text-gray-600 text-center">
                        현재: {challenge.current_value} / {challenge.target_value} {challenge.unit}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 개인 챌린지 생성 폼 컴포넌트
function CreatePersonalChallengeForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const { createChallenge, loading } = usePersonalChallenges()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'focus_time' as 'focus_time' | 'study_sessions' | 'streak_days' | 'focus_score' | 'custom',
    target_value: '',
    unit: '시간',
    duration_days: ''
  })

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
    
    if (!formData.title || !formData.target_value || !formData.duration_days) {
      alert('모든 필수 필드를 입력해주세요.')
      return
    }

    try {
      const result = await createChallenge({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        target_value: Number(formData.target_value),
        unit: formData.unit,
        duration_days: Number(formData.duration_days)
      })

      if (result) {
        onSuccess()
      }
    } catch (error) {
      console.error('개인 챌린지 생성 실패:', error)
      alert('챌린지 생성에 실패했습니다.')
    }
  }

  return (
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
          placeholder="예: 하루 2시간 집중 공부하기"
          required
        />
      </div>

      {/* 챌린지 타입 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          챌린지 타입 *
        </label>
        <select
          value={formData.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="focus_time">집중 시간</option>
          <option value="study_sessions">공부 세션</option>
          <option value="streak_days">연속 달성</option>
          <option value="focus_score">집중도 점수</option>
          <option value="custom">커스텀</option>
        </select>
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
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? '생성 중...' : '챌린지 생성'}
        </Button>
      </div>
    </form>
  )
}
