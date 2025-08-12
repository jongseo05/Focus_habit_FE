import { create } from 'zustand'

// 습관 관련 UI 상태를 위한 스토어
interface HabitUIState {
  // 현재 선택된 날짜
  selectedDate: Date
  
  // 습관 목록 필터 및 정렬
  filters: {
    status: 'all' | 'active' | 'completed' | 'paused'
    category: string | null
    sortBy: 'name' | 'created' | 'streak' | 'priority'
    sortOrder: 'asc' | 'desc'
  }
  
  // UI 상태
  ui: {
    isAddingHabit: boolean
    isEditingHabit: string | null // habit id
    selectedHabitId: string | null
    showCalendar: boolean
    sidebarCollapsed: boolean
  }
  
  // 통계 보기 설정
  statsView: {
    period: 'week' | 'month' | 'year'
    chartType: 'line' | 'bar' | 'heatmap'
  }

  // Actions
  setSelectedDate: (date: Date) => void
  updateFilters: (filters: Partial<HabitUIState['filters']>) => void
  setAddingHabit: (isAdding: boolean) => void
  setEditingHabit: (habitId: string | null) => void
  setSelectedHabit: (habitId: string | null) => void
  toggleCalendar: () => void
  toggleSidebar: () => void
  updateStatsView: (statsView: Partial<HabitUIState['statsView']>) => void
  resetFilters: () => void
}

const initialFilters = {
  status: 'all' as const,
  category: null,
  sortBy: 'created' as const,
  sortOrder: 'desc' as const,
}

export const useHabitUIStore = create<HabitUIState>((set) => ({
  selectedDate: new Date(),
  
  filters: initialFilters,
  
  ui: {
    isAddingHabit: false,
    isEditingHabit: null,
    selectedHabitId: null,
    showCalendar: false,
    sidebarCollapsed: false,
  },
  
  statsView: {
    period: 'month',
    chartType: 'line',
  },
  
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  updateFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    })),
  
  setAddingHabit: (isAdding) =>
    set((state) => ({
      ui: { ...state.ui, isAddingHabit: isAdding }
    })),
  
  setEditingHabit: (habitId) =>
    set((state) => ({
      ui: { ...state.ui, isEditingHabit: habitId }
    })),
  
  setSelectedHabit: (habitId) =>
    set((state) => ({
      ui: { ...state.ui, selectedHabitId: habitId }
    })),
  
  toggleCalendar: () =>
    set((state) => ({
      ui: { ...state.ui, showCalendar: !state.ui.showCalendar }
    })),
  
  toggleSidebar: () =>
    set((state) => ({
      ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed }
    })),
  
  updateStatsView: (newStatsView) =>
    set((state) => ({
      statsView: { ...state.statsView, ...newStatsView }
    })),
  
  resetFilters: () =>
    set((state) => ({
      filters: initialFilters
    })),
}))
