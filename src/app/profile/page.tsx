"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Edit3, School, BookOpen, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/useAuth"
import { useProfile, useUpdateProfile, useFocusSummary, useWeeklyStats } from "@/hooks/useProfile"
import { useUploadProfileImage, useDeleteProfileImage } from "@/hooks/useProfileImage"
import { UserStatus, UserProfile, Badge as BadgeType, Challenge, ReportSharingSettings } from "@/types/profile"
import { 
  StatusBadge, 
  InlineProfileEdit,
  OverviewTab,
  AchievementsTab, 
  PersonalizationTab,
  SettingsTab
} from "@/components/profile"

// Mock data for development
const mockProfile: UserProfile = {
  id: "1",
  user_id: "user1",
  display_name: "김집중",
  handle: "focus_master",
  avatar_url: "/api/placeholder/100/100",
  bio: "매일 조금씩 성장하는 개발자입니다",
  school: "서울대학교",
  major: "컴퓨터공학부",
  status: UserStatus.ONLINE,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-12-01T00:00:00Z"
}

const mockBadges: BadgeType[] = [
  {
    id: "1",
    name: "연속 3일",
    description: "3일 연속으로 집중 세션을 완료했습니다",
    icon_url: "/api/placeholder/40/40",
    earned_at: "2024-12-01T00:00:00Z",
    category: "streak"
  },
  {
    id: "2",
    name: "60분 돌파",
    description: "한 번에 60분 이상 집중했습니다",
    icon_url: "/api/placeholder/40/40",
    earned_at: "2024-12-01T00:00:00Z",
    category: "milestone"
  },
  {
    id: "3",
    name: "집중 마스터",
    description: "평균 집중 점수 80점 이상을 달성했습니다",
    icon_url: "/api/placeholder/40/40",
    earned_at: "2024-12-01T00:00:00Z",
    category: "achievement"
  }
]

const mockChallenges: Challenge[] = [
  {
    id: "1",
    name: "이번 주 10시간 집중하기",
    description: "일주일 동안 총 10시간 집중 세션을 완료하세요",
    type: "personal",
    progress: 70,
    target: 600,
    current: 420,
    end_date: "2024-12-07T23:59:59Z"
  },
  {
    id: "2",
    name: "친구와 1:1 챌린지",
    description: "친구와 함께 집중 시간을 겨뤄보세요",
    type: "one_on_one",
    progress: 45,
    target: 300,
    current: 135,
    end_date: "2024-12-05T23:59:59Z"
  }
]

const mockSharingSettings: ReportSharingSettings = {
  allow_friends_view: true,
  sharing_period: "week",
  sharing_scope: "summary",
  real_time_score_sharing: false
}

// 개인화 설정 인터페이스
interface PersonalizationSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'ko' | 'en'
  fontSize: 'small' | 'medium' | 'large'
  colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly'
  defaultGoalMinutes: number
  notifications: {
    focusSession: boolean
    achievement: boolean
    weeklyReport: boolean
    challenge: boolean
    sound: boolean
    vibration: boolean
  }
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private'
    dataSharing: boolean
    analytics: boolean
  }
  sync: {
    autoSync: boolean
    syncInterval: 'realtime' | 'hourly' | 'daily'
    cloudBackup: boolean
  }
}

