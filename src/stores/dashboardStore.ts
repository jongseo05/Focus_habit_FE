import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 대시보드 UI 상태 관리를 위한 스토어
interface DashboardUIState {
  // 웹캠 관련
  showWebcam: boolean
  showPermissionLayer: boolean
  showErrorDisplay: boolean
  
  // 차트/UI 상태
  hoveredChartPoint: number | null
  chartType: 'area' | 'line'
  // snapshotCollapsed 제거 (스냅샷 기능 삭제됨)
  
  // 애니메이션 상태
  hoveredBarIndex: number | null
  
  // 알림
  notifications: Array<{
    id: number
    message: string
    type: 'success' | 'info' | 'warning' | 'error'
  }>
}

// 대시보드 상태 (UI만)
interface DashboardState extends DashboardUIState {
  // UI 액션
  setShowWebcam: (show: boolean) => void
  setShowPermissionLayer: (show: boolean) => void
  setShowErrorDisplay: (show: boolean) => void
  setHoveredChartPoint: (index: number | null) => void
  setChartType: (type: 'area' | 'line') => void
  // toggleSnapshotCollapsed 제거 (스냅샷 기능 삭제됨)
  setHoveredBarIndex: (index: number | null) => void
  addNotification: (notification: Omit<DashboardUIState['notifications'][0], 'id'>) => void
  removeNotification: (id: number) => void
  
  // 유틸리티
  reset: () => void
  resetToInitialState: () => void
}

const initialState = {
  // UI 초기값
  showWebcam: false,
  showPermissionLayer: false,
  showErrorDisplay: false,
  hoveredChartPoint: null,
  chartType: 'area' as const,
      // snapshotCollapsed: false, // 스냅샷 기능 삭제됨
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
      
      // UI 액션
      setShowWebcam: (show: boolean) => set({ showWebcam: show }),
      setShowPermissionLayer: (show: boolean) => set({ showPermissionLayer: show }),
      setShowErrorDisplay: (show: boolean) => set({ showErrorDisplay: show }),
      setHoveredChartPoint: (index: number | null) => set({ hoveredChartPoint: index }),
      setChartType: (type: 'area' | 'line') => set({ chartType: type }),
      // toggleSnapshotCollapsed 제거 (스냅샷 기능 삭제됨)
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
      reset: () => set(initialState),
      
      // 초기 상태로 리셋 (페이지 포커스 시 사용)
      resetToInitialState: () => {
        const currentState = get()
        set({
          ...currentState,
          // UI 상태만 초기화
          hoveredChartPoint: null,
          hoveredBarIndex: null,
          showErrorDisplay: false
        })
      }
    }),
    {
      name: 'dashboard-storage',
      // 민감하지 않은 UI 상태만 저장
      partialize: (state) => ({
        chartType: state.chartType,
        // snapshotCollapsed: state.snapshotCollapsed, // 스냅샷 기능 삭제됨
        showWebcam: state.showWebcam
      })
    }
  )
)

// 페이지 포커스 시 상태 초기화
if (typeof window !== 'undefined') {
  const handleFocus = () => {
    useDashboardStore.getState().resetToInitialState()
  }
  
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      useDashboardStore.getState().resetToInitialState()
    }
  }
  
  window.addEventListener('focus', handleFocus)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

// 선택자 훅들 (성능 최적화)
export const useDashboardUI = () => useDashboardStore((state) => ({
  showWebcam: state.showWebcam,
  showPermissionLayer: state.showPermissionLayer,
  showErrorDisplay: state.showErrorDisplay,
  notifications: state.notifications,
  setShowWebcam: state.setShowWebcam,
  setShowPermissionLayer: state.setShowPermissionLayer,
  setShowErrorDisplay: state.setShowErrorDisplay,
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
