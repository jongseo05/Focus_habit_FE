'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FriendsList } from '@/components/social/FriendsList'
import { FriendRequests } from '@/components/social/FriendRequests'
import { FriendSearch } from '@/components/social/FriendSearch'
import { FriendRanking } from '@/components/social/FriendRanking'
import { Users, UserPlus, Search, TrendingUp } from 'lucide-react'

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState('friends')
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">친구</h1>
        <p className="text-gray-600">
          친구들과 함께 집중하고 경쟁해보세요.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="friends" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            친구 목록
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            친구 요청
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            친구 검색
          </TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            친구 랭킹
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-6">
          <FriendsList onAddFriend={() => setActiveTab('search')} />
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <FriendRequests />
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <FriendSearch onClose={() => setActiveTab('friends')} />
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6">
          <FriendRanking />
        </TabsContent>
      </Tabs>
    </div>
  )
}
