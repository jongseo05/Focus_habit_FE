import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 집중 세션 상태 관리를 위한 스토어
interface FocusSessionState {
  isRunning: boolean
  isPaused: boolean
  elapsed: number
  focusScore: number
  startTime: number | null
}

// 대시보드 UI 상태 관리를 위한 스토어
interface DashboardUIState {
  // 웹캠 관련
  showWebcam: boolean
  showPermissionLayer: boolean
  showErrorDisplay: boolean
  
  // 차트/UI 상태
  hoveredChartPoint: number | null
  chartType: 'area' | 'line'
  snapshotCollapsed: boolean
  
  // 애니메이션 상태
  hoveredBarIndex: number | null
  
  // 알림
  notifications: Array<{
    id: number
    message: string
    type: 'success' | 'info' | 'warning' | 'error'
  }>
}

// 통합 대시보드 상태
interface DashboardState extends FocusSessionState, DashboardUIState {
  // 집중 세션 액션
  startSession: () => void
  pauseSession: () => void
  stopSession: () => void
  updateElapsed: () => void
  updateFocusScore: (score: number) => void
  
  // UI 액션
  setShowWebcam: (show: boolean) => void
  setShowPermissionLayer: (show: boolean) => void
  setShowErrorDisplay: (show: boolean) => void
  setHoveredChartPoint: (index: number | null) => void
  setChartType: (type: 'area' | 'line') => void
  toggleSnapshotCollapsed: () => void
  setHoveredBarIndex: (index: number | null) => void
  addNotification: (notification: Omit<DashboardUIState['notifications'][0], 'id'>) => void
  removeNotification: (id: number) => void
  
  // 유틸리티
  formatTime: (seconds: number) => string
  reset: () => void
}

const initialState = {
  // 집중 세션 초기값
  isRunning: false,
  isPaused: false,
  elapsed: 0,
  focusScore: 85,
  startTime: null,
  
  // UI 초기값
  showWebcam: false,
  showPermissionLayer: false,
  showErrorDisplay: false,
  hoveredChartPoint: null,
  chartType: 'area' as const,
  snapshotCollapsed: false,
  hoveredBarIndex: null,
  notifications: [
    { id: 1, message: "웹캠 연결이 성공적으로 완료되었습니다", type: "success" as const },
    { id: 2, message: "새로운 업데이트가 있습니다", type: "info" as const },
  ]
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // 집중 세션 액션
      startSession: () => {
        set({
          isRunning: true,
          isPaused: false,
          startTime: Date.now(),
          elapsed: 0
        })
      },
      
      pauseSession: () => {
        set((state) => ({
          isPaused: !state.isPaused
        }))
      },
      
      stopSession: () => {
        set({
          isRunning: false,
          isPaused: false,
          elapsed: 0,
          startTime: null
        })
      },
      
      updateElapsed: () => {
        set((state) => {
          if (state.isRunning && !state.isPaused && state.startTime) {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
            return { elapsed }
          }
          return state
        })
      },
      
      updateFocusScore: (score: number) => {
        set({ focusScore: Math.max(0, Math.min(100, score)) })
      },
      
      // UI 액션
      setShowWebcam: (show: boolean) => set({ showWebcam: show }),
      setShowPermissionLayer: (show: boolean) => set({ showPermissionLayer: show }),
      setShowErrorDisplay: (show: boolean) => set({ showErrorDisplay: show }),
      setHoveredChartPoint: (index: number | null) => set({ hoveredChartPoint: index }),
      setChartType: (type: 'area' | 'line') => set({ chartType: type }),
      toggleSnapshotCollapsed: () => set((state) => ({ snapshotCollapsed: !state.snapshotCollapsed })),
      setHoveredBarIndex: (index: number | null) => set({ hoveredBarIndex: index }),
      
      addNotification: (notification) => {
        const newNotification = {
          ...notification,
          id: Date.now() + Math.random()
        }
        set((state) => ({
          notifications: [...state.notifications, newNotification]
        }))
      },
      
      removeNotification: (id: number) => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id)
        }))
      },
      
      // 유틸리티
      formatTime: (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      },
      
      reset: () => set(initialState)
    }),
    {
      name: 'dashboard-storage',
      // 민감하지 않은 UI 상태만 저장
      partialize: (state) => ({
        chartType: state.chartType,
        snapshotCollapsed: state.snapshotCollapsed,
        showWebcam: state.showWebcam
      })
    }
  )
)

// 선택자 훅들 (성능 최적화)
export const useFocusSession = () => useDashboardStore((state) => ({
  isRunning: state.isRunning,
  isPaused: state.isPaused,
  elapsed: state.elapsed,
  focusScore: state.focusScore,
  startSession: state.startSession,
  pauseSession: state.pauseSession,
  stopSession: state.stopSession,
  updateFocusScore: state.updateFocusScore,
  formatTime: state.formatTime
}))

export const useDashboardUI = () => useDashboardStore((state) => ({
  showWebcam: state.showWebcam,
  showPermissionLayer: state.showPermissionLayer,
  showErrorDisplay: state.showErrorDisplay,
  snapshotCollapsed: state.snapshotCollapsed,
  notifications: state.notifications,
  setShowWebcam: state.setShowWebcam,
  setShowPermissionLayer: state.setShowPermissionLayer,
  setShowErrorDisplay: state.setShowErrorDisplay,
  toggleSnapshotCollapsed: state.toggleSnapshotCollapsed,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification
}))

export const useChartState = () => useDashboardStore((state) => ({
  hoveredChartPoint: state.hoveredChartPoint,
  chartType: state.chartType,
  hoveredBarIndex: state.hoveredBarIndex,
  setHoveredChartPoint: state.setHoveredChartPoint,
  setChartType: state.setChartType,
  setHoveredBarIndex: state.setHoveredBarIndex
}))
