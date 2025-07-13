import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 사용자 설정 및 기본 정보를 위한 스토어
interface UserPreferencesState {
  // 사용자 설정
  preferences: {
    theme: 'light' | 'dark' | 'system'
    language: 'ko' | 'en'
    notifications: {
      email: boolean
      push: boolean
      habitReminders: boolean
    }
  }
  
  // 온보딩 상태
  onboarding: {
    isCompleted: boolean
    currentStep: number
  }

  // Actions
  updatePreferences: (preferences: Partial<UserPreferencesState['preferences']>) => void
  updateNotificationSettings: (notifications: Partial<UserPreferencesState['preferences']['notifications']>) => void
  completeOnboarding: () => void
  setOnboardingStep: (step: number) => void
  resetUserData: () => void
}

const initialState = {
  preferences: {
    theme: 'system' as const,
    language: 'ko' as const,
    notifications: {
      email: true,
      push: true,
      habitReminders: true,
    }
  },
  onboarding: {
    isCompleted: false,
    currentStep: 0,
  }
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      ...initialState,
      
      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences }
        })),
      
      updateNotificationSettings: (newNotifications) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            notifications: { ...state.preferences.notifications, ...newNotifications }
          }
        })),
      
      completeOnboarding: () =>
        set((state) => ({
          onboarding: { ...state.onboarding, isCompleted: true }
        })),
      
      setOnboardingStep: (step) =>
        set((state) => ({
          onboarding: { ...state.onboarding, currentStep: step }
        })),
      
      resetUserData: () => set(initialState),
    }),
    {
      name: 'user-preferences-storage', // localStorage key
      // 민감하지 않은 데이터만 persist
      partialize: (state) => ({
        preferences: state.preferences,
        onboarding: state.onboarding,
      }),
    }
  )
)
