import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 사용자 설정 및 기본 정보를 위한 스토어 (안정 버전)
interface UserPreferencesState {
  preferences: {
    theme: 'light' | 'dark' | 'system'
    language: 'ko' | 'en'
    notifications: {
      email: boolean
      push: boolean
      habitReminders: boolean
    }
    // 스터디룸: 타인이 세션 시작 시 내 카메라 자동 시작 여부
    autoStartCameraOnSession: boolean
  }
  onboarding: {
    isCompleted: boolean
    currentStep: number
  }
  updatePreferences: (preferences: Partial<UserPreferencesState['preferences']>) => void
  updateNotificationSettings: (notifications: Partial<UserPreferencesState['preferences']['notifications']>) => void
  setAutoStartCameraOnSession: (value: boolean) => void
  completeOnboarding: () => void
  setOnboardingStep: (step: number) => void
  resetUserData: () => void
}

const initialState: Pick<UserPreferencesState, 'preferences' | 'onboarding'> = {
  preferences: {
    theme: 'system',
    language: 'ko',
    notifications: {
      email: true,
      push: true,
      habitReminders: true
    },
    autoStartCameraOnSession: false
  },
  onboarding: {
    isCompleted: false,
    currentStep: 0
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
      setAutoStartCameraOnSession: (value) =>
        set((state) => ({
          preferences: { ...state.preferences, autoStartCameraOnSession: value }
        })),
      completeOnboarding: () =>
        set((state) => ({
          onboarding: { ...state.onboarding, isCompleted: true }
        })),
      setOnboardingStep: (step) =>
        set((state) => ({
          onboarding: { ...state.onboarding, currentStep: step }
        })),
      resetUserData: () => set(initialState)
    }),
    {
      name: 'user-preferences-storage',
      partialize: (state) => ({
        preferences: state.preferences,
        onboarding: state.onboarding
      })
    }
  )
)
