import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

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

interface NotificationSettingsProps {
  settings: PersonalizationSettings['notifications']
  onSettingsChange: (settings: PersonalizationSettings['notifications']) => void
}

export const NotificationSettings = ({ settings, onSettingsChange }: NotificationSettingsProps) => {
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
