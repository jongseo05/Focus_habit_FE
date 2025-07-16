import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

// 앱 전역 상태 (성능 및 네트워크 관련)
interface AppPerformanceState {
  // 네트워크 상태
  isOnline: boolean
  networkQuality: 'good' | 'medium' | 'poor'
  lastSyncTime: number | null
  
  // 성능 모니터링
  frameRate: number
  memoryUsage: number
  renderTime: number
  
  // 에러 상태
  globalErrors: Array<{
    id: string
    message: string
    timestamp: number
    severity: 'low' | 'medium' | 'high'
    context: string
  }>
  
  // 캐시 상태
  cacheSize: number
  lastCacheCleanup: number | null
}

interface AppPerformanceActions {
  // 네트워크
  setOnlineStatus: (isOnline: boolean) => void
  updateNetworkQuality: (quality: 'good' | 'medium' | 'poor') => void
  recordSyncTime: () => void
  
  // 성능
  updateFrameRate: (fps: number) => void
  updateMemoryUsage: (usage: number) => void
  updateRenderTime: (time: number) => void
  
  // 에러 관리
  addError: (error: Omit<AppPerformanceState['globalErrors'][0], 'id' | 'timestamp'>) => void
  clearError: (id: string) => void
  clearAllErrors: () => void
  
  // 캐시 관리
  updateCacheSize: (size: number) => void
  recordCacheCleanup: () => void
  
  // 정리
  cleanup: () => void
}

export const useAppPerformanceStore = create<AppPerformanceState & AppPerformanceActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // 초기 상태
        isOnline: true,
        networkQuality: 'good',
        lastSyncTime: null,
        frameRate: 0,
        memoryUsage: 0,
        renderTime: 0,
        globalErrors: [],
        cacheSize: 0,
        lastCacheCleanup: null,
        
        // 네트워크 액션
        setOnlineStatus: (isOnline) =>
          set((state) => ({
            ...state,
            isOnline,
            networkQuality: !isOnline ? 'poor' : state.networkQuality
          })),
        
        updateNetworkQuality: (quality) =>
          set((state) => ({
            ...state,
            networkQuality: quality
          })),
        
        recordSyncTime: () =>
          set((state) => ({
            ...state,
            lastSyncTime: Date.now()
          })),
        
        // 성능 액션
        updateFrameRate: (fps) =>
          set((state) => ({
            ...state,
            frameRate: fps
          })),
        
        updateMemoryUsage: (usage) =>
          set((state) => ({
            ...state,
            memoryUsage: usage
          })),
        
        updateRenderTime: (time) =>
          set((state) => ({
            ...state,
            renderTime: time
          })),
        
        // 에러 관리 액션
        addError: (error) =>
          set((state) => {
            const newError = {
              ...error,
              id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now()
            }
            
            const updatedErrors = [...state.globalErrors, newError]
            
            // 최대 50개 에러만 유지
            return {
              ...state,
              globalErrors: updatedErrors.length > 50 ? updatedErrors.slice(-50) : updatedErrors
            }
          }),
        
        clearError: (id) =>
          set((state) => ({
            ...state,
            globalErrors: state.globalErrors.filter((errorItem) => errorItem.id !== id)
          })),
        
        clearAllErrors: () =>
          set((state) => ({
            ...state,
            globalErrors: []
          })),
        
        // 캐시 관리 액션
        updateCacheSize: (size) =>
          set((state) => ({
            ...state,
            cacheSize: size
          })),
        
        recordCacheCleanup: () =>
          set((state) => ({
            ...state,
            lastCacheCleanup: Date.now()
          })),
        
        // 정리
        cleanup: () =>
          set((state) => ({
            ...state,
            globalErrors: [],
            frameRate: 0,
            memoryUsage: 0,
            renderTime: 0
          })),
      }),
      {
        name: 'app-performance-storage',
        // 민감하지 않은 데이터만 persist
        partialize: (state) => ({
          networkQuality: state.networkQuality,
          lastSyncTime: state.lastSyncTime,
          lastCacheCleanup: state.lastCacheCleanup
        })
      }
    )
  )
)

