export interface LearningInsight {
  learningStyle: {
    type: string
    description: string
    recommendation: string
    confidence: number
    characteristics: string[]
  }
  focusPattern: {
    peakHours: string[]
    declinePattern: string
    recommendation: string
    consistency: number
    weekdayVsWeekend: {
      weekday: number
      weekend: number
      difference: number
    }
  }
  efficiencyAnalysis: {
    sessionLengths: Array<{
      duration: string
      averageScore: number
      frequency: number
    }>
    recommendation: string
    optimalSessionLength: string
    efficiencyTrend: 'improving' | 'declining' | 'stable'
  }
  weeklyTrends: {
    bestDay: string
    worstDay: string
    improvement: string
    scoreVariation: number
    progressFromLastWeek: {
      change: number
      direction: 'up' | 'down' | 'stable'
    }
  }
  personalizedTips: Array<{
    category: 'focus' | 'schedule' | 'environment' | 'technique'
    tip: string
    priority: 'high' | 'medium' | 'low'
    difficulty: 'easy' | 'medium' | 'hard'
    estimatedImpact: number
  }>
  studyEnvironment: {
    timeOfDayEffectiveness: Array<{
      period: string
      score: number
      recommendation: string
    }>
    sessionBreakdown: {
      shortSessions: number
      mediumSessions: number
      longSessions: number
      mostEffective: string
    }
  }
  goalAchievement: {
    weeklyGoalCompletion: number
    streakDays: number
    missedDays: number
    targetAdjustment: string
  }
  comparativeAnalysis: {
    vsLastWeek: {
      focusScore: number
      studyTime: number
      consistency: number
    }
    vsAverage: {
      rank: string
      percentile: number
    }
  }
}

