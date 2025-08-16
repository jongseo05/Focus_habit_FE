// 성능 모니터링 및 최적화 유틸리티

// 메모리 사용량 모니터링
export const monitorMemoryUsage = () => {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    }
  }
  return null
}

// 페이지 가시성 상태 모니터링
export const createVisibilityMonitor = (callback: (isVisible: boolean) => void) => {
  const handleVisibilityChange = () => {
    callback(!document.hidden)
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}

// 성능 메트릭 수집
export const collectPerformanceMetrics = () => {
  const metrics: any = {}
  
  // 네비게이션 타이밍
  if ('navigation' in performance) {
    const navigation = (performance as any).navigation
    metrics.navigation = {
      type: navigation.type,
      redirectCount: navigation.redirectCount
    }
  }
  
  // 리소스 타이밍
  if ('getEntriesByType' in performance) {
    const resources = performance.getEntriesByType('resource')
    metrics.resources = resources.map((resource: any) => ({
      name: resource.name,
      duration: resource.duration,
      transferSize: resource.transferSize
    }))
  }
  
  // 메모리 사용량
  const memory = monitorMemoryUsage()
  if (memory) {
    metrics.memory = memory
  }
  
  return metrics
}

// 성능 경고 체크
export const checkPerformanceWarnings = () => {
  const warnings: string[] = []
  
  // 메모리 사용량 체크
  const memory = monitorMemoryUsage()
  if (memory && memory.usagePercentage > 80) {
    warnings.push(`메모리 사용량이 높습니다: ${memory.usagePercentage.toFixed(1)}%`)
  }
  
  // 긴 작업 체크
  if ('getEntriesByType' in performance) {
    const longTasks = performance.getEntriesByType('longtask')
    if (longTasks.length > 0) {
      warnings.push(`${longTasks.length}개의 긴 작업이 감지되었습니다`)
    }
  }
  
  return warnings
}

// 성능 최적화 권장사항
export const getPerformanceRecommendations = () => {
  const recommendations: string[] = []
  
  // 메모리 사용량 기반 권장사항
  const memory = monitorMemoryUsage()
  if (memory) {
    if (memory.usagePercentage > 70) {
      recommendations.push('메모리 사용량이 높습니다. 불필요한 컴포넌트를 언마운트하거나 캐시를 정리해보세요.')
    }
    if (memory.usagePercentage > 90) {
      recommendations.push('메모리 사용량이 매우 높습니다. 페이지를 새로고침하거나 브라우저를 재시작해보세요.')
    }
  }
  
  // 일반적인 권장사항
  recommendations.push('React Query 캐시 크기를 주기적으로 확인하고 필요시 정리하세요.')
  recommendations.push('WebSocket 연결이 불필요하게 많이 열려있는지 확인하세요.')
  recommendations.push('useEffect cleanup 함수가 제대로 구현되어 있는지 확인하세요.')
  
  return recommendations
}

// 성능 로깅
export const logPerformanceMetrics = (label: string) => {
  const metrics = collectPerformanceMetrics()
  const warnings = checkPerformanceWarnings()
  const recommendations = getPerformanceRecommendations()
  
  console.group(`🚀 성능 메트릭 - ${label}`)
  console.table(metrics)
  
  if (warnings.length > 0) {
    console.warn('⚠️ 성능 경고:', warnings)
  }
  
  if (recommendations.length > 0) {
    console.info('💡 성능 최적화 권장사항:', recommendations)
  }
  
  console.groupEnd()
  
  return { metrics, warnings, recommendations }
}

// 디바운스 유틸리티
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 쓰로틀 유틸리티
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// 메모리 누수 방지를 위한 약한 참조 맵
export class WeakRefMap<K, V extends WeakKey> {
  private map = new Map<K, WeakRef<V>>()
  private finalizationRegistry: FinalizationRegistry<K>

  constructor() {
    this.finalizationRegistry = new FinalizationRegistry((key: K) => {
      this.map.delete(key)
    })
  }

  set(key: K, value: V): this {
    this.map.set(key, new WeakRef(value))
    this.finalizationRegistry.register(value, key)
    return this
  }

  get(key: K): V | undefined {
    const ref = this.map.get(key)
    if (ref) {
      const value = ref.deref()
      if (value === undefined) {
        this.map.delete(key)
      }
      return value
    }
    return undefined
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  size(): number {
    return this.map.size
  }
}