// 성능 모니터링을 위한 선택자 훅들
export const useNetworkStatus = () => useAppPerformanceStore((state) => ({
  isOnline: state.isOnline,
  quality: state.networkQuality,
  lastSync: state.lastSyncTime,
  setOnlineStatus: state.setOnlineStatus,
  updateQuality: state.updateNetworkQuality,
  recordSync: state.recordSyncTime
}))

export const usePerformanceMetrics = () => useAppPerformanceStore((state) => ({
  frameRate: state.frameRate,
  memoryUsage: state.memoryUsage,
  renderTime: state.renderTime,
  updateFrameRate: state.updateFrameRate,
  updateMemoryUsage: state.updateMemoryUsage,
  updateRenderTime: state.updateRenderTime
}))

export const useGlobalErrors = () => useAppPerformanceStore((state) => ({
  errors: state.globalErrors,
  addError: state.addError,
  clearError: state.clearError,
  clearAllErrors: state.clearAllErrors
}))

// 성능 모니터링 훅
export function usePerformanceMonitor() {
  const { updateFrameRate, updateMemoryUsage, updateRenderTime } = usePerformanceMetrics()
  const { addError } = useGlobalErrors()
  
  // 성능 측정 유틸리티
  const measurePerformance = {
    startRenderMeasure: () => {
      const startTime = performance.now()
      return () => {
        const endTime = performance.now()
        const renderTime = endTime - startTime
        updateRenderTime(renderTime)
        
        // 느린 렌더링 감지 (16.67ms = 60fps 기준)
        if (renderTime > 16.67) {
          addError({
            message: `Slow render detected: ${renderTime.toFixed(2)}ms`,
            severity: renderTime > 33.33 ? 'high' : 'medium',
            context: 'performance-monitor'
          })
        }
      }
    },
    
    measureMemory: () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usedMB = memory.usedJSHeapSize / 1048576
        updateMemoryUsage(usedMB)
        
        // 메모리 사용량 경고 (100MB 이상)
        if (usedMB > 100) {
          addError({
            message: `High memory usage: ${usedMB.toFixed(2)}MB`,
            severity: usedMB > 200 ? 'high' : 'medium',
            context: 'memory-monitor'
          })
        }
      }
    },
    
    measureFrameRate: () => {
      let frames = 0
      let lastTime = performance.now()
      
      const measureFrame = () => {
        frames++
        const currentTime = performance.now()
        
        if (currentTime - lastTime >= 1000) {
          const fps = Math.round((frames * 1000) / (currentTime - lastTime))
          updateFrameRate(fps)
          
          // 낮은 FPS 경고
          if (fps < 30) {
            addError({
              message: `Low FPS detected: ${fps}`,
              severity: fps < 15 ? 'high' : 'medium',
              context: 'fps-monitor'
            })
          }
          
          frames = 0
          lastTime = currentTime
        }
        
        requestAnimationFrame(measureFrame)
      }
      
      measureFrame()
    }
  }
  
  return measurePerformance
}

// 네트워크 상태 모니터링 훅
export function useNetworkMonitor() {
  const { setOnlineStatus, updateQuality, recordSync } = useNetworkStatus()
  const { addError } = useGlobalErrors()
  
  // 네트워크 상태 감지
  const monitorNetwork = {
    init: () => {
      // 온라인/오프라인 상태 감지
      const handleOnline = () => {
        setOnlineStatus(true)
        recordSync()
      }
      
      const handleOffline = () => {
        setOnlineStatus(false)
        addError({
          message: 'Network connection lost',
          severity: 'high',
          context: 'network-monitor'
        })
      }
      
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      
      // 연결 품질 모니터링
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        const updateConnectionQuality = () => {
          if (connection.effectiveType === '4g') {
            updateQuality('good')
          } else if (connection.effectiveType === '3g') {
            updateQuality('medium')
          } else {
            updateQuality('poor')
          }
        }
        
        connection.addEventListener('change', updateConnectionQuality)
        updateConnectionQuality()
      }
      
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }
  
  return monitorNetwork
}
