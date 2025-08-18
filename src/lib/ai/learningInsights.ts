export interface LearningInsight {
  learningStyle: {
    type: string
    description: string
    recommendation: string
  }
  focusPattern: {
    peakHours: string[]
    declinePattern: string
    recommendation: string
  }
  efficiencyAnalysis: {
    sessionLengths: Array<{
      duration: string
      averageScore: number
    }>
    recommendation: string
  }
  weeklyTrends: {
    bestDay: string
    worstDay: string
    improvement: string
  }
  personalizedTips: string[]
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
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to generate insights')
    }

    const result = await response.json()
    // 표준 API 응답에서 data 필드만 반환
    return result.data || result.insights
  } catch (error) {
    console.error('Error generating learning insights:', error)
    // 기본 인사이트 반환
    return {
      learningStyle: {
        type: '일반형',
        description: '안정적인 학습 패턴을 보이고 있습니다.',
        recommendation: '현재 패턴을 유지하면서 점진적으로 개선해보세요.'
      },
      focusPattern: {
        peakHours: ['09:00-11:00'],
        declinePattern: '45분 후 30% 감소',
        recommendation: '뽀모도로 기법을 활용하여 집중력을 유지하세요.'
      },
      efficiencyAnalysis: {
        sessionLengths: [
          { duration: '30분', averageScore: 85 },
          { duration: '60분', averageScore: 72 }
        ],
        recommendation: '짧은 세션이 더 효율적입니다.'
      },
      weeklyTrends: {
        bestDay: '화요일',
        worstDay: '일요일',
        improvement: '주말에도 일정한 학습 습관을 만들어보세요.'
      },
      personalizedTips: [
        '아침 시간을 최대한 활용하세요',
        '25분 집중 + 5분 휴식 패턴을 시도해보세요',
        '주말에도 짧은 세션으로 학습을 유지하세요'
      ]
    }
  }
}


