// =====================================================
// 차트 데이터 압축 및 샘플링 유틸리티
// =====================================================

interface DataPoint {
  ts: string
  score: number
  confidence?: number
  [key: string]: any
}

/**
 * 시간 기반 데이터 압축
 * 차트에 적절한 수의 데이터 포인트만 표시하도록 샘플링
 */
export function compressTimeSeriesData<T extends DataPoint>(
  data: T[],
  maxPoints: number = 30,
  compressionMethod: 'average' | 'max' | 'min' | 'latest' = 'average'
): T[] {
  if (!data || data.length === 0) return []
  if (data.length <= maxPoints) return data

  // 데이터를 시간순으로 정렬
  const sortedData = [...data].sort((a, b) => 
    new Date(a.ts).getTime() - new Date(b.ts).getTime()
  )

  // 압축 비율 계산
  const compressionRatio = Math.ceil(sortedData.length / maxPoints)
  const compressedData: T[] = []

  for (let i = 0; i < sortedData.length; i += compressionRatio) {
    const chunk = sortedData.slice(i, i + compressionRatio)
    
    if (chunk.length === 0) continue

    let representative: T
    
    switch (compressionMethod) {
      case 'max':
        representative = chunk.reduce((max, current) => 
          current.score > max.score ? current : max
        )
        break
        
      case 'min':
        representative = chunk.reduce((min, current) => 
          current.score < min.score ? current : min
        )
        break
        
      case 'latest':
        representative = chunk[chunk.length - 1]
        break
        
      case 'average':
      default:
        // 평균값 계산
        const avgScore = chunk.reduce((sum, item) => sum + item.score, 0) / chunk.length
        const avgConfidence = chunk.reduce((sum, item) => sum + (item.confidence || 0), 0) / chunk.length
        
        // 중간 시점의 데이터를 베이스로 사용
        const baseItem = chunk[Math.floor(chunk.length / 2)]
        representative = {
          ...baseItem,
          score: Math.round(avgScore * 10) / 10, // 소수점 1자리
          confidence: Math.round(avgConfidence * 100) / 100 // 소수점 2자리
        }
        break
    }
    
    compressedData.push(representative)
  }

  console.log(`📊 데이터 압축: ${sortedData.length} → ${compressedData.length} (${compressionMethod})`)
  return compressedData
}

/**
 * 적응형 데이터 압축
 * 시간 구간에 따라 다른 압축 방식 적용
 */
export function adaptiveDataCompression<T extends DataPoint>(
  data: T[],
  maxPoints: number = 30
): T[] {
  if (!data || data.length === 0) return []
  if (data.length <= maxPoints) return data

  const sortedData = [...data].sort((a, b) => 
    new Date(a.ts).getTime() - new Date(b.ts).getTime()
  )

  const totalDuration = new Date(sortedData[sortedData.length - 1].ts).getTime() - 
                       new Date(sortedData[0].ts).getTime()
  
  // 시간 구간별로 다른 압축 방식 적용
  if (totalDuration < 5 * 60 * 1000) { // 5분 미만
    // 짧은 세션: 모든 데이터 유지 (최대 20개)
    return compressTimeSeriesData(sortedData, Math.min(maxPoints, 20), 'latest')
  } else if (totalDuration < 30 * 60 * 1000) { // 30분 미만
    // 중간 세션: 평균값 사용
    return compressTimeSeriesData(sortedData, maxPoints, 'average')
  } else { // 30분 이상
    // 긴 세션: 최대값 우선 (집중도 피크 보존)
    return compressTimeSeriesData(sortedData, maxPoints, 'max')
  }
}

/**
 * 실시간 차트용 데이터 버퍼
 * 새로운 데이터가 추가될 때 자동으로 압축
 */
export class RealtimeDataBuffer<T extends DataPoint> {
  private buffer: T[] = []
  private maxBufferSize: number
  private maxDisplayPoints: number

  constructor(maxBufferSize: number = 1000, maxDisplayPoints: number = 30) {
    this.maxBufferSize = maxBufferSize
    this.maxDisplayPoints = maxDisplayPoints
  }

