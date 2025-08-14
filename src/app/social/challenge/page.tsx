'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateGroupChallengeForm } from '@/components/social/CreateGroupChallengeForm'
import { GroupChallengeCard } from '@/components/social/GroupChallengeCard'
import { useGroupChallenge } from '@/hooks/useGroupChallenge'
import { Plus, Trophy, Users, Target } from 'lucide-react'

export default function GroupChallengePage() {
  const { 
    challenges, 
    myChallenges, 
    availableChallenges, 
    loading, 
    error,
    refreshChallenges 
  } = useGroupChallenge()
  
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const handleCreateSuccess = () => {
    setShowCreateForm(false)
    refreshChallenges()
  }

  const handleJoinSuccess = () => {
    refreshChallenges()
  }

  if (showCreateForm) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setShowCreateForm(false)}
              className="mb-4"
            >
              ← 목록으로 돌아가기
            </Button>
            <h1 className="text-2xl font-bold">새로운 그룹 챌린지 생성</h1>
          </div>
          <CreateGroupChallengeForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-yellow-500" />
              그룹 챌린지
            </h1>
            <p className="text-gray-600 mt-2">
              함께 목표를 달성하고 동기부여를 받아보세요
            </p>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            챌린지 생성
          </Button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              전체 챌린지
            </TabsTrigger>
            <TabsTrigger value="my" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              내 챌린지
            </TabsTrigger>
            <TabsTrigger value="available" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              참가 가능
            </TabsTrigger>
          </TabsList>

          {/* 전체 챌린지 */}
          <TabsContent value="all" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">전체 챌린지</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshChallenges}
                disabled={loading}
              >
                새로고침
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">챌린지를 불러오는 중...</p>
              </div>
            ) : challenges.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">아직 챌린지가 없습니다</h3>
                <p className="text-gray-600 mb-4">첫 번째 챌린지를 생성해보세요!</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  챌린지 생성하기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {challenges.map((challenge) => (
                  <GroupChallengeCard
                    key={challenge.challenge_id}
                    challenge={challenge}
                    showJoinButton={true}
                    onJoin={handleJoinSuccess}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 내 챌린지 */}
          <TabsContent value="my" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">내가 참가한 챌린지</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshChallenges}
                disabled={loading}
              >
                새로고침
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">챌린지를 불러오는 중...</p>
              </div>
            ) : myChallenges.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">참가한 챌린지가 없습니다</h3>
                <p className="text-gray-600 mb-4">관심 있는 챌린지에 참가해보세요!</p>
                <Button onClick={() => setActiveTab('available')}>
                  챌린지 둘러보기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myChallenges.map((challenge) => (
                  <GroupChallengeCard
                    key={challenge.challenge_id}
                    challenge={challenge}
                    showJoinButton={false}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 참가 가능한 챌린지 */}
          <TabsContent value="available" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">참가 가능한 챌린지</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshChallenges}
                disabled={loading}
              >
                새로고침
              </Button>
            </div>
            
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">챌린지를 불러오는 중...</p>
              </div>
            ) : availableChallenges.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">참가 가능한 챌린지가 없습니다</h3>
                <p className="text-gray-600 mb-4">새로운 챌린지를 생성해보세요!</p>
                <Button onClick={() => setShowCreateForm(true)}>
                  챌린지 생성하기
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableChallenges.map((challenge) => (
                  <GroupChallengeCard
                    key={challenge.challenge_id}
                    challenge={challenge}
                    showJoinButton={true}
                    onJoin={handleJoinSuccess}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