// Mock personalization settings
const mockPersonalizationSettings: PersonalizationSettings = {
  theme: 'system',
  language: 'ko',
  fontSize: 'medium',
  colorScheme: 'default',
  defaultGoalMinutes: 30,
  notifications: {
    focusSession: true,
    achievement: true,
    weeklyReport: true,
    challenge: false,
    sound: true,
    vibration: false,
  },
  privacy: {
    profileVisibility: 'friends',
    dataSharing: true,
    analytics: true,
  },
  sync: {
    autoSync: true,
    syncInterval: 'realtime',
    cloudBackup: true,
  }
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [sharingSettings, setSharingSettings] = useState(mockSharingSettings)
  const [personalizationSettings, setPersonalizationSettings] = useState(mockPersonalizationSettings)
  const [isEditing, setIsEditing] = useState(false)
  
  // 개인화 설정 저장 함수
  const savePersonalizationSettings = async (settings: PersonalizationSettings) => {
    try {
      const response = await fetch('/api/profile/personalization-model', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          default_goal_minutes: settings.defaultGoalMinutes
        })
      })
      
      if (response.ok) {
        console.log('개인화 설정이 저장되었습니다')
      } else {
        console.error('개인화 설정 저장 실패')
      }
    } catch (error) {
      console.error('개인화 설정 저장 중 오류:', error)
    }
  }

  // 프로필 데이터 조회
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(user?.id)
  const { data: focusSummary, isLoading: summaryLoading, error: summaryError } = useFocusSummary(user?.id)
  const { data: weeklyStats, isLoading: statsLoading, error: statsError } = useWeeklyStats(user?.id)
  
  // 프로필 업데이트
  const updateProfileMutation = useUpdateProfile()
  
  // 프로필 이미지 업로드/삭제
  const uploadImageMutation = useUploadProfileImage()
  const deleteImageMutation = useDeleteProfileImage()

  // 로딩 상태
  const isLoading = profileLoading || summaryLoading || statsLoading

  // 이미지 업로드 핸들러
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      console.log('이미지 업로드 시작:', file.name, file.size)
      uploadImageMutation.mutate(file, {
        onSuccess: (data) => {
          console.log('이미지 업로드 성공:', data)
        },
        onError: (error) => {
          console.error('이미지 업로드 실패:', error)
        }
      })
    }
  }

  // 이미지 삭제 핸들러
  const handleImageDelete = () => {
    if (profile?.avatar_url) {
      deleteImageMutation.mutate()
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  if (profileError || summaryError || statsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">데이터를 불러오는데 실패했습니다.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">프로필</h1>
          <p className="text-gray-600">나의 집중 습관과 성과를 한눈에 확인하세요</p>
        </div>

        {/* Basic Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          {isEditing ? (
            <InlineProfileEdit
              profile={profile || null}
              onSave={(data) => {
                updateProfileMutation.mutate(data)
                setIsEditing(false)
              }}
              onCancel={() => setIsEditing(false)}
              onImageUpload={(file) => {
                uploadImageMutation.mutate(file)
              }}
              onImageDelete={() => {
                if (profile?.avatar_url) {
                  deleteImageMutation.mutate()
                }
              }}
            />
          ) : (
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                  <div className="relative group">
                    <Avatar className="w-24 h-24 cursor-pointer">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.display_name} />
                  <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-gray-900">{profile?.display_name || '사용자'}</h2>
                      <span className="text-gray-500">@{profile?.handle || 'user'}</span>
                      <StatusBadge status={profile?.status as UserStatus || UserStatus.ONLINE} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="ml-auto"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        편집
                      </Button>
                  </div>
                  
                    <div className="space-y-3">
                      <p className="text-gray-600 text-lg">
                        {profile?.bio || '소개를 입력해주세요'}
                      </p>
                  
                  <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4" />
                          <span>{profile?.school || '학교 미입력'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                          <span>{profile?.major || '전공 미입력'}</span>
                      </div>
                      </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="achievements">성과</TabsTrigger>
            <TabsTrigger value="personalization">개인화 모델</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <OverviewTab 
              focusSummary={focusSummary || null} 
              weeklyStats={weeklyStats} 
            />
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            <AchievementsTab 
              badges={mockBadges} 
              challenges={mockChallenges} 
            />
          </TabsContent>

          {/* Personalization Model Tab */}
          <TabsContent value="personalization" className="space-y-6">
            <PersonalizationTab />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <SettingsTab 
              personalizationSettings={personalizationSettings}
              setPersonalizationSettings={(settings) => {
                setPersonalizationSettings(settings)
                savePersonalizationSettings(settings)
              }}
              sharingSettings={sharingSettings}
              setSharingSettings={setSharingSettings}
            />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}