import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

interface PrivacySettingsProps {
  settings: PersonalizationSettings['privacy']
  onSettingsChange: (settings: PersonalizationSettings['privacy']) => void
}

export const PrivacySettings = ({ settings, onSettingsChange }: PrivacySettingsProps) => {
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
