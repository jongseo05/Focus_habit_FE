import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Download, Upload } from "lucide-react"

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

interface SyncSettingsProps {
  settings: PersonalizationSettings['sync']
  onSettingsChange: (settings: PersonalizationSettings['sync']) => void
}

export const SyncSettings = ({ settings, onSettingsChange }: SyncSettingsProps) => {
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