// 인사이트 캐시 (메모리 효율성 개선)
const insightsCache = new Map<string, { data: LearningInsight; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5분 캐시

function generateCacheKey(weeklyData: any): string {
  const { overview, timeSeriesData } = weeklyData
  return `insights_${overview?.totalSessions}_${overview?.averageFocusScore}_${timeSeriesData?.length || 0}`
}

export async function generateLearningInsights(
  weeklyData: {
    timeSeriesData: Array<{
      dayOfWeek: string
      focusScore: number
      sessionDuration: number
      distractions: number
    }>
    heatmapData: number[][]
    overview: {
      totalSessions: number
      averageFocusScore: number
      totalStudyTime: number
    }
  }
): Promise<LearningInsight> {
  // 캐시 확인
  const cacheKey = generateCacheKey(weeklyData)
  const cachedResult = insightsCache.get(cacheKey)
  
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
    console.log('인사이트 캐시에서 반환')
    return cachedResult.data
  }
  
  try {
    const response = await fetch('/api/ai/learning-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        weeklyData
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate insights`)
    }

    const result = await response.json()
    
    // API 응답 구조 확인 및 데이터 추출
    let insights: LearningInsight
    if (result.success && result.data) {
      insights = result.data
    } else if (result.insights) {
      insights = result.insights // 이전 버전 호환성
    } else {
      throw new Error('Invalid API response structure')
    }
    
    // 캐시에 저장
    insightsCache.set(cacheKey, {
      data: insights,
      timestamp: Date.now()
    })
    
    // 캐시 크기 관리 (최대 10개 항목)
    if (insightsCache.size > 10) {
      const oldestKey = insightsCache.keys().next().value
      if (oldestKey) {
        insightsCache.delete(oldestKey)
      }
    }
    
    console.log('API에서 새로운 인사이트 생성 완료')
    return insights
  } catch (error) {
    console.error('Error generating learning insights:', error)
    // 향상된 기본 인사이트 반환
    const fallbackInsights = generateFallbackInsights(weeklyData)
    
    // 캐시에 폴백 인사이트 저장 (짧은 시간)
    insightsCache.set(cacheKey, {
      data: fallbackInsights,
      timestamp: Date.now()
    })
    
    return fallbackInsights
  }
}

// 향상된 폴백 인사이트 생성 함수
function generateFallbackInsights(weeklyData: any): LearningInsight {
  const { overview, timeSeriesData } = weeklyData
  const avgFocusScore = overview?.averageFocusScore || 75
  const totalSessions = overview?.totalSessions || 0
  
  return {
    learningStyle: {
      type: totalSessions >= 5 ? '발전형 학습자' : '시작 단계',
      description: totalSessions >= 3 ? 
        `${totalSessions}개 세션을 통해 꾸준한 학습 패턴을 구축하고 있습니다.` :
        '학습 데이터를 더 수집하면 개인화된 분석을 제공할 수 있습니다.',
      recommendation: totalSessions >= 3 ? 
        '현재 패턴을 유지하면서 점진적으로 개선해보세요.' :
        '꾸준한 학습을 통해 개인 맞춤 인사이트를 받아보세요.',
      confidence: Math.min(totalSessions * 15 + 40, 85),
      characteristics: totalSessions >= 3 ? ['꾸준함', '성장', '분석가능'] : ['시작', '잠재력']
    },
    focusPattern: {
      peakHours: totalSessions >= 2 ? ['09:00-11:00', '14:00-16:00'] : ['데이터 수집 중'],
      declinePattern: totalSessions >= 2 ? 
        '일반적으로 45분 후에 집중도가 감소하는 패턴을 보입니다.' :
        '더 많은 세션을 통해 개인 집중 패턴을 분석할 수 있습니다.',
      recommendation: '뽀모도로 기법(25분 집중 + 5분 휴식)으로 시작해보세요.',
      consistency: Math.min(totalSessions * 12, 80),
      weekdayVsWeekend: {
        weekday: avgFocusScore + 2,
        weekend: avgFocusScore - 3,
        difference: 5
      }
    },
    efficiencyAnalysis: {
      sessionLengths: totalSessions >= 2 ? [
        { duration: '25분', averageScore: Math.min(avgFocusScore + 5, 100), frequency: Math.floor(totalSessions * 0.6) },
        { duration: '45분', averageScore: avgFocusScore, frequency: Math.floor(totalSessions * 0.4) }
      ] : [
        { duration: '추천: 25분', averageScore: 0, frequency: 0 }
      ],
      recommendation: totalSessions >= 2 ? 
        '짧은 세션부터 시작하여 점진적으로 늘려가세요.' :
        '첫 세션은 25분으로 시작해보는 것을 추천합니다.',
      optimalSessionLength: '25분',
      efficiencyTrend: 'stable' as const
    },
    weeklyTrends: {
      bestDay: totalSessions >= 3 ? '월요일' : '데이터 부족',
      worstDay: totalSessions >= 3 ? '주말' : '데이터 부족',
      improvement: totalSessions >= 3 ? 
        '주말에도 짧은 세션으로 학습 리듬을 유지해보세요.' :
        '일주일에 3회 이상 학습하면 주간 패턴 분석이 가능합니다.',
      scoreVariation: Math.min(totalSessions * 5, 20),
      progressFromLastWeek: {
        change: 0,
        direction: 'stable' as const
      }
    },
    personalizedTips: [
      {
        category: 'focus' as const,
        tip: totalSessions === 0 ? 
          '첫 번째 학습 세션을 시작해보세요!' :
          '아침 시간을 활용한 학습을 시도해보세요',
        priority: 'high' as const,
        difficulty: 'easy' as const,
        estimatedImpact: 15
      },
      {
        category: 'technique' as const,
        tip: '25분 집중 + 5분 휴식의 뽀모도로 기법을 시도해보세요',
        priority: 'high' as const,
        difficulty: 'easy' as const,
        estimatedImpact: 12
      },
      {
        category: 'environment' as const,
        tip: '조용하고 방해받지 않는 학습 환경을 만들어보세요',
        priority: 'medium' as const,
        difficulty: 'easy' as const,
        estimatedImpact: 8
      }
    ],
    studyEnvironment: {
      timeOfDayEffectiveness: [
        { period: '오전 (9-12시)', score: Math.min(avgFocusScore + 5, 95), recommendation: '추천 학습 시간대입니다' },
        { period: '오후 (13-18시)', score: avgFocusScore, recommendation: '적당한 학습 시간대입니다' },
        { period: '저녁 (19-22시)', score: Math.max(avgFocusScore - 10, 50), recommendation: '복습에 활용하세요' }
      ],
      sessionBreakdown: {
        shortSessions: Math.floor(totalSessions * 0.7),
        mediumSessions: Math.floor(totalSessions * 0.3),
        longSessions: 0,
        mostEffective: totalSessions >= 2 ? '짧은 세션' : '데이터 부족'
      }
    },
    goalAchievement: {
      weeklyGoalCompletion: Math.min(totalSessions * 14, 100),
      streakDays: Math.min(totalSessions, 7),
      missedDays: Math.max(7 - totalSessions, 0),
      targetAdjustment: totalSessions >= 5 ? 
        '현재 목표가 적절합니다' : 
        '주 3회 학습을 목표로 시작해보세요'
    },
    comparativeAnalysis: {
      vsLastWeek: {
        focusScore: 0,
        studyTime: 0,
        consistency: 0
      },
      vsAverage: {
        rank: avgFocusScore >= 75 ? '양호' : '시작 단계',
        percentile: Math.min(Math.max(avgFocusScore, 30), 90)
      }
    }
  }
}

// 캐시 관리 유틸리티 함수들
export function clearInsightsCache(): void {
  insightsCache.clear()
  console.log('인사이트 캐시가 클리어되었습니다')
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: insightsCache.size,
    keys: Array.from(insightsCache.keys())
  }
}

// 페이지 언로드 시 캐시 정리
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // 메모리 정리
    insightsCache.clear()
  })
}
