import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Brain, 
  RefreshCw, 
  TrendingUp, 
  Play, 
  AlertCircle,
  CheckCircle,
  Loader2,
  Database
} from "lucide-react"
import { usePersonalizationModel } from "@/hooks/usePersonalizationModel"
import { PersonalizationDataCollection } from "@/components/social/PersonalizationDataCollection"

export const PersonalizationTab = () => {
  const {
    modelInfo,
    isLoading,
    error,
    startDataCollection,
    isDataCollectionVisible,
    handleDataCollectionComplete,
    handleDataCollectionCancel,
    dataCollectionProgress,
    updateDataCollectionProgress,
    recollectData,
    isRecollecting,
    recollectError,
    retrainModel,
    isRetraining,
    retrainError,
    deleteAllData,
    isDeleting,
    deleteError
  } = usePersonalizationModel()

  // 시간 표시 형식 (00:00 ~ 05:00)
  const formatTimeDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 샘플 수를 시간으로 변환 (2초마다 1개 샘플 가정)
  const samplesToTime = (samples: number) => {
    return Math.min(samples * 2, 3600) // 최대 약 60분(3600초) - 1000개 기준
  }

  // 실제 수집된 시간 사용 (API에서 계산된 시간)
  const getActualTime = (type: 'focus' | 'nonfocus') => {
    if (modelInfo) {
      return type === 'focus' ? modelInfo.actual_focus_time : modelInfo.actual_non_focus_time
    }
    return 0
  }

  // 실시간 진행상황 데이터 계산
  const getRealTimeProgress = () => {
    if (dataCollectionProgress.isCollecting) {
      // 데이터 수집 중일 때는 실시간 진행상황 사용
      const focusTime = samplesToTime(dataCollectionProgress.focusSamplesCollected)
      const nonFocusTime = samplesToTime(dataCollectionProgress.nonFocusSamplesCollected)
      
      return {
        focusSamples: dataCollectionProgress.focusSamplesCollected,
        nonFocusSamples: dataCollectionProgress.nonFocusSamplesCollected,
        focusTime,
        nonFocusTime,
        focusProgress: Math.min((focusTime / 300) * 100, 100), // 5분(300초) 기준
        nonFocusProgress: Math.min((nonFocusTime / 300) * 100, 100), // 5분(300초) 기준
        completionPercentage: Math.round((Math.min((focusTime / 300) * 100, 100) + Math.min((nonFocusTime / 300) * 100, 100)) / 2),
        status: 'collecting' as const
      }
    } else {
      // 데이터 수집 중이 아닐 때는 저장된 모델 정보 사용
      const focusTime = getActualTime('focus') || samplesToTime(modelInfo?.focus_samples_collected || 0)
      const nonFocusTime = getActualTime('nonfocus') || samplesToTime(modelInfo?.non_focus_samples_collected || 0)
      
      return {
        focusSamples: modelInfo?.focus_samples_collected || 0,
        nonFocusSamples: modelInfo?.non_focus_samples_collected || 0,
        focusTime,
        nonFocusTime,
        focusProgress: Math.min((focusTime / 300) * 100, 100), // 5분(300초) 기준
        nonFocusProgress: Math.min((nonFocusTime / 300) * 100, 100), // 5분(300초) 기준
        completionPercentage: Math.round((Math.min((focusTime / 300) * 100, 100) + Math.min((nonFocusTime / 300) * 100, 100)) / 2),
        status: modelInfo?.training_status || 'idle'
      }
    }
  }

  const realTimeProgress = getRealTimeProgress()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600">모델 정보를 불러오는 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          개인화 모델 정보를 불러올 수 없습니다: {error.message}
        </AlertDescription>
      </Alert>
    )
  }

  const hasCollectedData = modelInfo && (modelInfo.focus_samples_collected > 0 || modelInfo.non_focus_samples_collected > 0)
  const canRetrain = hasCollectedData && modelInfo?.data_collection_session_id
  
  // 상태에 따른 배지 색상
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'idle': return { text: '대기중', variant: 'secondary' as const }
      case 'collecting': return { text: '수집중', variant: 'default' as const }
      case 'training': return { text: '학습중', variant: 'default' as const }
      case 'completed': return { text: '완료', variant: 'default' as const }
      case 'error': return { text: '오류', variant: 'destructive' as const }
      default: return { text: status, variant: 'secondary' as const }
    }
  }

  const statusBadge = getStatusBadge(modelInfo?.training_status || 'idle')
  
  return (
    <>
      <div className="space-y-6">
        {/* 에러 메시지 표시 */}
        {(recollectError || retrainError || deleteError) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {recollectError?.message || retrainError?.message || deleteError?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Model Status Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-purple-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                개인화 모델 상태
              </div>
              <Badge variant={statusBadge.variant}>
                {statusBadge.text}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-white/60 rounded-lg">
              <div className="text-3xl font-bold text-purple-900 mb-2">
                {realTimeProgress.completionPercentage || 0}%
              </div>
              <div className="text-sm text-purple-700">데이터 수집 완료율</div>
              <div className="text-xs text-purple-600 mt-1">
                집중: {formatTimeDisplay(realTimeProgress.focusTime || 0)} / 
                비집중: {formatTimeDisplay(realTimeProgress.nonFocusTime || 0)}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">집중 샘플 수집</span>
                <span className="text-sm font-medium text-purple-900">
                  {formatTimeDisplay(realTimeProgress.focusTime || 0)} / 60:00
                </span>
              </div>
              <Progress 
                value={realTimeProgress.focusProgress || 0} 
                className="h-2 bg-purple-200"
              />
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-purple-700">비집중 샘플 수집</span>
                <span className="text-sm font-medium text-purple-900">
                  {formatTimeDisplay(realTimeProgress.nonFocusTime || 0)} / 60:00
                </span>
              </div>
              <Progress 
                value={realTimeProgress.nonFocusProgress || 0} 
                className="h-2 bg-purple-200"
              />
            </div>

            <Separator />

            <div className="text-center">
              <div className="font-medium text-purple-900">
                {modelInfo?.last_updated 
                  ? new Date(modelInfo.last_updated).toLocaleDateString('ko-KR')
                  : '--'
                }
              </div>
              <div className="text-sm text-purple-600">마지막 업데이트</div>
              
              {modelInfo?.last_training_date && (
                <div className="mt-2">
                  <div className="font-medium text-purple-900">
                    {new Date(modelInfo.last_training_date).toLocaleDateString('ko-KR')}
                  </div>
                  <div className="text-sm text-purple-600">마지막 학습일</div>
                </div>
              )}
            </div>

            {/* 액션 버튼들 */}
            <div className="space-y-2">
              {!hasCollectedData ? (
                <Button 
                  onClick={startDataCollection}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={isRecollecting || isRetraining || isDeleting}
                >
                  <Play className="w-4 h-4 mr-2" />
                  데이터 수집 시작
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        if (confirm('정말로 모든 개인화 데이터를 삭제하고 재수집하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 기존에 수집된 모든 데이터가 삭제됩니다.')) {
                          recollectData()
                        }
                      }}
                      disabled={isRecollecting || isRetraining || isDeleting}
                    >
                      {isRecollecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      데이터 재수집
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => retrainModel()}
                      disabled={!canRetrain || isRecollecting || isRetraining || isDeleting}
                    >
                      {isRetraining ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4 mr-2" />
                      )}
                      모델 재학습
                    </Button>
                  </div>
                  
                  {/* 개인화 데이터 삭제 버튼 */}
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      if (confirm('⚠️ 경고: 수집된 모든 개인화 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 다음 데이터가 삭제됩니다:\n• 수집된 모든 개인화 데이터 (음성, 제스처, 시선 등)\n• 모델 학습을 위한 원본 데이터\n\n모델 설정 정보는 유지되며, 새로운 데이터 수집을 시작할 수 있습니다.\n\n정말로 삭제하시겠습니까?')) {
                        deleteAllData()
                      }
                    }}
                    disabled={isRecollecting || isRetraining || isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4 mr-2" />
                    )}
                    수집된 데이터 삭제
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 데이터 수집 안내 카드 */}
        {!hasCollectedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                데이터 수집 안내
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">개인화 모델 학습 과정</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>약 60분간 집중 상태로 화면을 응시합니다 (1000개 샘플 수집)</li>
                  <li>약 60분간 비집중 상태 (자유롭게 행동)를 유지합니다 (1000개 샘플 수집)</li>
                  <li>수집된 데이터가 자동으로 분석되어 개인화 모델을 생성합니다</li>
                  <li>개인화된 집중도 분석이 가능해집니다</li>
                </ol>
              </div>
              
              <div className="text-sm text-gray-600">
                <strong>수집되는 데이터:</strong> 음성 특성, 제스처, 시선 방향, 자세 등의 집중도 관련 정보만 수집되며, 
                개인을 식별할 수 있는 정보는 수집하지 않습니다.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Model Training History */}
        {hasCollectedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                모델 학습 기록
              </CardTitle>
            </CardHeader>
            <CardContent>
              {modelInfo?.last_training_date ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        modelInfo.training_status === 'completed' ? 'bg-green-500' :
                        modelInfo.training_status === 'training' ? 'bg-blue-500' :
                        modelInfo.training_status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <div className="font-medium">개인화 모델 학습</div>
                        <div className="text-sm text-gray-600">
                          {modelInfo.training_status === 'completed' ? '학습 완료' : '학습 중...'}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(modelInfo.last_training_date).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  아직 학습 기록이 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        )}


      </div>

      {/* 데이터 수집 모달 */}
      <PersonalizationDataCollection
        isVisible={isDataCollectionVisible}
        onComplete={handleDataCollectionComplete}
        onCancel={handleDataCollectionCancel}
        onProgressUpdate={updateDataCollectionProgress}
      />
    </>
  )
}
