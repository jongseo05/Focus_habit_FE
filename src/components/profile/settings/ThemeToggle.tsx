import { Button } from "@/components/ui/button"
import { Sun, Moon, Monitor } from "lucide-react"

interface ThemeToggleProps {
  theme: string
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void
}

export const ThemeToggle = ({ theme, onThemeChange }: ThemeToggleProps) => {
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
