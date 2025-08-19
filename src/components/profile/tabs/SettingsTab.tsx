import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Palette, 
  Bell, 
  Shield, 
  Database, 
  User, 
  Eye, 
  Edit3, 
  Key, 
  Trash2, 
  Smartphone 
} from "lucide-react"
import { 
  ThemeToggle, 
  NotificationSettings, 
  PrivacySettings, 
  SyncSettings 
} from "../settings"
import { ReportSharingSettings } from "@/types/profile"

// 개인화 설정 인터페이스
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

interface SettingsTabProps {
  personalizationSettings: PersonalizationSettings
  setPersonalizationSettings: (settings: PersonalizationSettings) => void
  sharingSettings: ReportSharingSettings
  setSharingSettings: (settings: ReportSharingSettings) => void
}

export const SettingsTab = ({ 
  personalizationSettings, 
  setPersonalizationSettings,
  sharingSettings,
  setSharingSettings 
}: SettingsTabProps) => {
  return (
    <div className="space-y-6">
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
              onThemeChange={(theme) => setPersonalizationSettings({ ...personalizationSettings, theme })} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">언어</Label>
              <Select
                value={personalizationSettings.language}
                onValueChange={(value: 'ko' | 'en') => setPersonalizationSettings({ ...personalizationSettings, language: value })}
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
                onValueChange={(value: 'small' | 'medium' | 'large') => setPersonalizationSettings({ ...personalizationSettings, fontSize: value })}
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
              onValueChange={(value: 'default' | 'high-contrast' | 'colorblind-friendly') => setPersonalizationSettings({ ...personalizationSettings, colorScheme: value })}
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
            onSettingsChange={(notifications) => setPersonalizationSettings({ ...personalizationSettings, notifications })}
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
            onSettingsChange={(privacy) => setPersonalizationSettings({ ...personalizationSettings, privacy })}
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
            onSettingsChange={(sync) => setPersonalizationSettings({ ...personalizationSettings, sync })}
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
                setSharingSettings({ ...sharingSettings, allow_friends_view: checked })
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
                    setSharingSettings({ ...sharingSettings, sharing_period: value })
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
                    setSharingSettings({ ...sharingSettings, sharing_scope: value })
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
                setSharingSettings({ ...sharingSettings, real_time_score_sharing: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