  /**
   * 새 데이터 포인트 추가
   */
  addDataPoint(dataPoint: T): T[] {
    this.buffer.push(dataPoint)
    
    // 버퍼 크기 제한
    if (this.buffer.length > this.maxBufferSize) {
      // 오래된 데이터의 절반 정도 제거
      const removeCount = Math.floor(this.maxBufferSize * 0.3)
      this.buffer.splice(0, removeCount)
    }

    return this.getDisplayData()
  }

  /**
   * 차트 표시용 압축된 데이터 반환
   */
  getDisplayData(): T[] {
    return adaptiveDataCompression(this.buffer, this.maxDisplayPoints)
  }

  /**
   * 전체 버퍼 데이터 반환
   */
  getRawData(): T[] {
    return [...this.buffer]
  }

  /**
   * 버퍼 초기화
   */
  clear(): void {
    this.buffer = []
  }

  /**
   * 버퍼 크기 정보
   */
  getStats(): { bufferSize: number, displaySize: number } {
    return {
      bufferSize: this.buffer.length,
      displaySize: this.getDisplayData().length
    }
  }
}

/**
 * 차트 데이터를 위한 시간 라벨 생성
 */
export function generateTimeLabels(
  data: DataPoint[],
  format: 'time' | 'duration' = 'time'
): string[] {
  if (!data || data.length === 0) return []

  const startTime = new Date(data[0].ts).getTime()

  return data.map(item => {
    const timestamp = new Date(item.ts)
    
    if (format === 'duration') {
      // 세션 시작부터의 경과 시간 (분:초)
      const elapsed = Math.floor((timestamp.getTime() - startTime) / 1000)
      const minutes = Math.floor(elapsed / 60)
      const seconds = elapsed % 60
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    } else {
      // 절대 시간 (시:분)
      return timestamp.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  })
}

/**
 * 집중도 데이터 특화 압축
 * 집중도 변화가 큰 구간은 더 세밀하게 유지
 */
export function compressFocusData<T extends DataPoint>(
  data: T[],
  maxPoints: number = 30
): T[] {
  if (!data || data.length === 0) return []
  if (data.length <= maxPoints) return data

  const sortedData = [...data].sort((a, b) => 
    new Date(a.ts).getTime() - new Date(b.ts).getTime()
  )

  // 집중도 변화량 계산
  const varianceScores = sortedData.map((item, index) => {
    if (index === 0) return 0
    
    const prevScore = sortedData[index - 1].score
    const variance = Math.abs(item.score - prevScore)
    return variance
  })

  // 변화량이 큰 구간의 데이터는 더 많이 보존
  const importantIndices = new Set<number>()
  
  // 높은 변화량 구간 선택
  const threshold = varianceScores.reduce((sum, v) => sum + v, 0) / varianceScores.length
  varianceScores.forEach((variance, index) => {
    if (variance > threshold * 1.5) {
      importantIndices.add(index)
      // 앞뒤 데이터도 포함
      if (index > 0) importantIndices.add(index - 1)
      if (index < sortedData.length - 1) importantIndices.add(index + 1)
    }
  })

  // 첫 번째와 마지막 데이터는 항상 포함
  importantIndices.add(0)
  importantIndices.add(sortedData.length - 1)

  // 중요한 데이터와 일반 데이터 분리
  const importantData = Array.from(importantIndices)
    .sort((a, b) => a - b)
    .map(index => sortedData[index])

  // 남은 포인트 수 계산
  const remainingPoints = maxPoints - importantData.length
  
  if (remainingPoints <= 0) {
    return importantData.slice(0, maxPoints)
  }

  // 일반 데이터에서 균등 샘플링
  const generalIndices = sortedData
    .map((_, index) => index)
    .filter(index => !importantIndices.has(index))

  const samplingRatio = Math.ceil(generalIndices.length / remainingPoints)
  const sampledGeneral = generalIndices
    .filter((_, index) => index % samplingRatio === 0)
    .map(index => sortedData[index])

  // 병합 및 시간순 정렬
  const result = [...importantData, ...sampledGeneral]
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  console.log(`🎯 집중도 데이터 압축: ${sortedData.length} → ${result.length} (중요: ${importantData.length}, 일반: ${sampledGeneral.length})`)
  return result
}
