import { useState, useEffect } from 'react'
import { generateLearningInsights, LearningInsight } from '@/lib/ai/learningInsights'

// Mock 학습 인사이트 데이터 (타입에 맞게 조정)
const mockLearningInsights: LearningInsight = {
  learningStyle: {
    type: '집중형 학습자',
    description: '짧은 시간에 높은 집중력을 발휘하는 타입입니다.',
    recommendation: '포모도로 기법과 환경 최적화를 통해 더욱 효과적인 학습이 가능합니다.',
    confidence: 85,
    characteristics: [
      '오전 시간대에 최고 효율',
      '25-45분 집중 세션 선호',
      '환경 변화에 민감',
      '목표 지향적 학습'
    ]
  },
  focusPattern: {
    peakHours: ['09:00-12:00', '19:00-22:00'],
    declinePattern: '점심 후 1-2시간 동안 집중력이 저하되는 경향',
    recommendation: '오전 골든타임을 최대한 활용하고, 오후에는 가벼운 복습 위주로 진행하세요',
    consistency: 82,
    weekdayVsWeekend: {
      weekday: 86,
      weekend: 78,
      difference: 8
    }
  },
  efficiencyAnalysis: {
    sessionLengths: [
      { duration: '25-30분', averageScore: 88, frequency: 45 },
      { duration: '45-60분', averageScore: 84, frequency: 35 },
      { duration: '60분 이상', averageScore: 79, frequency: 20 }
    ],
    recommendation: '25-30분 세션이 가장 효과적입니다. 긴 세션은 중간에 5분 휴식을 넣어주세요.',
    optimalSessionLength: '25-30분',
    efficiencyTrend: 'improving'
  },
  weeklyTrends: {
    bestDay: '화',
    worstDay: '일',
    improvement: '이번 주는 화요일에 가장 집중도가 높았고, 일요일에 가장 낮았습니다.',
    scoreVariation: 12,
    progressFromLastWeek: {
      change: 7.8,
      direction: 'up'
    }
  },
  personalizedTips: [
    { 
      category: 'schedule',
      tip: '🌟 화요일 패턴을 다른 요일에도 적용해보세요! 전날 충분한 수면과 아침 운동이 비결입니다.',
      priority: 'high',
      difficulty: 'easy',
      estimatedImpact: 8
    },
    { 
      category: 'environment',
      tip: '☕ 오전 집중 시간 전에 가벼운 스트레칭과 따뜻한 차 한 잔으로 몸을 깨우세요.',
      priority: 'medium',
      difficulty: 'easy',
      estimatedImpact: 6
    },
    { 
      category: 'focus',
      tip: '📱 집중 세션 시작 전 휴대폰을 다른 방에 두고 알림을 끄면 방해요소를 크게 줄일 수 있어요.',
      priority: 'high',
      difficulty: 'easy',
      estimatedImpact: 9
    }
  ],
  studyEnvironment: {
    timeOfDayEffectiveness: [
      { period: '06:00-09:00', score: 70, recommendation: '이른 아침, 가벼운 예습이나 복습에 적합' },
      { period: '09:00-12:00', score: 95, recommendation: '최고 집중 시간! 가장 어려운 과목을 배치하세요' },
      { period: '12:00-14:00', score: 45, recommendation: '점심 후 졸음 시간, 가벼운 정리 활동 추천' },
      { period: '14:00-17:00', score: 78, recommendation: '오후 집중 시간, 문제 풀이에 좋습니다' },
      { period: '19:00-22:00', score: 86, recommendation: '저녁 집중 시간, 심화 학습에 적합' },
      { period: '22:00-24:00', score: 62, recommendation: '늦은 시간, 가벼운 읽기나 정리 위주로' }
    ],
    sessionBreakdown: {
      shortSessions: 45,
      mediumSessions: 35,
      longSessions: 20,
      mostEffective: '25-30분'
    }
  },
  goalAchievement: {
    weeklyGoalCompletion: 95,
    streakDays: 7,
    missedDays: 0,
    targetAdjustment: '현재 목표가 적절합니다. 다음 주는 조금 더 도전적인 목표를 설정해보세요!'
  },
  comparativeAnalysis: {
    vsLastWeek: {
      focusScore: 7.8,
      studyTime: 12.5,
      consistency: 15.2
    },
    vsAverage: {
      rank: '상위 15%',
      percentile: 85
    }
  }
}

export function useLearningInsights(weeklyData: any) {
  const [insights, setInsights] = useState<LearningInsight | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!weeklyData) {
      return
    }

    const fetchInsights = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // 실제 API 호출 시도, 실패 시 mock 데이터 사용
        if (weeklyData.timeSeriesData && weeklyData.timeSeriesData.length > 0) {
          try {
            const data = await generateLearningInsights(weeklyData)
            setInsights(data)
          } catch (apiError) {
            console.log('API 호출 실패, Mock 데이터 사용:', apiError)
            setInsights(mockLearningInsights)
          }
        } else {
          // 데이터가 없으면 바로 mock 데이터 사용
          setInsights(mockLearningInsights)
        }
      } catch (err) {
        console.log('인사이트 생성 실패, Mock 데이터 사용:', err)
        setInsights(mockLearningInsights)
      } finally {
        setIsLoading(false)
      }
    }

    // 로딩 애니메이션을 위한 약간의 지연
    setTimeout(fetchInsights, 800)
  }, [weeklyData])

  return {
    insights,
    isLoading,
    error,
    refetch: () => {
      setInsights(null)
      setError(null)
      setIsLoading(true)
      setTimeout(() => {
        setInsights(mockLearningInsights)
        setIsLoading(false)
      }, 600)
    }
  }
}
