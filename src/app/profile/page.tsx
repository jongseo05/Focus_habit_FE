"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  User,
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  Eye,
  School,
  BookOpen,
  Activity,
  PlayCircle,
  Bell,
  BellOff,
  Palette,
  Moon,
  Sun,
  Monitor,
  Database,
  Download,
  Upload,
  Trash2,
  Edit3,
  Key,
  Trophy,
  Brain,
  RefreshCw,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as BadgeUI } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/useAuth"
import { useProfile, useUpdateProfile, useFocusSummary, useWeeklyStats } from "@/hooks/useProfile"
import { useUploadProfileImage, useDeleteProfileImage } from "@/hooks/useProfileImage"
import { UserStatus, UserProfile, FocusSummary, Badge as BadgeType, Challenge, ReportSharingSettings } from "@/types/profile"
import { Textarea } from "@/components/ui/textarea"

// Mock data for development
const mockProfile: UserProfile = {
  id: "1",
  user_id: "user1",
  display_name: "김집중",
  handle: "focus_master",
  avatar_url: "/api/placeholder/100/100",
  bio: "매일 조금씩 성장하는 개발자입니다 🚀",
  school: "서울대학교",
  major: "컴퓨터공학부",
  status: UserStatus.ONLINE,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-12-01T00:00:00Z"
}

