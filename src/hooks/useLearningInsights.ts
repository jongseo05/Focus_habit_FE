import { useState, useEffect } from 'react'
import { generateLearningInsights, LearningInsight } from '@/lib/ai/learningInsights'

export function useLearningInsights(weeklyData: any) {
  const [insights, setInsights] = useState<LearningInsight | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!weeklyData || !weeklyData.timeSeriesData || weeklyData.timeSeriesData.length === 0) {
      return
    }

    const fetchInsights = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const data = await generateLearningInsights(weeklyData)
        setInsights(data)
      } catch (err) {
        setError('학습 인사이트를 불러오는데 실패했습니다.')
        console.error('Learning insights error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInsights()
  }, [weeklyData])

  return {
    insights,
    isLoading,
    error,
    refetch: () => {
      if (weeklyData) {
        setInsights(null)
        setError(null)
        setIsLoading(true)
        generateLearningInsights(weeklyData)
          .then(setInsights)
          .catch((err) => {
            setError('학습 인사이트를 불러오는데 실패했습니다.')
            console.error('Learning insights error:', err)
          })
          .finally(() => setIsLoading(false))
      }
    }
  }
}


