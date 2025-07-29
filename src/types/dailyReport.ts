// Daily Report 관련 타입 정의

export interface FocusScorePoint {
  ts: string // ISO timestamp
  score: number // 0-100
  events: EventType[]
}

export type EventType = 'phone' | 'distraction' | 'break' | 'focus' | 'posture'

export interface DailyReportData {
  date: string // YYYY-MM-DD
  focusScorePoints: FocusScorePoint[]
  highlights: {
    peak: {
      time: string
      score: number
      duration: number
    }
    drop: {
      time: string
      score: number
      reason: string
    }
    phoneUsage: {
      count: number
      totalTime: number
      peakTime: string
    }
  }
  aiAdvice: {
    message: string
    routine: RoutineToggle
  }
  reward: {
    exp: number
    level: number
    progress: number
    stickers: string[]
  }
}

export interface RoutineToggle {
  id: string
  name: string
  enabled: boolean
  description: string
}

export interface SnapshotData {
  id: string
  timestamp: string
  imageUrl: string
  focusScore: number
  note?: string
}

export interface EmptyStateCardProps {
  date: string
  message?: string
}

export interface TimelineCardProps {
  data: FocusScorePoint[]
  onPointClick: (point: FocusScorePoint) => void
}

export interface HighlightCardsProps {
  highlights: DailyReportData['highlights']
}

export interface AIAdviceBubbleProps {
  message: string
  routine: RoutineToggle
  onRoutineToggle: (routineId: string, enabled: boolean) => void
}

export interface SmallRewardPanelProps {
  reward: DailyReportData['reward']
  onClaim: () => void
  claimed: boolean
}

export interface SnapshotModalProps {
  snapshot: SnapshotData | null
  isOpen: boolean
  onClose: () => void
  onSaveNote: (note: string) => void
} 