const mockFocusSummary: FocusSummary = {
  weekly_total_time: 420, // 7시간
  average_focus_score: 85,
  longest_streak: 120, // 2시간
  session_count: 12,
  weekly_change: 12.5
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

// Personalization Model Interface
interface PersonalizationModelInfo {
  focus_samples_collected: number
  non_focus_samples_collected: number
  total_samples_needed: number
  completion_percentage: number
  model_version: string
  last_updated: string
  model_accuracy: number
  training_status: 'idle' | 'collecting' | 'training' | 'completed' | 'error'
  next_training_date: string
}

// Mock personalization model data
const mockPersonalizationModel: PersonalizationModelInfo = {
  focus_samples_collected: 45,
  non_focus_samples_collected: 38,
  total_samples_needed: 100,
  completion_percentage: 83,
  model_version: "1.2.0",
  last_updated: "2024-12-01T00:00:00Z",
  model_accuracy: 87.5,
  training_status: 'completed',
  next_training_date: "2024-12-08T00:00:00Z"
}

// Mock personalization settings
const mockPersonalizationSettings: PersonalizationSettings = {
  theme: 'system',
  language: 'ko',
  fontSize: 'medium',
  colorScheme: 'default',
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

// Status Badge Component
const StatusBadge = ({ status }: { status: UserStatus }) => {
  const getStatusConfig = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ONLINE:
        return { text: "온라인", color: "bg-green-500", icon: Activity }
      case UserStatus.IN_SESSION:
        return { text: "세션중", color: "bg-blue-500", icon: PlayCircle }
      case UserStatus.DO_NOT_DISTURB:
        return { text: "방해금지", color: "bg-red-500", icon: BellOff }
      default:
        return { text: "오프라인", color: "bg-gray-500", icon: User }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <BadgeUI variant="secondary" className={`${config.color} text-white flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.text}
    </BadgeUI>
  )
}

// Focus Summary Card Component
const FocusSummaryCard = ({ summary }: { summary: FocusSummary }) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`
  }

  const formatScore = (score: number) => {
    return `${score}점`
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          <Target className="w-5 h-5" />
          이번 주 집중 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{formatTime(summary.weekly_total_time)}</div>
            <div className="text-sm text-blue-600">총 집중시간</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{formatScore(summary.average_focus_score)}</div>
            <div className="text-sm text-blue-600">평균 집중점수</div>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">{formatTime(summary.longest_streak)}</div>
            <div className="text-sm text-blue-600">최장 스트릭</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">{summary.session_count}회</div>
            <div className="text-sm text-blue-600">세션 수</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          {summary.weekly_change > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={summary.weekly_change > 0 ? "text-green-600" : "text-red-600"}>
            지난주 대비 {Math.abs(summary.weekly_change)}% {summary.weekly_change > 0 ? "증가" : "감소"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}





// Personalization Settings Interface
interface PersonalizationSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'ko' | 'en'
  fontSize: 'small' | 'medium' | 'large'
  colorScheme: 'default' | 'high-contrast' | 'colorblind-friendly'
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

// Theme Toggle Component
const ThemeToggle = ({ theme, onThemeChange }: { theme: string, onThemeChange: (theme: 'light' | 'dark' | 'system') => void }) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={theme === 'light' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onThemeChange('light')}
        className="flex items-center gap-2"
      >
        <Sun className="w-4 h-4" />
        라이트
      </Button>
      <Button
        variant={theme === 'dark' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onThemeChange('dark')}
        className="flex items-center gap-2"
      >
        <Moon className="w-4 h-4" />
        다크
      </Button>
      <Button
        variant={theme === 'system' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onThemeChange('system')}
        className="flex items-center gap-2"
      >
        <Monitor className="w-4 h-4" />
        시스템
      </Button>
    </div>
  )
}

// Notification Settings Component
const NotificationSettings = ({ settings, onSettingsChange }: { 
  settings: PersonalizationSettings['notifications'], 
  onSettingsChange: (settings: PersonalizationSettings['notifications']) => void 
}) => {
  const updateSetting = (key: keyof PersonalizationSettings['notifications'], value: boolean) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">집중 세션 알림</Label>
          <p className="text-sm text-gray-600">집중 세션 시작/종료 시 알림을 받습니다</p>
        </div>
        <Switch
          checked={settings.focusSession}
          onCheckedChange={(checked) => updateSetting('focusSession', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">성과 달성 알림</Label>
          <p className="text-sm text-gray-600">배지 획득이나 목표 달성 시 알림을 받습니다</p>
        </div>
        <Switch
          checked={settings.achievement}
          onCheckedChange={(checked) => updateSetting('achievement', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">주간 리포트 알림</Label>
          <p className="text-sm text-gray-600">매주 일요일에 주간 리포트를 알려줍니다</p>
        </div>
        <Switch
          checked={settings.weeklyReport}
          onCheckedChange={(checked) => updateSetting('weeklyReport', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">챌린지 알림</Label>
          <p className="text-sm text-gray-600">챌린지 진행 상황과 마감 알림을 받습니다</p>
        </div>
        <Switch
          checked={settings.challenge}
          onCheckedChange={(checked) => updateSetting('challenge', checked)}
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">알림음</Label>
          <p className="text-sm text-gray-600">알림 시 소리를 재생합니다</p>
        </div>
        <Switch
          checked={settings.sound}
          onCheckedChange={(checked) => updateSetting('sound', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">진동</Label>
          <p className="text-sm text-gray-600">알림 시 기기를 진동시킵니다</p>
        </div>
        <Switch
          checked={settings.vibration}
          onCheckedChange={(checked) => updateSetting('vibration', checked)}
        />
      </div>
    </div>
  )
}

// Privacy Settings Component
const PrivacySettings = ({ settings, onSettingsChange }: { 
  settings: PersonalizationSettings['privacy'], 
  onSettingsChange: (settings: PersonalizationSettings['privacy']) => void 
}) => {
  const updateSetting = (key: keyof PersonalizationSettings['privacy'], value: any) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-visibility">프로필 공개 범위</Label>
        <Select
          value={settings.profileVisibility}
          onValueChange={(value: 'public' | 'friends' | 'private') => updateSetting('profileVisibility', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">전체 공개</SelectItem>
            <SelectItem value="friends">친구만</SelectItem>
            <SelectItem value="private">비공개</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-600">프로필을 볼 수 있는 사용자 범위를 설정합니다</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">데이터 공유</Label>
          <p className="text-sm text-gray-600">익명화된 데이터를 연구 및 서비스 개선에 활용합니다</p>
        </div>
        <Switch
          checked={settings.dataSharing}
          onCheckedChange={(checked) => updateSetting('dataSharing', checked)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">사용 분석</Label>
          <p className="text-sm text-gray-600">서비스 사용 패턴을 분석하여 개인화된 경험을 제공합니다</p>
        </div>
        <Switch
          checked={settings.analytics}
          onCheckedChange={(checked) => updateSetting('analytics', checked)}
        />
      </div>
    </div>
  )
}

// Badge Component
const BadgeCard = ({ badge }: { badge: BadgeType }) => {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{badge.name}</h4>
            <p className="text-sm text-gray-600">{badge.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(badge.earned_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Challenge Component
const ChallengeCard = ({ challenge }: { challenge: Challenge }) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'personal': return 'bg-blue-100 text-blue-800'
      case 'one_on_one': return 'bg-green-100 text-green-800'
      case 'group': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'personal': return '개인'
      case 'one_on_one': return '1:1'
      case 'group': return '그룹'
      default: return '기타'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <BadgeUI className={getTypeColor(challenge.type)} variant="secondary">
            {getTypeText(challenge.type)}
          </BadgeUI>
          <span className="text-sm text-gray-500">
            {new Date(challenge.end_date).toLocaleDateString('ko-KR')}
          </span>
        </div>
        
        <h4 className="font-semibold text-gray-900 mb-2">{challenge.name}</h4>
        <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>진행률</span>
            <span className="font-medium">{challenge.progress}%</span>
          </div>
          <Progress value={challenge.progress} className="h-2" />
          <div className="text-xs text-gray-500 text-center">
            {challenge.current} / {challenge.target}분
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Inline Profile Edit Component
const InlineProfileEdit = ({ 
  profile, 
  onSave, 
  onCancel,
  onImageUpload,
  onImageDelete
}: { 
  profile: UserProfile | null
  onSave: (data: Partial<UserProfile>) => void
  onCancel: () => void
  onImageUpload: (file: File) => void
  onImageDelete: () => void
}) => {
  const [formData, setFormData] = useState({
    display_name: '',
    handle: '',
    bio: '',
    school: '',
    major: ''
  })

  // profile이 변경될 때 formData 업데이트
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || '',
        handle: profile.handle || '',
        bio: profile.bio || '',
        school: profile.school || '',
        major: profile.major || ''
      })
    }
  }, [profile])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onImageUpload(file)
    }
  }

  return (
    <Card className="bg-white shadow-sm">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
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
              {profile?.avatar_url && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={onImageDelete}
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    value={formData.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="text-2xl font-bold"
                    required
                  />
                  <Input
                    value={formData.handle}
                    onChange={(e) => handleInputChange('handle', e.target.value)}
                    placeholder="핸들을 입력하세요"
                    className="text-gray-500"
                    required
                  />
                </div>
                <StatusBadge status={profile?.status as UserStatus || UserStatus.ONLINE} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    저장
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                    취소
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="자신에 대해 소개해주세요"
                  rows={2}
                  className="text-gray-600 text-lg"
                />
              </div>
              
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4" />
                  <Input
                    value={formData.school}
                    onChange={(e) => handleInputChange('school', e.target.value)}
                    placeholder="학교명"
                    className="w-32"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <Input
                    value={formData.major}
                    onChange={(e) => handleInputChange('major', e.target.value)}
                    placeholder="전공명"
                    className="w-32"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Sync Settings Component
const SyncSettings = ({ settings, onSettingsChange }: { 
  settings: PersonalizationSettings['sync'], 
  onSettingsChange: (settings: PersonalizationSettings['sync']) => void 
}) => {
  const updateSetting = (key: keyof PersonalizationSettings['sync'], value: any) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">자동 동기화</Label>
          <p className="text-sm text-gray-600">데이터를 자동으로 클라우드와 동기화합니다</p>
        </div>
        <Switch
          checked={settings.autoSync}
          onCheckedChange={(checked) => updateSetting('autoSync', checked)}
        />
      </div>

      {settings.autoSync && (
        <div className="space-y-2">
          <Label htmlFor="sync-interval">동기화 주기</Label>
          <Select
            value={settings.syncInterval}
            onValueChange={(value: 'realtime' | 'hourly' | 'daily') => updateSetting('syncInterval', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="realtime">실시간</SelectItem>
              <SelectItem value="hourly">1시간마다</SelectItem>
              <SelectItem value="daily">하루마다</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">클라우드 백업</Label>
          <p className="text-sm text-gray-600">중요한 데이터를 클라우드에 백업합니다</p>
        </div>
        <Switch
          checked={settings.cloudBackup}
          onCheckedChange={(checked) => updateSetting('cloudBackup', checked)}
        />
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          데이터 내보내기
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Upload className="w-4 h-4 mr-2" />
          데이터 가져오기
        </Button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("overview")
  const [sharingSettings, setSharingSettings] = useState(mockSharingSettings)
  const [personalizationSettings, setPersonalizationSettings] = useState(mockPersonalizationSettings)
  const [isEditing, setIsEditing] = useState(false)

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
            <div className="grid grid-cols-1 gap-6">
              {focusSummary && <FocusSummaryCard summary={focusSummary} />}
              
              {/* Weekly Activity Summary */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-green-900 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    이번 주 활동 요약
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-white/60 rounded-lg">
                      <div className="text-3xl font-bold text-green-900 mb-2">
                        {focusSummary ? `${Math.floor(focusSummary.weekly_total_time / 60)}시간 ${focusSummary.weekly_total_time % 60}분` : '0시간 0분'}
                      </div>
                      <div className="text-sm text-green-700 font-medium">총 집중시간</div>
                    </div>
                    
                    <div className="text-center p-4 bg-white/60 rounded-lg">
                      <div className="text-3xl font-bold text-green-900 mb-2">
                        {focusSummary?.average_focus_score || 0}점
                      </div>
                      <div className="text-sm text-green-700 font-medium">평균 집중점수</div>
                    </div>
                    
                    <div className="text-center p-4 bg-white/60 rounded-lg">
                      <div className="text-3xl font-bold text-green-900 mb-2">
                        {focusSummary?.session_count || 0}회
                      </div>
                      <div className="text-sm text-green-700 font-medium">세션 수</div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Weekly Change Visualization */}
                  <div>
                    <h4 className="text-base font-semibold text-green-900 mb-4 text-center">전주 대비 증감</h4>
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        {focusSummary && focusSummary.weekly_change > 0 ? (
                          <TrendingUp className="w-6 h-6 text-green-500" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-500" />
                        )}
                        <span className={`text-lg font-bold ${
                          focusSummary && focusSummary.weekly_change > 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {focusSummary ? Math.abs(focusSummary.weekly_change) : 0}%
                        </span>
                      </div>
                      <span className="text-green-700">
                        {focusSummary && focusSummary.weekly_change > 0 ? "증가" : "감소"}
                      </span>
                    </div>
                  </div>

                  {/* Weekly Focus Chart */}
                  <div>
                    <h4 className="text-base font-semibold text-green-900 mb-4 text-center">요일별 집중도</h4>
                    <div className="bg-white/60 rounded-lg p-6">
                      <div className="flex items-end justify-between h-60 gap-3">
                        {weeklyStats?.daily_stats?.map((dayStat: any, index: number) => {
                          const goalHeight = 120 // 목표 시간 기준 높이
                          const actualHeight = Math.min((dayStat.total_time / dayStat.goal_time) * goalHeight, 180) // 최대 180px
                          const timeText = dayStat.total_time >= 60 
                            ? `${Math.floor(dayStat.total_time / 60)}h ${dayStat.total_time % 60}m`
                            : `${dayStat.total_time}m`
                          const goalDiff = dayStat.total_time - dayStat.goal_time
                          const diffText = goalDiff >= 0 
                            ? `+${goalDiff >= 60 ? `${Math.floor(goalDiff / 60)}h ${goalDiff % 60}m` : `${goalDiff}m`}`
                            : `${goalDiff >= -60 ? `${goalDiff}m` : `${Math.floor(Math.abs(goalDiff) / 60)}h ${Math.abs(goalDiff) % 60}m`}`

                          return (
                            <div key={index} className="flex flex-col items-center gap-3 flex-1">
                          <div className="w-full relative group cursor-pointer">
                            {/* 목표 시간 바 (반투명 연한 초록색) */}
                            <div className="w-full bg-green-200/60 rounded-t-sm" 
                                     style={{ height: `${goalHeight}px` }}></div>
                            {/* 실제 집중 시간 바 (진한 색, 겹쳐서 표시) */}
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t-sm" 
                                     style={{ height: `${actualHeight}px` }}>
                              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                    {dayStat.day_name}요일: {timeText} (목표: {dayStat.goal_time >= 60 ? `${Math.floor(dayStat.goal_time / 60)}시간` : `${dayStat.goal_time}분`})
                              </div>
                            </div>
                          </div>
                              <span className="text-xs text-green-700 font-medium">{dayStat.day_name}</span>
                              <span className="text-xs text-green-600">{timeText}</span>
                              <span className={`text-xs font-medium ${goalDiff >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                {diffText}
                              </span>
                        </div>
                          )
                        }) || Array.from({ length: 7 }, (_, i) => (
                          <div key={i} className="flex flex-col items-center gap-3 flex-1">
                          <div className="w-full relative group cursor-pointer">
                              <div className="w-full bg-green-200/60 rounded-t-sm" style={{ height: '120px' }}></div>
                              <div className="absolute bottom-0 w-full bg-gradient-to-t from-green-400 to-green-500 rounded-t-sm" style={{ height: '0px' }}></div>
                              </div>
                            <span className="text-xs text-green-700 font-medium">{['일', '월', '화', '수', '목', '금', '토'][i]}</span>
                            <span className="text-xs text-green-600">0m</span>
                            <span className="text-xs text-red-600 font-medium">-2h</span>
                            </div>
                        ))}
                      </div>
                      
                      {/* Chart Legend */}
                      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-green-700">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-400 rounded"></div>
                          <span>집중 시간</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-200 rounded"></div>
                          <span>목표 시간 (2시간)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            {/* Badges Section */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                획득 배지
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockBadges.map((badge) => (
                  <BadgeCard key={badge.id} badge={badge} />
                ))}
              </div>
            </div>

            {/* Challenges Section */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                진행 중 챌린지
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockChallenges.map((challenge) => (
                  <ChallengeCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Personalization Model Tab */}
          <TabsContent value="personalization" className="space-y-6">
            {/* Model Status Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  개인화 모델 상태
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-white/60 rounded-lg">
                    <div className="text-2xl font-bold text-purple-900">
                      {mockPersonalizationModel.model_accuracy}%
                    </div>
                    <div className="text-sm text-purple-700">모델 정확도</div>
                  </div>
                  <div className="text-center p-3 bg-white/60 rounded-lg">
                    <div className="text-2xl font-bold text-purple-900">
                      v{mockPersonalizationModel.model_version}
                    </div>
                    <div className="text-sm text-purple-700">모델 버전</div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">집중 샘플 수집</span>
                    <span className="text-sm font-medium text-purple-900">
                      {mockPersonalizationModel.focus_samples_collected} / {mockPersonalizationModel.total_samples_needed}
                    </span>
                  </div>
                  <Progress 
                    value={(mockPersonalizationModel.focus_samples_collected / mockPersonalizationModel.total_samples_needed) * 100} 
                    className="h-2 bg-purple-200"
                  />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">비집중 샘플 수집</span>
                    <span className="text-sm font-medium text-purple-900">
                      {mockPersonalizationModel.non_focus_samples_collected} / {mockPersonalizationModel.total_samples_needed}
                    </span>
                  </div>
                  <Progress 
                    value={(mockPersonalizationModel.non_focus_samples_collected / mockPersonalizationModel.total_samples_needed) * 100} 
                    className="h-2 bg-purple-200"
                  />
                </div>

                <Separator />
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-900">
                    {mockPersonalizationModel.completion_percentage}%
                  </div>
                  <div className="text-sm text-purple-600">전체 완료율</div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-purple-900">
                      {new Date(mockPersonalizationModel.last_updated).toLocaleDateString('ko-KR')}
                    </div>
                    <div className="text-purple-600">마지막 업데이트</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-purple-900">
                      {new Date(mockPersonalizationModel.next_training_date).toLocaleDateString('ko-KR')}
                    </div>
                    <div className="text-purple-600">다음 학습 예정</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    샘플 재수집
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Brain className="w-4 h-4 mr-2" />
                    모델 재학습
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Model Training History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  모델 학습 기록
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">v1.2.0 학습 완료</div>
                        <div className="text-sm text-gray-600">정확도: 87.5%</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(mockPersonalizationModel.last_updated).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">v1.1.0 학습 완료</div>
                        <div className="text-sm text-gray-600">정확도: 82.3%</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">2024-11-15</div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">v1.0.0 초기 모델</div>
                        <div className="text-sm text-gray-600">정확도: 75.1%</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">2024-10-01</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Model Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  모델 성능 지표
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">집중 상태 감지</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>정확도</span>
                        <span className="font-medium">89.2%</span>
                      </div>
                      <Progress value={89.2} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>재현율</span>
                        <span className="font-medium">87.8%</span>
                      </div>
                      <Progress value={87.8} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>정밀도</span>
                        <span className="font-medium">91.5%</span>
                      </div>
                      <Progress value={91.5} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">비집중 상태 감지</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>정확도</span>
                        <span className="font-medium">85.8%</span>
                      </div>
                      <Progress value={85.8} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>재현율</span>
                        <span className="font-medium">83.2%</span>
                      </div>
                      <Progress value={83.2} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>정밀도</span>
                        <span className="font-medium">88.7%</span>
                      </div>
                      <Progress value={88.7} className="h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Theme Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  테마 및 외관
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-base font-medium">테마 모드</Label>
                  <ThemeToggle 
                    theme={personalizationSettings.theme} 
                    onThemeChange={(theme) => setPersonalizationSettings(prev => ({ ...prev, theme }))} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">언어</Label>
                    <Select
                      value={personalizationSettings.language}
                      onValueChange={(value: 'ko' | 'en') => setPersonalizationSettings(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ko">한국어</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="font-size">폰트 크기</Label>
                    <Select
                      value={personalizationSettings.fontSize}
                      onValueChange={(value: 'small' | 'medium' | 'large') => setPersonalizationSettings(prev => ({ ...prev, fontSize: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">작게</SelectItem>
                        <SelectItem value="medium">보통</SelectItem>
                        <SelectItem value="large">크게</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="color-scheme">색상 테마</Label>
                  <Select
                    value={personalizationSettings.colorScheme}
                    onValueChange={(value: 'default' | 'high-contrast' | 'colorblind-friendly') => setPersonalizationSettings(prev => ({ ...prev, colorScheme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">기본</SelectItem>
                      <SelectItem value="high-contrast">고대비</SelectItem>
                      <SelectItem value="colorblind-friendly">색맹 친화적</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  알림 설정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NotificationSettings 
                  settings={personalizationSettings.notifications}
                  onSettingsChange={(notifications) => setPersonalizationSettings(prev => ({ ...prev, notifications }))}
                />
              </CardContent>
            </Card>

            {/* Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  개인정보 보호
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PrivacySettings 
                  settings={personalizationSettings.privacy}
                  onSettingsChange={(privacy) => setPersonalizationSettings(prev => ({ ...prev, privacy }))}
                />
              </CardContent>
            </Card>

            {/* Sync Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  동기화 및 백업
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SyncSettings 
                  settings={personalizationSettings.sync}
                  onSettingsChange={(sync) => setPersonalizationSettings(prev => ({ ...prev, sync }))}
                />
              </CardContent>
            </Card>

            {/* Account Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  계정 관리
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Edit3 className="w-4 h-4 mr-2" />
                    프로필 편집
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Key className="w-4 h-4 mr-2" />
                    비밀번호 변경
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    <Smartphone className="w-4 h-4 mr-2" />
                    기기 관리
                  </Button>
                  <Button variant="destructive" className="flex-1">
                    <Trash2 className="w-4 h-4 mr-2" />
                    계정 삭제
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Report Sharing Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  리포트 공유 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="friends-view" className="text-base font-medium">
                      친구가 내 리포트 보기
                    </Label>
                    <p className="text-sm text-gray-600">
                      친구들이 내 집중 리포트를 볼 수 있도록 허용합니다
                    </p>
                  </div>
                  <Switch
                    id="friends-view"
                    checked={sharingSettings.allow_friends_view}
                    onCheckedChange={(checked: boolean) =>
                      setSharingSettings(prev => ({ ...prev, allow_friends_view: checked }))
                    }
                  />
                </div>

                {sharingSettings.allow_friends_view && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sharing-period">공유 기간</Label>
                      <Select
                        value={sharingSettings.sharing_period}
                        onValueChange={(value: any) =>
                          setSharingSettings(prev => ({ ...prev, sharing_period: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">하루</SelectItem>
                          <SelectItem value="week">일주일</SelectItem>
                          <SelectItem value="month">한 달</SelectItem>
                          <SelectItem value="all">전체</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sharing-scope">공유 범위</Label>
                      <Select
                        value={sharingSettings.sharing_scope}
                        onValueChange={(value: any) =>
                          setSharingSettings(prev => ({ ...prev, sharing_scope: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summary">요약</SelectItem>
                          <SelectItem value="detailed">상세</SelectItem>
                          <SelectItem value="full">전체</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="real-time-sharing" className="text-base font-medium">
                      실시간 점수 공유
                    </Label>
                    <p className="text-sm text-gray-600">
                      세션 중에 실시간 집중 점수를 친구들과 공유합니다
                    </p>
                  </div>
                  <Switch
                    id="real-time-sharing"
                    checked={sharingSettings.real_time_score_sharing}
                    onCheckedChange={(checked: boolean) =>
                      setSharingSettings(prev => ({ ...prev, real_time_score_sharing: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  )
}
