import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

// 개인화 모델 정보 타입 정의 (단순화)
interface PersonalizationModelInfo {
  focus_samples_collected: number
  non_focus_samples_collected: number
  total_samples_needed: number
  completion_percentage: number
  training_status: 'idle' | 'collecting' | 'training' | 'completed' | 'error'
  last_training_date: string | null
  data_collection_session_id: string | null
  last_updated: string
  created_at: string
  actual_focus_time: number // 실제 수집된 집중 시간 (초)
  actual_non_focus_time: number // 실제 수집된 비집중 시간 (초)
}

// 실시간 데이터 수집 진행상황 타입
interface DataCollectionProgress {
  isCollecting: boolean
  currentPhase: 'focus' | 'nonfocus' | 'idle'
  focusProgress: number // 0-100
  nonFocusProgress: number // 0-100
  focusSamplesCollected: number
  nonFocusSamplesCollected: number
  totalDuration: number // 초 단위
  targetDuration: number // 초 단위
}

export const usePersonalizationModel = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isDataCollectionVisible, setIsDataCollectionVisible] = useState(false)
  
  // 실시간 데이터 수집 진행상황 상태
  const [dataCollectionProgress, setDataCollectionProgress] = useState<DataCollectionProgress>({
    isCollecting: false,
    currentPhase: 'idle',
    focusProgress: 0,
    nonFocusProgress: 0,
    focusSamplesCollected: 0,
    nonFocusSamplesCollected: 0,
    totalDuration: 0,
    targetDuration: 3600 // 약 60분 (1000개씩 수집)
  })
  
  // 개인화 모델 정보 조회
  const { data: modelInfo, isLoading, error } = useQuery({
    queryKey: ['personalization-model', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      
      const response = await fetch(`/api/profile/personalization-model?userId=${user.id}`)
      if (!response.ok) {
        throw new Error('모델 정보 조회에 실패했습니다')
      }
      return await response.json()
    },
    enabled: !!user?.id
  })
  
  // 데이터 수집 시작 (UI 열기)
  const startDataCollection = () => {
    setIsDataCollectionVisible(true)
    // 데이터 수집 시작 시 진행상황 초기화
    setDataCollectionProgress({
      isCollecting: true,
      currentPhase: 'focus',
      focusProgress: 0,
      nonFocusProgress: 0,
      focusSamplesCollected: 0,
      nonFocusSamplesCollected: 0,
      totalDuration: 0,
      targetDuration: 3600 // 약 60분 (1000개씩 수집)
    })
  }
  
  // 실시간 진행상황 업데이트 함수
  const updateDataCollectionProgress = (progress: Partial<DataCollectionProgress>) => {
    setDataCollectionProgress(prev => ({
      ...prev,
      ...progress
    }))
  }
  
  // 데이터 수집 완료 후 모델 학습 시작
  const handleDataCollectionComplete = async (data: { 
    focusDataCount: number; 
    nonFocusDataCount: number; 
    totalDataCount?: number;
  }) => {
    setIsDataCollectionVisible(false)
    
    // 진행상황 초기화
    setDataCollectionProgress({
      isCollecting: false,
      currentPhase: 'idle',
      focusProgress: 0,
      nonFocusProgress: 0,
      focusSamplesCollected: 0,
      nonFocusSamplesCollected: 0,
      totalDuration: 0,
      targetDuration: 300
    })
    
    // 모델 정보 새로고침
    queryClient.invalidateQueries({ queryKey: ['personalization-model'] })
    
    console.log(`데이터 수집 완료: 집중 ${data.focusDataCount}개, 비집중 ${data.nonFocusDataCount}개${data.totalDataCount ? ` (총 ${data.totalDataCount}개 데이터 포함)` : ''}`)
  }
  
  // 데이터 수집 취소
  const handleDataCollectionCancel = () => {
    setIsDataCollectionVisible(false)
    // 진행상황 초기화
    setDataCollectionProgress({
      isCollecting: false,
      currentPhase: 'idle',
      focusProgress: 0,
      nonFocusProgress: 0,
      focusSamplesCollected: 0,
      nonFocusSamplesCollected: 0,
      totalDuration: 0,
      targetDuration: 3600 // 약 60분 (1000개씩 수집)
    })
  }
  
  // 데이터 재수집 시작
  const recollectDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('사용자 정보가 없습니다')
      }
      
      const response = await fetch('/api/profile/personalization-model/recollect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      })
      
      if (!response.ok) {
        throw new Error('데이터 재수집에 실패했습니다')
      }
      
      return await response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['personalization-model'] })
      // 재수집 시작 후 데이터 수집 UI 열기
      setIsDataCollectionVisible(true)
      setDataCollectionProgress({
        isCollecting: true,
        currentPhase: 'focus',
        focusProgress: 0,
        nonFocusProgress: 0,
        focusSamplesCollected: 0,
        nonFocusSamplesCollected: 0,
        totalDuration: 0,
        targetDuration: 3600 // 약 60분 (1000개씩 수집)
      })
      console.log('데이터 재수집 시작됨:', data.data.message)
    }
  })
  
  // 모델 재학습 (기존 데이터로)
  const retrainModelMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('사용자 정보가 없습니다')
      }
      
      // 기존 수집된 데이터가 있는지 확인
      const modelData = modelInfo?.data as PersonalizationModelInfo
      if (!modelData || modelData.focus_samples_collected === 0 || modelData.non_focus_samples_collected === 0) {
        throw new Error('재학습할 데이터가 없습니다. 데이터를 먼저 수집해주세요.')
      }
      
      // 기존 세션 ID로 재처리
      const response = await fetch('/api/personalization/process-collected-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          sessionId: modelData.data_collection_session_id
        })
      })
      
      if (!response.ok) {
        throw new Error('모델 재학습에 실패했습니다')
      }
      
      return await response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization-model'] })
    }
  })

  // 모든 개인화 데이터 삭제
  const deleteAllDataMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('사용자 정보가 없습니다')
      }
      
      const response = await fetch('/api/personalization/delete-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API 응답 오류:', response.status, errorText)
        throw new Error(`데이터 삭제에 실패했습니다 (${response.status})`)
      }
      
      try {
        const data = await response.json()
        return data
      } catch (parseError) {
        console.error('JSON 파싱 오류:', parseError)
        throw new Error('서버 응답을 처리할 수 없습니다')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization-model'] })
      console.log('모든 개인화 데이터가 삭제되었습니다')
    },
    onError: (error) => {
      console.error('데이터 삭제 오류:', error)
    }
  })
  
  return {
    modelInfo: modelInfo?.data as PersonalizationModelInfo | null,
    isLoading,
    error,
    
    // 데이터 수집 관련
    startDataCollection,
    isDataCollectionVisible,
    handleDataCollectionComplete,
    handleDataCollectionCancel,
    
    // 실시간 진행상황
    dataCollectionProgress,
    updateDataCollectionProgress,
    
    // 데이터 재수집
    recollectData: recollectDataMutation.mutate,
    isRecollecting: recollectDataMutation.isPending,
    recollectError: recollectDataMutation.error,
    
    // 모델 재학습
    retrainModel: retrainModelMutation.mutate,
    isRetraining: retrainModelMutation.isPending,
    retrainError: retrainModelMutation.error,
    
    // 데이터 삭제
    deleteAllData: deleteAllDataMutation.mutate,
    isDeleting: deleteAllDataMutation.isPending,
    deleteError: deleteAllDataMutation.error
  }
}

export default usePersonalizationModel
