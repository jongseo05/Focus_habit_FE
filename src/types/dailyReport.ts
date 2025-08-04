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
    // 총 집중 시간
    totalFocusTime: {
      time: string
      goalProgress: number
      weekTrend: number
    }
    // 평균 집중도
    averageFocus: {
      score: number
      grade: string
      sessionImprovement: number
    }
    // 방해 요소
    distractions: {
      count: number
      mainCause: string
      details: Array<{
        type: string
        time: string
        impact: string
      }>
      yesterdayChange: number
    }
    // 기존 데이터 (호환성을 위해 유지)
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